#!/usr/bin/env bash
# Backup ALL application data on the shared cashbook Postgres (every app schema).
#
# Preferred: run on the Supabase host (192.168.0.146) via cron.
# Also works from a Mac that can reach :54322 and has the NAS mounted.
#
# Destination (SMB share AppData/Backup):
#   Host: /mnt/nas/AppData/Backup/shared-supabase/<timestamp>/
#   Mac:  /Volumes/AppData/Backup/shared-supabase/<timestamp>/
#
# Dumps:
#   - Role/globals SQL (needed to restore users/grants)
#   - Custom-format dump of database `postgres` (cashbook, exhibition, drone,
#     snorkel, photostory, tryon, georgette, metal, auth, storage metadata, …)
#   - Supabase Storage buckets (Docker volume files + storage schema in postgres.dump)
#   - cashbook config.toml when present
#   - Host .env files, Cloudflare tunnel config, nginx, systemd (host runs only)
#
# Does NOT dump `_supabase` (~100GB Logflare/analytics) unless INCLUDE_ANALYTICS=1.
#
# See docs/supabase-infrastructure.md
set -euo pipefail

usage() {
  cat <<'EOF'
Backup the shared cashbook Postgres (all apps) to the NAS Backup share.

  bash scripts/backup-shared-supabase.sh
  bash scripts/backup-shared-supabase.sh --dry-run
  bash scripts/backup-shared-supabase.sh --host-config-only

Env:
  BACKUP_ROOT          NAS Backup folder (auto-detected)
  KEEP_DAYS            Retention in days (default: 14)
  PGHOST PGPORT PGUSER PGPASSWORD
  DB_CONTAINER         default: supabase_db_cashbook
  INCLUDE_ANALYTICS=1  also dump _supabase (very large)
  SKIP_STORAGE=1       skip Docker storage volume tarball
  SKIP_HOST_CONFIG=1   skip .env / Cloudflare / nginx capture
EOF
}

DRY_RUN=false
HOST_CONFIG_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --host-config-only) HOST_CONFIG_ONLY=true; shift ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_cashbook}"
PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

utc_now() { date -u +%Y-%m-%dT%H%M%SZ; }

utc_cutoff() {
  local days="$1"
  if date -u -d "-${days} days" "+%Y-%m-%dT%H%M%SZ" >/dev/null 2>&1; then
    date -u -d "-${days} days" "+%Y-%m-%dT%H%M%SZ"
  else
    date -u -v-"${days}"d "+%Y-%m-%dT%H%M%SZ"
  fi
}

detect_backup_root() {
  if [[ -n "${BACKUP_ROOT:-}" ]]; then
    printf '%s\n' "$BACKUP_ROOT"
    return
  fi
  local candidate
  for candidate in /mnt/nas/AppData/Backup /Volumes/AppData/Backup; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  echo "NAS Backup folder not found. Mount smb://192.168.0.142/AppData/Backup" >&2
  echo "or set BACKUP_ROOT. Expected /mnt/nas/AppData/Backup or /Volumes/AppData/Backup." >&2
  exit 1
}

have_docker_db() {
  command -v docker >/dev/null 2>&1 || return 1
  docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -qx true
}

find_pg_bin() {
  local name="$1"
  local candidate
  for candidate in \
    "/opt/homebrew/opt/postgresql@15/bin/${name}" \
    "/usr/lib/postgresql/15/bin/${name}" \
    "/usr/bin/${name}"
  do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return
  fi
  echo "Missing ${name}. Install PostgreSQL 15 client tools." >&2
  exit 1
}

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file"
  else
    shasum -a 256 "$file"
  fi
}

human_size() {
  local path="$1"
  if du -h "$path" >/dev/null 2>&1; then
    du -h "$path" | awk '{print $1}'
  else
    wc -c <"$path"
  fi
}

# Copy live host secrets and network config into $1/host-config.tar.gz
collect_host_config() {
  local dest="$1"
  local tree="$dest/.host-config-tree"
  rm -rf "$tree"
  mkdir -p "$tree"
  local list="$tree/CONTENTS.txt"
  : >"$list"

  add_file() {
    local src="$1" destrel="$2"
    [[ -e "$src" ]] || return 0
    mkdir -p "$tree/$(dirname "$destrel")"
    cp -a "$src" "$tree/$destrel"
    printf '%s\n' "$destrel" >>"$list"
  }

  add_tree() {
    local src="$1" destrel="$2"
    [[ -e "$src" ]] || return 0
    mkdir -p "$tree/$(dirname "$destrel")"
    cp -a "$src" "$tree/$destrel"
    printf '%s/\n' "$destrel" >>"$list"
  }

  local f rel
  while IFS= read -r -d '' f; do
    rel="${f#/home/john/}"
    add_file "$f" "$rel"
  done < <(find /home/john/apps /home/john/appwrite -maxdepth 4 \
    \( -name '.env' -o -name '.env.local' -o -name '.env.production' -o -name '.env.production.local' \) \
    ! -name '*.example' -print0 2>/dev/null || true)

  for f in /home/john/.cloudflared/config.yml \
           /home/john/.cloudflared/cert.pem \
           /home/john/.cloudflared/*.json; do
    add_file "$f" "cloudflared-user/$(basename "$f")"
  done
  add_file /etc/cloudflared/config.yml cloudflared-etc/config.yml
  add_file /etc/systemd/system/cloudflared.service systemd/cloudflared.service

  add_file /etc/nginx/nginx.conf nginx/nginx.conf
  add_file /etc/nginx/proxy_params nginx/proxy_params
  add_file /etc/nginx/fastcgi_params nginx/fastcgi_params
  add_tree /etc/nginx/sites-available nginx/sites-available
  add_tree /etc/nginx/sites-enabled nginx/sites-enabled
  add_tree /etc/nginx/snippets nginx/snippets
  add_tree /etc/nginx/conf.d nginx/conf.d
  add_file /etc/hosts etc/hosts

  add_file /home/john/.pm2/dump.pm2 pm2/dump.pm2
  while IFS= read -r -d '' f; do
    add_file "$f" "pm2/$(basename "$(dirname "$f")")-ecosystem.config.js"
  done < <(find /home/john/apps -maxdepth 2 -name 'ecosystem.config.js' -print0 2>/dev/null || true)

  if [[ ! -s "$list" ]]; then
    echo "  no host config files found (run this on 192.168.0.146)"
    rm -rf "$tree"
    return 0
  fi

  tar -czf "$dest/host-config.tar.gz" -C "$tree" .
  rm -rf "$tree"
  echo "  host-config.tar.gz $(human_size "$dest/host-config.tar.gz")"
}

BACKUP_ROOT="$(detect_backup_root)"
DEST_ROOT="${BACKUP_ROOT%/}/shared-supabase"
STAMP="$(utc_now)"
STAGING="${DEST_ROOT}/.inprogress-${STAMP}"
FINAL="${DEST_ROOT}/${STAMP}"
LOCK_DIR="${TMPDIR:-/tmp}/shared-supabase-backup.lock"

if [[ "$DRY_RUN" == true ]]; then
  echo "backup root: $BACKUP_ROOT"
  echo "destination: $FINAL"
  echo "keep days:   $KEEP_DAYS"
  if have_docker_db; then
    echo "dump via:    docker exec $DB_CONTAINER"
  else
    echo "dump via:    pg_dump ${PGHOST:-192.168.0.146}:${PGPORT}"
  fi
  echo "analytics:   ${INCLUDE_ANALYTICS:-0}"
  echo "host config: ${SKIP_HOST_CONFIG:-0}"
  exit 0
fi

mkdir -p "$DEST_ROOT"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another backup is running (lock $LOCK_DIR)." >&2
  exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

refresh_host_config_checksums() {
  local dir="$1"
  [[ -f "$dir/host-config.tar.gz" ]] || return 0
  if [[ -f "$dir/SHA256SUMS" ]]; then
    grep -v ' host-config.tar.gz$' "$dir/SHA256SUMS" >"$dir/SHA256SUMS.tmp" || true
    mv "$dir/SHA256SUMS.tmp" "$dir/SHA256SUMS"
  else
    : >"$dir/SHA256SUMS"
  fi
  (
    cd "$dir"
    sha256_file host-config.tar.gz >>SHA256SUMS
  )
}

if [[ "$HOST_CONFIG_ONLY" == true ]]; then
  if [[ ! -f "$DEST_ROOT/latest.txt" ]]; then
    echo "No latest snapshot yet. Run a full backup first." >&2
    exit 1
  fi
  latest_dir="$DEST_ROOT/$(tr -d '[:space:]' <"$DEST_ROOT/latest.txt")"
  if [[ ! -d "$latest_dir" ]]; then
    echo "Latest snapshot missing: $latest_dir" >&2
    exit 1
  fi
  echo "→ Host config into $latest_dir"
  collect_host_config "$latest_dir"
  refresh_host_config_checksums "$latest_dir"
  echo "host-config: captured" >>"$latest_dir/MANIFEST.txt"
  echo "✓ Host config stored in $latest_dir"
  exit 0
fi

# Prefer dumping from inside the live container (matching server major version).
USE_DOCKER=false
if have_docker_db; then
  USE_DOCKER=true
  PGHOST="${PGHOST:-127.0.0.1}"
else
  # Mac clients talk to the LAN host. The Ubuntu box uses localhost.
  if [[ -z "$PGHOST" ]]; then
    if [[ "$(uname -s)" == "Linux" ]]; then
      PGHOST="127.0.0.1"
    else
      PGHOST="192.168.0.146"
    fi
  fi
fi

PG_DUMP_BIN=""
PG_DUMPALL_BIN=""
PSQL_BIN=""
if [[ "$USE_DOCKER" == false ]]; then
  PG_DUMP_BIN="$(find_pg_bin pg_dump)"
  PG_DUMPALL_BIN="$(find_pg_bin pg_dumpall)"
  PSQL_BIN="$(find_pg_bin psql)"
fi

run_psql() {
  if [[ "$USE_DOCKER" == true ]]; then
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
      psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
  else
    "$PSQL_BIN" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
  fi
}

echo "→ Shared Supabase backup ${STAMP}"
echo "  dest: $FINAL"
if [[ "$USE_DOCKER" == true ]]; then
  echo "  dump: docker exec ${DB_CONTAINER}"
else
  echo "  dump: ${PG_DUMP_BIN} → ${PGHOST}:${PGPORT}"
fi

mkdir -p "$STAGING"

# Drop stale incomplete dumps (older than 1 day).
cutoff_stale="$(utc_cutoff 1)"
shopt -s nullglob
for leftover in "$DEST_ROOT"/.inprogress-*; do
  base="$(basename "$leftover")"
  stamp="${base#.inprogress-}"
  if [[ "$stamp" < "$cutoff_stale" ]]; then
    echo "  removing stale $base"
    rm -rf "$leftover"
  fi
done
shopt -u nullglob

{
  echo "shared-supabase backup"
  echo "timestamp_utc: ${STAMP}"
  echo "hostname: $(hostname)"
  echo "source_host: ${PGHOST}:${PGPORT}"
  echo "dump_method: $([[ "$USE_DOCKER" == true ]] && echo docker-exec || echo pg-client)"
  echo "container: ${DB_CONTAINER}"
  echo "keep_days: ${KEEP_DAYS}"
  echo "include_analytics: ${INCLUDE_ANALYTICS:-0}"
  echo
} >"$STAGING/MANIFEST.txt"

echo "→ Recording schema sizes"
run_psql -c "SELECT version();" >>"$STAGING/MANIFEST.txt"
run_psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY 1;" >>"$STAGING/MANIFEST.txt"
run_psql -c "SELECT n.nspname AS schema, pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS size FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') GROUP BY 1 ORDER BY sum(pg_total_relation_size(c.oid)) DESC;" >>"$STAGING/MANIFEST.txt"

echo "→ Dumping roles / globals"
if [[ "$USE_DOCKER" == true ]]; then
  docker exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
    pg_dumpall -U "$PGUSER" --globals-only \
    | gzip -c >"$STAGING/globals.sql.gz"
else
  "$PG_DUMPALL_BIN" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --globals-only \
    | gzip -c >"$STAGING/globals.sql.gz"
fi
gzip -t "$STAGING/globals.sql.gz"
echo "  globals.sql.gz $(human_size "$STAGING/globals.sql.gz")"

echo "→ Dumping database postgres (all app schemas)"
if [[ "$USE_DOCKER" == true ]]; then
  docker exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$PGUSER" --format=custom --compress=6 --verbose postgres \
    >"$STAGING/postgres.dump" 2>"$STAGING/postgres.dump.log"
else
  "$PG_DUMP_BIN" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
    --format=custom --compress=6 --verbose \
    --file="$STAGING/postgres.dump" \
    postgres \
    2>"$STAGING/postgres.dump.log"
fi
echo "  postgres.dump $(human_size "$STAGING/postgres.dump")"

echo "→ Verifying dump table of contents"
PG_RESTORE_BIN=""
if [[ "$USE_DOCKER" == false ]]; then
  PG_RESTORE_BIN="$(find_pg_bin pg_restore)"
elif command -v pg_restore >/dev/null 2>&1; then
  PG_RESTORE_BIN="$(command -v pg_restore)"
fi
if [[ -n "$PG_RESTORE_BIN" ]]; then
  "$PG_RESTORE_BIN" --list "$STAGING/postgres.dump" >"$STAGING/postgres.toc.txt"
  toc_count="$(grep -c ' TABLE DATA ' "$STAGING/postgres.toc.txt" || true)"
  echo "  toc entries with TABLE DATA: ${toc_count}"
  echo "postgres_table_data_entries: ${toc_count}" >>"$STAGING/MANIFEST.txt"
else
  echo "  skip toc verify (no pg_restore client)"
fi

if [[ "${INCLUDE_ANALYTICS:-0}" == "1" ]]; then
  echo "→ Dumping _supabase analytics (INCLUDE_ANALYTICS=1)"
  if [[ "$USE_DOCKER" == true ]]; then
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
      pg_dump -U "$PGUSER" --format=custom --compress=6 _supabase \
      >"$STAGING/_supabase.dump"
  else
    "$PG_DUMP_BIN" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
      --format=custom --compress=6 \
      --file="$STAGING/_supabase.dump" \
      _supabase
  fi
  echo "  _supabase.dump $(human_size "$STAGING/_supabase.dump")"
else
  echo "  skip _supabase analytics (set INCLUDE_ANALYTICS=1 to include ~100GB)" >>"$STAGING/MANIFEST.txt"
fi

echo "→ Storage buckets"
{
  echo
  echo "storage_buckets:"
} >>"$STAGING/MANIFEST.txt"
run_psql -c "SELECT b.name AS bucket, b.public, count(o.id) AS objects FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id = b.id GROUP BY b.name, b.public ORDER BY 1;" >>"$STAGING/MANIFEST.txt"
db_storage_objects="$(run_psql -tAc "SELECT count(*) FROM storage.objects" | tr -d '[:space:]')"
echo "  database objects: ${db_storage_objects}"

if [[ "${SKIP_STORAGE:-0}" != "1" ]] && [[ "$USE_DOCKER" == true ]]; then
  STORAGE_VOL="$(docker volume ls -q | grep -E 'supabase_storage_.*cashbook$' || true)"
  if [[ -n "$STORAGE_VOL" ]]; then
    echo "→ Archiving storage buckets from volume ${STORAGE_VOL}"
    docker run --rm \
      -v "${STORAGE_VOL}:/data:ro" \
      -v "$STAGING:/backup" \
      alpine:3.20 \
      sh -c 'find /data -type f | wc -l | tr -d " " > /backup/storage-file-count.txt; tar -czf /backup/storage.tar.gz -C /data .'
    vol_files="$(tr -d '[:space:]' <"$STAGING/storage-file-count.txt")"
    echo "  volume files: ${vol_files}"
    echo "storage_volume_files: ${vol_files}" >>"$STAGING/MANIFEST.txt"
    echo "  storage.tar.gz $(human_size "$STAGING/storage.tar.gz")"
    if [[ "${db_storage_objects:-0}" -gt 0 && "${vol_files:-0}" -eq 0 ]]; then
      echo "Storage buckets have ${db_storage_objects} objects in Postgres but the volume has no files." >&2
      exit 1
    fi
  else
    echo "  no cashbook storage volume found — skipped" >>"$STAGING/MANIFEST.txt"
    if [[ "${db_storage_objects:-0}" -gt 0 ]]; then
      echo "Storage buckets have ${db_storage_objects} objects but supabase_storage_cashbook was not found." >&2
      exit 1
    fi
  fi
elif [[ "${db_storage_objects:-0}" -gt 0 ]]; then
  echo "  skip storage files (no Docker on this machine; cron on the host includes buckets)" >>"$STAGING/MANIFEST.txt"
  echo "  note: ${db_storage_objects} bucket objects exist; run the backup on the host to capture files"
fi

CONFIG_TOML="${SUPABASE_DIR:-$HOME/apps/cashbook/supabase}/config.toml"
if [[ -f "$CONFIG_TOML" ]]; then
  cp "$CONFIG_TOML" "$STAGING/config.toml"
fi

if [[ "${SKIP_HOST_CONFIG:-0}" != "1" ]]; then
  echo "→ Host .env files, Cloudflare, nginx"
  collect_host_config "$STAGING"
fi

echo "→ Checksums"
(
  cd "$STAGING"
  : >SHA256SUMS
  for f in globals.sql.gz postgres.dump _supabase.dump storage.tar.gz config.toml host-config.tar.gz; do
    if [[ -f "$f" ]]; then
      sha256_file "$f" >>SHA256SUMS
    fi
  done
)

{
  echo
  echo "files:"
  ls -lh "$STAGING" | sed 's/^/  /'
  echo
  echo "status: ok"
} >>"$STAGING/MANIFEST.txt"

mv "$STAGING" "$FINAL"
printf '%s\n' "$STAMP" >"$DEST_ROOT/latest.txt"
echo "  wrote $FINAL"

cutoff="$(utc_cutoff "$KEEP_DAYS")"
echo "→ Retention: removing snapshots older than ${KEEP_DAYS} days (before ${cutoff})"
shopt -s nullglob
for dir in "$DEST_ROOT"/20*; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  if [[ "$name" < "$cutoff" ]]; then
    echo "  delete $name"
    rm -rf "$dir"
  fi
done
shopt -u nullglob

echo "✓ Backup complete: $FINAL"
echo "  latest: $(cat "$DEST_ROOT/latest.txt")"

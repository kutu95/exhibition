#!/usr/bin/env bash
# Restore a shared-supabase snapshot created by backup-shared-supabase.sh.
#
# THIS REPLACES LIVE DATA. It never runs `supabase db reset` or deletes
# docker volumes. Use only for disaster recovery.
#
# Typical disaster path (empty new Postgres after data loss):
#   1. Start the cashbook stack so supabase_db_cashbook is healthy
#   2. bash scripts/restore-shared-supabase.sh --snapshot /path/to/20...Z \
#        --i-understand-this-replaces-the-live-database
#   3. If needed, tar -tzf host-config.tar.gz and copy .env / nginx / cloudflared back
set -euo pipefail

usage() {
  cat <<'EOF'
Restore a NAS snapshot of the shared cashbook Postgres.

  bash scripts/restore-shared-supabase.sh --list
  bash scripts/restore-shared-supabase.sh --snapshot /mnt/nas/AppData/Backup/shared-supabase/20...Z \
    --i-understand-this-replaces-the-live-database

Env:
  BACKUP_ROOT PGHOST PGPORT PGUSER PGPASSWORD DB_CONTAINER
EOF
}

SNAPSHOT=""
CONFIRM=false
LIST_ONLY=false
DB_CONTAINER="${DB_CONTAINER:-supabase_db_cashbook}"
PGHOST="${PGHOST:-}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --list) LIST_ONLY=true; shift ;;
    --snapshot) SNAPSHOT="${2:-}"; shift 2 ;;
    --i-understand-this-replaces-the-live-database) CONFIRM=true; shift ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

detect_backup_root() {
  if [[ -n "${BACKUP_ROOT:-}" ]]; then
    printf '%s\n' "$BACKUP_ROOT"
    return
  fi
  for candidate in /mnt/nas/AppData/Backup /Volumes/AppData/Backup; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  echo "NAS Backup folder not found." >&2
  exit 1
}

BACKUP_ROOT="$(detect_backup_root)"
DEST_ROOT="${BACKUP_ROOT%/}/shared-supabase"

if [[ "$LIST_ONLY" == true ]]; then
  echo "Snapshots in $DEST_ROOT"
  if [[ -f "$DEST_ROOT/latest.txt" ]]; then
    echo "latest: $(cat "$DEST_ROOT/latest.txt")"
  fi
  ls -1d "$DEST_ROOT"/20* 2>/dev/null || echo "(none)"
  exit 0
fi

if [[ -z "$SNAPSHOT" && -f "$DEST_ROOT/latest.txt" ]]; then
  SNAPSHOT="${DEST_ROOT}/$(cat "$DEST_ROOT/latest.txt")"
fi

if [[ -z "$SNAPSHOT" || ! -d "$SNAPSHOT" ]]; then
  echo "Snapshot directory not found. Pass --snapshot or run --list." >&2
  exit 1
fi

DUMP="$SNAPSHOT/postgres.dump"
GLOBALS="$SNAPSHOT/globals.sql.gz"
if [[ ! -f "$DUMP" ]]; then
  echo "Missing $DUMP" >&2
  exit 1
fi

if [[ "$CONFIRM" != true ]]; then
  echo "Refusing to restore. This overwrites the live shared database for every app." >&2
  echo "Re-run with --i-understand-this-replaces-the-live-database" >&2
  echo "Snapshot: $SNAPSHOT" >&2
  exit 1
fi

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
  command -v "$name"
}

USE_DOCKER=false
if have_docker_db; then
  USE_DOCKER=true
  PGHOST="${PGHOST:-127.0.0.1}"
else
  PGHOST="${PGHOST:-192.168.0.146}"
fi

echo "→ Restoring $SNAPSHOT"
echo "  THIS REPLACES LIVE DATA on ${PGHOST}:${PGPORT}"

if [[ -f "$GLOBALS" ]]; then
  echo "→ Restoring roles / globals (existing-role errors are OK)"
  if [[ "$USE_DOCKER" == true ]]; then
    gunzip -c "$GLOBALS" | docker exec -i -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
      psql -U "$PGUSER" -d postgres || true
  else
    gunzip -c "$GLOBALS" | "$(find_pg_bin psql)" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres || true
  fi
fi

echo "→ Restoring database postgres"
if [[ "$USE_DOCKER" == true ]]; then
  docker exec -i -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
    pg_restore -U "$PGUSER" -d postgres --clean --if-exists --no-owner \
    <"$DUMP"
else
  "$(find_pg_bin pg_restore)" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
    -d postgres --clean --if-exists --no-owner \
    "$DUMP"
fi

if [[ -f "$SNAPSHOT/storage.tar.gz" ]] && [[ "$USE_DOCKER" == true ]]; then
  STORAGE_VOL="$(docker volume ls -q | grep -E 'supabase_storage_.*cashbook$' || true)"
  if [[ -n "$STORAGE_VOL" ]]; then
    echo "→ Restoring storage volume ${STORAGE_VOL}"
    docker run --rm \
      -v "${STORAGE_VOL}:/data" \
      -v "$SNAPSHOT:/backup:ro" \
      alpine:3.20 \
      sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null || true; tar -xzf /backup/storage.tar.gz -C /data'
  fi
fi

echo "✓ Restore finished. Verify with: npm run db:check"
echo "  Then spot-check cashbook, exhibition, and other app schemas in Studio."

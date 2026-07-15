#!/usr/bin/env bash
# Run on the Supabase host (192.168.0.146), not on your Mac.
# See docs/supabase-infrastructure.md
# Repairs PGRST002 by restarting the stack, ensuring exhibition is in PostgREST schemas,
# and optionally applying SQL migrations from this repo.
#
# DATA SAFETY: Never runs `supabase db reset`, `docker volume rm`, or any command that
# wipes Postgres data. Migrations are additive; bootstrap SQL is skipped if exhibition exists.
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  echo "Repairs shared Supabase without resetting the database."
  echo "Never uses: supabase db reset, volume deletion, or bootstrap re-apply when schema exists."
  exit 0
fi

# Active stack on 192.168.0.146 is project "cashbook" (Studio :54323, API :54321).
# Do NOT use ~/supabase-local/supabase — that is a separate unused project/volume.
SUPABASE_DIR="${SUPABASE_DIR:-$HOME/apps/cashbook/supabase}"
EXHIBITION_REPO="${EXHIBITION_REPO:-$HOME/apps/exhibition}"
MIGRATIONS_ONLY=false
SKIP_MIGRATIONS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrations-only)
      MIGRATIONS_ONLY=true
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$SUPABASE_DIR" ]]; then
  echo "Supabase directory not found: $SUPABASE_DIR" >&2
  echo "Set SUPABASE_DIR to the running stack (default: ~/apps/cashbook/supabase)." >&2
  exit 1
fi

cd "$SUPABASE_DIR"

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'supabase_kong_cashbook'; then
  echo "Warning: supabase_kong_cashbook is not running. Confirm SUPABASE_DIR is ~/apps/cashbook/supabase." >&2
  echo "Studio admin: http://192.168.0.146:54323 (not ~/supabase-local)." >&2
fi

patch_config() {
  if grep -q '"exhibition"' config.toml 2>/dev/null; then
    echo "→ config.toml already lists exhibition schema"
    return
  fi

  if grep -q 'schemas = \[' config.toml; then
    echo "→ Adding exhibition to [api] schemas in config.toml"
    sed -i.bak 's/schemas = \[\([^]]*\)\]/schemas = [\1, "exhibition"]/' config.toml
  else
    echo "Could not find [api] schemas line in config.toml — merge supabase/config.toml from exhibition repo manually." >&2
    exit 1
  fi
}

restart_stack() {
  echo "→ Restarting Supabase (supabase stop && supabase start)"
  supabase stop
  supabase start
  echo "→ Waiting for PostgREST..."
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:54321/rest/v1/" -H "apikey: ${SUPABASE_ANON_KEY:-}" >/dev/null 2>&1; then
      echo "→ PostgREST is responding"
      return
    fi
    sleep 2
  done
  echo "PostgREST still not healthy after restart. Check: docker ps --filter name=supabase" >&2
  exit 1
}

apply_migrations() {
  if [[ "$SKIP_MIGRATIONS" == true ]]; then
    return
  fi

  if [[ ! -d "$EXHIBITION_REPO" ]]; then
    echo "Exhibition repo not found at $EXHIBITION_REPO — skipping migrations." >&2
    return
  fi

  echo "→ Applying exhibition SQL migrations from $EXHIBITION_REPO"
  DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

  schema_exists="$(psql "$DB_URL" -tAc "select exists(select 1 from information_schema.schemata where schema_name = 'exhibition')" 2>/dev/null || echo "f")"

  shopt -s nullglob
  files=("$EXHIBITION_REPO"/202*.sql)
  shopt -u nullglob

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No migration files found." >&2
    return
  fi

  for file in "${files[@]}"; do
    base="$(basename "$file")"
    if [[ "$schema_exists" == "t" && "$base" == "20260421_exhibition_schema.sql" ]]; then
      echo "  skip $base (schema already exists; bootstrap would drop data)"
      continue
    fi
    echo "  apply $base"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  done
}

if [[ "$MIGRATIONS_ONLY" == false ]]; then
  patch_config
  restart_stack
fi

apply_migrations

echo "✓ Shared Supabase repair finished. Run 'npm run db:check' from your Mac to verify."

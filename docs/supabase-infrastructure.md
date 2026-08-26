# Supabase infrastructure (Exhibition)

Canonical reference for the self-hosted Supabase stack used by this project. Read this before changing database connectivity, running repairs on the server, or debugging `PGRST002`.

## Overview

| Item | Value |
|------|--------|
| Host | `192.168.0.146` (LAN; often reached via Tailscale) |
| **Live Supabase project** | **`cashbook`** — workdir `~/apps/cashbook` on the host |
| Exhibition Postgres schema | `exhibition` |
| App REST URL (`.env.local`) | `NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321` |
| Direct Postgres (on host) | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (admin UI) | `http://192.168.0.146:54323` (e.g. `/project/default/editor/...?schema=public`) |
| Local dev app | `http://localhost:3007` |

Exhibition shares one PostgreSQL database with other apps (cashbook, tryon, drone, snorkel, photostory). Each app uses its **own schema**. Exhibition clients set `db.schema: "exhibition"` (see `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`).

## Two Supabase installations on the host (critical)

Do **not** confuse these. Only **cashbook** is the running stack for port 54321/54323.

| Path on `192.168.0.146` | `project_id` | Docker names | DB volume | Role |
|-------------------------|--------------|--------------|-----------|------|
| **`~/apps/cashbook/supabase`** | `cashbook` | `supabase_*_cashbook` | `supabase_db_cashbook` | **Production LAN stack** — repair and restart here |
| `~/supabase-local/supabase` | `supabase-local` | (not active) | `supabase_db_supabase-local` | Separate/old project; **not** what Exhibition uses |

**How to confirm you have the right stack:**

- Studio at **:54323** shows cashbook data in `public` (e.g. columns like `bill_date`).
- `docker ps` shows containers ending in `_cashbook`.
- `docker inspect supabase_rest_cashbook` includes `exhibition` in `PGRST_DB_SCHEMAS`.

Other app repos also carry their own `supabase/config.toml` (tryon, drone, etc.) for documentation; the **running** config is **`~/apps/cashbook/supabase/config.toml`**.

## Ports and services

| Port | Service | Container (cashbook) |
|------|---------|----------------------|
| 54321 | Kong → REST / Auth / Storage API | `supabase_kong_cashbook` |
| 54322 | Postgres | `supabase_db_cashbook` |
| 54323 | Studio | `supabase_studio_cashbook` |
| 54324 | Inbucket (email) | `supabase_inbucket_cashbook` |
| 54327 | Analytics | `supabase_analytics_cashbook` |

PostgREST schema list (example; verify on host after config changes):

```text
PGRST_DB_SCHEMAS=public,graphql_public,tryon_schema,drone,snorkel,photostory,exhibition
```

`[api] schemas` in **`~/apps/cashbook/supabase/config.toml`** must include `"exhibition"`. A reference merge list lives in this repo: `supabase/config.toml`.

## Exhibition app configuration

**.env.local** (developer machine):

```env
NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from cashbook stack / Studio>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Optional direct Postgres (migrations, scripts on host):

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Verify connectivity from Mac:**

```bash
npm run db:check
```

Queries `exhibition.site_content` via REST (same path as `/story`).

**Server checkout:** `~/apps/exhibition` on the host may lag behind this repo; scripts such as `scripts/repair-shared-supabase.sh` might need `git pull` or `scp` before use.

## SQL migrations

Migration files live in the **repo root** as `202*.sql` (not under `supabase/migrations/`).

| File | Notes |
|------|--------|
| `20260421_exhibition_schema.sql` | **Bootstrap** — drops and recreates all `exhibition` tables. **Never re-run** if the schema already exists. |
| `202605*.sql` | Additive migrations (safe to apply when needed) |

Apply on the host (Postgres up on :54322):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f ~/apps/exhibition/20260502_....sql
```

Or use `scripts/repair-shared-supabase.sh --migrations-only` (skips bootstrap when `exhibition` schema exists).

## Data safety (non-negotiable)

**Never run:**

- `supabase db reset`
- `docker volume rm supabase_db_cashbook` (or any `supabase_db_*` volume)
- Re-applying `20260421_exhibition_schema.sql` on a populated database

**Safe operations:**

- `supabase stop` / `supabase start` from `~/apps/cashbook`
- Removing **containers** only: `docker ps -aq --filter name=cashbook | xargs -r docker rm -f`
- Removing stale **`postmaster.pid`** when the DB crash-loops after unclean shutdown
- Additive SQL migrations
- Scheduled dumps via `scripts/backup-shared-supabase.sh` (does not modify the live volume)

## Backups (all apps)

Application data for **every schema** lives in one Postgres database (`postgres` on the cashbook stack). Back that up; do not create a separate Exhibition-only dump.

| Item | Value |
|------|--------|
| NAS share | `smb://192.168.0.142/AppData/Backup` |
| Host path | `/mnt/nas/AppData/Backup/shared-supabase/` |
| Mac path | `/Volumes/AppData/Backup/shared-supabase/` |
| Dump | Roles/globals + custom-format `postgres` (all app schemas, including `storage` bucket metadata) |
| Storage buckets | Host backups also tar the `supabase_storage_cashbook` volume (`storage.tar.gz`) — the actual files in every bucket |
| Host config | `.env` files from `~/apps`, Cloudflare tunnel (`~/.cloudflared`, `/etc/cloudflared`), nginx vhosts, `cloudflared.service`, `/etc/hosts` (`host-config.tar.gz`; host backups only) |
| Excluded by default | `_supabase` (~100GB Logflare/analytics). Set `INCLUDE_ANALYTICS=1` to include it. |
| Retention | 14 days |

Cloudflare **DNS records** live in the Cloudflare dashboard. The tunnel ingress in `config.yml` is what this box can copy.

**On the host (preferred, daily cron):**

```bash
cd ~/apps/exhibition
git pull --ff-only
bash scripts/install-shared-supabase-backup-cron.sh
# first run:
bash scripts/backup-shared-supabase.sh
```

**From a Mac** (NAS mounted at `/Volumes/AppData`, Postgres reachable on `:54322`):

```bash
npm run db:backup
```

Restore is disaster-only and requires an explicit flag. Never use `supabase db reset` as a restore:

```bash
bash scripts/restore-shared-supabase.sh --list
bash scripts/restore-shared-supabase.sh --snapshot /mnt/nas/AppData/Backup/shared-supabase/<timestamp> \
  --i-understand-this-replaces-the-live-database
```

Unpack `host-config.tar.gz` beside the database restore if you need `.env`, nginx, or Cloudflare tunnel files.

## Common failures

### `PGRST002` — Could not query the database for the schema cache

Kong/REST is up; **Postgres is not**. Typical causes:

- `supabase_db_cashbook` in `Restarting` state
- Stale lock file: `/var/lib/docker/volumes/supabase_db_cashbook/_data/postmaster.pid`

Not an Exhibition application bug. Fix on the host (cashbook stack), then `npm run db:check`.

### `supabase start` — container name already in use

Partial stop/start left orphaned `supabase_*_cashbook` containers. Remove containers (not volumes), then start again:

```bash
cd ~/apps/cashbook
docker ps -aq --filter name=cashbook | xargs -r docker rm -f
supabase start
```

### DB container crash-loop (~125ms uptime)

Often fixed by stopping the DB container and deleting stale `postmaster.pid` (see repair runbook below).

### Wrong Supabase directory

Editing or restarting `~/supabase-local/supabase` does **not** fix Exhibition; it uses a different volume and does not expose `exhibition` on the live REST API.

## Repair runbook (host)

SSH: `john@192.168.0.146`. All steps from **cashbook**:

```bash
cd ~/apps/cashbook

# Status
docker ps --filter name=supabase --format 'table {{.Names}}\t{{.Status}}'

# Crash-loop: clear stale PID (data preserved)
docker stop supabase_db_cashbook
sudo rm -f /var/lib/docker/volumes/supabase_db_cashbook/_data/postmaster.pid

# Restart
supabase stop
docker ps -aq --filter name=cashbook | xargs -r docker rm -f   # if name conflicts
supabase start

# Confirm
docker ps --filter name=supabase_db_cashbook --format '{{.Names}} {{.Status}}'
# Expect: supabase_db_cashbook Up (healthy)
```

From your Mac after repair:

```bash
npm run db:check
```

**Repair script** (in this repo; sync to server first):

```bash
bash ~/apps/exhibition/scripts/repair-shared-supabase.sh
```

Defaults: `SUPABASE_DIR=~/apps/cashbook/supabase`, `EXHIBITION_REPO=~/apps/exhibition`. Never calls `db reset`.

## Remote access (Tailscale)

Developers often reach `192.168.0.146` over Tailscale. No special Tailscale config is required beyond normal LAN routing to **54321** (API) and **54322** if tunneled. If the API is unreachable, check Tailscale connectivity to the host first, then container health on the server.

## Related docs in this repo

| Doc | Purpose |
|-----|---------|
| [image-and-fulfilment-workflow.md](./image-and-fulfilment-workflow.md) | Register photos, shop orders, print worker, Pixel Perfect |
| [supabase-multi-schema.md](./supabase-multi-schema.md) | Checklist for adding a new schema to PostgREST |
| [supabase-shared-stack.md](./supabase-shared-stack.md) | Short pointer to this document |
| `supabase/config.toml` | Reference `[api] schemas` snippet to merge on the host |
| `scripts/repair-shared-supabase.sh` | Automated repair (host only) |
| `scripts/backup-shared-supabase.sh` | Full-cluster app dump to NAS `AppData/Backup` |
| `scripts/install-shared-supabase-backup-cron.sh` | Daily 02:15 cron on the host |
| `scripts/restore-shared-supabase.sh` | Disaster restore (explicit confirm flag) |
| `scripts/check-database.mjs` | `npm run db:check` |

## History (why this doc exists)

- Exhibition initially documented `~/supabase-local/supabase`; the **live** stack is **cashbook** (`supabase_*_cashbook`, Studio :54323).
- Outage root cause: `supabase_db_cashbook` crash-loop + stale `postmaster.pid`; fixed with container cleanup and `supabase start` without volume reset.
- `PGRST002` from the Mac was PostgREST unable to reach Postgres, not a Next.js or Tailscale misconfiguration in the app.

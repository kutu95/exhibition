# Supabase: expose an app schema (single database, multiple apps)

When one PostgreSQL database hosts several apps, each app should use its **own schema** (for example `exhibition`). PostgREST must list every schema you want available through the Supabase REST API; otherwise clients see errors like “schema not configured”.

This doc is the checklist to reuse for **each new app/schema** on your stack.

## Where to edit

In the Supabase project directory for that stack (example: `~/apps/cashbook/supabase`):

```text
supabase/config.toml
```

Use your editor of choice (for example `nano config.toml` from that folder).

## What to change

Under `[api]`, ensure `schemas` includes your app schema **in addition to** the defaults you already rely on (often `public` and `graphql_public`).

Example — add `exhibition`:

```toml
[api]
schemas = ["public", "graphql_public", "exhibition"]
```

If you already expose other app schemas, append the new one to the same list — do not remove existing entries unless you intend to.

This setting maps to PostgREST’s `PGRST_DB_SCHEMAS` when containers start.

## Apply the change

From the same Supabase project root (where `supabase/config.toml` lives):

```bash
supabase stop
supabase start
```

(If you use Docker Compose only, restart the `rest` / PostgREST service for that stack the same way you usually do.)

## Verify

Container names often follow `supabase_rest_<project_id>`. Confirm `PGRST_DB_SCHEMAS` includes your schema:

```bash
docker inspect supabase_rest_cashbook --format '{{range .Config.Env}}{{println .}}{{end}}' | rg PGRST_DB_SCHEMAS
```

You should see a comma-separated list that includes your new schema name.

## App configuration reminder

- **SQL**: create the schema and objects in PostgreSQL (migrations), then grant usage/select as required for `anon` / `authenticated` / `service_role` per your RLS design.
- **Supabase JS** (`@supabase/supabase-js` / `@supabase/ssr`): set the client `db.schema` option to match (this project uses `exhibition`).

## One-line mental model

**Database schema exists in Postgres ≠ exposed to REST.** You need both: the schema in the DB **and** the name in `config.toml` `[api] schemas` (then restart).

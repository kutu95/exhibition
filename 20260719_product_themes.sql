-- Add reusable themes and many-to-many product assignments.
-- This migration is additive and safe to run once on the live exhibition schema.

begin;

create table if not exists exhibition.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint themes_name_not_blank check (btrim(name) <> ''),
  constraint themes_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists themes_name_lower_key
on exhibition.themes (lower(name));

create table if not exists exhibition.product_themes (
  product_id uuid not null references exhibition.products(id) on delete cascade,
  theme_id uuid not null references exhibition.themes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, theme_id)
);

create index if not exists product_themes_theme_id_idx
on exhibition.product_themes (theme_id);

alter table exhibition.themes enable row level security;
alter table exhibition.product_themes enable row level security;

drop policy if exists themes_public_select on exhibition.themes;
create policy themes_public_select
on exhibition.themes
for select
to anon, authenticated
using (true);

drop policy if exists product_themes_public_select on exhibition.product_themes;
create policy product_themes_public_select
on exhibition.product_themes
for select
to anon, authenticated
using (true);

grant select on exhibition.themes to anon, authenticated;
grant select on exhibition.product_themes to anon, authenticated;
grant all on exhibition.themes to service_role;
grant all on exhibition.product_themes to service_role;

commit;

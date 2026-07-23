-- Anonymous product favourites: unique per visitor for popularity tallies.
-- Additive and safe to run once on the live exhibition schema.

begin;

create table if not exists exhibition.product_favourites (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references exhibition.products(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  constraint product_favourites_visitor_id_not_blank check (btrim(visitor_id) <> ''),
  constraint product_favourites_product_visitor_unique unique (product_id, visitor_id)
);

create index if not exists idx_product_favourites_product_id
  on exhibition.product_favourites (product_id);

create index if not exists idx_product_favourites_created_at
  on exhibition.product_favourites (created_at desc);

alter table exhibition.product_favourites enable row level security;

drop policy if exists product_favourites_service_role_all on exhibition.product_favourites;
create policy product_favourites_service_role_all
  on exhibition.product_favourites
  for all
  to service_role
  using (true)
  with check (true);

grant all on exhibition.product_favourites to service_role;

commit;

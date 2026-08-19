-- Named private galleries: one gallery per product, invites scoped to a gallery.
-- Additive and safe to run once on the live exhibition schema.
-- Public products stay public (gallery_id remains null).

begin;

create table if not exists exhibition.galleries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text null,
  created_at timestamptz not null default now(),
  constraint galleries_name_not_blank check (btrim(name) <> ''),
  constraint galleries_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists galleries_name_lower_key
  on exhibition.galleries (lower(name));

insert into exhibition.galleries (name, slug, description)
select
  'Private collections',
  'private-collections',
  'Work reserved for invited collectors and guests.'
where not exists (
  select 1 from exhibition.galleries where slug = 'private-collections'
);

alter table exhibition.products
  add column if not exists gallery_id uuid;

alter table exhibition.vault_invites
  add column if not exists gallery_id uuid;

alter table exhibition.vault_access_requests
  add column if not exists gallery_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_gallery_id_fkey'
      and conrelid = 'exhibition.products'::regclass
  ) then
    alter table exhibition.products
      add constraint products_gallery_id_fkey
      foreign key (gallery_id) references exhibition.galleries(id) on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vault_invites_gallery_id_fkey'
      and conrelid = 'exhibition.vault_invites'::regclass
  ) then
    alter table exhibition.vault_invites
      add constraint vault_invites_gallery_id_fkey
      foreign key (gallery_id) references exhibition.galleries(id) on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vault_access_requests_gallery_id_fkey'
      and conrelid = 'exhibition.vault_access_requests'::regclass
  ) then
    alter table exhibition.vault_access_requests
      add constraint vault_access_requests_gallery_id_fkey
      foreign key (gallery_id) references exhibition.galleries(id) on delete restrict;
  end if;
end $$;

update exhibition.products as products
set gallery_id = galleries.id
from exhibition.galleries as galleries
where galleries.slug = 'private-collections'
  and products.visibility = 'vault'
  and products.gallery_id is null;

update exhibition.vault_invites as invites
set gallery_id = galleries.id
from exhibition.galleries as galleries
where galleries.slug = 'private-collections'
  and invites.gallery_id is null;

alter table exhibition.vault_invites
  alter column gallery_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_visibility_gallery_check'
      and conrelid = 'exhibition.products'::regclass
  ) then
    alter table exhibition.products
      add constraint products_visibility_gallery_check
      check (
        (visibility = 'public' and gallery_id is null)
        or (visibility = 'vault' and gallery_id is not null)
      );
  end if;
end $$;

create index if not exists idx_products_gallery_id
  on exhibition.products (gallery_id)
  where gallery_id is not null;

create index if not exists idx_vault_invites_gallery_id
  on exhibition.vault_invites (gallery_id);

create index if not exists idx_vault_access_requests_gallery_id
  on exhibition.vault_access_requests (gallery_id);

alter table exhibition.galleries enable row level security;

drop policy if exists galleries_service_role_all on exhibition.galleries;
create policy galleries_service_role_all
  on exhibition.galleries
  for all
  to service_role
  using (true)
  with check (true);

grant all on exhibition.galleries to service_role;

commit;

notify pgrst, 'reload schema';

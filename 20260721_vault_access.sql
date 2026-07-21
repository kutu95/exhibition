-- Private collections (vault): product visibility, invites, and access requests.
-- Additive and safe to run once on the live exhibition schema.

begin;

alter table exhibition.products
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_visibility_check'
      and conrelid = 'exhibition.products'::regclass
  ) then
    alter table exhibition.products
      add constraint products_visibility_check
      check (visibility in ('public', 'vault'));
  end if;
end $$;

create index if not exists idx_products_available_visibility
  on exhibition.products (is_available, visibility);

create table if not exists exhibition.vault_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  interest text not null,
  organisation text null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  admin_note text null,
  invite_id uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint vault_access_requests_name_not_blank check (btrim(name) <> ''),
  constraint vault_access_requests_interest_not_blank check (btrim(interest) <> ''),
  constraint vault_access_requests_email_not_blank check (btrim(email) <> '')
);

create table if not exists exhibition.vault_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  label text not null,
  email text null,
  access_request_id uuid null references exhibition.vault_access_requests(id) on delete set null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint vault_invites_label_not_blank check (btrim(label) <> ''),
  constraint vault_invites_token_hash_not_blank check (btrim(token_hash) <> '')
);

alter table exhibition.vault_access_requests
  drop constraint if exists vault_access_requests_invite_id_fkey;

alter table exhibition.vault_access_requests
  add constraint vault_access_requests_invite_id_fkey
  foreign key (invite_id) references exhibition.vault_invites(id) on delete set null;

create index if not exists idx_vault_access_requests_status_created
  on exhibition.vault_access_requests (status, created_at desc);

create index if not exists idx_vault_invites_created
  on exhibition.vault_invites (created_at desc);

alter table exhibition.vault_access_requests enable row level security;
alter table exhibition.vault_invites enable row level security;

drop policy if exists vault_access_requests_service_role_all on exhibition.vault_access_requests;
create policy vault_access_requests_service_role_all
  on exhibition.vault_access_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists vault_invites_service_role_all on exhibition.vault_invites;
create policy vault_invites_service_role_all
  on exhibition.vault_invites
  for all
  to service_role
  using (true)
  with check (true);

grant all on exhibition.vault_access_requests to service_role;
grant all on exhibition.vault_invites to service_role;

-- Public can submit requests via service-role API only; no anon insert policy.
grant select on exhibition.products to anon, authenticated;

commit;

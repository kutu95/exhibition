-- Free registration for the Marcia van Zeller public talk.
-- Additive and safe to run once on the live exhibition schema.

begin;

create table if not exists exhibition.talk_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  party_size integer not null default 1
    check (party_size >= 1 and party_size <= 10),
  list text not null default 'confirmed'
    check (list in ('confirmed', 'waitlist')),
  source text null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  constraint talk_registrations_email_not_blank check (btrim(email) <> ''),
  constraint talk_registrations_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists talk_registrations_active_email_unique
  on exhibition.talk_registrations (lower(email))
  where cancelled_at is null;

create index if not exists idx_talk_registrations_created_at
  on exhibition.talk_registrations (created_at desc);

create index if not exists idx_talk_registrations_list_created
  on exhibition.talk_registrations (list, created_at desc)
  where cancelled_at is null;

alter table exhibition.talk_registrations enable row level security;

drop policy if exists talk_registrations_service_role_all on exhibition.talk_registrations;
create policy talk_registrations_service_role_all
  on exhibition.talk_registrations
  for all
  to service_role
  using (true)
  with check (true);

grant all on exhibition.talk_registrations to service_role;

commit;

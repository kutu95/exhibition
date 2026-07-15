-- Add private ICC print profile management for server-side print generation.

begin;

create table if not exists exhibition.print_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  profile_role text not null check (profile_role in ('source', 'destination')),
  colour_space text,
  paper_type text,
  print_type text check (
    print_type is null or print_type in ('fine_art', 'photo', 'canvas', 'metal')
  ),
  filename text not null,
  original_filename text not null,
  file_size_bytes integer not null check (file_size_bytes > 0),
  storage_path text not null,
  checksum_sha256 text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_print_profiles_role_active
  on exhibition.print_profiles(profile_role, is_active);

create index if not exists idx_print_profiles_print_type
  on exhibition.print_profiles(print_type);

alter table exhibition.print_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'print_profiles'
      and policyname = 'print_profiles_service_role_all'
  ) then
    create policy print_profiles_service_role_all
      on exhibition.print_profiles
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

grant all on exhibition.print_profiles to service_role;

alter table exhibition.variant_templates
  add column if not exists source_print_profile_id uuid references exhibition.print_profiles(id) on delete restrict,
  add column if not exists destination_print_profile_id uuid references exhibition.print_profiles(id) on delete restrict;

alter table exhibition.product_variants
  add column if not exists source_print_profile_id uuid references exhibition.print_profiles(id) on delete restrict,
  add column if not exists destination_print_profile_id uuid references exhibition.print_profiles(id) on delete restrict;

commit;

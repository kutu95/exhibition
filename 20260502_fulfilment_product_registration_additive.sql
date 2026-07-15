-- Additive production migration for Photolab fulfilment/product registration.
-- Safe to run against an existing exhibition database. Does not drop or truncate data.

begin;

create extension if not exists pgcrypto;
create schema if not exists exhibition;

-- Remove the legacy location allow-list. Product locations are descriptive labels,
-- not a closed enum.
do $$
begin
  if to_regclass('exhibition.products') is not null then
    alter table exhibition.products
      drop constraint if exists products_location_tag_check;
  end if;
end $$;

-- Standard print offerings applied to newly registered products.
create table if not exists exhibition.variant_templates (
  id uuid primary key default gen_random_uuid(),
  variant_label text not null,
  width_mm integer not null,
  height_mm integer not null,
  border_mm integer not null default 0,
  paper_type text not null,
  print_type text not null,
  base_price_aud integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'variant_templates_print_type_check'
      and conrelid = 'exhibition.variant_templates'::regclass
  ) then
    alter table exhibition.variant_templates
      add constraint variant_templates_print_type_check
      check (print_type in ('fine_art', 'photo', 'canvas', 'metal'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'variant_templates_base_price_aud_check'
      and conrelid = 'exhibition.variant_templates'::regclass
  ) then
    alter table exhibition.variant_templates
      add constraint variant_templates_base_price_aud_check
      check (base_price_aud >= 0);
  end if;
end $$;

insert into exhibition.variant_templates
  (variant_label, width_mm, height_mm, border_mm, paper_type, print_type, base_price_aud, sort_order)
select
  values_table.variant_label,
  values_table.width_mm,
  values_table.height_mm,
  values_table.border_mm,
  values_table.paper_type,
  values_table.print_type,
  values_table.base_price_aud,
  values_table.sort_order
from (
  values
    ('A2 / Hahnemühle Photo Rag', 420, 594, 0, 'Hahnemühle Photo Rag 308gsm', 'fine_art', 45000, 1),
    ('A1 / Hahnemühle Photo Rag', 594, 841, 0, 'Hahnemühle Photo Rag 308gsm', 'fine_art', 65000, 2)
) as values_table(
  variant_label,
  width_mm,
  height_mm,
  border_mm,
  paper_type,
  print_type,
  base_price_aud,
  sort_order
)
where not exists (
  select 1
  from exhibition.variant_templates existing
  where existing.variant_label = values_table.variant_label
);

-- Structured print dimensions and source file metadata used by the registration API.
alter table exhibition.product_variants
  add column if not exists width_mm integer,
  add column if not exists height_mm integer,
  add column if not exists border_mm integer default 0,
  add column if not exists paper_type text,
  add column if not exists print_type text,
  add column if not exists master_filename text;

update exhibition.product_variants
set border_mm = 0
where border_mm is null;

alter table exhibition.product_variants
  alter column border_mm set default 0,
  alter column border_mm set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_print_type_check'
      and conrelid = 'exhibition.product_variants'::regclass
  ) then
    alter table exhibition.product_variants
      add constraint product_variants_print_type_check
      check (print_type is null or print_type in ('fine_art', 'photo', 'canvas', 'metal'));
  end if;
end $$;

update exhibition.product_variants pv
set
  width_mm = case
    when pv.variant_label in ('A2 / Hahnemuhle Photo Rag', 'A2 / Hahnemühle Photo Rag') then 420
    when pv.variant_label in ('A1 / Hahnemuhle Photo Rag', 'A1 / Hahnemühle Photo Rag') then 594
    else pv.width_mm
  end,
  height_mm = case
    when pv.variant_label in ('A2 / Hahnemuhle Photo Rag', 'A2 / Hahnemühle Photo Rag') then 594
    when pv.variant_label in ('A1 / Hahnemuhle Photo Rag', 'A1 / Hahnemühle Photo Rag') then 841
    else pv.height_mm
  end,
  paper_type = coalesce(pv.paper_type, 'Hahnemühle Photo Rag 308gsm'),
  print_type = coalesce(pv.print_type, 'fine_art'),
  master_filename = coalesce(pv.master_filename, 'isaac_rock_no_3.tif')
where pv.variant_label in (
  'A2 / Hahnemuhle Photo Rag',
  'A1 / Hahnemuhle Photo Rag',
  'A2 / Hahnemühle Photo Rag',
  'A1 / Hahnemühle Photo Rag'
);

-- Fulfilment tracking fields consumed by the lab queue and status update APIs.
alter table exhibition.order_items
  add column if not exists fulfilment_status text not null default 'awaiting_file',
  add column if not exists cloud_file_url text,
  add column if not exists cloud_folder_path text,
  add column if not exists pixel_perfect_order_ref text,
  add column if not exists tracking_number text,
  add column if not exists fulfilment_notes text,
  add column if not exists file_ready_at timestamptz,
  add column if not exists submitted_to_lab_at timestamptz,
  add column if not exists shipped_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_fulfilment_status_check'
      and conrelid = 'exhibition.order_items'::regclass
  ) then
    alter table exhibition.order_items
      add constraint order_items_fulfilment_status_check
      check (
        fulfilment_status in (
          'awaiting_file',
          'file_ready',
          'submitted_to_lab',
          'shipped',
          'delivered'
        )
      );
  end if;
end $$;

create table if not exists exhibition.fulfilment_events (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references exhibition.order_items(id) on delete cascade,
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fulfilment_events_order_item
  on exhibition.fulfilment_events(order_item_id);

create table if not exists exhibition.edition_locks (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references exhibition.product_variants(id) on delete cascade,
  edition_number integer not null,
  order_item_id uuid references exhibition.order_items(id) on delete set null,
  locked_at timestamptz not null default now(),
  unique (variant_id, edition_number)
);

alter table exhibition.variant_templates enable row level security;
alter table exhibition.fulfilment_events enable row level security;
alter table exhibition.edition_locks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'variant_templates'
      and policyname = 'variant_templates_public_select'
  ) then
    create policy variant_templates_public_select
      on exhibition.variant_templates
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'variant_templates'
      and policyname = 'variant_templates_service_role_all'
  ) then
    create policy variant_templates_service_role_all
      on exhibition.variant_templates
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'fulfilment_events'
      and policyname = 'fulfilment_events_service_role_all'
  ) then
    create policy fulfilment_events_service_role_all
      on exhibition.fulfilment_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'edition_locks'
      and policyname = 'edition_locks_service_role_all'
  ) then
    create policy edition_locks_service_role_all
      on exhibition.edition_locks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

grant usage on schema exhibition to anon, authenticated, service_role;
grant select on exhibition.variant_templates to anon, authenticated;
grant all on exhibition.variant_templates to service_role;
grant all on exhibition.fulfilment_events to service_role;
grant all on exhibition.edition_locks to service_role;

commit;

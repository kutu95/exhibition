-- Exhibition schema bootstrap for [YOUR EXHIBITION NAME]
-- 12-27 September 2026, Margaret River Region Open Studios (WA)

begin;

create extension if not exists pgcrypto;
create schema if not exists exhibition;

-- 1) Drop all existing tables in exhibition schema and start clean.
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'exhibition'
  loop
    execute format('drop table if exists exhibition.%I cascade', t.tablename);
  end loop;
end $$;

drop sequence if exists exhibition.order_number_seq cascade;
drop function if exists exhibition.generate_order_number() cascade;
drop function if exists exhibition.assign_order_number() cascade;
drop function if exists exhibition.update_updated_at_column() cascade;

-- 2) Core tables.
create table exhibition.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  product_type text not null check (product_type in ('print', 'merchandise')),
  location_tag text check (
    location_tag is null
    or location_tag in ('Calgardup Bay', 'Redgate Beach', 'Isaac Rock', 'SS Georgette Wreck')
  ),
  installation_tag text check (
    installation_tag is null
    or installation_tag in ('Cubarama', 'Captain Godfrey AI', 'Drift')
  ),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table exhibition.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references exhibition.products(id) on delete cascade,
  variant_label text not null,
  price_aud integer not null check (price_aud >= 0),
  edition_size integer check (edition_size is null or edition_size > 0),
  edition_number integer check (edition_number is null or edition_number > 0),
  stripe_price_id text,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (edition_size is null or edition_number is null or edition_number <= edition_size)
);

create table exhibition.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references exhibition.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false
);

create table exhibition.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  customer_email text not null,
  customer_name text,
  shipping_address jsonb,
  subtotal_aud integer check (subtotal_aud is null or subtotal_aud >= 0),
  shipping_aud integer not null default 0 check (shipping_aud >= 0),
  total_aud integer check (total_aud is null or total_aud >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exhibition.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references exhibition.orders(id) on delete cascade,
  variant_id uuid not null references exhibition.product_variants(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_aud integer not null check (unit_price_aud >= 0),
  edition_number_assigned integer check (edition_number_assigned is null or edition_number_assigned > 0)
);

create table exhibition.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  source text check (
    source is null
    or source in ('holding_page', 'shop', 'visit_page', 'footer', 'other')
  ),
  is_confirmed boolean not null default false,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table exhibition.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  event_date timestamptz not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  location_name text,
  speaker_name text,
  speaker_bio text,
  is_ticketed boolean not null default false,
  ticket_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table exhibition.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  content_value text,
  updated_at timestamptz not null default now()
);

-- 3) Indexes.
create index idx_products_slug on exhibition.products(slug);
create index idx_products_product_type on exhibition.products(product_type);
create index idx_products_available_featured on exhibition.products(is_available, is_featured);
create index idx_product_variants_product_id on exhibition.product_variants(product_id);
create index idx_product_images_product_sort on exhibition.product_images(product_id, sort_order);
create index idx_orders_payment_intent on exhibition.orders(stripe_payment_intent_id);
create index idx_orders_customer_email on exhibition.orders(customer_email);
create index idx_orders_status on exhibition.orders(status);
create index idx_order_items_order_id on exhibition.order_items(order_id);
create index idx_email_subscribers_email on exhibition.email_subscribers(email);

-- 5) Helper function and trigger for sequential order numbers.
create sequence exhibition.order_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

create or replace function exhibition.generate_order_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('exhibition.order_number_seq');
  return 'GEO-' || lpad(next_val::text, 4, '0');
end;
$$;

create or replace function exhibition.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := exhibition.generate_order_number();
  end if;
  return new;
end;
$$;

create trigger trg_orders_assign_order_number
before insert on exhibition.orders
for each row
execute function exhibition.assign_order_number();

-- 6) Generic updated_at trigger function.
create or replace function exhibition.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_orders_updated_at
before update on exhibition.orders
for each row
execute function exhibition.update_updated_at_column();

create trigger trg_site_content_updated_at
before update on exhibition.site_content
for each row
execute function exhibition.update_updated_at_column();

-- 4) Row Level Security.
alter table exhibition.products enable row level security;
alter table exhibition.product_variants enable row level security;
alter table exhibition.product_images enable row level security;
alter table exhibition.orders enable row level security;
alter table exhibition.order_items enable row level security;
alter table exhibition.email_subscribers enable row level security;
alter table exhibition.events enable row level security;
alter table exhibition.site_content enable row level security;

-- Public read policies (anon only) for content/catalog tables.
create policy products_public_select
on exhibition.products
for select
to anon
using (true);

create policy product_variants_public_select
on exhibition.product_variants
for select
to anon
using (true);

create policy product_images_public_select
on exhibition.product_images
for select
to anon
using (true);

create policy events_public_select
on exhibition.events
for select
to anon
using (true);

create policy site_content_public_select
on exhibition.site_content
for select
to anon
using (true);

-- Orders and order_items restricted to service_role.
create policy orders_service_role_all
on exhibition.orders
for all
to service_role
using (true)
with check (true);

create policy order_items_service_role_all
on exhibition.order_items
for all
to service_role
using (true)
with check (true);

-- Email subscribers: anon can insert, service_role can read.
create policy email_subscribers_anon_insert
on exhibition.email_subscribers
for insert
to anon
with check (true);

create policy email_subscribers_service_role_select
on exhibition.email_subscribers
for select
to service_role
using (true);

-- 7) Seed data.
insert into exhibition.site_content (content_key, content_value)
values
  ('location_calgarta_bay', 'Placeholder description for Calgardup Bay.'),
  ('location_redgate_beach', 'Placeholder description for Redgate Beach.'),
  ('location_isaac_rock', 'Placeholder description for Isaac Rock.'),
  ('location_ss_georgette', 'Placeholder description for SS Georgette Wreck.'),
  ('installation_cubarama', 'Placeholder description for Cubarama installation.'),
  ('installation_captain_godfrey_ai', 'Placeholder description for Captain Godfrey AI installation.'),
  ('installation_drift', 'Placeholder description for Drift installation.');

with inserted_product as (
  insert into exhibition.products (
    slug,
    title,
    description,
    product_type,
    location_tag,
    installation_tag,
    is_available,
    is_featured
  )
  values (
    'isaac-rock-no-3',
    'Isaac Rock No. 3',
    'Limited-edition fine art print from the Isaac Rock series.',
    'print',
    'Isaac Rock',
    null,
    true,
    true
  )
  returning id
)
insert into exhibition.product_variants (
  product_id,
  variant_label,
  price_aud,
  edition_size,
  stripe_price_id,
  stock_quantity,
  is_active
)
select
  ip.id,
  v.variant_label,
  v.price_aud,
  10,
  null,
  null,
  true
from inserted_product ip
cross join (
  values
    ('A2 / Hahnemuhle Photo Rag', 45000),
    ('A1 / Hahnemuhle Photo Rag', 65000)
) as v(variant_label, price_aud);

insert into exhibition.events (
  slug,
  title,
  description,
  event_date,
  duration_minutes,
  location_name,
  speaker_name,
  speaker_bio,
  is_ticketed,
  ticket_url,
  is_published
)
values (
  'the-truth-about-the-georgette',
  'The Truth About the Georgette',
  'An artist talk exploring myth, history, and photographic interpretation of the SS Georgette.',
  '2026-09-15 18:00:00+08',
  60,
  'Exhibition Venue, Prevelly',
  'Marcia van Zeller',
  'Marcia van Zeller is a photographer and storyteller focused on place, memory, and coastal histories.',
  false,
  null,
  true
);

commit;

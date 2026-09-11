-- Daily exhibition-board discount codes. One code per calendar day (Australia/Perth).
-- Additive only — safe to apply when exhibition schema already exists.

begin;

create table if not exists exhibition.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  valid_on date not null,
  percent_off integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_code_format check (
    (code ~ '^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$' or code ~ '^[A-Z0-9]{3,24}$')
    and code !~ '--'
  ),
  constraint discount_codes_percent_off check (percent_off in (10, 15, 20, 25))
);

create unique index if not exists discount_codes_valid_on_key
  on exhibition.discount_codes (valid_on);

create unique index if not exists discount_codes_code_key
  on exhibition.discount_codes (code);

comment on table exhibition.discount_codes is
  'Board codes at the exhibition. Each code is valid for a single calendar day.';
comment on column exhibition.discount_codes.valid_on is
  'Calendar date in Australia/Perth. The code works all day, including later that evening.';
comment on column exhibition.discount_codes.percent_off is
  'Percentage taken off the print subtotal at checkout.';

alter table exhibition.orders
  add column if not exists discount_code text;

alter table exhibition.orders
  add column if not exists discount_percent integer;

alter table exhibition.orders
  add column if not exists discount_amount_aud integer;

comment on column exhibition.orders.discount_code is
  'Exhibition board code applied at checkout, if any.';
comment on column exhibition.orders.discount_percent is
  'Percent off when a daily board code was used.';
comment on column exhibition.orders.discount_amount_aud is
  'Discount in AUD cents, taken off the print subtotal.';

alter table exhibition.discount_codes enable row level security;

drop policy if exists discount_codes_service_all on exhibition.discount_codes;
create policy discount_codes_service_all
  on exhibition.discount_codes
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on exhibition.discount_codes to service_role;

notify pgrst, 'reload schema';

commit;

-- On-site Square reader payments (card-present). Stripe fields stay null for these orders.
alter table exhibition.orders
  add column if not exists square_payment_id text;

create unique index if not exists idx_orders_square_payment_id
  on exhibition.orders (square_payment_id)
  where square_payment_id is not null;

comment on column exhibition.orders.square_payment_id is
  'Square POS / reader transaction id for on-site card-present sales.';

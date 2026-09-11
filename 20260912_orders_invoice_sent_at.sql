-- Customer invoice email timestamp. Additive only.

alter table exhibition.orders
  add column if not exists invoice_sent_at timestamptz;

comment on column exhibition.orders.invoice_sent_at is
  'When the customer invoice email was last sent.';

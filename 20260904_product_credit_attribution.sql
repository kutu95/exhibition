-- Optional wall-label credit / attribution on photographs.
-- Additive: nullable. Photographs without a credit are unchanged.
-- Not intended for the public shop page.

begin;

alter table exhibition.products
  add column if not exists credit_attribution text;

comment on column exhibition.products.credit_attribution is
  'Optional credit line for wall title labels, e.g. ''Credit: WA Shipwrecks Museum''. Not shown on the shop page.';

commit;

notify pgrst, 'reload schema';

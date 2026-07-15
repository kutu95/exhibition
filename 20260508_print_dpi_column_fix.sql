-- Ensure print_dpi exists for fulfilment queries and print generation.

begin;

alter table exhibition.variant_templates
  add column if not exists print_dpi integer not null default 300;

alter table exhibition.product_variants
  add column if not exists print_dpi integer not null default 300;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'variant_templates_print_dpi_check'
      and conrelid = 'exhibition.variant_templates'::regclass
  ) then
    alter table exhibition.variant_templates
      add constraint variant_templates_print_dpi_check
      check (print_dpi > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_print_dpi_check'
      and conrelid = 'exhibition.product_variants'::regclass
  ) then
    alter table exhibition.product_variants
      add constraint product_variants_print_dpi_check
      check (print_dpi > 0);
  end if;
end $$;

commit;

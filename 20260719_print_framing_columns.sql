-- Print framing: cover/crop vs custom size per product variant.

begin;

alter table exhibition.product_variants
  add column if not exists fit_mode text not null default 'cover_crop',
  add column if not exists crop_offset numeric not null default 0,
  add column if not exists size_lock text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_fit_mode_check'
      and conrelid = 'exhibition.product_variants'::regclass
  ) then
    alter table exhibition.product_variants
      add constraint product_variants_fit_mode_check
      check (fit_mode in ('cover_crop', 'custom_size'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_crop_offset_check'
      and conrelid = 'exhibition.product_variants'::regclass
  ) then
    alter table exhibition.product_variants
      add constraint product_variants_crop_offset_check
      check (crop_offset >= -1 and crop_offset <= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_size_lock_check'
      and conrelid = 'exhibition.product_variants'::regclass
  ) then
    alter table exhibition.product_variants
      add constraint product_variants_size_lock_check
      check (size_lock is null or size_lock in ('long_edge', 'width', 'height'));
  end if;
end $$;

commit;

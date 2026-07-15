-- Backfill newer print template / variant columns in older local databases.

begin;

alter table exhibition.variant_templates
  add column if not exists tier_label text,
  add column if not exists finish text,
  add column if not exists is_framed boolean not null default false,
  add column if not exists frame_type text,
  add column if not exists print_dpi integer not null default 300,
  add column if not exists lab_cost_aud integer,
  add column if not exists suggested_retail_min_aud integer,
  add column if not exists suggested_retail_max_aud integer,
  add column if not exists turnaround_days_min integer,
  add column if not exists turnaround_days_max integer,
  add column if not exists shipping_class text,
  add column if not exists fulfilment_notes text,
  add column if not exists aspect_ratio text,
  add column if not exists canvas_wrap_mm integer,
  add column if not exists wrap_style text,
  add column if not exists front_face_width_mm integer,
  add column if not exists front_face_height_mm integer,
  add column if not exists edition_size integer;

alter table exhibition.product_variants
  add column if not exists tier_label text,
  add column if not exists finish text,
  add column if not exists is_framed boolean not null default false,
  add column if not exists frame_type text,
  add column if not exists print_dpi integer not null default 300,
  add column if not exists lab_cost_aud integer,
  add column if not exists suggested_retail_min_aud integer,
  add column if not exists suggested_retail_max_aud integer,
  add column if not exists turnaround_days_min integer,
  add column if not exists turnaround_days_max integer,
  add column if not exists shipping_class text,
  add column if not exists fulfilment_notes text,
  add column if not exists aspect_ratio text,
  add column if not exists canvas_wrap_mm integer,
  add column if not exists wrap_style text,
  add column if not exists front_face_width_mm integer,
  add column if not exists front_face_height_mm integer;

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

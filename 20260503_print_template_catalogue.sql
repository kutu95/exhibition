-- Enrich print templates so the admin can manage product range, lab cost,
-- suggested retail, framing, shipping, and canvas notes.

begin;

alter table exhibition.print_profiles
  drop constraint if exists print_profiles_print_type_check;

alter table exhibition.variant_templates
  drop constraint if exists variant_templates_print_type_check;

alter table exhibition.product_variants
  drop constraint if exists product_variants_print_type_check;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'variant_templates_lab_cost_check'
      and conrelid = 'exhibition.variant_templates'::regclass
  ) then
    alter table exhibition.variant_templates
      add constraint variant_templates_lab_cost_check
      check (lab_cost_aud is null or lab_cost_aud >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'variant_templates_retail_range_check'
      and conrelid = 'exhibition.variant_templates'::regclass
  ) then
    alter table exhibition.variant_templates
      add constraint variant_templates_retail_range_check
      check (
        suggested_retail_min_aud is null
        or suggested_retail_max_aud is null
        or suggested_retail_min_aud <= suggested_retail_max_aud
      );
  end if;
end $$;

with recommended_templates as (
  select *
  from (
    values
      (
        'Tier 1 / A4 / Hahnemühle Photo Rag / Unframed',
        210, 297, 0, 'Hahnemühle Photo Rag', 'fine_art', 9500, 10, true,
        'Tier 1 - Entry / Gift', 'matte cotton', false, null,
        1750, 9500, 12000, 2, 3, 'flat-small',
        'Small enough to post flat. Confirm final paper choice against Pixel Perfect samples.',
        null, null, null, null, null
      ),
      (
        'Tier 2 / A3 / Hahnemühle Photo Rag / Unframed',
        297, 420, 0, 'Hahnemühle Photo Rag', 'fine_art', 19500, 20, true,
        'Tier 2 - Small', 'matte cotton', false, null,
        3500, 19500, 25000, 2, 3, 'flat-medium',
        'Good wall size without committing to a large piece.',
        null, null, null, null, null
      ),
      (
        'Tier 2 / A3 / Hahnemühle Photo Rag / Framed Standard',
        297, 420, 0, 'Hahnemühle Photo Rag', 'fine_art', 38000, 21, true,
        'Tier 2 - Small', 'matte cotton', true, 'Standard frame',
        17100, 38000, 45000, 2, 3, 'framed-medium',
        'Lab cost includes estimated A3 standard frame plus print. Confirm final frame colour before ordering.',
        null, null, null, null, null
      ),
      (
        'Tier 3 / A2 / Canson Rag Photographique / Unframed',
        420, 594, 0, 'Canson Rag Photographique', 'fine_art', 35000, 30, true,
        'Tier 3 - Medium', 'matte cotton, ultra smooth', false, null,
        7002, 35000, 45000, 2, 3, 'flat-large',
        'Strong option for dark water and shadow tones; review paper sample before final catalogue lock.',
        null, null, null, null, null
      ),
      (
        'Tier 3 / A2 / Canson Rag Photographique / Framed Standard',
        420, 594, 0, 'Canson Rag Photographique', 'fine_art', 58000, 31, true,
        'Tier 3 - Medium', 'matte cotton, ultra smooth', true, 'Standard frame',
        26100, 58000, 70000, 2, 3, 'framed-large',
        'Lab cost includes estimated A2 standard frame plus print. Consider Space frame if budget allows.',
        null, null, null, null, null
      ),
      (
        'Tier 4 / A2 / Hahnemühle Photo Rag Pearl / Unframed',
        420, 594, 0, 'Hahnemühle Photo Rag Pearl', 'fine_art', 45000, 40, true,
        'Tier 4 - Medium Large', 'semi-gloss cotton', false, null,
        8395, 45000, 55000, 2, 3, 'flat-large',
        'Premium A2 alternative for images where ocean light and wet rock luminosity matter.',
        null, null, null, null, null
      ),
      (
        'Tier 5 / A1 / Hahnemühle Photo Rag / Unframed',
        594, 841, 0, 'Hahnemühle Photo Rag', 'fine_art', 65000, 50, true,
        'Tier 5 - Large', 'matte cotton', false, null,
        14017, 65000, 85000, 2, 3, 'flat-oversize',
        'Statement-piece size. Consider edition size 5 to 10 per selected image.',
        null, null, null, null, 10
      ),
      (
        'Tier 5 / A1 / Hahnemühle Photo Rag / Framed Standard',
        594, 841, 0, 'Hahnemühle Photo Rag', 'fine_art', 95000, 51, true,
        'Tier 5 - Large', 'matte cotton', true, 'Standard frame',
        41900, 95000, 120000, 2, 3, 'framed-oversize',
        'Lab cost includes estimated A1 standard frame plus print. Confirm freight before quoting.',
        null, null, null, null, 10
      ),
      (
        'Tier 6 / A0 / Hahnemühle Photo Rag / Unframed',
        841, 1189, 0, 'Hahnemühle Photo Rag', 'fine_art', 120000, 60, true,
        'Tier 6 - Statement', 'matte cotton', false, null,
        28053, 120000, 180000, 2, 3, 'flat-oversize',
        'Reserve for one or two hero images. Recommended edition size 3.',
        null, null, null, null, 3
      ),
      (
        'Tier 6 / A0 / Hahnemühle Photo Rag / Framed Deluxe',
        841, 1189, 0, 'Hahnemühle Photo Rag', 'fine_art', 200000, 61, true,
        'Tier 6 - Statement', 'matte cotton', true, 'Deluxe frame',
        77900, 200000, 280000, 2, 3, 'framed-oversize',
        'Lab cost includes estimated A0 deluxe frame plus print. Confirm freight and handling before sale.',
        null, null, null, null, 3
      ),
      (
        'Canvas / 30x20 inch / Canson PhotoArt Pro Canvas / Ready to Hang',
        762, 508, 0, 'Canson PhotoArt Pro Canvas', 'canvas', 45000, 70, true,
        'Canvas - Ready to Hang', 'satin canvas', true, 'Gallery wrapped canvas with wire hanger',
        23474, 45000, 60000, 5, 7, 'canvas-ready-to-hang',
        'Use Pixel Perfect ready-to-hang canvas pricing; includes stretching, mounting, and wire hanger.',
        38, 'gallery wrap', 762, 508, null
      )
  ) as rows(
    variant_label,
    width_mm,
    height_mm,
    border_mm,
    paper_type,
    print_type,
    base_price_aud,
    sort_order,
    is_active,
    tier_label,
    finish,
    is_framed,
    frame_type,
    lab_cost_aud,
    suggested_retail_min_aud,
    suggested_retail_max_aud,
    turnaround_days_min,
    turnaround_days_max,
    shipping_class,
    fulfilment_notes,
    canvas_wrap_mm,
    wrap_style,
    front_face_width_mm,
    front_face_height_mm,
    edition_size
  )
)
insert into exhibition.variant_templates (
  variant_label,
  width_mm,
  height_mm,
  border_mm,
  paper_type,
  print_type,
  base_price_aud,
  sort_order,
  is_active,
  tier_label,
  finish,
  is_framed,
  frame_type,
  lab_cost_aud,
  suggested_retail_min_aud,
  suggested_retail_max_aud,
  turnaround_days_min,
  turnaround_days_max,
  shipping_class,
  fulfilment_notes,
  canvas_wrap_mm,
  wrap_style,
  front_face_width_mm,
  front_face_height_mm,
  edition_size,
  source_print_profile_id,
  destination_print_profile_id
)
select
  variant_label,
  width_mm,
  height_mm,
  border_mm,
  paper_type,
  print_type::text,
  base_price_aud,
  sort_order,
  is_active,
  tier_label,
  finish,
  is_framed,
  frame_type,
  lab_cost_aud,
  suggested_retail_min_aud,
  suggested_retail_max_aud,
  turnaround_days_min,
  turnaround_days_max,
  shipping_class,
  fulfilment_notes,
  canvas_wrap_mm,
  wrap_style,
  front_face_width_mm,
  front_face_height_mm,
  edition_size,
  null,
  null
from recommended_templates rt
where not exists (
  select 1
  from exhibition.variant_templates existing
  where existing.variant_label = rt.variant_label
);

commit;

-- Public catalogue/content pages should read the same rows for anonymous visitors
-- and browsers that happen to carry Supabase authenticated-role cookies.

begin;

drop policy if exists products_public_select on exhibition.products;
create policy products_public_select
on exhibition.products
for select
to anon, authenticated
using (true);

drop policy if exists product_variants_public_select on exhibition.product_variants;
create policy product_variants_public_select
on exhibition.product_variants
for select
to anon, authenticated
using (true);

drop policy if exists product_images_public_select on exhibition.product_images;
create policy product_images_public_select
on exhibition.product_images
for select
to anon, authenticated
using (true);

drop policy if exists events_public_select on exhibition.events;
create policy events_public_select
on exhibition.events
for select
to anon, authenticated
using (true);

drop policy if exists site_content_public_select on exhibition.site_content;
create policy site_content_public_select
on exhibition.site_content
for select
to anon, authenticated
using (true);

drop policy if exists variant_templates_public_select on exhibition.variant_templates;
create policy variant_templates_public_select
on exhibition.variant_templates
for select
to anon, authenticated
using (true);

drop policy if exists media_files_public_select on exhibition.media_files;
create policy media_files_public_select
on exhibition.media_files
for select
to anon, authenticated
using (true);

grant select on exhibition.products to anon, authenticated;
grant select on exhibition.product_variants to anon, authenticated;
grant select on exhibition.product_images to anon, authenticated;
grant select on exhibition.events to anon, authenticated;
grant select on exhibition.site_content to anon, authenticated;
grant select on exhibition.variant_templates to anon, authenticated;
grant select on exhibition.media_files to anon, authenticated;

commit;

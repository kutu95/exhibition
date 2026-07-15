-- Add a photo capture/type tag for product registration and admin editing.
-- This replaces the admin-facing use of installation_tag for still photographs.

begin;

alter table exhibition.products
  add column if not exists photo_type_tag text check (
    photo_type_tag is null
    or photo_type_tag in ('Still camera', 'Drone', 'Underwater')
  );

commit;

begin;

create table if not exists exhibition.media_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  original_filename text not null,
  file_type text not null check (file_type in ('image', 'video')),
  mime_type text not null,
  file_size_bytes integer not null,
  url_path text not null,
  width integer,
  height integer,
  duration_seconds integer,
  alt_text text,
  usage_note text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_media_files_type on exhibition.media_files(file_type);
create index if not exists idx_media_files_uploaded_at on exhibition.media_files(uploaded_at);

alter table exhibition.media_files enable row level security;

drop policy if exists media_files_service_role_all on exhibition.media_files;
create policy media_files_service_role_all
on exhibition.media_files
for all
to service_role
using (true)
with check (true);

alter table exhibition.site_content
  add column if not exists content_type text not null default 'text';

alter table exhibition.site_content
  add column if not exists media_file_id uuid references exhibition.media_files(id) on delete set null;

insert into exhibition.site_content (content_key, content_value, content_type)
values
  ('hero_headline', 'Where the Georgette Went Down', 'text'),
  ('hero_subheadline', 'A photography exhibition · 12–27 September 2026', 'text'),
  ('hero_background_image', '', 'image'),
  ('hero_video', '', 'video'),
  (
    'holding_page_body',
    'On 12 January 1876, the steamship Georgette foundered off Redgate Beach on the south-west coast of Western Australia. Seven people drowned. A captain''s reputation was destroyed. This exhibition returns to the site — Calgardup Bay, Redgate Beach, Isaac Rock — one hundred and fifty years later.',
    'text'
  ),
  ('story_intro', '', 'text'),
  ('visit_hours', '', 'text'),
  ('visit_address', '', 'text'),
  ('visit_parking', '', 'text'),
  (
    'installation_cubarama',
    'A four-wall 360° immersive video room. Stand at the centre of the coast, the wreck, the weather.',
    'text'
  ),
  (
    'installation_captain_godfrey_ai',
    'Speak directly with an AI-driven MetaHuman of Captain John Godfrey — the man whose certificate was suspended after seven of his passengers drowned.',
    'text'
  ),
  ('installation_drift', 'A Kinect-driven interactive display. Move through the photographs with your body.', 'text'),
  ('location_calgardup_bay', 'The bay where the Georgette came to rest.', 'text'),
  ('location_redgate_beach', 'The beach where Grace Bussell and Sam Isaacs rode into the surf.', 'text'),
  ('location_isaac_rock', 'The reef that tore the hull open.', 'text'),
  ('location_ss_georgette', 'The wreck site, 150 years on.', 'text')
on conflict (content_key) do nothing;

commit;

-- Allow public pages to read media metadata linked from site_content.
-- The files themselves are already public under /images and /video.

begin;

alter table exhibition.media_files enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'exhibition'
      and tablename = 'media_files'
      and policyname = 'media_files_public_select'
  ) then
    create policy media_files_public_select
      on exhibition.media_files
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

grant select on exhibition.media_files to anon, authenticated;

commit;

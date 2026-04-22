begin;

insert into exhibition.site_content (content_key, content_value, content_type)
values ('story_hero_image', '', 'image')
on conflict (content_key) do nothing;

commit;

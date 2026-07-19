-- Add an admin-managed portrait/image for Marcia van Zeller's author talk.
-- Additive and safe to run repeatedly.

insert into exhibition.site_content (content_key, content_value, content_type)
values ('author_talk_image', '', 'image')
on conflict (content_key) do nothing;

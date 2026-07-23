-- Admin-editable talk seat capacity (default 40).
-- Additive and safe to run once on the live exhibition schema.

begin;

insert into exhibition.site_content (content_key, content_value, content_type)
values ('talk_capacity', '40', 'text')
on conflict (content_key) do nothing;

commit;

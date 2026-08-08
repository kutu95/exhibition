-- Shorten home meta title so it fits typical SERP pixel budgets (~580px).
-- Additive and safe to re-run.

begin;

update exhibition.site_content
set content_value = 'The Georgette 150th Exhibition | John Bowskill'
where content_key = 'seo_home_title'
  and content_value = 'The Georgette 150th Anniversary Photographic Exhibition | John Bowskill';

insert into exhibition.site_content (content_key, content_value, content_type)
values (
  'seo_home_title',
  'The Georgette 150th Exhibition | John Bowskill',
  'text'
)
on conflict (content_key) do nothing;

commit;

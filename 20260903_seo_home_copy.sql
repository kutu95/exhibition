-- Homepage title/description for search and social previews.
-- Additive and safe to re-run.

begin;

update exhibition.site_content
set content_value = 'John Bowskill Photography — SS Georgette Exhibition | Margaret River'
where content_key = 'seo_home_title';

insert into exhibition.site_content (content_key, content_value, content_type)
values (
  'seo_home_title',
  'John Bowskill Photography — SS Georgette Exhibition | Margaret River',
  'text'
)
on conflict (content_key) do nothing;

update exhibition.site_content
set content_value = 'A photography and immersive historical exhibition by Margaret River photographer John Bowskill commemorating 150 years since the wreck of the SS Georgette at Redgate Beach, Western Australia. Part of Margaret River Region Open Studios 2026.'
where content_key = 'seo_home_description';

insert into exhibition.site_content (content_key, content_value, content_type)
values (
  'seo_home_description',
  'A photography and immersive historical exhibition by Margaret River photographer John Bowskill commemorating 150 years since the wreck of the SS Georgette at Redgate Beach, Western Australia. Part of Margaret River Region Open Studios 2026.',
  'text'
)
on conflict (content_key) do nothing;

update exhibition.site_content
set content_value = 'Visit the Exhibition | Margaret River | The Georgette 150th'
where content_key = 'seo_visit_title';

insert into exhibition.site_content (content_key, content_value, content_type)
values (
  'seo_visit_title',
  'Visit the Exhibition | Margaret River | The Georgette 150th',
  'text'
)
on conflict (content_key) do nothing;

commit;

begin;

insert into exhibition.site_content (content_key, content_value, content_type)
values
  ('installation_cubarama_image', '', 'image'),
  ('installation_captain_godfrey_image', '', 'image'),
  ('installation_drift_image', '', 'image')
on conflict (content_key) do nothing;

commit;

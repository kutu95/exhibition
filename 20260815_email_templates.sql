-- Designable transactional emails (order confirmation, shipped, welcome).
-- Additive only — safe to apply when exhibition schema already exists.

create table if not exists exhibition.email_templates (
  slug text primary key,
  name text not null,
  subject text not null default '',
  preview_text text,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table exhibition.email_templates enable row level security;

drop policy if exists email_templates_service_all on exhibition.email_templates;
create policy email_templates_service_all
  on exhibition.email_templates
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on exhibition.email_templates to service_role;

-- Email campaigns: branded block-based newsletters to email_subscribers.
-- Additive only — safe to apply when exhibition schema already exists.

create table if not exists exhibition.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  preview_text text,
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  audience_count integer,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaigns_status_idx
  on exhibition.email_campaigns (status);

create index if not exists email_campaigns_scheduled_at_idx
  on exhibition.email_campaigns (scheduled_at)
  where status = 'scheduled';

create table if not exists exhibition.email_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references exhibition.email_campaigns (id) on delete cascade,
  subscriber_id uuid references exhibition.email_subscribers (id) on delete set null,
  email text not null,
  resend_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists email_campaign_sends_campaign_idx
  on exhibition.email_campaign_sends (campaign_id);

alter table exhibition.email_campaigns enable row level security;
alter table exhibition.email_campaign_sends enable row level security;

-- Service role used by the app; no anon access to campaigns.
drop policy if exists email_campaigns_service_all on exhibition.email_campaigns;
create policy email_campaigns_service_all
  on exhibition.email_campaigns
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists email_campaign_sends_service_all on exhibition.email_campaign_sends;
create policy email_campaign_sends_service_all
  on exhibition.email_campaign_sends
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on exhibition.email_campaigns to service_role;
grant select, insert, update, delete on exhibition.email_campaign_sends to service_role;

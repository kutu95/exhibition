-- Campaign audience: website subscribers or talk registrations.
-- Additive only.

alter table exhibition.email_campaigns
  add column if not exists audience text not null default 'subscribers';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_campaigns_audience_check'
      and conrelid = 'exhibition.email_campaigns'::regclass
  ) then
    alter table exhibition.email_campaigns
      add constraint email_campaigns_audience_check
      check (audience in ('subscribers', 'talk_registrations'));
  end if;
end $$;

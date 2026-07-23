-- Add confirmed vs waitlist status for talk registrations.
-- Additive and safe to run once on the live exhibition schema.

begin;

alter table exhibition.talk_registrations
  add column if not exists list text not null default 'confirmed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'talk_registrations_list_check'
      and conrelid = 'exhibition.talk_registrations'::regclass
  ) then
    alter table exhibition.talk_registrations
      add constraint talk_registrations_list_check
      check (list in ('confirmed', 'waitlist'));
  end if;
end $$;

create index if not exists idx_talk_registrations_list_created
  on exhibition.talk_registrations (list, created_at desc)
  where cancelled_at is null;

commit;

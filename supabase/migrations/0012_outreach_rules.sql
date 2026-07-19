-- ════════════════════════════════════════════════════════════════════
-- Outreach control — master send mode + per-category treatment rules.
--
--   crm_settings.outreach_mode      'manual' (default) | 'auto'
--     manual → the daily sync detects problems but sends NOTHING;
--              emails go out only when the admin selects donors and
--              presses Send on the Recovery page.
--     auto   → the sync emails donors according to category rules.
--
--   categories.outreach_policy      'auto' | 'manual' | 'none'
--     auto   → automation may email this category (followup_days apart,
--              at most max_messages per problem)
--     manual → never auto-emailed; admin contacts them personally
--     none   → do not email at all — skipped even in bulk manual email
--
--   crm_settings.default_treatment  the rule for donors with NO category.
--
-- A donor in several categories gets the MOST PROTECTIVE rule:
-- none > manual > auto; among auto rules, slowest cadence + lowest cap.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.crm_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.crm_settings enable row level security;
drop policy if exists crm_settings_admin_all on public.crm_settings;
create policy crm_settings_admin_all on public.crm_settings
  for all to authenticated using (true) with check (true);

-- Safe defaults: nothing sends automatically until the admin opts in.
insert into public.crm_settings (key, value)
  values ('outreach_mode', '"manual"')
  on conflict (key) do nothing;
insert into public.crm_settings (key, value)
  values ('default_treatment', '{"policy":"manual","followup_days":7,"max_messages":3}')
  on conflict (key) do nothing;

alter table public.categories add column if not exists outreach_policy text not null default 'manual';
alter table public.categories add column if not exists followup_days   int  not null default 7;
alter table public.categories add column if not exists max_messages    int  not null default 3;

do $$ begin
  alter table public.categories
    add constraint categories_outreach_policy_chk
    check (outreach_policy in ('auto', 'manual', 'none'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.categories
    add constraint categories_cadence_chk
    check (followup_days >= 1 and max_messages >= 1);
exception when duplicate_object then null; end $$;

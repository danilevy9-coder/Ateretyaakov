-- ════════════════════════════════════════════════════════════════════
-- Money model fixes:
--  • balance = amount still OWED, never negative
--  • clear the fake "pledged = lifetime paid" values from the import
--    (these donors have no outstanding lump-sum pledge; pledged starts at 0)
--  • dashboard returns total raised + outstanding owed
-- ════════════════════════════════════════════════════════════════════

-- Redefine balance as outstanding owed (>= 0).
alter table public.donors drop column if exists balance;
alter table public.donors
  add column balance numeric(12,2)
  generated always as (greatest(0, total_pledged - total_paid)) stored;

-- Clear fake pledges (lifetime giving had been copied into total_pledged).
update public.donors set total_pledged = 0 where total_pledged <> 0;

-- Dashboard stats incl. outstanding owed.
create or replace function public.crm_dashboard_stats()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'donors',          (select count(*) from donors),
    'monthly',         (select count(*) from donors where segment = 'monthly_regular'),
    'campaignOnce',    (select count(*) from donors where segment = 'campaign_oneoff'),
    'campaignMonthly', (select count(*) from donors where segment = 'campaign_monthly'),
    'openIssues',      (select count(*) from donor_issues where status = 'open'),
    'unfulfilled',     (select count(*) from donor_issues where status = 'open' and type = 'unfulfilled_pledge'),
    'lapsed',          (select count(*) from donor_issues where status = 'open' and type = 'lapsed'),
    'failed',          (select count(*) from donor_issues where status = 'open' and type = 'failed_payment'),
    'students',        (select count(*) from students),
    'enrolled',        (select count(*) from students where status = 'enrolled'),
    'totalPaid',       (select coalesce(sum(total_paid), 0) from donors),
    'outstanding',     (select coalesce(sum(balance), 0) from donors),
    'monthlyRecurring',(select coalesce(sum(monthly_amount), 0) from donors where segment = 'monthly_regular'),
    'currency',        (select currency from donors group by currency order by sum(total_paid) desc nulls last limit 1)
  );
$$;

revoke all on function public.crm_dashboard_stats() from public, anon;
grant execute on function public.crm_dashboard_stats() to authenticated;

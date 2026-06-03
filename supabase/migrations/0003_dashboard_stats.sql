-- ════════════════════════════════════════════════════════════════════
-- Dashboard stats in a single DB call. Aggregates run in SQL, so they are
-- NOT subject to the PostgREST 1000-row response cap (the bug where the
-- dashboard total only reflected the first 1000 donors).
-- ════════════════════════════════════════════════════════════════════

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
    'totalPledged',    (select coalesce(sum(total_pledged), 0) from donors),
    'totalPaid',       (select coalesce(sum(total_paid), 0) from donors),
    'currency',        (select currency from donors group by currency order by sum(total_paid) desc nulls last limit 1)
  );
$$;

revoke all on function public.crm_dashboard_stats() from public, anon;
grant execute on function public.crm_dashboard_stats() to authenticated;

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtMoney } from '@/lib/crm/util';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = createClient();

  const count = async (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count: c } = await q;
    return c ?? 0;
  };

  const [
    donors,
    monthly,
    campaignOnce,
    campaignMonthly,
    openIssues,
    unfulfilled,
    lapsed,
    failed,
    students,
    enrolled,
  ] = await Promise.all([
    count('donors'),
    count('donors', (q) => q.eq('segment', 'monthly_regular')),
    count('donors', (q) => q.eq('segment', 'campaign_oneoff')),
    count('donors', (q) => q.eq('segment', 'campaign_monthly')),
    count('donor_issues', (q) => q.eq('status', 'open')),
    count('donor_issues', (q) => q.eq('status', 'open').eq('type', 'unfulfilled_pledge')),
    count('donor_issues', (q) => q.eq('status', 'open').eq('type', 'lapsed')),
    count('donor_issues', (q) => q.eq('status', 'open').eq('type', 'failed_payment')),
    count('students'),
    count('students', (q) => q.eq('status', 'enrolled')),
  ]);

  // Totals
  const { data: sums } = await supabase.from('donors').select('total_pledged, total_paid');
  const totalPledged = (sums ?? []).reduce((a, r: any) => a + Number(r.total_pledged || 0), 0);
  const totalPaid = (sums ?? []).reduce((a, r: any) => a + Number(r.total_paid || 0), 0);

  return {
    donors, monthly, campaignOnce, campaignMonthly,
    openIssues, unfulfilled, lapsed, failed,
    students, enrolled, totalPledged, totalPaid,
  };
}

function Stat({ label, value, href, accent }: { label: string; value: string | number; href?: string; accent?: string }) {
  const inner = (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-5 ${href ? 'hover:border-amber-500/40 hover:bg-white/[0.05] transition-colors' : ''}`}>
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function Dashboard() {
  let stats;
  let error: string | null = null;
  try {
    stats = await getStats();
  } catch (e) {
    error = String(e);
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">Overview of donors, issues and the yeshiva.</p>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 mb-8">
          <p className="text-amber-300 font-semibold text-sm mb-1">Database not reachable yet</p>
          <p className="text-amber-200/70 text-xs">
            Once the schema is applied and env vars are set, stats will appear here. ({error})
          </p>
        </div>
      )}

      {stats && (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Donors</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total donors" value={stats.donors} href="/crm/donors" />
              <Stat label="Monthly regulars" value={stats.monthly} href="/crm/donors?segment=monthly_regular" />
              <Stat label="Campaign — one-off" value={stats.campaignOnce} href="/crm/donors?segment=campaign_oneoff" />
              <Stat label="Campaign — monthly" value={stats.campaignMonthly} href="/crm/donors?segment=campaign_monthly" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Open issues</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="All open" value={stats.openIssues} href="/crm/issues" accent="text-amber-300" />
              <Stat label="Unfulfilled pledges" value={stats.unfulfilled} href="/crm/issues?type=unfulfilled_pledge" accent="text-amber-300" />
              <Stat label="Lapsed" value={stats.lapsed} href="/crm/issues?type=lapsed" accent="text-amber-300" />
              <Stat label="Failed payments" value={stats.failed} href="/crm/issues?type=failed_payment" accent="text-red-300" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Money & Yeshiva</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total pledged" value={fmtMoney(stats.totalPledged)} accent="text-emerald-300" />
              <Stat label="Total paid" value={fmtMoney(stats.totalPaid)} accent="text-emerald-300" />
              <Stat label="Students" value={stats.students} href="/crm/students" />
              <Stat label="Enrolled" value={stats.enrolled} href="/crm/students?status=enrolled" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

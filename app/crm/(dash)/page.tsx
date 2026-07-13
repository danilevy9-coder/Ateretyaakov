import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import HelpBox from '@/components/crm/HelpBox';

export const dynamic = 'force-dynamic';

interface Stats {
  donors: number; monthly: number; campaignOnce: number; campaignMonthly: number;
  openIssues: number; unfulfilled: number; lapsed: number; failed: number;
  students: number; enrolled: number;
  totalPaid: number; outstanding: number; monthlyRecurring: number; currency: string | null;
}

async function getStats(): Promise<Stats> {
  const supabase = createClient();
  // Single DB call — aggregates run in SQL so they cover ALL rows, not just
  // the first 1000 (the PostgREST response cap).
  const { data, error } = await supabase.rpc('crm_dashboard_stats');
  if (error) throw error;
  return data as Stats;
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
      <p className="text-slate-400 text-sm mb-4">Overview of donors, issues and the yeshiva.</p>

      <HelpBox>
        <p>Every card is clickable and jumps to the filtered list behind the number.</p>
        <p><b>Failed payments</b> are managed automatically by the <a href="/crm/nedarim" className="underline">Nedarim Plus</a> page —
        bouncing donors are emailed for you; check there (or your Sunday report email) to see who needs a personal call.</p>
        <p>New to this system? Start with the <a href="/crm/help" className="underline">❓ Help page</a> — it explains everything in plain language.</p>
      </HelpBox>

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
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Money</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total raised" value={fmtMoney(stats.totalPaid, currencySymbol(stats.currency))} accent="text-emerald-300" />
              <Stat label="Monthly recurring" value={fmtMoney(stats.monthlyRecurring, currencySymbol(stats.currency))} accent="text-sky-300" />
              <Stat label="Outstanding owed" value={fmtMoney(stats.outstanding, currencySymbol(stats.currency))} accent={stats.outstanding > 0 ? 'text-amber-300' : 'text-slate-300'} />
              <Stat label="Students" value={stats.students} href="/crm/students" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

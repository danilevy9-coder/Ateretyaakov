import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import HelpBox from '@/components/crm/HelpBox';
import TodayClient from '@/components/crm/TodayClient';

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

function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: 'red' | 'green' | 'amber' }) {
  const color = tone === 'red' ? 'text-[#b91c1c]' : tone === 'green' ? 'text-emerald-800' : tone === 'amber' ? 'text-[#b45309]' : 'text-slate-900';
  const inner = (
    <div className={`rounded-xl border border-slate-200 bg-[#fff] px-4 py-3 h-full ${href ? 'hover:border-slate-400 transition-colors' : ''}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function Dashboard() {
  let stats: Stats | undefined;
  let error: string | null = null;
  try {
    stats = await getStats();
  } catch (e) {
    error = String(e);
  }
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' });

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-slate-900">Today</h1>
      <p className="text-slate-600 text-[16px] mb-4">{today}</p>

      <HelpBox>
        <p><b>Call today</b> lists donors whose Nedarim card is failing (biggest amounts first). <b>Renewals due</b> are standing orders that just finished or are about to.</p>
        <p>Every row has one-tap <b>Call</b>, <b>WhatsApp</b> and <b>Email</b>. Tap a name to open the full page for that person.</p>
        <p>Use the search box at the top to find anyone by Hebrew or English name, phone (any format), email or city.</p>
      </HelpBox>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-6 text-[15px] text-amber-950">
          Totals couldn&apos;t load right now ({error}).
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <Stat label="Donors" value={stats.donors.toLocaleString()} href="/crm/donors" />
          <Stat label="Monthly regulars" value={stats.monthly.toLocaleString()} href="/crm/donors?segment=monthly_regular" />
          <Stat label="Monthly income" value={fmtMoney(stats.monthlyRecurring, currencySymbol(stats.currency))} tone="green" />
          <Stat label="Cards failing" value={stats.failed} href="/crm/issues?type=failed_payment" tone={stats.failed > 0 ? 'red' : undefined} />
          <Stat label="Open issues" value={stats.openIssues} href="/crm/issues" tone={stats.openIssues > 0 ? 'amber' : undefined} />
          <Stat label="Students" value={stats.students} href="/crm/students" />
        </div>
      )}

      <TodayClient />
    </div>
  );
}

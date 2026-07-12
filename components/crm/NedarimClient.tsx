'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';

interface KevaRow {
  keva_id: string;
  donor_id: string | null;
  client_name: string | null;
  email: string | null;
  phone: string | null;
  amount: number | null;
  currency: string;
  error_text: string | null;
  error_kind: string | null;
  bouncing_since: string | null;
  next_charge: string | null;
  last_num: string | null;
  tokef: string | null;
  enabled: boolean;
}

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  ok: boolean | null;
  error: string | null;
  kevas_total: number | null;
  kevas_bouncing: number | null;
  new_bounces: number | null;
  recovered: number | null;
  emails_sent: number | null;
  emails_failed: number | null;
  weekly_report_sent: boolean;
}

interface IssueRow {
  keva_id: string;
  notify_count: number;
  last_notified_at: string | null;
}

const dt = (s: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
const d = (s: string | null) => (s ? s.slice(0, 10) : '—');

export default function NedarimClient() {
  const [kevas, setKevas] = useState<KevaRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [issues, setIssues] = useState<Map<string, IssueRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'sync' | 'report'>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [kevaRes, runRes, issueRes] = await Promise.all([
      supabase.from('nedarim_keva').select('*').order('amount', { ascending: false }).limit(2000),
      supabase.from('nedarim_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
      supabase.from('donor_issues').select('keva_id, notify_count, last_notified_at')
        .eq('type', 'failed_payment').eq('status', 'open').not('keva_id', 'is', null),
    ]);
    setKevas((kevaRes.data ?? []) as KevaRow[]);
    setRuns((runRes.data ?? []) as RunRow[]);
    setIssues(new Map(((issueRes.data ?? []) as IssueRow[]).map((i) => [i.keva_id, i])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const trigger = async (kind: 'sync' | 'report') => {
    setBusy(kind);
    setActionMsg(null);
    try {
      const res = await fetch('/api/cron/nedarim-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'report' ? { report: true } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMsg(`❌ ${json.error || 'Sync failed'}`);
      } else {
        const parts = [
          `✅ Synced ${json.kevasTotal} standing orders`,
          `${json.kevasBouncing} bouncing`,
          json.newBounces ? `${json.newBounces} new` : null,
          json.recovered ? `${json.recovered} recovered` : null,
          json.emailsSent ? `${json.emailsSent} email(s) sent` : null,
          json.emailsFailed ? `⚠️ ${json.emailsFailed} email(s) failed` : null,
          json.report && 'to' in json.report ? `report sent to ${json.report.to}` : null,
          json.report && 'error' in json.report ? `⚠️ report failed: ${json.report.error}` : null,
        ].filter(Boolean);
        setActionMsg(parts.join(' · '));
      }
    } catch (e) {
      setActionMsg(`❌ ${String(e)}`);
    }
    setBusy(null);
    load();
  };

  const active = kevas.filter((k) => k.enabled && !k.error_text);
  const bouncing = kevas.filter((k) => k.enabled && k.error_kind === 'card_failure');
  const completed = kevas.filter((k) => k.enabled && k.error_kind === 'completed');
  const sumMonthly = (rows: KevaRow[], cur: string) =>
    rows.filter((r) => (r.currency || 'ILS') === cur).reduce((a, r) => a + (r.amount ?? 0), 0);
  const monthlyStr = (rows: KevaRow[]) => {
    const ils = sumMonthly(rows, 'ILS');
    const usd = sumMonthly(rows, 'USD');
    return [ils ? fmtMoney(ils, '₪') : null, usd ? fmtMoney(usd, '$') : null].filter(Boolean).join(' + ') || '₪0';
  };
  const lastRun = runs[0];

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold">Nedarim Plus</h1>
        <div className="flex gap-2">
          <button
            onClick={() => trigger('sync')}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {busy === 'sync' ? 'Syncing…' : '↻ Sync now'}
          </button>
          <button
            onClick={() => trigger('report')}
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg border border-white/15 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
            {busy === 'report' ? 'Sending…' : '✉️ Sync + email me the report'}
          </button>
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Automated standing-order sync — bounce detection, donor recovery emails, and a weekly digest.
      </p>

      {actionMsg && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-6 text-sm text-slate-200">
          {actionMsg}
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 mb-6">
          <p className="text-amber-300 font-semibold text-sm mb-1">Not connected yet</p>
          <p className="text-amber-200/70 text-xs leading-relaxed">
            No sync has run. Ask Nedarim Plus (office@nedar.im, from an email authorized on the mosad)
            for your <b>API password</b>, then set <code>NEDARIM_MOSAD_ID</code> and{' '}
            <code>NEDARIM_API_PASSWORD</code> in Vercel and press “Sync now”. The daily cron takes over
            from there.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Active orders</p>
          <p className="text-2xl font-bold mt-1 text-emerald-300">{active.length}</p>
          <p className="text-slate-400 text-xs mt-1">{monthlyStr(active)}/mo</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Bouncing</p>
          <p className={`text-2xl font-bold mt-1 ${bouncing.length ? 'text-red-300' : 'text-emerald-300'}`}>{bouncing.length}</p>
          <p className="text-slate-400 text-xs mt-1">{monthlyStr(bouncing)}/mo at risk</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Term completed</p>
          <p className="text-2xl font-bold mt-1 text-amber-300">{completed.length}</p>
          <p className="text-slate-400 text-xs mt-1">{monthlyStr(completed)}/mo to renew</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Last sync</p>
          <p className="text-sm font-semibold mt-2 text-white">{lastRun ? dt(lastRun.started_at) : 'never'}</p>
          <p className={`text-xs mt-1 ${lastRun?.ok === false ? 'text-red-300' : 'text-slate-400'}`}>
            {lastRun ? (lastRun.ok ? `OK — ${lastRun.kevas_total} orders` : `failed: ${lastRun.error?.slice(0, 60)}`) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Auto-emails (last run)</p>
          <p className="text-2xl font-bold mt-1 text-sky-300">{lastRun?.emails_sent ?? 0}</p>
          <p className="text-slate-400 text-xs mt-1">{lastRun?.emails_failed ? `${lastRun.emails_failed} failed` : 'recovery emails sent'}</p>
        </div>
      </div>

      {/* Bouncing table */}
      <h2 className="text-sm font-semibold text-slate-300 mb-3">
        Currently bouncing ({bouncing.length})
      </h2>
      <div className="rounded-xl border border-white/10 overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Monthly</th>
              <th className="px-4 py-3">Since</th>
              <th className="px-4 py-3">Card error</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Emails sent</th>
              <th className="px-4 py-3">Last emailed</th>
            </tr>
          </thead>
          <tbody>
            {bouncing.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-500 text-center">
                {loading ? 'Loading…' : 'No bouncing standing orders 🎉'}
              </td></tr>
            )}
            {bouncing.map((k) => {
              const issue = issues.get(k.keva_id);
              return (
                <tr key={k.keva_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{k.client_name || '—'}
                    <span className="block text-xs text-slate-500">#{k.keva_id}{k.last_num ? ` · ****${k.last_num}` : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-red-300 font-semibold">{fmtMoney(k.amount ?? 0, currencySymbol(k.currency))}</td>
                  <td className="px-4 py-3 text-slate-300">{d(k.bouncing_since)}</td>
                  <td className="px-4 py-3 text-slate-300" dir="rtl">{k.error_text}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {k.email || k.phone || <span className="text-amber-300">none ⚠️</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{issue?.notify_count ?? 0}</td>
                  <td className="px-4 py-3 text-slate-400">{dt(issue?.last_notified_at ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Completed-term table */}
      <h2 className="text-sm font-semibold text-slate-300 mb-3">
        Finished their commitment — renewal opportunities ({completed.length})
      </h2>
      <p className="text-slate-500 text-xs mb-3">
        These donors completed every payment they signed up for. They are never auto-emailed —
        reach out personally or via a bulk renewal email from the Issues page (type “lapsed”).
      </p>
      <div className="rounded-xl border border-white/10 overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Was giving</th>
              <th className="px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody>
            {completed.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-slate-500 text-center">
                {loading ? 'Loading…' : 'None'}
              </td></tr>
            )}
            {completed.map((k) => (
              <tr key={k.keva_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{k.client_name || '—'}
                  <span className="block text-xs text-slate-500">#{k.keva_id}</span>
                </td>
                <td className="px-4 py-3 text-amber-300 font-semibold">{fmtMoney(k.amount ?? 0, currencySymbol(k.currency))}/mo</td>
                <td className="px-4 py-3 text-slate-300">{k.email || k.phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Run history */}
      <h2 className="text-sm font-semibold text-slate-300 mb-3">Sync history</h2>
      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Bouncing</th>
              <th className="px-4 py-3">New</th>
              <th className="px-4 py-3">Recovered</th>
              <th className="px-4 py-3">Emails</th>
              <th className="px-4 py-3">Report</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-slate-500 text-center">
                {loading ? 'Loading…' : 'No syncs yet.'}
              </td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-slate-300">{dt(r.started_at)}</td>
                <td className="px-4 py-3 text-slate-400">{r.trigger}</td>
                <td className="px-4 py-3">
                  {r.ok === null ? <span className="text-slate-400">running…</span>
                    : r.ok ? <span className="text-emerald-300">OK</span>
                    : <span className="text-red-300" title={r.error ?? ''}>failed</span>}
                </td>
                <td className="px-4 py-3 text-slate-300">{r.kevas_total ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{r.kevas_bouncing ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{r.new_bounces ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{r.recovered ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">
                  {r.emails_sent ?? 0}{r.emails_failed ? <span className="text-red-300"> +{r.emails_failed} failed</span> : ''}
                </td>
                <td className="px-4 py-3 text-slate-400">{r.weekly_report_sent ? '✉️ sent' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-slate-500 text-xs mt-6 leading-relaxed">
        The cron syncs daily at ~8:00 Israel time and emails the weekly digest on Sunday. Bouncing donors
        get the “Payment issue” template (edit it under <a href="/crm/templates" className="underline">Templates</a>)
        in their own language — first notice immediately, reminders every {Number(process.env.NEXT_PUBLIC_NEDARIM_REMINDER_DAYS ?? 7)} days,
        up to 3 notices, never to anyone unsubscribed.
      </p>
    </div>
  );
}

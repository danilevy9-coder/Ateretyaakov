'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol, waLink } from '@/lib/crm/util';
import HelpBox from './HelpBox';

// ── Recovery workbench ────────────────────────────────────────────────
// One donor per row, grouped across all their standing orders, sorted by
// money at stake, bucketed by the action the admin needs to take.

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

interface IssueRow {
  id: string;
  donor_id: string;
  keva_id: string | null;
  type: string;
  status: string;
  notify_count: number;
  last_notified_at: string | null;
  last_called_at: string | null;
  snooze_reason: string | null;
  resolved_at: string | null;
  amount: number | null;
}

interface DonorRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  unsubscribed: boolean;
  preferred_language: 'en' | 'he';
}

interface PayStat { donor_id: string; total_paid: number; payment_count: number; last_paid: string | null }

interface RunRow {
  id: string; started_at: string; trigger: string; ok: boolean | null; error: string | null;
  kevas_total: number | null; kevas_bouncing: number | null; kevas_completed: number | null;
  new_bounces: number | null; recovered: number | null; emails_sent: number | null;
  emails_failed: number | null; weekly_report_sent: boolean;
}

type Bucket = 'new' | 'emailing' | 'call' | 'left_out';

interface WorkRow {
  donor: DonorRow | null;
  donorId: string | null;
  name: string;
  kevas: KevaRow[];
  issues: IssueRow[];
  monthly: number;
  currency: string;
  since: string | null;
  error: string;
  notifyCount: number;
  lastNotified: string | null;
  lastCalled: string | null;
  bucket: Bucket;
  lifetime: PayStat | null;
}

const d = (s: string | null | undefined) => (s ? s.slice(0, 10) : '—');
const dt = (s: string | null | undefined) => (s ? s.slice(0, 16).replace('T', ' ') : '—');

const BUCKET_META: Record<Bucket, { label: string; hint: string; color: string }> = {
  new:      { label: '🆕 New',        hint: 'Just detected — first email goes out on the next sync', color: 'text-sky-300' },
  emailing: { label: '✉️ Emailing',   hint: 'Automated recovery emails in progress',                 color: 'text-amber-300' },
  call:     { label: '📞 Call these', hint: 'Email can’t reach them — needs your personal touch',    color: 'text-red-300' },
  left_out: { label: '⏸️ Left out',   hint: 'You excluded them — automation won’t touch them',       color: 'text-slate-400' },
};

export default function NedarimClient() {
  const [kevas, setKevas] = useState<KevaRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [resolved, setResolved] = useState<IssueRow[]>([]);
  const [donors, setDonors] = useState<Map<string, DonorRow>>(new Map());
  const [payStats, setPayStats] = useState<Map<string, PayStat>>(new Map());
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | Bucket | 'recovered' | 'renewals'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Map<string, { at: string; body: string }[]>>(new Map());

  const load = useCallback(async () => {
    const supabase = createClient();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const [kevaRes, issueRes, resolvedRes, runRes] = await Promise.all([
      supabase.from('nedarim_keva').select('*').order('amount', { ascending: false }).limit(2000),
      supabase.from('donor_issues')
        .select('id, donor_id, keva_id, type, status, notify_count, last_notified_at, last_called_at, snooze_reason, resolved_at, amount')
        .not('keva_id', 'is', null).in('status', ['open', 'snoozed']),
      supabase.from('donor_issues')
        .select('id, donor_id, keva_id, type, status, notify_count, last_notified_at, last_called_at, snooze_reason, resolved_at, amount')
        .not('keva_id', 'is', null).eq('type', 'failed_payment').eq('status', 'resolved')
        .gte('resolved_at', sixtyDaysAgo).order('resolved_at', { ascending: false }).limit(50),
      supabase.from('nedarim_sync_runs').select('*').order('started_at', { ascending: false }).limit(8),
    ]);
    const kevaRows = (kevaRes.data ?? []) as KevaRow[];
    setKevas(kevaRows);
    setIssues((issueRes.data ?? []) as IssueRow[]);
    setResolved((resolvedRes.data ?? []) as IssueRow[]);
    setRuns((runRes.data ?? []) as RunRow[]);

    const donorIds = Array.from(new Set(kevaRows.map((k) => k.donor_id).filter(Boolean))) as string[];
    if (donorIds.length) {
      const dMap = new Map<string, DonorRow>();
      for (let i = 0; i < donorIds.length; i += 200) {
        const { data } = await supabase.from('donors')
          .select('id, full_name, email, phone, whatsapp_phone, unsubscribed, preferred_language')
          .in('id', donorIds.slice(i, i + 200));
        for (const row of (data ?? []) as DonorRow[]) dMap.set(row.id, row);
      }
      setDonors(dMap);
      const { data: stats } = await supabase.rpc('nedarim_donor_payment_stats', { donor_ids: donorIds });
      setPayStats(new Map(((stats ?? []) as PayStat[]).map((s) => [s.donor_id, s])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── build donor-centric work rows ──────────────────────────────────
  const workRows = useMemo<WorkRow[]>(() => {
    const bouncing = kevas.filter((k) => k.enabled && k.error_kind === 'card_failure');
    const issueByKeva = new Map(issues.map((i) => [i.keva_id!, i]));
    const groups = new Map<string, { kevas: KevaRow[]; issues: IssueRow[] }>();
    for (const k of bouncing) {
      const key = k.donor_id ?? `nokey-${k.keva_id}`;
      const g = groups.get(key) ?? { kevas: [], issues: [] };
      g.kevas.push(k);
      const iss = issueByKeva.get(k.keva_id);
      if (iss && iss.type === 'failed_payment') g.issues.push(iss);
      groups.set(key, g);
    }
    const rows: WorkRow[] = [];
    for (const [key, g] of Array.from(groups.entries())) {
      const donorId = key.startsWith('nokey-') ? null : key;
      const donor = donorId ? donors.get(donorId) ?? null : null;
      const main = g.kevas.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
      const notifyCount = Math.max(0, ...g.issues.map((i) => i.notify_count));
      const allSnoozed = g.issues.length > 0 && g.issues.every((i) => i.status === 'snoozed');
      const email = donor?.email ?? main.email;
      let bucket: Bucket;
      if (allSnoozed) bucket = 'left_out';
      else if (!email || donor?.unsubscribed || notifyCount >= 3) bucket = 'call';
      else if (notifyCount === 0) bucket = 'new';
      else bucket = 'emailing';
      rows.push({
        donor, donorId,
        name: donor?.full_name || main.client_name || '—',
        kevas: g.kevas, issues: g.issues,
        monthly: g.kevas.reduce((s, k) => s + (k.amount ?? 0), 0),
        currency: main.currency,
        since: g.kevas.map((k) => k.bouncing_since).filter(Boolean).sort()[0] ?? null,
        error: Array.from(new Set(g.kevas.map((k) => k.error_text).filter(Boolean))).join(' · '),
        notifyCount,
        lastNotified: g.issues.map((i) => i.last_notified_at).filter(Boolean).sort().pop() ?? null,
        lastCalled: g.issues.map((i) => i.last_called_at).filter(Boolean).sort().pop() ?? null,
        bucket,
        lifetime: donorId ? payStats.get(donorId) ?? null : null,
      });
    }
    return rows.sort((a, b) => b.monthly - a.monthly);
  }, [kevas, issues, donors, payStats]);

  const completedRows = useMemo(
    () => kevas.filter((k) => k.enabled && k.error_kind === 'completed'),
    [kevas]
  );
  const kevaById = useMemo(() => new Map(kevas.map((k) => [k.keva_id, k])), [kevas]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { new: 0, emailing: 0, call: 0, left_out: 0 };
    for (const r of workRows) c[r.bucket]++;
    return c;
  }, [workRows]);

  // ── actions ─────────────────────────────────────────────────────────
  const act = async (row: WorkRow, action: string, promptText?: string) => {
    let note: string | undefined;
    if (promptText) {
      const v = window.prompt(promptText);
      if (v === null) return;
      note = v || undefined;
      if (action === 'note' && !note) return;
    }
    setBusy(row.name);
    try {
      const targets = action === 'note' ? row.issues.slice(0, 1) : row.issues;
      for (const issue of targets) {
        const res = await fetch('/api/crm/nedarim/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId: issue.id, action, note }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'action failed');
      }
      setActionMsg(`✅ ${row.name}: ${action.replace('_', ' ')} recorded`);
      setTimeline((t) => { const n = new Map(t); if (row.donorId) n.delete(row.donorId); return n; });
    } catch (e) {
      setActionMsg(`❌ ${String(e)}`);
    }
    setBusy(null);
    load();
  };

  const toggleExpand = async (row: WorkRow) => {
    const id = row.donorId;
    if (!id) return;
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!timeline.has(id)) {
      const supabase = createClient();
      const [logRes, noteRes] = await Promise.all([
        supabase.from('message_log').select('created_at, subject, status')
          .eq('donor_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('donor_notes').select('created_at, body, author')
          .eq('donor_id', id).order('created_at', { ascending: false }).limit(10),
      ]);
      const items = [
        ...(logRes.data ?? []).map((l: any) => {
          const label: Record<string, string> = {
            sent: '✉️ Email sent', delivered: '📬 Email delivered', opened: '👀 Email opened',
            clicked: '🔗 Email link clicked', bounced: '⚠️ Email bounced', failed: '✉️❌ Email failed',
          };
          return { at: l.created_at as string, body: `${label[l.status] ?? l.status}: ${l.subject}` };
        }),
        ...(noteRes.data ?? []).map((n: any) => ({
          at: n.created_at as string,
          body: `${n.body}${n.author ? ` — ${n.author}` : ''}`,
        })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);
      setTimeline((t) => new Map(t).set(id, items));
    }
  };

  const trigger = async (kind: 'sync' | 'report') => {
    setBusy(kind);
    setActionMsg(null);
    try {
      const res = await fetch('/api/cron/nedarim-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'report' ? { report: true } : {}),
      });
      const json = await res.json();
      setActionMsg(res.ok && json.ok !== false
        ? `✅ Synced ${json.kevasTotal} orders · ${json.kevasBouncing} bouncing · ${json.newBounces} new · ${json.recovered} recovered · ${json.paymentsImported ?? 0} payments imported` +
          (json.report?.to ? ` · report → ${json.report.to}` : '') + (json.report?.error ? ` · ⚠️ report: ${json.report.error}` : '')
        : `❌ ${json.error || 'Sync failed'}`);
    } catch (e) { setActionMsg(`❌ ${String(e)}`); }
    setBusy(null);
    load();
  };

  const waMessage = (row: WorkRow) => {
    const sym = currencySymbol(row.currency);
    return row.donor?.preferred_language === 'he'
      ? `שלום ${row.name.split(' ')[0]}, כאן ישיבת עטרת יעקב. התרומה החודשית שלך בסך ${sym}${row.monthly.toLocaleString()} לא עברה (בעיה בכרטיס). נשמח לעזור להסדיר — תודה רבה!`
      : `Hi ${row.name.split(' ')[0]}, this is Yeshiva Ateret Yaakov. Your monthly donation of ${sym}${row.monthly.toLocaleString()} didn’t go through (a card issue). We’d love to help fix it — thank you!`;
  };

  const visible = tab === 'all' ? workRows : workRows.filter((r) => r.bucket === tab);
  const sumMonthly = (rows: WorkRow[]) => rows.reduce((s, r) => s + r.monthly, 0);
  const lastRun = runs[0];

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold">Nedarim Plus — Recovery</h1>
        <div className="flex gap-2">
          <button onClick={() => trigger('sync')} disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors">
            {busy === 'sync' ? 'Syncing…' : '↻ Sync now'}
          </button>
          <button onClick={() => trigger('report')} disabled={busy !== null}
            className="px-4 py-2 rounded-lg border border-white/15 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50 transition-colors">
            {busy === 'report' ? 'Sending…' : '✉️ Email me the report'}
          </button>
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        {workRows.length} donors bouncing · {fmtMoney(sumMonthly(workRows), currencySymbol('ILS'))}/mo at risk ·
        last sync {lastRun ? dt(lastRun.started_at) : 'never'}{lastRun?.ok === false ? ' (failed)' : ''}
      </p>

      <HelpBox>
        <p>This page recovers failed monthly donations <b>automatically</b>. Every morning it checks Nedarim Plus
        (read-only — it can never change or charge anything there), emails donors whose cards failed
        (bilingual, up to 3 times, a week apart), and closes everything by itself when the payment recovers.</p>
        <p><b>The tabs = what needs doing:</b> 🆕 New (just detected) · ✉️ Emailing (automation working) ·
        📞 <b>Call these — your to-do list</b> (email can&apos;t reach them or was ignored 3×) · ⏸️ Left out (you excluded them) ·
        ✅ Recovered · 🔄 Renewals (finished their commitment — never nagged, worth a personal ask).</p>
        <p><b>Row buttons:</b> WhatsApp opens a pre-filled message · 📞 Called logs your call · ⏸ Leave out stops all automation
        for them · ✓ Resolve closes it · ✎ Note saves a note. <b>Click a donor&apos;s name</b> for their full history.</p>
        <p><b>Lifetime given</b> = their real payment history from Nedarim — prioritize big long-time givers for calls.
        The Sunday email report summarizes all of this, including who opened the emails and who paid.</p>
      </HelpBox>

      {actionMsg && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-5 text-sm text-slate-200">{actionMsg}</div>
      )}

      {/* Bucket tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([['all', `All bouncing (${workRows.length})`],
           ['new', `${BUCKET_META.new.label} (${counts.new})`],
           ['emailing', `${BUCKET_META.emailing.label} (${counts.emailing})`],
           ['call', `${BUCKET_META.call.label} (${counts.call})`],
           ['left_out', `${BUCKET_META.left_out.label} (${counts.left_out})`],
           ['recovered', `✅ Recovered (${resolved.length})`],
           ['renewals', `🔄 Renewals (${completedRows.length})`]] as [typeof tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              tab === key ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                          : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab !== 'recovered' && tab !== 'renewals' && tab !== 'all' && (
        <p className="text-slate-500 text-xs mb-3">{BUCKET_META[tab as Bucket].hint}</p>
      )}

      {/* ── Main workbench table ── */}
      {tab !== 'recovered' && tab !== 'renewals' && (
        <div className="rounded-xl border border-white/10 overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3">At risk</th>
                <th className="px-4 py-3">Lifetime given</th>
                <th className="px-4 py-3">Since</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Outreach</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-slate-500 text-center">
                  {loading ? 'Loading…' : tab === 'all' ? 'No bouncing donors 🎉' : 'Nothing here'}
                </td></tr>
              )}
              {visible.map((row) => {
                const key = row.donorId ?? row.kevas[0].keva_id;
                const phone = row.donor?.whatsapp_phone || row.donor?.phone || row.kevas[0].phone;
                const isOpen = expanded === row.donorId;
                return (
                  <>
                    <tr key={key} className="border-b border-white/5 hover:bg-white/[0.02] align-top">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpand(row)} className="text-left">
                          <span className="font-medium text-white">{row.name}</span>
                          {row.monthly >= 300 && <span title="High value" className="ml-1">⭐</span>}
                          <span className="block text-xs text-slate-500">
                            {row.kevas.length > 1 ? `${row.kevas.length} orders · ` : ''}
                            {row.donor?.email || row.kevas[0].email || 'no email'}
                            {phone ? ` · ${phone}` : ''}
                            {row.donor?.unsubscribed ? ' · 🚫 unsubscribed' : ''}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-red-300 font-semibold whitespace-nowrap">
                        {fmtMoney(row.monthly, currencySymbol(row.currency))}/mo
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {row.lifetime
                          ? <>{fmtMoney(row.lifetime.total_paid, currencySymbol(row.currency))}
                              <span className="block text-xs text-slate-500">{row.lifetime.payment_count} payments · last {d(row.lifetime.last_paid)}</span></>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{d(row.since)}</td>
                      <td className="px-4 py-3 text-slate-300 max-w-[220px]" dir="rtl">{row.error}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        <span className={BUCKET_META[row.bucket].color}>{BUCKET_META[row.bucket].label}</span>
                        <span className="block text-xs text-slate-500">
                          {row.notifyCount > 0 ? `${row.notifyCount}/3 emails · last ${d(row.lastNotified)}` : 'no emails yet'}
                          {row.lastCalled ? ` · called ${d(row.lastCalled)}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          {phone && (
                            <a href={waLink(phone, waMessage(row))} target="_blank" rel="noreferrer"
                              className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 text-xs hover:bg-emerald-600/30">WhatsApp</a>
                          )}
                          <button onClick={() => act(row, 'called', 'Note about the call (optional):')}
                            className="px-2 py-1 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10">📞 Called</button>
                          {row.bucket === 'left_out'
                            ? <button onClick={() => act(row, 'reinclude')}
                                className="px-2 py-1 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10">▶ Re-include</button>
                            : <button onClick={() => act(row, 'leave_out', 'Why leave them out? (optional)')}
                                className="px-2 py-1 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10">⏸ Leave out</button>}
                          <button onClick={() => act(row, 'resolve', 'Resolution note (optional):')}
                            className="px-2 py-1 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10">✓ Resolve</button>
                          <button onClick={() => act(row, 'note', 'Note:')}
                            className="px-2 py-1 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10">✎ Note</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && row.donorId && (
                      <tr key={key + '-tl'} className="border-b border-white/5 bg-white/[0.015]">
                        <td colSpan={7} className="px-6 py-3">
                          <p className="text-xs text-slate-400 font-semibold mb-2">History</p>
                          {(timeline.get(row.donorId) ?? []).length === 0
                            ? <p className="text-xs text-slate-500">No activity recorded yet.</p>
                            : <ul className="space-y-1">
                                {(timeline.get(row.donorId) ?? []).map((t, i) => (
                                  <li key={i} className="text-xs text-slate-300">
                                    <span className="text-slate-500">{dt(t.at)}</span> — {t.body}
                                  </li>
                                ))}
                              </ul>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recovered ── */}
      {tab === 'recovered' && (
        <div className="rounded-xl border border-white/10 overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
                <th className="px-4 py-3">Donor</th><th className="px-4 py-3">Monthly</th><th className="px-4 py-3">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {resolved.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-slate-500 text-center">{loading ? 'Loading…' : 'None in the last 60 days'}</td></tr>
              )}
              {resolved.map((i) => {
                const k = kevaById.get(i.keva_id!);
                return (
                  <tr key={i.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white">{k?.client_name ?? i.keva_id}</td>
                    <td className="px-4 py-3 text-emerald-300 font-semibold">{fmtMoney(i.amount ?? 0, currencySymbol(k?.currency ?? 'ILS'))}/mo</td>
                    <td className="px-4 py-3 text-slate-300">{d(i.resolved_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Renewals (completed term) ── */}
      {tab === 'renewals' && (
        <>
          <p className="text-slate-500 text-xs mb-3">
            These donors finished every payment they committed to — nothing failed. They are never
            auto-emailed; ask them personally (or bulk-email the “lapsed” issue type) to renew.
          </p>
          <div className="rounded-xl border border-white/10 overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
                  <th className="px-4 py-3">Donor</th><th className="px-4 py-3">Was giving</th><th className="px-4 py-3">Contact</th>
                </tr>
              </thead>
              <tbody>
                {completedRows.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-slate-500 text-center">{loading ? 'Loading…' : 'None'}</td></tr>
                )}
                {completedRows.map((k) => (
                  <tr key={k.keva_id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white">{k.client_name || '—'}</td>
                    <td className="px-4 py-3 text-amber-300 font-semibold">{fmtMoney(k.amount ?? 0, currencySymbol(k.currency))}/mo</td>
                    <td className="px-4 py-3 text-slate-300">{k.email || k.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Sync history */}
      <details className="mb-4">
        <summary className="text-sm font-semibold text-slate-300 cursor-pointer">Sync history</summary>
        <div className="rounded-xl border border-white/10 overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-white/10">
                <th className="px-4 py-3">When</th><th className="px-4 py-3">Trigger</th><th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Orders</th><th className="px-4 py-3">Bouncing</th><th className="px-4 py-3">New</th>
                <th className="px-4 py-3">Recovered</th><th className="px-4 py-3">Emails</th><th className="px-4 py-3">Report</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-slate-300">{dt(r.started_at)}</td>
                  <td className="px-4 py-3 text-slate-400">{r.trigger}</td>
                  <td className="px-4 py-3">{r.ok === null ? <span className="text-slate-400">running…</span> : r.ok ? <span className="text-emerald-300">OK</span> : <span className="text-red-300" title={r.error ?? ''}>failed</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{r.kevas_total ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.kevas_bouncing ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.new_bounces ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.recovered ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.emails_sent ?? 0}{r.emails_failed ? <span className="text-red-300"> +{r.emails_failed}✗</span> : ''}</td>
                  <td className="px-4 py-3 text-slate-400">{r.weekly_report_sent ? '✉️' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-slate-500 text-xs leading-relaxed">
        Daily sync ~8:00 Israel time · weekly digest Sunday · recovery emails: first notice on detection,
        reminders every 7 days, max 3, one email per donor across all their orders, never to unsubscribed
        or left-out donors. Templates editable under <a href="/crm/templates" className="underline">Templates</a>.
      </p>
    </div>
  );
}

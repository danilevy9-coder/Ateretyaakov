// ── Weekly Nedarim digest for the admin ─────────────────────────────
// Summarises the last 7 days of automated sync activity: money at risk,
// new bounces, recoveries, outreach sent, donors needing a personal
// call, and cards about to expire.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendHtmlEmail } from './email';
import { currencySymbol, fmtMoney } from './util';
import { monthsUntilExpiry } from './nedarim';

const sym = (c: string | null) => currencySymbol(c || 'ILS');

interface BouncingRow {
  keva_id: string;
  client_name: string | null;
  amount: number | null;
  currency: string;
  error_text: string | null;
  error_kind: string | null;
  bouncing_since: string | null;
  email: string | null;
  phone: string | null;
  enabled: boolean;
  tokef: string | null;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return '<p style="color:#888;margin:6px 0 18px;">None this week 🎉</p>';
  const th = headers.map((h) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;font-size:13px;color:#555;">${h}</th>`).join('');
  const trs = rows.map((r) =>
    `<tr>${r.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:14px;">${c}</td>`).join('')}</tr>`
  ).join('');
  return `<table style="border-collapse:collapse;width:100%;margin:6px 0 18px;">${'<tr>' + th + '</tr>'}${trs}</table>`;
}

function section(title: string, inner: string): string {
  return `<h2 style="font-size:16px;margin:24px 0 4px;color:#1a1a1a;">${title}</h2>${inner}`;
}

export async function buildWeeklyNedarimReport(
  client?: SupabaseClient
): Promise<{ subject: string; html: string }> {
  const supabase = client ?? createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const weekAgoDate = weekAgo.slice(0, 10);

  const [{ data: kevaRows }, { data: newIssues }, { data: resolvedIssues }, { data: sentLog }, { data: lastRuns }] =
    await Promise.all([
      supabase.from('nedarim_keva').select('keva_id, client_name, amount, currency, error_text, error_kind, bouncing_since, email, phone, enabled, tokef').limit(5000),
      supabase.from('donor_issues').select('keva_id, detail, amount, detected_at').eq('type', 'failed_payment').not('keva_id', 'is', null).gte('detected_at', weekAgoDate).order('detected_at', { ascending: false }),
      supabase.from('donor_issues').select('keva_id, donor_id, detail, amount, resolved_at').eq('type', 'failed_payment').eq('status', 'resolved').not('keva_id', 'is', null).gte('resolved_at', weekAgoDate),
      supabase.from('message_log').select('donor_id, to_address, subject, status, created_at').eq('sent_by', 'nedarim-auto').gte('created_at', weekAgo).order('created_at', { ascending: false }),
      supabase.from('nedarim_sync_runs').select('*').order('started_at', { ascending: false }).limit(7),
    ]);

  const kevas = (kevaRows ?? []) as BouncingRow[];
  const byKevaId = new Map(kevas.map((k) => [k.keva_id, k]));
  const active = kevas.filter((k) => k.enabled && !k.error_text);
  const bouncing = kevas.filter((k) => k.enabled && k.error_kind === 'card_failure');
  const completedTerm = kevas.filter((k) => k.enabled && k.error_kind === 'completed');

  const sumByCur = (rows: BouncingRow[]) => {
    const acc: Record<string, number> = {};
    for (const r of rows) acc[r.currency || 'ILS'] = (acc[r.currency || 'ILS'] ?? 0) + (r.amount ?? 0);
    return Object.entries(acc).map(([c, n]) => fmtMoney(n, sym(c))).join(' + ') || fmtMoney(0, '₪');
  };

  const lastRun = (lastRuns ?? [])[0];
  const failedRuns = (lastRuns ?? []).filter((r) => r.ok === false);
  const needsAttention: Record<string, unknown>[] = Array.isArray(lastRun?.report?.needsAttention)
    ? lastRun.report.needsAttention : [];

  const expiring = active
    .map((k) => ({ ...k, monthsLeft: monthsUntilExpiry(k.tokef) }))
    .filter((k) => k.monthsLeft !== null && k.monthsLeft <= 1);

  const kevaName = (id: string | null) => esc(byKevaId.get(id ?? '')?.client_name ?? id ?? '?');

  const statHtml = `
  <table style="border-collapse:collapse;width:100%;margin:10px 0 6px;">
    <tr>
      <td style="padding:12px;background:#f4f7f4;border-radius:8px;">
        <div style="font-size:12px;color:#666;">Active standing orders</div>
        <div style="font-size:22px;font-weight:bold;">${active.length}</div>
        <div style="font-size:13px;color:#444;">${sumByCur(active)} / month</div>
      </td>
      <td style="width:10px;"></td>
      <td style="padding:12px;background:${bouncing.length ? '#fdf2f0' : '#f4f7f4'};border-radius:8px;">
        <div style="font-size:12px;color:#666;">Bouncing</div>
        <div style="font-size:22px;font-weight:bold;color:${bouncing.length ? '#c0392b' : '#1a7a3a'};">${bouncing.length}</div>
        <div style="font-size:13px;color:#444;">${sumByCur(bouncing)} / month at risk</div>
      </td>
      <td style="width:10px;"></td>
      <td style="padding:12px;background:#fbf7ef;border-radius:8px;">
        <div style="font-size:12px;color:#666;">Term completed</div>
        <div style="font-size:22px;font-weight:bold;color:#8a6d1a;">${completedTerm.length}</div>
        <div style="font-size:13px;color:#444;">${sumByCur(completedTerm)} / month to renew</div>
      </td>
      <td style="width:10px;"></td>
      <td style="padding:12px;background:#f4f7f4;border-radius:8px;">
        <div style="font-size:12px;color:#666;">This week</div>
        <div style="font-size:14px;">🆕 ${newIssues?.length ?? 0} new bounce(s)</div>
        <div style="font-size:14px;">✅ ${resolvedIssues?.length ?? 0} recovered</div>
        <div style="font-size:14px;">✉️ ${(sentLog ?? []).filter((l) => !['failed', 'bounced'].includes(l.status)).length} recovery email(s)</div>
      </td>
    </tr>
  </table>`;

  const bouncingTable = table(
    ['Donor', 'Monthly', 'Since', 'Card error', 'Contact'],
    bouncing
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .map((k) => [
        esc(k.client_name),
        fmtMoney(k.amount ?? 0, sym(k.currency)),
        esc(k.bouncing_since ?? '—'),
        `<span dir="rtl">${esc(k.error_text)}</span>`,
        esc(k.email || k.phone || 'no contact info ⚠️'),
      ])
  );

  const recoveredTable = table(
    ['Donor', 'Monthly', 'Resolved'],
    (resolvedIssues ?? []).map((i) => [
      kevaName(i.keva_id),
      fmtMoney(i.amount ?? 0, '₪'),
      esc(i.resolved_at),
    ])
  );

  // ── Outreach funnel: sent → delivered → opened → paid ────────────────
  const recoveredDonors = new Set((resolvedIssues ?? []).map((i: any) => i.donor_id).filter(Boolean));
  const STATUS_LABEL: Record<string, string> = {
    sent: '✉️ sent', delivered: '📬 delivered', opened: '👀 opened',
    clicked: '🔗 clicked link', bounced: '⚠️ bounced', failed: '❌ failed',
  };
  const log = sentLog ?? [];
  // One row per donor: their latest email this week.
  const latestByDonor = new Map<string, any>();
  for (const l of log) if (l.donor_id && !latestByDonor.has(l.donor_id)) latestByDonor.set(l.donor_id, l);
  const funnelRows = Array.from(latestByDonor.values());
  const nOf = (s: string[]) => funnelRows.filter((l) => s.includes(l.status)).length;
  const paidCount = funnelRows.filter((l) => recoveredDonors.has(l.donor_id)).length;
  const funnelLine = funnelRows.length
    ? `<p style="font-size:14px;margin:4px 0 8px;"><b>${funnelRows.length}</b> emailed →
       <b>${nOf(['delivered', 'opened', 'clicked'])}</b> delivered →
       <b>${nOf(['opened', 'clicked'])}</b> opened →
       <b style="color:#1a7a3a;">${paidCount}</b> paid ✓
       ${nOf(['bounced', 'failed']) ? ` · <b style="color:#c0392b;">${nOf(['bounced', 'failed'])}</b> undeliverable` : ''}</p>`
    : '';

  const outreachTable = funnelLine + table(
    ['Donor', 'Email status', 'Result'],
    funnelRows.map((l) => [
      esc(l.to_address),
      STATUS_LABEL[l.status] ?? esc(l.status),
      recoveredDonors.has(l.donor_id)
        ? '<b style="color:#1a7a3a;">✅ PAID — recovered</b>'
        : ['opened', 'clicked'].includes(l.status)
          ? '<span style="color:#8a6d1a;">saw it, not yet paid</span>'
          : ['bounced', 'failed'].includes(l.status)
            ? '<span style="color:#c0392b;">never reached them — call</span>'
            : 'waiting',
    ])
  );

  const attentionTable = table(
    ['Donor', 'Monthly', 'Why it needs you'],
    needsAttention.map((n) => [
      esc((n as any).name),
      fmtMoney(Number((n as any).amount ?? 0), sym(String((n as any).currency ?? 'ILS'))),
      esc((n as any).reason) + ((n as any).phone ? ` — 📞 ${esc((n as any).phone)}` : ''),
    ])
  );

  const completedTable = table(
    ['Donor', 'Was giving', 'Contact'],
    completedTerm
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .map((k) => [
        esc(k.client_name),
        fmtMoney(k.amount ?? 0, sym(k.currency)) + '/mo',
        esc(k.email || k.phone || '—'),
      ])
  );

  const expiringTable = table(
    ['Donor', 'Monthly', 'Card expires', 'Contact'],
    expiring.map((k) => [
      esc(k.client_name),
      fmtMoney(k.amount ?? 0, sym(k.currency)),
      esc(k.tokef ? `${k.tokef.slice(0, 2)}/${k.tokef.slice(2)}` : '?'),
      esc(k.email || k.phone || '—'),
    ])
  );

  const healthNote = lastRun
    ? `Last sync: ${esc(String(lastRun.started_at).slice(0, 16).replace('T', ' '))} UTC — ${lastRun.ok ? 'OK' : `FAILED: ${esc(lastRun.error)}`}` +
      (failedRuns.length > 1 ? ` · ⚠️ ${failedRuns.length} failed run(s) this week` : '')
    : '⚠️ No sync has run yet.';

  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' });
  const subject = bouncing.length
    ? `Nedarim weekly: ${bouncing.length} bouncing (${sumByCur(bouncing)}/mo at risk) — ${today}`
    : `Nedarim weekly: all standing orders healthy — ${today}`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;">
  <div style="max-width:680px;margin:0 auto;padding:28px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <h1 style="font-size:20px;margin:0 0 2px;">Nedarim Plus — weekly report</h1>
    <p style="color:#888;font-size:13px;margin:0 0 10px;">${healthNote}</p>
    ${statHtml}
    ${section(`🔴 Currently bouncing (${bouncing.length})`, bouncingTable)}
    ${section(`🙏 Needs your personal attention (${needsAttention.length})`, attentionTable)}
    ${section(`✅ Recovered this week (${resolvedIssues?.length ?? 0})`, recoveredTable)}
    ${section(`✉️ Automated recovery emails this week (${sentLog?.length ?? 0})`, outreachTable)}
    ${section(`🔄 Finished their commitment — worth a renewal ask (${completedTerm.length})`, completedTable)}
    ${section(`⏳ Cards expiring within a month (${expiring.length})`, expiringTable)}
    <p style="color:#999;font-size:12px;margin-top:28px;">Sent automatically by the Ateret Yaakov CRM · <a href="${process.env.CRM_PUBLIC_URL || 'https://www.ateretyaakov.com'}/crm/nedarim" style="color:#999;">open the Nedarim dashboard</a></p>
  </div></body></html>`;

  return { subject, html };
}

export async function sendWeeklyNedarimReport(): Promise<{ to: string }> {
  const to =
    process.env.NEDARIM_REPORT_EMAIL ||
    process.env.CRM_ADMIN_EMAIL ||
    process.env.RESEND_REPLY_TO;
  if (!to) throw new Error('No report recipient: set NEDARIM_REPORT_EMAIL (or CRM_ADMIN_EMAIL).');

  const { subject, html } = await buildWeeklyNedarimReport();
  await sendHtmlEmail({ to, subject, html });

  const supabase = createAdminClient();
  const { data: latest } = await supabase
    .from('nedarim_sync_runs').select('id').order('started_at', { ascending: false }).limit(1);
  if (latest?.[0]) {
    await supabase.from('nedarim_sync_runs').update({ weekly_report_sent: true }).eq('id', latest[0].id);
  }
  return { to };
}

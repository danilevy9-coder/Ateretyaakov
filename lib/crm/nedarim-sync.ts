// ── Nedarim Plus sync + automated recovery outreach ─────────────────
// Daily pipeline:
//   1. Pull every standing order from Nedarim (GetKevaJson).
//   2. Mirror into nedarim_keva, matching / creating donors.
//   3. Open a failed_payment issue for every NEW bounce (ErrorText set),
//      auto-resolve issues whose keva charges cleanly again.
//   4. Email bouncing donors from the failed_payment template, in their
//      language, with a staged cadence (initial → reminders → stop).
//   5. Log everything to nedarim_sync_runs for the UI + weekly digest.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchAllKevas,
  fetchKevaDetail,
  friendlyErrorReason,
  monthsUntilExpiry,
  type NedarimKeva,
} from './nedarim';
import { sendEmail } from './email';
import { renderTemplate, currencySymbol, normalizePhone, ORG_NAME } from './util';

const SITE = process.env.CRM_PUBLIC_URL || 'https://www.ateretyaakov.com';
const DONATE_URL = process.env.NEDARIM_DONATE_URL || `${SITE}/support`;
const REMINDER_DAYS = Number(process.env.NEDARIM_REMINDER_DAYS || 7);
const MAX_NOTICES = Number(process.env.NEDARIM_MAX_NOTICES || 3);
const DETAIL_LOOKUPS_PER_RUN = 15; // GetKevaId calls per run, kept well under rate limits

export interface SyncSummary {
  runId: string | null;
  ok: boolean;
  error?: string;
  kevasTotal: number;
  kevasActive: number;
  kevasBouncing: number;
  newBounces: number;
  recovered: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;
}

interface DonorLite {
  id: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  external_id: string | null;
  first_name: string | null;
  full_name: string | null;
  preferred_language: 'en' | 'he';
  status: string;
  tags: string[];
  monthly_amount: number | null;
  currency: string;
  unsubscribed: boolean;
  unsubscribe_token: string;
}

const todayJerusalem = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD

async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filter?: (q: any) => any
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select(columns).range(from, from + page - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

const hasHebrew = (s: string | null) => /[֐-׿]/.test(s || '');

function kevaIsBouncing(k: NedarimKeva): boolean {
  return k.enabled && Boolean(k.errorText);
}

// ── Donor matching ───────────────────────────────────────────────────
function buildDonorIndex(donors: DonorLite[]) {
  const byEmail = new Map<string, DonorLite>();
  const byPhone = new Map<string, DonorLite>();
  const byExtId = new Map<string, DonorLite>();
  for (const d of donors) {
    if (d.email) byEmail.set(d.email.toLowerCase(), d);
    const p = normalizePhone(d.phone);
    if (p) byPhone.set(p, d);
    const w = normalizePhone(d.whatsapp_phone);
    if (w) byPhone.set(w, d);
    if (d.external_id) byExtId.set(d.external_id.toLowerCase(), d);
  }
  return { byEmail, byPhone, byExtId };
}

function matchDonor(k: NedarimKeva, idx: ReturnType<typeof buildDonorIndex>): DonorLite | null {
  if (k.email) {
    const d = idx.byEmail.get(k.email.toLowerCase());
    if (d) return d;
  }
  const p = normalizePhone(k.phone);
  if (p) {
    const d = idx.byPhone.get(p);
    if (d) return d;
  }
  if (k.zeout) {
    const d = idx.byExtId.get(k.zeout.toLowerCase());
    if (d) return d;
  }
  return null;
}

// ── Main entry ───────────────────────────────────────────────────────
export async function runNedarimSync(
  trigger: 'cron' | 'manual',
  client?: SupabaseClient // injectable for tests; defaults to the service-role client
): Promise<SyncSummary> {
  const supabase = client ?? createAdminClient();
  const today = todayJerusalem();

  const { data: runRow, error: runErr } = await supabase
    .from('nedarim_sync_runs')
    .insert({ trigger })
    .select('id')
    .single();
  if (runErr || !runRow) throw new Error('Could not create sync run: ' + runErr?.message);
  const runId = runRow.id as string;

  const summary: SyncSummary = {
    runId, ok: false, kevasTotal: 0, kevasActive: 0, kevasBouncing: 0,
    newBounces: 0, recovered: 0, emailsSent: 0, emailsFailed: 0, emailsSkipped: 0,
  };
  const report: Record<string, unknown[]> = {
    newBounces: [], recovered: [], emailsSent: [], needsAttention: [], expiringCards: [],
  };

  try {
    // 1 ── pull from Nedarim ------------------------------------------------
    const kevas = await fetchAllKevas();
    summary.kevasTotal = kevas.length;
    summary.kevasActive = kevas.filter((k) => k.enabled).length;
    const bouncing = kevas.filter(kevaIsBouncing);
    summary.kevasBouncing = bouncing.length;

    // 2 ── existing state ---------------------------------------------------
    const existingKevas = await fetchAllRows<{
      keva_id: string; donor_id: string | null; error_text: string | null; bouncing_since: string | null;
    }>(supabase, 'nedarim_keva', 'keva_id, donor_id, error_text, bouncing_since');
    const existingByKevaId = new Map(existingKevas.map((r) => [r.keva_id, r]));

    const donors = await fetchAllRows<DonorLite>(
      supabase,
      'donors',
      'id, email, phone, whatsapp_phone, external_id, first_name, full_name, preferred_language, status, tags, monthly_amount, currency, unsubscribed, unsubscribe_token'
    );
    const idx = buildDonorIndex(donors);

    // 3 ── match or create donors ------------------------------------------
    const donorIdByKeva = new Map<string, string>();
    const donorById = new Map(donors.map((d) => [d.id, d]));

    for (const k of kevas) {
      const prior = existingByKevaId.get(k.kevaId);
      if (prior?.donor_id && donorById.has(prior.donor_id)) {
        donorIdByKeva.set(k.kevaId, prior.donor_id);
        continue;
      }
      let donor = matchDonor(k, idx);
      if (!donor && (k.email || k.phone) && k.clientName) {
        const lang: 'en' | 'he' = hasHebrew(k.clientName) ? 'he' : 'en';
        const insert = {
          full_name: k.clientName,
          first_name: k.clientName.split(/\s+/)[0],
          email: k.email,
          phone: k.phone,
          whatsapp_phone: k.phone,
          address_line: k.address,
          city: k.city,
          segment: 'monthly_regular',
          source: 'nedarim',
          preferred_language: lang,
          status: 'active',
          monthly_amount: k.amount,
          currency: k.currency,
          raw: k.raw,
        };
        const { data: created, error: insErr } = await supabase
          .from('donors')
          .insert(insert)
          .select('id, email, phone, whatsapp_phone, external_id, first_name, full_name, preferred_language, status, tags, monthly_amount, currency, unsubscribed, unsubscribe_token')
          .single();
        if (!insErr && created) {
          donor = created as DonorLite;
          donorById.set(donor.id, donor);
          if (donor.email) idx.byEmail.set(donor.email.toLowerCase(), donor);
          const p = normalizePhone(donor.phone);
          if (p) idx.byPhone.set(p, donor);
        }
      }
      if (donor) donorIdByKeva.set(k.kevaId, donor.id);
    }

    // 4 ── mirror kevas into nedarim_keva -----------------------------------
    const upserts = kevas.map((k) => {
      const prior = existingByKevaId.get(k.kevaId);
      const nowBouncing = kevaIsBouncing(k);
      const wasBouncing = Boolean(prior?.error_text);
      return {
        keva_id: k.kevaId,
        donor_id: donorIdByKeva.get(k.kevaId) ?? null,
        client_name: k.clientName,
        zeout: k.zeout,
        email: k.email,
        phone: k.phone,
        address_line: k.address,
        city: k.city,
        amount: k.amount,
        currency: k.currency,
        charges_done: k.chargesDone,
        charges_remaining: k.chargesRemaining,
        last_num: k.lastNum,
        tokef: k.tokef,
        nedarim_created: k.createdDate,
        next_charge: k.nextDate,
        error_text: k.errorText,
        enabled: k.enabled,
        bouncing_since: nowBouncing ? (wasBouncing ? prior?.bouncing_since ?? today : today) : null,
        groupe: k.groupe,
        comments: k.comments,
        masof_id: k.masofId,
        raw: k.raw,
        last_synced_at: new Date().toISOString(),
      };
    });
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabase
        .from('nedarim_keva')
        .upsert(upserts.slice(i, i + 500), { onConflict: 'keva_id' });
      if (error) throw new Error('nedarim_keva upsert: ' + error.message);
    }

    // 5 ── issue lifecycle ---------------------------------------------------
    const openIssues = await fetchAllRows<{
      id: string; donor_id: string; keva_id: string | null;
      notify_count: number; last_notified_at: string | null; detected_at: string;
    }>(supabase, 'donor_issues', 'id, donor_id, keva_id, notify_count, last_notified_at, detected_at',
      (q) => q.eq('type', 'failed_payment').eq('status', 'open'));

    const issueByKevaId = new Map(openIssues.filter((i) => i.keva_id).map((i) => [i.keva_id!, i]));
    const legacyIssueByDonor = new Map(
      openIssues.filter((i) => !i.keva_id).map((i) => [i.donor_id, i])
    );

    const kevaById = new Map(kevas.map((k) => [k.kevaId, k]));

    // 5a. new bounces → open (or adopt) an issue
    let detailBudget = DETAIL_LOOKUPS_PER_RUN;
    for (const k of bouncing) {
      if (issueByKevaId.has(k.kevaId)) continue;
      const donorId = donorIdByKeva.get(k.kevaId) ?? null;
      const donor = donorId ? donorById.get(donorId) : null;

      // Enrich with charge history when we can afford the extra API call.
      let historyNote = '';
      if (detailBudget > 0) {
        detailBudget--;
        try {
          const det = await fetchKevaDetail(k.kevaId);
          if (det) {
            const declines = det.history.filter((h) => h.status === 'declined');
            const lastOk = det.history.find((h) => h.status === 'success');
            historyNote = ` · ${declines.length} declined attempt(s)` +
              (lastOk?.date ? `, last successful charge ${lastOk.date}` : '');
          }
        } catch { /* enrichment only — never fail the sync on it */ }
      }

      const sym = currencySymbol(k.currency);
      const detail =
        `Nedarim keva #${k.kevaId}: ${sym}${k.amount ?? '?'}/mo bouncing — ` +
        `${k.errorText}` +
        (k.lastNum ? ` (card ****${k.lastNum}${k.tokef ? `, exp ${k.tokef.slice(0, 2)}/${k.tokef.slice(2)}` : ''})` : '') +
        historyNote;

      const legacy = donorId ? legacyIssueByDonor.get(donorId) : undefined;
      if (legacy) {
        // The manual bounce upload already flagged this donor — adopt that issue.
        await supabase.from('donor_issues')
          .update({ keva_id: k.kevaId, amount: k.amount, detail, raw: k.raw })
          .eq('id', legacy.id);
        issueByKevaId.set(k.kevaId, { ...legacy, keva_id: k.kevaId });
        legacyIssueByDonor.delete(donorId!);
      } else if (donorId) {
        const { data: created, error } = await supabase.from('donor_issues')
          .insert({
            donor_id: donorId, type: 'failed_payment', status: 'open',
            amount: k.amount, detail, detected_at: today, keva_id: k.kevaId, raw: k.raw,
          })
          .select('id, donor_id, keva_id, notify_count, last_notified_at, detected_at')
          .single();
        if (!error && created) {
          issueByKevaId.set(k.kevaId, created as any);
          summary.newBounces++;
          report.newBounces.push({
            kevaId: k.kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
            error: k.errorText, email: k.email, phone: k.phone,
          });
          if (donor && donor.status === 'active') {
            const tags = donor.tags?.includes('bouncing') ? donor.tags : [...(donor.tags ?? []), 'bouncing'];
            await supabase.from('donors').update({ status: 'lapsed', tags }).eq('id', donorId);
          }
        }
      } else {
        report.needsAttention.push({
          kevaId: k.kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
          error: k.errorText, reason: 'No matching donor / no contact info',
        });
      }
    }

    // 5b. recoveries → resolve the issue, restore the donor
    for (const issue of openIssues) {
      if (!issue.keva_id) continue;
      const k = kevaById.get(issue.keva_id);
      if (!k) continue; // keva vanished from Nedarim — leave open, surfaced in the report
      if (k.enabled && !k.errorText) {
        await supabase.from('donor_issues')
          .update({ status: 'resolved', resolved_at: today, detail: `Auto-resolved ${today}: charge went through again.` })
          .eq('id', issue.id);
        summary.recovered++;
        report.recovered.push({
          kevaId: k.kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
        });
        const donor = donorById.get(issue.donor_id);
        if (donor) {
          await supabase.from('donors').update({
            status: 'active',
            tags: (donor.tags ?? []).filter((t) => t !== 'bouncing'),
          }).eq('id', donor.id);
        }
      }
    }

    // 6 ── automated recovery emails ----------------------------------------
    const { data: tmplRows } = await supabase
      .from('message_templates')
      .select('language, subject, body, is_default')
      .eq('channel', 'email')
      .eq('category', 'failed_payment')
      .order('is_default', { ascending: false });
    const tmplByLang = new Map<string, { subject: string | null; body: string }>();
    for (const t of tmplRows ?? []) {
      if (!tmplByLang.has(t.language)) tmplByLang.set(t.language, t);
    }

    const now = Date.now();
    for (const [kevaId, issue] of Array.from(issueByKevaId.entries())) {
      const k = kevaById.get(kevaId);
      if (!k || !kevaIsBouncing(k)) continue;
      const donor = donorById.get(issue.donor_id);
      if (!donor) continue;

      if (!donor.email) {
        report.needsAttention.push({
          kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
          error: k.errorText, phone: k.phone, reason: 'No email — call or WhatsApp manually',
        });
        continue;
      }
      if (donor.unsubscribed) {
        summary.emailsSkipped++;
        report.needsAttention.push({
          kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
          error: k.errorText, reason: 'Unsubscribed from email — needs manual contact',
        });
        continue;
      }
      if (issue.notify_count >= MAX_NOTICES) {
        report.needsAttention.push({
          kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
          error: k.errorText, reason: `${issue.notify_count} emails sent, still bouncing — needs a call`,
        });
        continue;
      }
      const lastMs = issue.last_notified_at ? new Date(issue.last_notified_at).getTime() : 0;
      const due = issue.notify_count === 0 || now - lastMs >= REMINDER_DAYS * 86400_000;
      if (!due) continue;

      const lang = donor.preferred_language === 'he' ? 'he' : 'en';
      const tmpl = tmplByLang.get(lang) ?? tmplByLang.get(lang === 'he' ? 'en' : 'he');
      if (!tmpl) continue;

      const vars = {
        first_name: donor.first_name || (k.clientName || '').split(/\s+/)[0] || 'Friend',
        full_name: donor.full_name || k.clientName || '',
        monthly_amount: (k.amount ?? donor.monthly_amount ?? 0).toLocaleString('en-US'),
        amount: (k.amount ?? 0).toLocaleString('en-US'),
        balance: '',
        currency: currencySymbol(k.currency),
        org: ORG_NAME,
        error_reason: friendlyErrorReason(k.errorText, lang),
        card_last4: k.lastNum ?? '',
      };
      let subject = renderTemplate(tmpl.subject || `Payment issue — ${ORG_NAME}`, vars);
      const body = renderTemplate(tmpl.body, vars).replaceAll('[DONATE LINK]', DONATE_URL);
      if (issue.notify_count > 0) {
        subject = (lang === 'he' ? 'תזכורת: ' : 'Reminder: ') + subject;
      }

      // Safety valve for testing with real credentials: sync everything but
      // send nothing. Set NEDARIM_DRY_RUN=1 in the environment.
      if (process.env.NEDARIM_DRY_RUN) {
        summary.emailsSkipped++;
        report.emailsSent.push({ to: donor.email, name: k.clientName, kevaId, notice: issue.notify_count + 1, dryRun: true });
        continue;
      }

      let status = 'sent';
      let providerId: string | null = null;
      let errMsg: string | null = null;
      try {
        const r = await sendEmail({
          to: donor.email, subject, body, language: lang,
          unsubscribeUrl: `${SITE}/api/crm/unsubscribe?token=${donor.unsubscribe_token}`,
        });
        providerId = r.id;
        summary.emailsSent++;
        report.emailsSent.push({
          to: donor.email, name: k.clientName, kevaId, notice: issue.notify_count + 1,
        });
        await supabase.from('donor_issues')
          .update({ last_notified_at: new Date().toISOString(), notify_count: issue.notify_count + 1 })
          .eq('id', issue.id);
      } catch (e) {
        status = 'failed';
        errMsg = String(e);
        summary.emailsFailed++; // notify_count not bumped — retried next run
      }
      await supabase.from('message_log').insert({
        donor_id: donor.id, channel: 'email', language: lang,
        to_address: donor.email, subject, body, status,
        provider_id: providerId, error: errMsg, sent_by: 'nedarim-auto', batch_id: runId,
      });
    }

    // 7 ── card-expiry watch (active, charging fine, expiring ≤ 1 month) ----
    for (const k of kevas) {
      if (!k.enabled || k.errorText) continue;
      const m = monthsUntilExpiry(k.tokef);
      if (m !== null && m <= 1) {
        report.expiringCards.push({
          kevaId: k.kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
          tokef: k.tokef, email: k.email, phone: k.phone, monthsLeft: m,
        });
      }
    }

    summary.ok = true;
  } catch (e) {
    summary.error = String(e);
  }

  await supabase.from('nedarim_sync_runs').update({
    finished_at: new Date().toISOString(),
    ok: summary.ok,
    error: summary.error ?? null,
    kevas_total: summary.kevasTotal,
    kevas_active: summary.kevasActive,
    kevas_bouncing: summary.kevasBouncing,
    new_bounces: summary.newBounces,
    recovered: summary.recovered,
    emails_sent: summary.emailsSent,
    emails_failed: summary.emailsFailed,
    emails_skipped: summary.emailsSkipped,
    report,
  }).eq('id', runId);

  return summary;
}

// ── Nedarim Plus sync + recovery outreach ───────────────────────────
// Daily pipeline:
//   1. Pull every standing order from Nedarim (GetKevaJson).
//   2. Mirror into nedarim_keva, matching / creating donors.
//   3. Open a failed_payment issue for every NEW bounce (ErrorText set),
//      auto-resolve issues whose keva charges cleanly again.
//   4. Recovery emails — ONLY when crm_settings.outreach_mode is 'auto',
//      and then only to donors whose category treatment allows it
//      (see lib/crm/outreach.ts). In manual mode (the default) the sync
//      detects and reports but sends nothing; the admin sends from the
//      Recovery page.
//   5. Log everything to nedarim_sync_runs for the UI + weekly digest.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  classifyError,
  fetchAllKevas,
  fetchHistoryPage,
  fetchKevaDetail,
  monthsUntilExpiry,
  type NedarimKeva,
} from './nedarim';
import { currencySymbol, normalizePhone } from './util';
import { loadOutreachConfig, ruleForDonor } from './outreach';
import { loadRecoveryTemplates, sendRecoveryToDonor } from './recovery-email';

export { greetingName } from './recovery-email';

const DETAIL_LOOKUPS_PER_RUN = 15; // GetKevaId calls per run, kept well under rate limits

export interface SyncSummary {
  runId: string | null;
  ok: boolean;
  error?: string;
  kevasTotal: number;
  kevasActive: number;
  kevasBouncing: number;
  kevasCompleted: number; // finished their committed term — not failures
  newBounces: number;
  recovered: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;
  paymentsImported: number;
}

interface DonorLite {
  id: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  external_id: string | null;
  first_name: string | null;
  full_name: string | null;
  hebrew_name: string | null;
  latin_name: string | null;
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

// Bouncing = a genuine card failure on an active order. Orders whose error is
// "completed its term" are a different bucket — never auto-emailed.
function kevaIsBouncing(k: NedarimKeva): boolean {
  return k.enabled && classifyError(k.errorText) === 'card_failure';
}

function kevaIsCompleted(k: NedarimKeva): boolean {
  return k.enabled && classifyError(k.errorText) === 'completed';
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

  // Only one sync at a time — overlapping runs race on issue creation.
  const { data: running } = await supabase
    .from('nedarim_sync_runs')
    .select('id')
    .is('finished_at', null)
    .gte('started_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(1);
  if (running?.length) {
    return {
      runId: null, ok: false, error: 'A sync is already running — try again in a minute.',
      kevasTotal: 0, kevasActive: 0, kevasBouncing: 0, kevasCompleted: 0,
      newBounces: 0, recovered: 0, emailsSent: 0, emailsFailed: 0, emailsSkipped: 0,
      paymentsImported: 0,
    };
  }

  const { data: runRow, error: runErr } = await supabase
    .from('nedarim_sync_runs')
    .insert({ trigger })
    .select('id')
    .single();
  if (runErr || !runRow) throw new Error('Could not create sync run: ' + runErr?.message);
  const runId = runRow.id as string;

  const summary: SyncSummary = {
    runId, ok: false, kevasTotal: 0, kevasActive: 0, kevasBouncing: 0, kevasCompleted: 0,
    newBounces: 0, recovered: 0, emailsSent: 0, emailsFailed: 0, emailsSkipped: 0,
    paymentsImported: 0,
  };
  const report: Record<string, any> = {
    newBounces: [], recovered: [], emailsSent: [], needsAttention: [], expiringCards: [],
    completedTerm: [], heldForManual: [],
  };

  try {
    // 1 ── pull from Nedarim ------------------------------------------------
    const kevas = await fetchAllKevas();
    summary.kevasTotal = kevas.length;
    summary.kevasActive = kevas.filter((k) => k.enabled).length;
    const bouncing = kevas.filter(kevaIsBouncing);
    summary.kevasBouncing = bouncing.length;
    const completed = kevas.filter(kevaIsCompleted);
    summary.kevasCompleted = completed.length;
    for (const k of completed) {
      report.completedTerm.push({
        kevaId: k.kevaId, name: k.clientName, amount: k.amount, currency: k.currency,
        email: k.email, phone: k.phone,
      });
    }

    // 2 ── existing state ---------------------------------------------------
    const existingKevas = await fetchAllRows<{
      keva_id: string; donor_id: string | null; error_text: string | null; bouncing_since: string | null;
    }>(supabase, 'nedarim_keva', 'keva_id, donor_id, error_text, bouncing_since');
    const existingByKevaId = new Map(existingKevas.map((r) => [r.keva_id, r]));

    const donors = await fetchAllRows<DonorLite>(
      supabase,
      'donors',
      'id, email, phone, whatsapp_phone, external_id, first_name, full_name, hebrew_name, latin_name, preferred_language, status, tags, monthly_amount, currency, unsubscribed, unsubscribe_token'
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
          .select('id, email, phone, whatsapp_phone, external_id, first_name, full_name, hebrew_name, latin_name, preferred_language, status, tags, monthly_amount, currency, unsubscribed, unsubscribe_token')
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
        error_kind: classifyError(k.errorText),
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

    // 4b ── transaction history mirror ---------------------------------------
    // Incremental: resume from the highest TransactionId already stored.
    // Rate limit is 20 calls/hour, so page conservatively; a big first
    // import simply continues across the next runs via the cursor.
    try {
      const { data: cursorRow } = await supabase
        .from('nedarim_payments')
        .select('transaction_num')
        .order('transaction_num', { ascending: false })
        .limit(1);
      let cursor: string | null = cursorRow?.[0]?.transaction_num != null
        ? String(cursorRow[0].transaction_num) : null;

      const MAX_HISTORY_PAGES = trigger === 'manual' ? 8 : 4;
      for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
        const payments = await fetchHistoryPage(cursor);
        if (!payments.length) break;
        const rows = payments.map((p) => {
          let donorId = p.kevaId ? donorIdByKeva.get(p.kevaId) ?? null : null;
          if (!donorId) {
            const d =
              (p.email && idx.byEmail.get(p.email)) ||
              (normalizePhone(p.phone) && idx.byPhone.get(normalizePhone(p.phone))) ||
              null;
            donorId = d ? d.id : null;
          }
          return {
            transaction_id: p.transactionId,
            transaction_num: p.transactionNum,
            keva_id: p.kevaId,
            donor_id: donorId,
            client_name: p.clientName,
            zeout: p.zeout,
            email: p.email,
            phone: p.phone,
            amount: p.amount,
            currency: p.currency,
            paid_at: p.paidAt,
            transaction_type: p.transactionType,
            confirmation: p.confirmation,
            shovar: p.shovar,
            last_num: p.lastNum,
            groupe: p.groupe,
            comments: p.comments,
            masof_id: p.masofId,
            receipt_id: p.receiptId,
            raw: p.raw,
          };
        });
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase
            .from('nedarim_payments')
            .upsert(rows.slice(i, i + 500), { onConflict: 'transaction_id', ignoreDuplicates: true });
          if (error) throw new Error('nedarim_payments upsert: ' + error.message);
        }
        summary.paymentsImported += payments.length;
        if (payments.length < 2000) break;
        cursor = payments[payments.length - 1].transactionId;
      }
    } catch (e) {
      // History import is additive — a failure here must not block bounce
      // detection and outreach. Surface it in the run report instead.
      report.needsAttention.push({ reason: `Payment-history import error: ${String(e)}` });
    }

    // 5 ── issue lifecycle ---------------------------------------------------
    // Includes snoozed ("left out") issues so we never re-create or re-email
    // an issue the admin explicitly parked.
    const openIssues = await fetchAllRows<{
      id: string; donor_id: string; keva_id: string | null; type: string; status: string;
      notify_count: number; last_notified_at: string | null; detected_at: string;
    }>(supabase, 'donor_issues', 'id, donor_id, keva_id, type, status, notify_count, last_notified_at, detected_at',
      (q) => q.in('type', ['failed_payment', 'lapsed']).in('status', ['open', 'snoozed']));

    const issueByKevaId = new Map(openIssues.filter((i) => i.keva_id).map((i) => [i.keva_id!, i]));
    const legacyIssueByDonor = new Map(
      openIssues
        .filter((i) => !i.keva_id && i.type === 'failed_payment' && i.status === 'open')
        .map((i) => [i.donor_id, i])
    );

    const kevaById = new Map(kevas.map((k) => [k.kevaId, k]));

    // 5-pre. Re-type any failed_payment issue whose order actually COMPLETED
    // its term (incl. ones created before this distinction existed): it
    // becomes a "lapsed" issue — renewal outreach is a human decision, and
    // the donor must never get a "problem with your payment" email.
    const completedByKevaId = new Set(completed.map((k) => k.kevaId));
    const bouncingDonorIds = new Set(
      bouncing.map((k) => donorIdByKeva.get(k.kevaId)).filter(Boolean)
    );
    for (const issue of openIssues) {
      if (issue.type !== 'failed_payment') continue;
      if (!issue.keva_id || !completedByKevaId.has(issue.keva_id)) continue;
      const k = kevaById.get(issue.keva_id)!;
      await supabase.from('donor_issues').update({
        type: 'lapsed',
        detail: `Nedarim keva #${k.kevaId}: monthly commitment finished (${k.chargesDone ?? '?'} charges completed) — renewal opportunity.`,
        amount: k.amount,
      }).eq('id', issue.id);
      issue.type = 'lapsed';
      const donor = donorById.get(issue.donor_id);
      // Keep the tag if another of their orders is genuinely card-failing.
      if (donor?.tags?.includes('bouncing') && !bouncingDonorIds.has(donor.id)) {
        await supabase.from('donors').update({
          tags: donor.tags.filter((t) => t !== 'bouncing'),
        }).eq('id', donor.id);
      }
    }

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
          .select('id, donor_id, keva_id, type, status, notify_count, last_notified_at, detected_at')
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

    // 5a-bis. completed-term orders → open a "lapsed" issue (renewal
    // follow-up in the Issues page). Never auto-emailed.
    for (const k of completed) {
      if (issueByKevaId.has(k.kevaId)) continue;
      const donorId = donorIdByKeva.get(k.kevaId) ?? null;
      if (!donorId) continue;
      const { data: created, error } = await supabase.from('donor_issues')
        .insert({
          donor_id: donorId, type: 'lapsed', status: 'open',
          amount: k.amount, detected_at: today, keva_id: k.kevaId, raw: k.raw,
          detail: `Nedarim keva #${k.kevaId}: monthly commitment finished (${k.chargesDone ?? '?'} charges completed) — renewal opportunity.`,
        })
        .select('id, donor_id, keva_id, type, status, notify_count, last_notified_at, detected_at')
        .single();
      if (!error && created) {
        issueByKevaId.set(k.kevaId, created as any);
        const donor = donorById.get(donorId);
        if (donor && donor.status === 'active') {
          await supabase.from('donors').update({ status: 'lapsed' }).eq('id', donorId);
        }
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

    // 6 ── recovery emails — gated by the master switch + category rules ----
    const tmplByLang = await loadRecoveryTemplates(supabase);

    // Group per donor — someone with several bouncing orders (it happens; one
    // donor had six) gets ONE email covering the combined monthly amount.
    interface Group { donor: DonorLite; issues: typeof openIssues; kevas: NedarimKeva[] }
    const groups = new Map<string, Group>();
    for (const [kevaId, issue] of Array.from(issueByKevaId.entries())) {
      if (issue.type !== 'failed_payment' || issue.status !== 'open') continue;
      const k = kevaById.get(kevaId);
      if (!k || !kevaIsBouncing(k)) continue;
      const donor = donorById.get(issue.donor_id);
      if (!donor) continue;
      const g = groups.get(donor.id) ?? { donor, issues: [], kevas: [] };
      g.issues.push(issue);
      g.kevas.push(k);
      groups.set(donor.id, g);
    }

    // Master switch + per-category treatment for every donor in play.
    const outreach = await loadOutreachConfig(supabase, Array.from(groups.keys()));
    report.outreachMode = outreach.mode;

    const now = Date.now();
    for (const { donor, issues, kevas: donorKevas } of Array.from(groups.values())) {
      // Use the largest order for error/card details; sum amounts per donor.
      const main = donorKevas.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
      const totalAmount = donorKevas.reduce((s, k) => s + (k.amount ?? 0), 0);
      const names = main.clientName;

      if (!donor.email) {
        report.needsAttention.push({
          kevaId: main.kevaId, name: names, amount: totalAmount, currency: main.currency,
          error: main.errorText, phone: main.phone, reason: 'No email — call or WhatsApp manually',
        });
        continue;
      }
      if (donor.unsubscribed) {
        summary.emailsSkipped++;
        report.needsAttention.push({
          kevaId: main.kevaId, name: names, amount: totalAmount, currency: main.currency,
          error: main.errorText, reason: 'Unsubscribed from email — needs manual contact',
        });
        continue;
      }
      const rule = ruleForDonor(outreach, donor.id);
      const notifyCount = Math.max(...issues.map((i) => i.notify_count));
      const lastMs = Math.max(0, ...issues.map((i) => (i.last_notified_at ? new Date(i.last_notified_at).getTime() : 0)));
      if (notifyCount >= rule.max_messages) {
        report.needsAttention.push({
          kevaId: main.kevaId, name: names, amount: totalAmount, currency: main.currency,
          error: main.errorText, reason: `${notifyCount} emails sent, still bouncing — needs a call`,
        });
        continue;
      }
      const due = notifyCount === 0 || now - lastMs >= rule.followup_days * 86400_000;
      if (!due) continue;

      // Master switch off, or this donor's category says manual/none →
      // hold it for the admin. The Recovery page is the send button.
      if (outreach.mode !== 'auto' || rule.policy !== 'auto') {
        summary.emailsSkipped++;
        report.heldForManual.push({
          name: names, to: donor.email, amount: totalAmount, currency: main.currency,
          reason: outreach.mode !== 'auto' ? 'Sending is set to manual' : `Category treatment: ${rule.policy}`,
        });
        continue;
      }

      // Safety valve for testing with real credentials: sync everything but
      // send nothing. Set NEDARIM_DRY_RUN=1 in the environment.
      if (process.env.NEDARIM_DRY_RUN) {
        summary.emailsSkipped++;
        report.emailsSent.push({ to: donor.email, name: names, kevaId: main.kevaId, notice: notifyCount + 1, dryRun: true });
        continue;
      }

      const res = await sendRecoveryToDonor({
        supabase, donor, kevas: donorKevas,
        issueIds: issues.map((i) => i.id), notifyCount, tmplByLang,
        sentBy: 'nedarim-auto', batchId: runId,
      });
      if (res.ok) {
        summary.emailsSent++;
        report.emailsSent.push({
          to: donor.email, name: names, kevaId: main.kevaId, orders: donorKevas.length, notice: notifyCount + 1,
        });
      } else {
        summary.emailsFailed++; // notify_count not bumped — retried next run
      }
    }

    // 6b ── engagement tracking: refresh delivery/open status ---------------
    // Resend records the last event per email (delivered / opened / clicked /
    // bounced). Poll recent outreach so the workbench + weekly digest can
    // show who received, who opened, and who ignored.
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey && !process.env.NEDARIM_MOCK) {
        const since = new Date(Date.now() - 14 * 86400_000).toISOString();
        const { data: recent } = await supabase
          .from('message_log')
          .select('id, provider_id, status')
          .in('sent_by', ['nedarim-auto', 'nedarim-manual'])
          .in('status', ['sent', 'delivered', 'opened'])
          .not('provider_id', 'is', null)
          .gte('created_at', since)
          .limit(200);
        const rank: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4 };
        for (const m of recent ?? []) {
          try {
            const res = await fetch(`https://api.resend.com/emails/${m.provider_id}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) continue;
            const j = (await res.json()) as { last_event?: string };
            const ev = String(j.last_event || '');
            const next =
              /bounce|complain/.test(ev) ? 'bounced'
              : ev === 'clicked' ? 'clicked'
              : ev === 'opened' ? 'opened'
              : ev === 'delivered' || ev === 'delivery_delayed' ? 'delivered'
              : null;
            if (next && (rank[next] ?? 0) > (rank[m.status] ?? 0)) {
              await supabase.from('message_log').update({ status: next }).eq('id', m.id);
            }
          } catch { /* best effort per email */ }
        }
      }
    } catch { /* tracking must never fail the sync */ }

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
    kevas_completed: summary.kevasCompleted,
    payments_imported: summary.paymentsImported,
    new_bounces: summary.newBounces,
    recovered: summary.recovered,
    emails_sent: summary.emailsSent,
    emails_failed: summary.emailsFailed,
    emails_skipped: summary.emailsSkipped,
    report,
  }).eq('id', runId);

  return summary;
}

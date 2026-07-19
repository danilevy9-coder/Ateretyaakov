// ── Payment-recovery email, shared by automation and manual send ─────
// One bilingual email per donor covering all their bouncing orders,
// built from the "failed_payment" templates. Used by the daily sync
// (when automation is on) and by the Recovery page's Send button.

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { renderTemplate, currencySymbol, ORG_NAME } from './util';
import { friendlyErrorReason } from './nedarim';

const SITE = process.env.CRM_PUBLIC_URL || 'https://www.ateretyaakov.com';
const DONATE_URL = process.env.NEDARIM_DONATE_URL || `${SITE}/support`;

export interface RecoveryDonor {
  id: string;
  email: string | null;
  first_name: string | null;
  full_name: string | null;
  hebrew_name: string | null;
  latin_name: string | null;
  preferred_language: 'en' | 'he';
  unsubscribed: boolean;
  unsubscribe_token: string;
}

// The keva fields the email needs — camelCase to match the Nedarim client;
// callers reading from the nedarim_keva table map their snake_case rows.
export interface RecoveryKeva {
  kevaId: string;
  clientName: string | null;
  amount: number | null;
  currency: string;
  errorText: string | null;
  lastNum: string | null;
}

export type RecoveryTemplates = Map<string, { subject: string | null; body: string }>;

// Greeting name in the right script for each language section of the
// bilingual email. Falls back to whatever name exists — a Latin name in
// the Hebrew section reads fine, and vice versa.
export function greetingName(
  lang: 'en' | 'he',
  d: { first_name?: string | null; full_name?: string | null; hebrew_name?: string | null; latin_name?: string | null },
  fallback?: string | null
): string {
  const heb = (s?: string | null) => /[֐-׿]/.test(s || '');
  const first = (s?: string | null) => (s || '').trim().split(/\s+/)[0] || '';
  const candidates =
    lang === 'he'
      ? [d.hebrew_name, heb(d.first_name) ? d.first_name : null, heb(d.full_name) ? d.full_name : null,
         heb(fallback) ? fallback : null, d.first_name, d.full_name, fallback]
      : [d.latin_name, !heb(d.first_name) ? d.first_name : null, !heb(d.full_name) ? d.full_name : null,
         !heb(fallback) ? fallback : null, d.first_name, d.full_name, fallback];
  for (const c of candidates) {
    const f = first(c);
    if (f) return f;
  }
  return lang === 'he' ? 'ידידנו' : 'Friend';
}

export async function loadRecoveryTemplates(supabase: SupabaseClient): Promise<RecoveryTemplates> {
  const { data: rows } = await supabase
    .from('message_templates')
    .select('language, subject, body, is_default')
    .eq('channel', 'email')
    .eq('category', 'failed_payment')
    .order('is_default', { ascending: false });
  const byLang: RecoveryTemplates = new Map();
  for (const t of rows ?? []) {
    if (!byLang.has(t.language)) byLang.set(t.language, t);
  }
  return byLang;
}

export function buildRecoveryEmail(
  donor: RecoveryDonor,
  kevas: RecoveryKeva[],
  tmplByLang: RecoveryTemplates,
  reminder: boolean
): { subject: string; body: string; sections: { body: string; language: 'he' | 'en' }[]; lang: 'he' | 'en' } | null {
  if (!kevas.length) return null;
  // Use the largest order for error/card details; sum amounts per donor.
  const main = kevas.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
  const totalAmount = kevas.reduce((s, k) => s + (k.amount ?? 0), 0);
  const names = main.clientName;

  // One bilingual email: the donor's language first, the other below.
  // Greeting name rendered in the matching script for each section.
  const preferred: 'he' | 'en' = donor.preferred_language === 'he' ? 'he' : 'en';
  const ordered: ('he' | 'en')[] = preferred === 'he' ? ['he', 'en'] : ['en', 'he'];
  const sections: { body: string; language: 'he' | 'en' }[] = [];
  let subject = '';
  for (const lang of ordered) {
    const tmpl = tmplByLang.get(lang);
    if (!tmpl) continue;
    const vars = {
      first_name: greetingName(lang, donor, names),
      full_name: donor.full_name || names || '',
      monthly_amount: totalAmount.toLocaleString('en-US'),
      amount: totalAmount.toLocaleString('en-US'),
      balance: '',
      currency: currencySymbol(main.currency),
      org: ORG_NAME,
      error_reason: friendlyErrorReason(main.errorText, lang),
      card_last4: main.lastNum ?? '',
    };
    if (!subject) subject = renderTemplate(tmpl.subject || `Payment issue — ${ORG_NAME}`, vars);
    sections.push({
      body: renderTemplate(tmpl.body, vars).replaceAll('[DONATE LINK]', DONATE_URL),
      language: lang,
    });
  }
  if (!sections.length) return null;
  if (reminder) subject = (preferred === 'he' ? 'תזכורת: ' : 'Reminder: ') + subject;
  return {
    subject,
    body: sections.map((s) => s.body).join('\n\n──────────────────\n\n'),
    sections,
    lang: preferred,
  };
}

// Send + stamp the issues + log — the one way a recovery email leaves the
// system, so cadence counters stay correct whether a human or the sync sent it.
export async function sendRecoveryToDonor(opts: {
  supabase: SupabaseClient;
  donor: RecoveryDonor;
  kevas: RecoveryKeva[];
  issueIds: string[];
  notifyCount: number; // emails already sent for this problem
  tmplByLang: RecoveryTemplates;
  sentBy: string; // 'nedarim-auto' or the admin's email
  batchId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, donor, kevas, issueIds, notifyCount, tmplByLang, sentBy, batchId } = opts;
  if (!donor.email) return { ok: false, error: 'No email address' };
  const built = buildRecoveryEmail(donor, kevas, tmplByLang, notifyCount > 0);
  if (!built) return { ok: false, error: 'No failed_payment template found (Templates page)' };

  let status = 'sent';
  let providerId: string | null = null;
  let errMsg: string | null = null;
  try {
    const r = await sendEmail({
      to: donor.email,
      subject: built.subject,
      body: built.body,
      language: built.lang,
      sections: built.sections,
      unsubscribeUrl: `${SITE}/api/crm/unsubscribe?token=${donor.unsubscribe_token}`,
    });
    providerId = r.id;
    // Stamp every one of the donor's bouncing issues so cadence stays in
    // step across all their orders.
    if (issueIds.length) {
      await supabase.from('donor_issues')
        .update({ last_notified_at: new Date().toISOString(), notify_count: notifyCount + 1 })
        .in('id', issueIds);
    }
  } catch (e) {
    status = 'failed';
    errMsg = String(e);
  }
  await supabase.from('message_log').insert({
    donor_id: donor.id, channel: 'email', language: built.lang,
    to_address: donor.email, subject: built.subject, body: built.body, status,
    provider_id: providerId, error: errMsg, sent_by: sentBy, batch_id: batchId ?? null,
  });
  return status === 'sent' ? { ok: true } : { ok: false, error: errMsg ?? 'send failed' };
}

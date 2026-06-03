import { createAdminClient } from '@/lib/supabase/admin';
import { toNumber, toDate, cleanStr, normalizePhone } from './util';
import type { ImportKind } from './ai-mapping';
import type { IssueType } from './types';

const NUMERIC_FIELDS = new Set(['total_pledged', 'total_paid', 'monthly_amount', 'monthly_tuition']);
const DATE_FIELDS = new Set(['first_gift_at', 'last_gift_at', 'date_of_birth', 'enrolled_on', 'withdrawn_on']);

export interface CommitParams {
  kind: ImportKind;
  mapping: Record<string, string | null>;
  rows: Record<string, unknown>[];
  defaultSegment?: string | null;
  defaultLanguage?: 'en' | 'he' | null;
  filename?: string;
  sheetName?: string;
  createdBy?: string;
  // When set, create an open issue of this type for every imported donor.
  issueType?: IssueType | null;
}

export interface CommitResult {
  batchId: string;
  rowCount: number;
  inserted: number;
  updated: number;
  skipped: number;
  issuesCreated: number;
  errors: string[];
}

function buildRecord(
  row: Record<string, unknown>,
  mapping: Record<string, string | null>
): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [source, field] of Object.entries(mapping)) {
    if (!field) continue;
    const raw = row[source];
    if (NUMERIC_FIELDS.has(field)) {
      const n = toNumber(raw);
      if (n !== null) rec[field] = n;
    } else if (DATE_FIELDS.has(field)) {
      const d = toDate(raw);
      if (d !== null) rec[field] = d;
    } else {
      const s = cleanStr(raw);
      if (s !== null) rec[field] = s;
    }
  }
  return rec;
}

function normalizeDonor(rec: Record<string, unknown>, defaults: { segment?: string | null; language?: string | null }) {
  // Compose full_name if only first/last given (and vice-versa for first_name).
  if (!rec.full_name && (rec.first_name || rec.last_name)) {
    rec.full_name = `${rec.first_name ?? ''} ${rec.last_name ?? ''}`.trim();
  }
  if (!rec.first_name && rec.full_name) {
    rec.first_name = String(rec.full_name).split(/\s+/)[0];
  }
  // Segment / language fallbacks.
  const seg = (rec.segment as string) || defaults.segment || 'other';
  rec.segment = ['monthly_regular', 'campaign_oneoff', 'campaign_monthly', 'other'].includes(seg)
    ? seg
    : 'other';
  const lang = (rec.preferred_language as string) || defaults.language || 'en';
  rec.preferred_language = lang === 'he' ? 'he' : 'en';
  // WhatsApp number defaults to phone.
  if (!rec.whatsapp_phone && rec.phone) rec.whatsapp_phone = rec.phone;
  return rec;
}

function dedupeKeyOf(rec: Record<string, unknown>): string | null {
  const ext = cleanStr(rec.external_id);
  if (ext) return ext.toLowerCase();
  const email = cleanStr(rec.email);
  if (email) return email.toLowerCase();
  const phone = normalizePhone(rec.phone as string);
  return phone || null;
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export async function commitImport(params: CommitParams): Promise<CommitResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. Create the batch record up-front so rows can reference it.
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      kind: params.kind,
      filename: params.filename,
      sheet_name: params.sheetName,
      source_columns: Object.keys(params.mapping),
      mapping: params.mapping,
      ai_model: process.env.CRM_AI_MODEL || 'claude-sonnet-4-6',
      row_count: params.rows.length,
      created_by: params.createdBy,
    })
    .select('id')
    .single();
  if (batchErr || !batch) throw new Error('Could not create import batch: ' + batchErr?.message);
  const batchId = batch.id as string;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let issuesCreated = 0;

  if (params.kind === 'students') {
    const recs = params.rows
      .map((r) => buildRecord(r, params.mapping))
      .map((rec, i) => {
        if (!rec.full_name && (rec.first_name || rec.last_name)) {
          rec.full_name = `${rec.first_name ?? ''} ${rec.last_name ?? ''}`.trim();
        }
        rec.import_batch_id = batchId;
        rec.raw = params.rows[i];
        return rec;
      })
      .filter((rec) => rec.full_name || rec.first_name || rec.external_id);
    skipped = params.rows.length - recs.length;

    for (const part of chunk(recs, 500)) {
      const { error } = await supabase.from('students').insert(part);
      if (error) errors.push(error.message);
      else inserted += part.length;
    }

    await supabase.from('import_batches').update({ inserted, updated, skipped, errors }).eq('id', batchId);
    return { batchId, rowCount: params.rows.length, inserted, updated, skipped, issuesCreated, errors };
  }

  // ── DONORS ──
  const records = params.rows.map((r, i) => {
    const rec = normalizeDonor(buildRecord(r, params.mapping), {
      segment: params.defaultSegment,
      language: params.defaultLanguage,
    });
    rec.import_batch_id = batchId;
    rec.raw = params.rows[i];
    return rec;
  });

  // De-dupe within the file (keep last occurrence) and drop empty rows.
  const seen = new Map<string, Record<string, unknown>>();
  const noKey: Record<string, unknown>[] = [];
  for (const rec of records) {
    if (!rec.full_name && !rec.first_name && !rec.email && !rec.external_id) {
      skipped++;
      continue;
    }
    const key = dedupeKeyOf(rec);
    if (key) seen.set(key, rec);
    else noKey.push(rec);
  }

  const keyedRecs = Array.from(seen.entries()); // [key, rec]
  const allKeys = keyedRecs.map(([k]) => k);

  // Find which keys already exist.
  const existing = new Map<string, string>(); // key -> id
  for (const part of chunk(allKeys, 300)) {
    const { data, error } = await supabase
      .from('donors')
      .select('id, dedupe_key')
      .in('dedupe_key', part);
    if (error) errors.push(error.message);
    for (const r of data ?? []) {
      if (r.dedupe_key) existing.set(r.dedupe_key as string, r.id as string);
    }
  }

  const toInsert: Record<string, unknown>[] = [...noKey];
  const toUpdate: { id: string; rec: Record<string, unknown> }[] = [];
  for (const [key, rec] of keyedRecs) {
    const id = existing.get(key);
    if (id) toUpdate.push({ id, rec });
    else toInsert.push(rec);
  }

  // Bulk insert new donors.
  for (const part of chunk(toInsert, 500)) {
    const { data, error } = await supabase.from('donors').insert(part).select('id');
    if (error) {
      errors.push(error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  // Merge-update existing donors (only overwrite with non-null new values).
  for (const { id, rec } of toUpdate) {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'raw' || k === 'import_batch_id') continue;
      if (v !== null && v !== undefined && v !== '') patch[k] = v;
    }
    const { error } = await supabase.from('donors').update(patch).eq('id', id);
    if (error) errors.push(error.message);
    else updated += 1;
  }

  // Optionally flag every imported donor with an issue (monthly issues upload).
  if (params.issueType) {
    // Re-fetch ids for all keyed + we have insert ids implicitly; simplest: look up by keys again.
    const idByKey = new Map(existing);
    for (const part of chunk(allKeys, 300)) {
      const { data } = await supabase.from('donors').select('id, dedupe_key, balance').in('dedupe_key', part);
      for (const r of data ?? []) if (r.dedupe_key) idByKey.set(r.dedupe_key as string, r.id as string);
    }
    const issues = keyedRecs
      .map(([key, rec]) => {
        const donorId = idByKey.get(key);
        if (!donorId) return null;
        return {
          donor_id: donorId,
          type: params.issueType,
          status: 'open',
          amount: (rec.total_pledged && rec.total_paid)
            ? Number(rec.total_pledged) - Number(rec.total_paid)
            : null,
          detail: 'Imported from issues file' + (params.filename ? ` (${params.filename})` : ''),
          import_batch_id: batchId,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    for (const part of chunk(issues, 500)) {
      const { error } = await supabase.from('donor_issues').insert(part);
      if (error) errors.push(error.message);
      else issuesCreated += part.length;
    }
  }

  await supabase.from('import_batches').update({ inserted, updated, skipped, errors }).eq('id', batchId);
  return {
    batchId,
    rowCount: params.rows.length,
    inserted,
    updated,
    skipped,
    issuesCreated,
    errors,
  };
}

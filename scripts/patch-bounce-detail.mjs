/**
 * Enrich the open failed_payment issues with full bounce history from the
 * source spreadsheet (months bouncing, # charges, first/last charge, card).
 * Run: node --env-file=.env.local scripts/patch-bounce-detail.mjs
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const FILE = './Ateret Yaakov Campaigns/Bouncing_Recurring_Donors (1).xlsx';
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const s = (v) => (v == null ? '' : String(v).trim());
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(x) ? x : null; };
const digits = (v) => (v ? String(v).replace(/[^0-9]/g, '') : '');

const rows = [];
// Not-in-Campaigns (less detail) first, so Genuine Bounces (richer) overrides.
for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Not in Campaigns'], { range: 3, defval: null })) {
  if (s(r['On Bounce List']).toLowerCase() !== 'yes') continue;
  rows.push({
    email: s(r['Email']), phone: s(r['Phone']),
    monthly: num(r['Amount (ILS)']), type: s(r['Type']), cause: s(r['Donated To (Cause)']),
    raw: { source: 'Nedarim Plus', monthly: num(r['Amount (ILS)']), type: s(r['Type']) },
  });
}
for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Genuine Bounces'], { range: 3, defval: null })) {
  if (!s(r['Name']) && !s(r['Email']) && !s(r['Phone'])) continue;
  rows.push({
    email: s(r['Email']), phone: s(r['Phone']),
    monthly: num(r['Monthly Amount (ILS)']),
    raw: {
      monthly: num(r['Monthly Amount (ILS)']),
      months_bouncing: num(r['Months Bouncing']),
      charges: num(r['# Charges']),
      first_charge: s(r['First Charge']),
      last_charge: s(r['Last Charge']),
      card_brand: s(r['Brand']),
      last_card: s(r['Last Card']),
      cause: s(r['Donated To (Cause)']),
    },
  });
}

const detailOf = (raw) => {
  if (raw.months_bouncing != null) {
    return [
      `${raw.months_bouncing} month(s) bouncing`,
      `${raw.charges ?? '?'} charge(s)`,
      raw.last_charge ? `last charge ${raw.last_charge}` : null,
      raw.first_charge ? `first ${raw.first_charge}` : null,
      raw.monthly != null ? `₪${raw.monthly}/mo` : null,
      raw.card_brand ? `${raw.card_brand} ${raw.last_card ?? ''}`.trim() : null,
      raw.cause || null,
    ].filter(Boolean).join(' · ');
  }
  return [`Bouncing recurring donor (Nedarim Plus)`, raw.monthly != null ? `₪${raw.monthly}/mo` : null, raw.type ? `type ${raw.type}` : null].filter(Boolean).join(' · ');
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const donors = (await c.query(`select id, lower(email) em, regexp_replace(coalesce(phone,''),'[^0-9]','','g') ph from donors`)).rows;
const byEmail = new Map(), byPhone = new Map();
for (const d of donors) { if (d.em) byEmail.set(d.em, d.id); if (d.ph) byPhone.set(d.ph, d.id); }

let patched = 0, noMatch = 0, noIssue = 0;
for (const r of rows) {
  const id = (r.email && byEmail.get(r.email.toLowerCase())) || (digits(r.phone) && byPhone.get(digits(r.phone)));
  if (!id) { noMatch++; continue; }
  const res = await c.query(
    `update donor_issues set detail=$2, raw=$3
     where donor_id=$1 and type='failed_payment' and status='open'`,
    [id, detailOf(r.raw), JSON.stringify(r.raw)]
  );
  if (res.rowCount > 0) patched += res.rowCount; else noIssue++;
}
console.log(`✓ Patched ${patched} failed_payment issues with full history.`);
console.log(`  (${noMatch} rows matched no donor, ${noIssue} matched donor had no open issue)`);

const sample = await c.query(`select detail from donor_issues where type='failed_payment' and status='open' and raw->>'months_bouncing' is not null order by (raw->>'months_bouncing')::int desc limit 3`);
console.log('\nSample enriched details:');
for (const x of sample.rows) console.log('  •', x.detail);
await c.end();

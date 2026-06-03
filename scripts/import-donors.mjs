/**
 * One-off clean import of "All campaigns summary.xlsx" → donors + contributions.
 * Run: node --env-file=.env.local scripts/import-donors.mjs [--commit]
 * Without --commit it does a dry run (parse + report, no writes).
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const COMMIT = process.argv.includes('--commit');
const FILE = './Ateret Yaakov Campaigns/All campaigns summary.xlsx';
const YEARS = ['2021 (₪)', '2022 (₪)', '2024 (₪)', '2025 (₪)', '2026 (₪)'];

const cleanStr = (v) => { if (v == null) return null; const s = String(v).trim(); return s === '' ? null : s; };
const cleanNote = (v) => {
  let s = cleanStr(v); if (!s) return null;
  if (s.toLowerCase() === 'nan') return null;
  s = s.replace(/\s*\|\s*nan\s*$/i, '').replace(/^\s*nan\s*\|\s*/i, '').trim();
  return s === '' ? null : s;
};
const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
const digits = (v) => (v ? String(v).replace(/[^0-9]/g, '') : '');

// ── Parse ──
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Donors Master'], { defval: null });

let skippedEmpty = 0;
const byKey = new Map();      // dedupe_key -> record
const noKey = [];             // records without a dedupe key

for (const r of rows) {
  const firstEn = cleanStr(r['First Name (EN)']);
  const lastEn = cleanStr(r['Last Name (EN)']);
  const firstHe = cleanStr(r['First Name (HE)']);
  const lastHe = cleanStr(r['Last Name (HE)']);
  const email = cleanStr(r['Email']);
  const phone = cleanStr(r['Phone']);
  const total = num(r['Total (₪)']);

  const fullEn = [firstEn, lastEn].filter(Boolean).join(' ').trim();
  const fullHe = [firstHe, lastHe].filter(Boolean).join(' ').trim();
  const full_name = fullEn || fullHe || null;

  // Skip rows with no identity and no money at all.
  if (!full_name && !email && !phone && !total) { skippedEmpty++; continue; }

  // Year contributions + first/last gift
  const contribs = [];
  let firstYear = null, lastYear = null;
  for (const col of YEARS) {
    const amt = num(r[col]);
    if (amt && amt > 0) {
      const y = parseInt(col.slice(0, 4), 10);
      contribs.push({ year: y, amount: amt });
      firstYear = firstYear == null ? y : Math.min(firstYear, y);
      lastYear = lastYear == null ? y : Math.max(lastYear, y);
    }
  }
  const totalPaid = total != null ? total : contribs.reduce((a, c) => a + c.amount, 0);
  const lang = (r['Default Language'] || '').toString().toLowerCase().startsWith('he') ? 'he' : 'en';

  const rec = {
    id: randomUUID(),
    first_name: firstEn,
    last_name: lastEn,
    full_name,
    hebrew_name: fullHe || null,
    email,
    phone,
    whatsapp_phone: phone,
    preferred_language: lang,
    segment: 'campaign_oneoff',
    source: cleanStr(r['Ambassador / Team']),
    currency: 'ILS',
    total_pledged: totalPaid,
    total_paid: totalPaid,
    first_gift_at: firstYear ? `${firstYear}-01-01` : null,
    last_gift_at: lastYear ? `${lastYear}-01-01` : null,
    notes: cleanNote(r['Notes']),
    raw: r,
    contribs,
  };

  const key = email ? email.toLowerCase() : (digits(phone) || null);
  if (!key) { noKey.push(rec); continue; }
  const prev = byKey.get(key);
  if (!prev || (rec.total_paid || 0) > (prev.total_paid || 0)) byKey.set(key, rec); // keep larger on dup
}

const collapsed = rows.length - skippedEmpty - byKey.size - noKey.length;
const all = [...byKey.values(), ...noKey];
const totalSum = all.reduce((a, r) => a + (r.total_paid || 0), 0);
const heCount = all.filter((r) => r.preferred_language === 'he').length;
const withEmail = all.filter((r) => r.email).length;
const withPhone = all.filter((r) => r.phone).length;
const contribCount = all.reduce((a, r) => a + r.contribs.length, 0);

console.log('── Parse summary ──');
console.log('rows in sheet:        ', rows.length);
console.log('skipped (empty):      ', skippedEmpty);
console.log('duplicates collapsed: ', collapsed);
console.log('donors to import:     ', all.length);
console.log('  with email:         ', withEmail);
console.log('  with phone:         ', withPhone);
console.log('  Hebrew language:    ', heCount, '| English:', all.length - heCount);
console.log('contributions:        ', contribCount);
console.log('total ₪:              ', totalSum.toLocaleString());
console.log('\nSample mapped donors:');
for (const r of all.slice(0, 3)) console.log('  ', JSON.stringify({ full_name: r.full_name, hebrew_name: r.hebrew_name, email: r.email, lang: r.preferred_language, total: r.total_paid, source: r.source, contribs: r.contribs }));

if (!COMMIT) { console.log('\n(DRY RUN — re-run with --commit to write to the database)'); process.exit(0); }

// ── Insert ──
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

try {
  await c.query('begin');
  const batch = (await c.query(
    `insert into import_batches (kind, filename, sheet_name, source_columns, row_count, created_by, ai_model, notes)
     values ('donors',$1,'Donors Master',$2,$3,'import-script','manual-mapping','All campaigns consolidated') returning id`,
    [FILE, JSON.stringify(Object.keys(rows[0] || {})), rows.length]
  )).rows[0];
  const batchId = batch.id;

  // donors
  const cols = ['id','first_name','last_name','full_name','hebrew_name','email','phone','whatsapp_phone','preferred_language','segment','source','currency','total_pledged','total_paid','first_gift_at','last_gift_at','notes','import_batch_id','raw'];
  let inserted = 0;
  for (const part of chunk(all, 400)) {
    const vals = [];
    const ph = part.map((r, i) => {
      const base = i * cols.length;
      vals.push(r.id, r.first_name, r.last_name, r.full_name, r.hebrew_name, r.email, r.phone, r.whatsapp_phone, r.preferred_language, r.segment, r.source, r.currency, r.total_pledged, r.total_paid, r.first_gift_at, r.last_gift_at, r.notes, batchId, JSON.stringify(r.raw));
      return '(' + cols.map((_, j) => `$${base + j + 1}`).join(',') + ')';
    });
    await c.query(`insert into donors (${cols.join(',')}) values ${ph.join(',')}`, vals);
    inserted += part.length;
  }

  // contributions
  const contribRows = [];
  for (const r of all) for (const ct of r.contribs) contribRows.push([r.id, ct.amount, `${ct.year}-01-01`, 'completed', `${ct.year} Campaign`]);
  let cins = 0;
  for (const part of chunk(contribRows, 800)) {
    const vals = [];
    const ph = part.map((row, i) => { const b = i * 5; vals.push(...row); return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`; });
    await c.query(`insert into donor_contributions (donor_id, amount, paid_on, status, campaign) values ${ph.join(',')}`, vals);
    cins += part.length;
  }

  await c.query(`update import_batches set inserted=$1, skipped=$2 where id=$3`, [inserted, skippedEmpty, batchId]);
  await c.query('commit');
  console.log(`\n✓ COMMITTED — ${inserted} donors, ${cins} contributions. Batch ${batchId}`);
} catch (e) {
  await c.query('rollback');
  console.error('\n✗ Failed (rolled back):', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}

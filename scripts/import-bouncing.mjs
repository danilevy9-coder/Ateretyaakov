/**
 * Import Bouncing_Recurring_Donors (1).xlsx — 3 tabs:
 *  - "Genuine Bounces"   -> monthly_regular, lapsed, OPEN failed_payment issue
 *  - "Re-Registered"     -> monthly_regular, active, NO issue (do not chase)
 *  - "Not in Campaigns"  -> monthly_regular; flag failed_payment if "On Bounce List" = Yes
 * De-dupes across all tabs + against existing donors (email/phone). Idempotent issues.
 * Run: node --env-file=.env.local scripts/import-bouncing.mjs [--commit]
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const COMMIT = process.argv.includes('--commit');
const FILE = './Ateret Yaakov Campaigns/Bouncing_Recurring_Donors (1).xlsx';
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });

const s = (v) => { if (v == null) return null; const t = String(v).trim(); return t === '' || t.toLowerCase() === 'nan' ? null : t; };
const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
const digits = (v) => (v ? String(v).replace(/[^0-9]/g, '') : '');
const isHe = (v) => !!v && /[֐-׿]/.test(v);
const sheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { range: 3, defval: null });

function rec(r, flag, source) {
  const name = s(r['Name']);
  const email = s(r['Email']);
  const phone = s(r['Phone']);
  if (!name && !email && !phone) return null;
  const monthly = num(r['Monthly Amount (ILS)']) ?? num(r['Amount (ILS)']) ?? num(r['New Amount']) ?? num(r['Old Amount']);
  return {
    name, email, phone, id: s(r['ID Number']), monthly,
    hebrew: isHe(name) ? name : null,
    language: isHe(name) ? 'he' : 'en',
    cause: s(r['Donated To (Cause)']) || s(r['Donated To']) || source,
    flag,
    detail: flag
      ? `Bouncing recurring donor${r['Months Bouncing'] ? ` — ${s(r['Months Bouncing'])} months` : ''}` +
        `${r['Last Charge'] ? `; last charge ${s(r['Last Charge'])}` : ''}` +
        `${r['Type'] ? `; type ${s(r['Type'])}` : ''}`
      : null,
    raw: r,
  };
}

const lists = [
  ...sheet('Genuine Bounces').map((r) => rec(r, true, 'Recurring (bouncing)')),
  ...sheet('Re-Registered').map((r) => rec(r, false, 'Recurring (re-registered)')),
  ...sheet('Not in Campaigns').map((r) => rec(r, s(r['On Bounce List'])?.toLowerCase() === 'yes', 'Nedarim Plus')),
].filter(Boolean);

// Global de-dupe by email|phone|id; OR the flags, fill missing fields, keep max monthly.
const merged = new Map();
const nameOnly = [];
for (const r of lists) {
  const key = (r.email && r.email.toLowerCase()) || digits(r.phone) || (r.id && 'id:' + r.id) || null;
  if (!key) { nameOnly.push(r); continue; }
  const prev = merged.get(key);
  if (!prev) { merged.set(key, { ...r }); continue; }
  prev.flag = prev.flag || r.flag;
  prev.email = prev.email || r.email;
  prev.phone = prev.phone || r.phone;
  prev.id = prev.id || r.id;
  prev.hebrew = prev.hebrew || r.hebrew;
  prev.monthly = Math.max(prev.monthly || 0, r.monthly || 0) || null;
  if (r.flag && r.detail) prev.detail = r.detail;
}
const all = [...merged.values(), ...nameOnly];
const flagged = all.filter((r) => r.flag);

console.log('── Parse ──');
console.log('rows across 3 tabs:', lists.length);
console.log('unique donors:     ', all.length, `(name-only: ${nameOnly.length})`);
console.log('to flag (bouncing):', flagged.length);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const existing = (await c.query(`select id, lower(email) em, regexp_replace(coalesce(phone,''),'[^0-9]','','g') ph from donors`)).rows;
const byEmail = new Map(), byPhone = new Map();
for (const d of existing) { if (d.em) byEmail.set(d.em, d.id); if (d.ph) byPhone.set(d.ph, d.id); }
const findId = (r) => (r.email && byEmail.get(r.email.toLowerCase())) || (digits(r.phone) && byPhone.get(digits(r.phone))) || null;

let willUpdate = 0, willInsert = 0;
for (const r of all) (findId(r) ? willUpdate++ : willInsert++);
console.log(`Match plan: ${willUpdate} update existing, ${willInsert} insert new\n`);

if (!COMMIT) { console.log('(DRY RUN — add --commit to write)'); await c.end(); process.exit(0); }

try {
  await c.query('begin');
  const batch = (await c.query(
    `insert into import_batches (kind, filename, sheet_name, row_count, created_by, ai_model, notes)
     values ('issues',$1,'Genuine+ReReg+NotInCampaigns',$2,'import-script','manual-mapping','Bouncing recurring donors') returning id`,
    [FILE, all.length]
  )).rows[0];
  const batchId = batch.id;
  let updated = 0, inserted = 0, issues = 0;

  for (const r of all) {
    let id = findId(r);
    const status = r.flag ? 'lapsed' : 'active';
    if (id) {
      await c.query(
        `update donors set segment='monthly_regular', status=$2, currency='ILS',
           monthly_amount=coalesce($3, monthly_amount),
           email=coalesce(email,$4), phone=coalesce(phone,$5), whatsapp_phone=coalesce(whatsapp_phone, phone, $5),
           tags=(select array(select distinct unnest(coalesce(tags,'{}') || array[$6])))
         where id=$1`,
        [id, status, r.monthly, r.email, r.phone, r.flag ? 'bouncing' : 're-registered']
      );
      updated++;
    } else {
      id = randomUUID();
      await c.query(
        `insert into donors (id, full_name, hebrew_name, email, phone, whatsapp_phone, preferred_language,
            segment, status, currency, monthly_amount, source, tags, import_batch_id, raw)
         values ($1,$2,$3,$4,$5,$5,$6,'monthly_regular',$7,'ILS',$8,$9,array[$10],$11,$12)`,
        [id, r.name, r.hebrew, r.email, r.phone, r.language, status, r.monthly,
         r.cause || 'Recurring donor', r.flag ? 'bouncing' : 're-registered', batchId, JSON.stringify(r.raw)]
      );
      inserted++;
    }
    if (r.email) byEmail.set(r.email.toLowerCase(), id);
    if (digits(r.phone)) byPhone.set(digits(r.phone), id);

    if (r.flag) {
      // idempotent: only one open failed_payment issue per donor
      const ins = await c.query(
        `insert into donor_issues (donor_id, type, status, amount, detail, import_batch_id)
         select $1,'failed_payment','open',$2,$3,$4
         where not exists (select 1 from donor_issues where donor_id=$1 and type='failed_payment' and status='open')`,
        [id, r.monthly, r.detail, batchId]
      );
      issues += ins.rowCount;
    }
  }

  await c.query(`update import_batches set inserted=$1, updated=$2 where id=$3`, [inserted, updated, batchId]);
  await c.query('commit');
  console.log(`✓ COMMITTED — updated ${updated}, inserted ${inserted}, flagged ${issues} as failed_payment. Batch ${batchId}`);
} catch (e) {
  await c.query('rollback');
  console.error('✗ Failed (rolled back):', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}

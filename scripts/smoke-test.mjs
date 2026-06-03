/**
 * End-to-end DB smoke test. Inserts clearly-marked test rows, asserts the
 * schema behaves (generated columns, dedupe, joins, tuition math), then
 * deletes everything it created. Run: node --env-file=.env.local scripts/smoke-test.mjs
 */
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const TAG = '__SMOKE__';

try {
  // Clean any leftovers from a previous run.
  await c.query(`delete from donors where source = $1`, [TAG]);
  await c.query(`delete from students where external_id like 'SMOKE-%'`);

  // ── Donors ──
  const A = (await c.query(
    `insert into donors (full_name, email, segment, source, total_pledged, total_paid)
     values ('ZZTEST Alpha','zztest.a@example.com','monthly_regular',$1,1000,600) returning id, balance, dedupe_key`, [TAG])).rows[0];
  ok('donor balance generated (1000-600=400)', Number(A.balance) === 400, `got ${A.balance}`);
  ok('dedupe_key uses email', A.dedupe_key === 'zztest.a@example.com', `got ${A.dedupe_key}`);

  const C = (await c.query(
    `insert into donors (full_name, phone, segment, source) values ('ZZTEST Gamma','+1 (555) 123-4567','campaign_monthly',$1) returning id, dedupe_key`, [TAG])).rows[0];
  ok('dedupe_key strips phone to digits', C.dedupe_key === '15551234567', `got ${C.dedupe_key}`);

  const B = (await c.query(
    `insert into donors (full_name, external_id, email, segment, source, total_pledged, total_paid)
     values ('ZZTEST Beta','ZZT-1','zztest.b@example.com','campaign_oneoff',$1,500,500) returning id, dedupe_key`, [TAG])).rows[0];
  ok('dedupe_key prefers external_id', B.dedupe_key === 'zzt-1', `got ${B.dedupe_key}`);

  // Duplicate email should violate the unique dedupe index.
  let dup = false;
  try { await c.query(`insert into donors (email, segment, source) values ('zztest.a@example.com','other',$1)`, [TAG]); }
  catch { dup = true; }
  ok('duplicate dedupe_key rejected', dup);

  // ── Issues ──
  await c.query(`insert into donor_issues (donor_id, type, status, amount) values ($1,'unfulfilled_pledge','open',400)`, [A.id]);
  await c.query(`insert into donor_issues (donor_id, type, status) values ($1,'failed_payment','open')`, [C.id]);
  await c.query(`insert into donor_issues (donor_id, type, status, resolved_at) values ($1,'lapsed','resolved',current_date)`, [B.id]);

  const openJoin = await c.query(
    `select distinct d.full_name from donors d join donor_issues i on i.donor_id=d.id
     where d.source=$1 and i.status='open' order by 1`, [TAG]);
  ok('open-issue join returns A & C only', openJoin.rows.map(r=>r.full_name).join(',') === 'ZZTEST Alpha,ZZTEST Gamma', openJoin.rows.map(r=>r.full_name).join(','));

  const typeFilter = await c.query(
    `select d.full_name from donors d join donor_issues i on i.donor_id=d.id
     where d.source=$1 and i.status='open' and i.type='unfulfilled_pledge'`, [TAG]);
  ok('issue type filter returns A only', typeFilter.rows.length === 1 && typeFilter.rows[0].full_name === 'ZZTEST Alpha');

  // ── Contributions + notes ──
  await c.query(`insert into donor_contributions (donor_id, amount, status, paid_on) values ($1,600,'completed','2026-05-01')`, [A.id]);
  await c.query(`insert into donor_contributions (donor_id, amount, status, paid_on) values ($1,100,'failed','2026-05-15')`, [A.id]);
  await c.query(`insert into donor_notes (donor_id, body) values ($1,'Called, will pay next week')`, [A.id]);
  const contribCount = (await c.query(`select count(*) from donor_contributions where donor_id=$1`, [A.id])).rows[0].count;
  ok('contributions recorded', Number(contribCount) === 2);

  // Cascade check: deleting a donor removes its issues.
  const tmp = (await c.query(`insert into donors (full_name, segment, source) values ('ZZTEST Temp','other',$1) returning id`, [TAG])).rows[0];
  await c.query(`insert into donor_issues (donor_id, type) values ($1,'manual')`, [tmp.id]);
  await c.query(`delete from donors where id=$1`, [tmp.id]);
  const orphan = (await c.query(`select count(*) from donor_issues where donor_id=$1`, [tmp.id])).rows[0].count;
  ok('cascade delete removes issues', Number(orphan) === 0);

  // ── Students + tuition ──
  const S = (await c.query(
    `insert into students (full_name, external_id, status, monthly_tuition, parent_name, parent_email, parent_phone)
     values ('ZZTEST Boy','SMOKE-1','enrolled',800,'ZZTEST Parent','parent@example.com','+972 50 123 4567') returning id`)).rows[0];
  await c.query(`insert into student_payments (student_id, period, amount_due, amount_paid, status) values ($1,'2026-04-01',800,800,'paid')`, [S.id]);
  await c.query(`insert into student_payments (student_id, period, amount_due, amount_paid, status) values ($1,'2026-05-01',800,400,'partial')`, [S.id]);
  await c.query(`insert into student_payments (student_id, period, amount_due, amount_paid, status) values ($1,'2026-06-01',800,0,'unpaid')`, [S.id]);
  // upsert conflict on (student_id, period)
  await c.query(`insert into student_payments (student_id, period, amount_due, amount_paid, status) values ($1,'2026-06-01',800,800,'paid')
                 on conflict (student_id, period) do update set amount_paid=excluded.amount_paid, status=excluded.status`, [S.id]);
  const owed = (await c.query(
    `select coalesce(sum(greatest(0, amount_due-amount_paid)),0) as owed from student_payments where student_id=$1`, [S.id])).rows[0].owed;
  ok('student owed after upsert (400 from May)', Number(owed) === 400, `got ${owed}`);

  // ── Templates present ──
  const t = (await c.query(`select count(*) from message_templates where is_default`)).rows[0].count;
  ok('default templates seeded (14)', Number(t) === 14, `got ${t}`);

} catch (e) {
  fail++; console.log('✗ EXCEPTION', e.message);
} finally {
  // Cleanup
  await c.query(`delete from donors where source = $1`, [TAG]);
  await c.query(`delete from students where external_id like 'SMOKE-%'`);
  console.log(`\nCleaned up test rows.\nRESULT: ${pass} passed, ${fail} failed`);
  await c.end();
  if (fail) process.exitCode = 1;
}

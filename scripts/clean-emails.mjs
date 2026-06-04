/**
 * Clean invalid donor emails: anything that isn't a plausible address gets
 * cleared (set to null) and tagged 'invalid_email'. The original stays in the
 * donor's `raw` data. Donors are kept (they may have a phone for WhatsApp).
 * Run: node --env-file=.env.local scripts/clean-emails.mjs [--commit]
 */
import pg from 'pg';

const COMMIT = process.argv.includes('--commit');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// A plausible email: something@something.tld (no spaces, has a dot in the domain).
const VALID = `email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]{2,}$'`;
const badWhere = `email is not null and not (${VALID})`;

const total = (await c.query(`select count(*) n from donors where email is not null`)).rows[0].n;
const bad = (await c.query(`select count(*) n from donors where ${badWhere}`)).rows[0].n;
console.log(`Donors with an email: ${total}`);
console.log(`Invalid emails to clean: ${bad}`);
const sample = await c.query(`select full_name, email from donors where ${badWhere} limit 15`);
console.log('Examples:');
for (const r of sample.rows) console.log('   ', JSON.stringify(r.email), '—', r.full_name || '(no name)');

if (!COMMIT) { console.log('\n(DRY RUN — add --commit to clean)'); await c.end(); process.exit(0); }

// Per-row, so a dedupe-key collision (the junk-email row duplicates another by
// phone/id) doesn't abort everything — fall back to nulling the colliding key too.
const rows = (await c.query(`select id from donors where ${badWhere}`)).rows;
const tagExpr = `(select array(select distinct unnest(coalesce(tags,'{}') || array['invalid_email'])))`;
let cleaned = 0, dupes = 0, skipped = 0;
for (const r of rows) {
  try {
    await c.query(`update donors set email=null, tags=${tagExpr} where id=$1`, [r.id]);
    cleaned++;
  } catch {
    try {
      await c.query(`update donors set email=null, phone=null, tags=(select array(select distinct unnest(coalesce(tags,'{}') || array['invalid_email','duplicate']))) where id=$1`, [r.id]);
      cleaned++; dupes++;
    } catch {
      try { await c.query(`update donors set email=null, phone=null, external_id=null where id=$1`, [r.id]); cleaned++; dupes++; }
      catch (e) { skipped++; console.log('  skip', r.id, e.message); }
    }
  }
}
console.log(`\n✓ Cleaned ${cleaned} invalid emails (${dupes} were duplicates — also cleared the colliding phone/id; ${skipped} skipped).`);
const left = (await c.query(`select count(*) n from donors where email is not null`)).rows[0].n;
console.log(`Donors with a valid email now: ${left}`);
await c.end();

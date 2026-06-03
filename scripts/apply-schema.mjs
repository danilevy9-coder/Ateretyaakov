/**
 * Applies every SQL file in supabase/migrations (in filename order) to the
 * database in DATABASE_URL. Idempotent — safe to run repeatedly.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-schema.mjs
 *
 * DATABASE_URL = the Supabase connection string
 *   (Dashboard → Settings → Database → Connection string → URI).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

try {
  await client.connect();
  console.log(`Connected. Applying ${files.length} migration(s)…\n`);
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  • ${file} … `);
    await client.query(sql);
    console.log('done');
  }
  console.log('\n✓ Schema applied successfully.');
} catch (err) {
  console.error('\n✗ Failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

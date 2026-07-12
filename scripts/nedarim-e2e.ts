// Usage: E2E_EMAIL=<admin email> E2E_PASSWORD=<password> npx tsx --env-file=.env.local scripts/nedarim-e2e.ts
// (set E2E_KEEP=1 to keep the mock rows for inspection)
// Temporary E2E harness for the Nedarim sync (mock fixtures, real DB).
// Signs in as the CRM admin so RLS grants full access — no service key needed.
import { createClient } from '@supabase/supabase-js';
import { runNedarimSync } from '../lib/crm/nedarim-sync';
import { buildWeeklyNedarimReport } from '../lib/crm/nedarim-report';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;

const MOCK_KEVAS = ['900001', '900002', '900003', '900004'];

async function main() {
  const authClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await authClient.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD,
  });
  if (authErr || !auth.session) throw new Error('login failed: ' + authErr?.message);
  const db = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('signed in as', auth.user?.email);

  const dump = async (label: string) => {
    const { data: kevas } = await db.from('nedarim_keva').select('keva_id, donor_id, error_text, bouncing_since').in('keva_id', MOCK_KEVAS).order('keva_id');
    const donorIds = (kevas ?? []).map((k) => k.donor_id).filter(Boolean);
    const { data: issues } = await db.from('donor_issues').select('keva_id, status, notify_count, amount, detail').in('keva_id', MOCK_KEVAS).order('keva_id');
    const { data: donors } = await db.from('donors').select('full_name, email, status, tags, segment, preferred_language').in('id', donorIds.length ? donorIds : ['00000000-0000-0000-0000-000000000000']);
    const { data: log } = await db.from('message_log').select('to_address, status, subject').eq('sent_by', 'nedarim-auto');
    console.log(`\n=== ${label} ===`);
    console.log('kevas:', JSON.stringify(kevas));
    console.log('issues:', JSON.stringify(issues));
    console.log('donors:', JSON.stringify(donors));
    console.log('message_log:', JSON.stringify(log));
  };

  // Run 1: bouncing fixtures
  process.env.NEDARIM_MOCK = '1';
  const s1 = await runNedarimSync('manual', db);
  console.log('\nRUN1 (mock=1):', JSON.stringify(s1));
  await dump('after run 1');

  // Run 2: same fixtures — must be idempotent (no new bounces/issues)
  const s2 = await runNedarimSync('manual', db);
  console.log('\nRUN2 (mock=1 again):', JSON.stringify(s2));

  // Run 3: keva 900001 recovers, 900003 still bouncing
  process.env.NEDARIM_MOCK = '2';
  const s3 = await runNedarimSync('manual', db);
  console.log('\nRUN3 (mock=2):', JSON.stringify(s3));
  await dump('after run 3 (recovery)');

  // Weekly report render
  const rep = await buildWeeklyNedarimReport(db);
  console.log('\nREPORT subject:', rep.subject);
  console.log('REPORT html length:', rep.html.length, '| mentions ישראל:', rep.html.includes('ישראל'));

  // ── cleanup: remove every test artifact ──
  if (process.env.E2E_KEEP) { console.log('\n(kept test data)'); return; }
  const { data: kevas } = await db.from('nedarim_keva').select('donor_id').in('keva_id', MOCK_KEVAS);
  const donorIds = Array.from(new Set((kevas ?? []).map((k) => k.donor_id).filter(Boolean)));
  await db.from('donor_issues').delete().in('keva_id', MOCK_KEVAS);
  if (donorIds.length) {
    await db.from('message_log').delete().in('donor_id', donorIds);
    await db.from('donors').delete().in('id', donorIds);
  }
  await db.from('nedarim_keva').delete().in('keva_id', MOCK_KEVAS);
  await db.from('nedarim_payments').delete().in('transaction_id', ['500001', '500002', '500003']);
  await db.from('nedarim_sync_runs').delete().eq('trigger', 'manual');
  const { count } = await db.from('nedarim_keva').select('*', { count: 'exact', head: true }).in('keva_id', MOCK_KEVAS);
  console.log('\ncleanup done, remaining mock kevas:', count);
}

main().then(() => process.exit(0)).catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });

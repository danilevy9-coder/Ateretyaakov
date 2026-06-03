/**
 * Creates (or resets) the single CRM admin login by writing directly to the
 * Supabase auth schema via DATABASE_URL. Use when you don't have the
 * service-role key handy. Idempotent on email.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-admin-sql.mjs "your-password"
 *
 * Email comes from CRM_ADMIN_EMAIL (default rabbig@lchaimcenter.org).
 */
import pg from 'pg';

const email = (process.env.CRM_ADMIN_EMAIL || 'rabbig@lchaimcenter.org').toLowerCase();
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('✗ Provide a password (min 8 chars).');
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('begin');
  // Remove any existing user with this email (and its identities via cascade).
  const existing = await c.query('select id from auth.users where lower(email) = $1', [email]);
  for (const r of existing.rows) {
    await c.query('delete from auth.identities where user_id = $1', [r.id]);
    await c.query('delete from auth.users where id = $1', [r.id]);
  }

  const ins = await c.query(
    `insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, reauthentication_token,
        phone_change, phone_change_token
     ) values (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        $1, crypt($2, gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(),
        '', '', '', '', '', '', '', ''
     ) returning id`,
    [email, password]
  );
  const uid = ins.rows[0].id;

  await c.query(
    `insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
     ) values (
        gen_random_uuid(), $1::uuid, $1::text,
        jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
        'email', now(), now(), now()
     )`,
    [uid, email]
  );

  await c.query('commit');
  console.log(`✓ Admin login ready: ${email}`);
  console.log('  Sign in at /crm/login');
} catch (e) {
  await c.query('rollback');
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}

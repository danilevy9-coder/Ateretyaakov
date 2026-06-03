/**
 * Creates (or updates) the single CRM admin login.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-admin.mjs "your-password"
 *
 * Email comes from CRM_ADMIN_EMAIL (defaults to rabbig@lchaimcenter.org).
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.CRM_ADMIN_EMAIL || 'rabbig@lchaimcenter.org';
const password = process.argv[2];

if (!url || !key) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('✗ Provide a password (min 8 chars): node --env-file=.env.local scripts/create-admin.mjs "YourPassword"');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Try to find an existing user with this email.
const { data: list } = await supabase.auth.admin.listUsers();
const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log(`✓ Updated password for ${email}`);
} else {
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log(`✓ Created admin login: ${email}`);
}
console.log('\nYou can now sign in at /crm/login');

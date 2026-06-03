import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — SERVER ONLY.
 * Bypasses Row-Level Security. Use for trusted server work like bulk
 * imports and logging sends. NEVER import this into a Client Component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (and Vercel env vars).'
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

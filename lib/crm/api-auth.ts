import { createClient } from '@/lib/supabase/server';

/**
 * Returns the authenticated user for an API route, or null.
 * Use at the top of every CRM API handler.
 */
export async function getApiUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

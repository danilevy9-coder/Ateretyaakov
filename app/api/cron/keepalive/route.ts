import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Weekly belt-and-suspenders keepalive. The daily nedarim-sync cron is the
// primary Supabase anti-pause ping; this covers Upstash and doubles up on
// Supabase in case the daily cron is ever removed.
export async function GET() {
  const result: Record<string, string> = {};

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('donors').select('id').limit(1);
    result.supabase = error ? `error: ${error.message}` : 'ok';
  } catch (e) {
    result.supabase = `error: ${String(e)}`;
  }

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['PING']),
      });
      const json = await res.json();
      result.upstash = json.result === 'PONG' ? 'ok' : JSON.stringify(json);
    } catch (e) {
      result.upstash = `error: ${String(e)}`;
    }
  } else {
    result.upstash = 'not configured';
  }

  const ok = !Object.values(result).some((v) => v.startsWith('error'));
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
}

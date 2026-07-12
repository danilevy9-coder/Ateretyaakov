import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNedarimSync } from '@/lib/crm/nedarim-sync';
import { sendWeeklyNedarimReport } from '@/lib/crm/nedarim-report';
import { nedarimConfigured } from '@/lib/crm/nedarim';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Vercel cron sends "Authorization: Bearer <CRON_SECRET>" automatically
// when the CRON_SECRET env var is set. A logged-in admin may also trigger
// runs manually from the CRM.
async function isAuthorized(req: NextRequest): Promise<{ ok: boolean; manual: boolean }> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) {
    return { ok: true, manual: false };
  }
  const user = await getApiUser();
  return { ok: Boolean(user), manual: true };
}

// Describes the FORMAT of the configured service key (never its value) so a
// misconfigured env var is diagnosable from the error response alone.
function describeServiceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!k) return 'missing';
  if (k.startsWith('sb_secret_')) return `new-style secret key (len ${k.length}) — should work`;
  if (k.startsWith('sb_publishable_')) return 'sb_publishable_… — WRONG: that is the public key, not the service key';
  if (k.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString());
      return `legacy JWT with role="${payload.role}"${payload.role === 'service_role' ? ' — should work' : ' — WRONG: needs role service_role'}`;
    } catch {
      return 'JWT-like but undecodable — likely truncated when pasted';
    }
  }
  return `unrecognized format (len ${k.length}) — likely a placeholder or partial paste`;
}

function isReportDay(): boolean {
  const weekday = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Jerusalem',
  });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const target = Number(process.env.NEDARIM_REPORT_WEEKDAY ?? 0); // default Sunday
  return weekday === days[(target % 7 + 7) % 7];
}

// Daily DB touch so the free-tier Supabase project never auto-pauses
// (it suspends after ~7 days without activity). Runs even before the
// Nedarim credentials are configured.
async function supabaseKeepalive(): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('donors').select('id').limit(1);
    return error ? `error: ${error.message}` : 'ok';
  } catch (e) {
    return `error: ${String(e)}`;
  }
}

async function handle(req: NextRequest, body?: { report?: boolean }) {
  const auth = await isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keepalive = await supabaseKeepalive();

  if (!nedarimConfigured()) {
    // Nothing to sync yet, but the DB ping above already did the important
    // part — return 200 so Vercel doesn't count the cron as failing.
    return NextResponse.json({
      ok: true,
      keepalive,
      nedarim: 'not configured — set NEDARIM_MOSAD_ID and NEDARIM_API_PASSWORD to enable the sync',
    });
  }

  try {
    const url = new URL(req.url);
    const reportParam = body?.report ?? (url.searchParams.has('report') ? url.searchParams.get('report') !== '0' : undefined);

    const summary = await runNedarimSync(auth.manual ? 'manual' : 'cron');

    // Weekly digest: on the scheduled day (cron) or when explicitly requested.
    let reportResult: { to: string } | { error: string } | null = null;
    const shouldReport = reportParam ?? (!auth.manual && isReportDay());
    if (shouldReport) {
      try {
        reportResult = await sendWeeklyNedarimReport();
      } catch (e) {
        reportResult = { error: String(e) };
      }
    }

    // Handled sync failures (bad credentials, Nedarim API errors) return 200
    // with ok:false — the run was executed and logged. Returning 5xx here
    // trips Vercel's anomaly alerts as if the site were down. Real crashes
    // still 500 via the catch below; sync health lives in /crm/nedarim and
    // the weekly digest.
    return NextResponse.json({ ...summary, keepalive, report: reportResult });
  } catch (e) {
    // Surface the failure in the response body — a blank 500 is undebuggable
    // from the Vercel cron log alone.
    console.error('[nedarim-sync]', e);
    return NextResponse.json(
      {
        ok: false,
        keepalive,
        error: String(e),
        serviceKey: describeServiceKey(),
        deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  let body: { report?: boolean } | undefined;
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }
  return handle(req, body);
}

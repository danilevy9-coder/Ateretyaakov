import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Public, token-gated. No auth — the token is the authorization.
async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('donors')
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select('id');
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// One-click unsubscribe (RFC 8058) — mail providers POST here.
export async function POST(req: NextRequest) {
  await unsubscribe(req.nextUrl.searchParams.get('token'));
  return new NextResponse(null, { status: 200 });
}

// Link in the footer — show a friendly confirmation page.
export async function GET(req: NextRequest) {
  const ok = await unsubscribe(req.nextUrl.searchParams.get('token'));
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;background:#0a0a0c;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
    <div style="text-align:center;max-width:420px;padding:32px;">
      <div style="font-size:42px;margin-bottom:12px;">${ok ? '✅' : '🤔'}</div>
      <h1 style="color:#D4AF37;font-size:22px;margin:0 0 8px;">${ok ? "You've been unsubscribed" : 'Link not recognised'}</h1>
      <p style="color:#aaa;font-size:15px;line-height:1.6;">
        ${ok
          ? 'You will no longer receive emails from Yeshiva Ateret Yaakov. If this was a mistake, just reply to any past email and we’ll add you back.'
          : 'We couldn’t process that unsubscribe link. Please reply to the email you received and we’ll remove you manually.'}
      </p>
    </div>
  </body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

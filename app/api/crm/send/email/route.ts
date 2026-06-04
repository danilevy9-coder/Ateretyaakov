import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/crm/email';

export const maxDuration = 300;

const SITE = process.env.CRM_PUBLIC_URL || 'https://www.ateretyaakov.com';

interface Msg {
  donorId?: string;
  studentId?: string;
  to: string;
  subject: string;
  body: string;
  language?: 'en' | 'he';
  templateId?: string;
}

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  try {
    const body = (await req.json()) as { messages: Msg[]; batchId?: string };
    const messages = body.messages || [];
    if (!messages.length) return NextResponse.json({ error: 'No messages.' }, { status: 400 });

    // Look up unsubscribe status + token for all donor recipients up front.
    const donorIds = Array.from(new Set(messages.map((m) => m.donorId).filter(Boolean))) as string[];
    const sub = new Map<string, { token: string; unsubscribed: boolean }>();
    if (donorIds.length) {
      const { data } = await supabase
        .from('donors')
        .select('id, unsubscribe_token, unsubscribed')
        .in('id', donorIds);
      for (const d of data ?? []) sub.set(d.id, { token: d.unsubscribe_token, unsubscribed: d.unsubscribed });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const m of messages) {
      // Never email someone who unsubscribed.
      if (m.donorId && sub.get(m.donorId)?.unsubscribed) { skipped++; continue; }
      if (!m.to) { failed++; errors.push('Missing email for a recipient'); continue; }

      const token = m.donorId ? sub.get(m.donorId)?.token : undefined;
      const unsubscribeUrl = token ? `${SITE}/api/crm/unsubscribe?token=${token}` : undefined;

      let status = 'sent';
      let providerId: string | null = null;
      let errMsg: string | null = null;
      try {
        const r = await sendEmail({ to: m.to, subject: m.subject, body: m.body, language: m.language, unsubscribeUrl });
        providerId = r.id;
        sent++;
      } catch (e) {
        status = 'failed';
        errMsg = String(e);
        failed++;
        errors.push(`${m.to}: ${errMsg}`);
      }
      await supabase.from('message_log').insert({
        donor_id: m.donorId ?? null,
        student_id: m.studentId ?? null,
        channel: 'email',
        template_id: m.templateId ?? null,
        language: m.language ?? null,
        to_address: m.to,
        subject: m.subject,
        body: m.body,
        status,
        provider_id: providerId,
        error: errMsg,
        sent_by: user.email ?? user.id,
        batch_id: body.batchId ?? null,
      });
    }

    return NextResponse.json({ sent, failed, skipped, errors });
  } catch (err) {
    console.error('[send/email]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

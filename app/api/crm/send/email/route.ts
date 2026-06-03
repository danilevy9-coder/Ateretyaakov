import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/crm/email';

export const maxDuration = 300;

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

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const m of messages) {
      if (!m.to) {
        failed++;
        errors.push(`Missing email for a recipient`);
        continue;
      }
      let status = 'sent';
      let providerId: string | null = null;
      let errMsg: string | null = null;
      try {
        const r = await sendEmail({ to: m.to, subject: m.subject, body: m.body, language: m.language });
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

    return NextResponse.json({ sent, failed, errors });
  } catch (err) {
    console.error('[send/email]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

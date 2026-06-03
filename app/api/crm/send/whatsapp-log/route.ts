import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  try {
    const m = (await req.json()) as {
      donorId?: string;
      studentId?: string;
      to: string;
      body: string;
      language?: 'en' | 'he';
      templateId?: string;
    };
    await supabase.from('message_log').insert({
      donor_id: m.donorId ?? null,
      student_id: m.studentId ?? null,
      channel: 'whatsapp',
      template_id: m.templateId ?? null,
      language: m.language ?? null,
      to_address: m.to,
      body: m.body,
      status: 'whatsapp_opened',
      sent_by: user.email ?? user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

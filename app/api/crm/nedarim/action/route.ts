import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Manual recovery-workbench actions. Every action is logged so the donor's
// timeline shows exactly what was done and when.

type Action = 'leave_out' | 'reinclude' | 'resolve' | 'called' | 'note';

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  try {
    const { issueId, action, note } = (await req.json()) as {
      issueId: string; action: Action; note?: string;
    };
    if (!issueId || !action) {
      return NextResponse.json({ error: 'issueId and action are required' }, { status: 400 });
    }

    const { data: issue, error: issueErr } = await supabase
      .from('donor_issues')
      .select('id, donor_id, keva_id, status')
      .eq('id', issueId)
      .single();
    if (issueErr || !issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const author = user.email ?? user.id;
    const today = new Date().toISOString().slice(0, 10);
    const logNote = async (body: string) => {
      await supabase.from('donor_notes').insert({ donor_id: issue.donor_id, body, author });
    };

    switch (action) {
      case 'leave_out':
        await supabase.from('donor_issues')
          .update({ status: 'snoozed', snooze_reason: note || 'Left out manually' })
          .eq('id', issueId);
        await logNote(`⏸️ Left out of payment-recovery outreach${note ? `: ${note}` : ''} (keva #${issue.keva_id ?? '—'})`);
        break;
      case 'reinclude':
        await supabase.from('donor_issues')
          .update({ status: 'open', snooze_reason: null })
          .eq('id', issueId);
        await logNote(`▶️ Re-included in payment-recovery outreach (keva #${issue.keva_id ?? '—'})`);
        break;
      case 'resolve':
        await supabase.from('donor_issues')
          .update({ status: 'resolved', resolved_at: today })
          .eq('id', issueId);
        await logNote(`✅ Marked resolved manually${note ? `: ${note}` : ''} (keva #${issue.keva_id ?? '—'})`);
        break;
      case 'called':
        await supabase.from('donor_issues')
          .update({ last_called_at: new Date().toISOString() })
          .eq('id', issueId);
        await logNote(`📞 Called about bouncing payment${note ? `: ${note}` : ''} (keva #${issue.keva_id ?? '—'})`);
        break;
      case 'note':
        if (!note) return NextResponse.json({ error: 'note text required' }, { status: 400 });
        await logNote(note);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[nedarim/action]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

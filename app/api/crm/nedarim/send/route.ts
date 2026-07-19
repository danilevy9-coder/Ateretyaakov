import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/crm/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadRecoveryTemplates,
  sendRecoveryToDonor,
  type RecoveryDonor,
} from '@/lib/crm/recovery-email';

// Manual "Send email now" from the Recovery workbench: the admin picked
// these donors, so category treatment and the manual/auto master switch
// don't apply — but unsubscribed donors are still never emailed, and the
// send counts toward the same follow-up history the automation uses.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  try {
    const { donorIds } = (await req.json()) as { donorIds: string[] };
    if (!donorIds?.length) {
      return NextResponse.json({ error: 'donorIds is required' }, { status: 400 });
    }
    if (donorIds.length > 500) {
      return NextResponse.json({ error: 'Too many donors in one send (max 500)' }, { status: 400 });
    }

    const { data: donors } = await supabase
      .from('donors')
      .select('id, email, first_name, full_name, hebrew_name, latin_name, preferred_language, unsubscribed, unsubscribe_token')
      .in('id', donorIds);
    const donorById = new Map((donors ?? []).map((d) => [d.id, d as RecoveryDonor]));

    // Their open payment problems + the bouncing orders behind them.
    const { data: issues } = await supabase
      .from('donor_issues')
      .select('id, donor_id, keva_id, notify_count')
      .in('donor_id', donorIds)
      .eq('type', 'failed_payment')
      .in('status', ['open', 'snoozed']);
    const { data: kevaRows } = await supabase
      .from('nedarim_keva')
      .select('keva_id, donor_id, client_name, amount, currency, error_text, last_num')
      .in('donor_id', donorIds)
      .eq('enabled', true)
      .eq('error_kind', 'card_failure');

    const tmplByLang = await loadRecoveryTemplates(supabase);
    const batchId = crypto.randomUUID();
    // Fixed marker (not the user's email) so engagement tracking and the
    // weekly digest funnel pick these up alongside 'nedarim-auto' sends.
    const sentBy = 'nedarim-manual';

    let sent = 0, failed = 0, skipped = 0;
    const errors: string[] = [];

    for (const donorId of Array.from(new Set(donorIds))) {
      const donor = donorById.get(donorId);
      const name = donor?.full_name || donorId;
      if (!donor) { skipped++; errors.push(`${name}: donor not found`); continue; }
      if (donor.unsubscribed) { skipped++; errors.push(`${name}: unsubscribed — never emailed`); continue; }
      if (!donor.email) { skipped++; errors.push(`${name}: no email address`); continue; }

      const donorIssues = (issues ?? []).filter((i) => i.donor_id === donorId);
      const donorKevas = (kevaRows ?? [])
        .filter((k) => k.donor_id === donorId)
        .map((k) => ({
          kevaId: k.keva_id, clientName: k.client_name, amount: k.amount,
          currency: k.currency, errorText: k.error_text, lastNum: k.last_num,
        }));
      if (!donorKevas.length) { skipped++; errors.push(`${name}: no bouncing order found`); continue; }

      const notifyCount = Math.max(0, ...donorIssues.map((i) => i.notify_count));
      const res = await sendRecoveryToDonor({
        supabase, donor, kevas: donorKevas,
        issueIds: donorIssues.map((i) => i.id), notifyCount, tmplByLang,
        sentBy, batchId,
      });
      if (res.ok) sent++;
      else { failed++; errors.push(`${name}: ${res.error}`); }
    }

    return NextResponse.json({ sent, failed, skipped, errors });
  } catch (e) {
    console.error('[nedarim/send]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

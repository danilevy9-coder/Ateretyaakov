export const dynamic = 'force-dynamic';

// The full plain-language manual for the CRM. No jargon — written for
// whoever opens this admin, even years from now.

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed space-y-2 [&_b]:text-white [&_code]:text-amber-300 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:rounded [&_a]:underline [&_a]:text-sky-300">
        {children}
      </div>
    </section>
  );
}

export default function HelpPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">❓ Help — how everything works</h1>
      <p className="text-slate-400 text-sm mb-8">
        The complete guide to this CRM. Every page also has its own ℹ️ box at the top.
      </p>

      <S title="The big picture">
        <p>
          This CRM manages the yeshiva&apos;s donors and, most importantly, <b>recovers failed monthly
          donations</b>. It connects directly to Nedarim Plus (read-only — it can never
          change or charge anything there), watches every standing order (הוראת קבע), flags donors
          whose cards fail, and reports to you weekly.
        </p>
        <p>
          <b>Who gets emailed, and when, is under your control.</b> The <b>Sending mode</b> switch on the
          Categories page decides: <b>✋ Manual</b> (the default — nothing is ever emailed until you select
          donors and press Send) or <b>🤖 Automatic</b> (the system emails by itself, but only donors whose
          category allows it, at the pace you set per category).
        </p>
      </S>

      <S title="The automatic daily cycle (~8:00 AM Israel time)">
        <p>1. Pulls all standing orders + new payments from Nedarim Plus.</p>
        <p>2. <b>New card failure found</b> → opens a &quot;failed payment&quot; issue and shows the donor on the Nedarim Plus page.</p>
        <p>3. <b>Emailing:</b> in ✋ Manual mode it sends nothing — you do it from the Nedarim Plus page. In 🤖 Automatic mode it emails donors in auto-email categories (bilingual, their language first, with the reason and a payment link), follows up at the pace set per category, then stops and puts them on your 📞 call list.</p>
        <p>4. <b>Donor fixed it</b> (Nedarim charges successfully) → everything closes itself, donor marked active again. You do nothing.</p>
        <p>5. <b>Donor finished their committed months</b> → that is NOT a failure — they appear under 🔄 Renewals for a personal ask, and are never nagged automatically.</p>
        <p>6. Checks who received / opened previous emails and records it.</p>
      </S>

      <S title="The Sunday report (email to you)">
        <p>
          Every Sunday morning: money at risk, new bounces, who recovered, the outreach funnel
          (<b>emailed → delivered → opened → paid</b>), who ignored the emails, <b>who needs a phone call</b>,
          renewal opportunities, and cards about to expire. You can also send it any time with the
          &quot;✉️ Email me the report&quot; button on the Nedarim Plus page.
        </p>
      </S>

      <S title="Nedarim Plus page — your recovery workbench">
        <p>One row per bouncing donor, sorted by money at stake. The banner at the top always shows the current
        sending mode. The tabs mean:</p>
        <p>🆕 <b>New</b> — never emailed yet. · ✉️ <b>Emailed</b> — outreach under way. ·
        📞 <b>Call these</b> — email can&apos;t reach them (no address, unsubscribed, or all emails ignored) — this is your to-do list. ·
        ⏸️ <b>Left out</b> — donors you excluded; no emails at all. · ✅ <b>Recovered</b> — fixed. · 🔄 <b>Renewals</b> — finished their commitment.</p>
        <p><b>To send emails yourself:</b> tick the checkboxes (the top box selects everyone reachable on the tab)
        and press <b>✉️ Send email</b>, or use the ✉️ Email button on a single row. Each donor gets the bilingual
        &quot;Payment issue&quot; email — one email per donor even with several orders.</p>
        <p>Other row buttons: <b>WhatsApp</b> (pre-filled message) · <b>📞 Called</b> (log a call) · <b>⏸ Leave out</b> / <b>▶ Re-include</b> ·
        <b>✓ Resolve</b> · <b>✎ Note</b>. Click a donor&apos;s name to see their full history — every email, call and note.</p>
        <p><b>Lifetime given</b> comes from the real Nedarim payment history — use it to decide who deserves a personal call first.</p>
      </S>

      <S title="Donors & Issues pages">
        <p>
          The full donor list — search, filter (segment, status, category, issue type), sort, select many
          with checkboxes for <b>bulk email</b> or <b>bulk category assignment</b>, export CSV. Click a name to
          open the donor card: edit details, set language (controls which language their emails lead with),
          assign categories, flag issues, add notes, see contributions. <b>Issues</b> is the same grid
          pre-filtered to donors needing attention.
        </p>
      </S>

      <S title="Categories — labels AND treatment rules">
        <p>
          Your own labels (Parents, Alumni, VIP, Dinner 2026…). Create them on the Categories page,
          assign from a donor&apos;s card (click chips) or in bulk from the Donors grid (select rows → 🏷 assign).
          Then filter the grid by category — e.g. category &quot;VIP&quot; + status &quot;lapsed&quot; → bulk email exactly them.
        </p>
        <p>
          The Categories page also controls <b>how each group is treated</b>:
        </p>
        <p>• <b>Sending mode</b> (top of the page) — the master switch: ✋ Manual (you send everything yourself) or 🤖 Automatic (the system may send, following the rules below).</p>
        <p>• <b>Per category:</b> 🤖 <b>Auto-email</b> (may be emailed automatically — you set &quot;follow up every N days, stop after M emails&quot;) · ✋ <b>Manual only</b> (never automatic) · 🚫 <b>Do not email</b> (never emailed at all — even bulk email skips them).</p>
        <p>• A donor in several categories gets the <b>most careful</b> rule. Donors with no category follow the &quot;no category&quot; rule at the top of the page.</p>
      </S>

      <S title="Templates">
        <p>
          The wording of every automatic and manual message, in English and Hebrew. The <b>&quot;Payment issue&quot;</b>
          (failed_payment) template is what bouncing donors receive — both languages go in one email, donor&apos;s
          language on top. Variables like <code>{'{{first_name}}'}</code>, <code>{'{{monthly_amount}}'}</code>,{' '}
          <code>{'{{error_reason}}'}</code>, <code>{'{{card_last4}}'}</code> are filled per donor —{' '}
          <code>[DONATE LINK]</code> becomes the Nedarim payment page. Edit wording freely; the live preview
          shows the result.
        </p>
      </S>

      <S title="Import">
        <p>
          Upload any Excel/CSV of donors — the AI figures out the columns, you approve the mapping, it
          imports without duplicating (matched by email/phone/ID). Still useful for campaign lists;
          the Nedarim data now arrives automatically so you no longer upload bounce files.
        </p>
      </S>

      <S title="Safety rules built in">
        <p>• The connection to Nedarim Plus is <b>read-only</b> — enforced in code; it cannot modify, charge, freeze or delete anything there.</p>
        <p>• <b>Nothing is ever sent automatically while sending mode is ✋ Manual</b> — the default.</p>
        <p>• In 🤖 Automatic mode, a donor is emailed at most the number of times their category allows, at the spacing it sets, <b>one email even if they have several standing orders</b>.</p>
        <p>• Unsubscribed, &quot;left out&quot;, and 🚫 do-not-email donors are never emailed — not even in bulk sends.</p>
        <p>• Donors who completed their commitment never get a &quot;payment problem&quot; email.</p>
        <p>• Every email and action is logged on the donor&apos;s timeline.</p>
      </S>

      <S title="If something looks wrong">
        <p>• <b>No sync today?</b> Nedarim Plus page → Sync history table shows every run and any error. Press &quot;↻ Sync now&quot; to run one manually.</p>
        <p>• <b>Emails not going out?</b> Check the run history &quot;Emails&quot; column for failures; the usual cause is the Resend domain or API key (Vercel → Settings → Environment Variables).</p>
        <p>• <b>Wrong donor matched?</b> Open the donor card and fix email/phone — matching uses email → phone → ID number.</p>
        <p>• Technical setup (API passwords, DNS, environment variables) is documented in <code>CRM_SETUP.md</code> in the code repository.</p>
      </S>
    </div>
  );
}

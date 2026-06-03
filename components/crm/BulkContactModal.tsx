'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { renderTemplate, donorVars } from '@/lib/crm/util';
import type { Donor, MessageTemplate } from '@/lib/crm/types';

/**
 * Bulk email to a set of selected donors. Each recipient can receive the
 * message in their own preferred language. WhatsApp stays per-person (it has
 * to open the app), so bulk is email-only.
 */
export default function BulkContactModal({
  donors,
  onClose,
  onSent,
}: {
  donors: Donor[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [matchLang, setMatchLang] = useState(true);
  const [forceLang, setForceLang] = useState<'en' | 'he'>('en');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('message_templates').select('*').eq('channel', 'email').order('name')
      .then(({ data }) => {
        const t = (data as MessageTemplate[]) ?? [];
        setTemplates(t);
        if (t.length) setTemplateName(t[0].name);
      });
  }, [supabase]);

  const withEmail = useMemo(() => donors.filter((d) => d.email), [donors]);
  const withoutEmail = donors.length - withEmail.length;

  const names = Array.from(new Set(templates.map((t) => t.name)));

  // Pick the right template variant for a donor.
  const templateFor = (d: Donor): MessageTemplate | undefined => {
    const lang = matchLang ? d.preferred_language : forceLang;
    return (
      templates.find((t) => t.name === templateName && t.language === lang) ||
      templates.find((t) => t.name === templateName && t.language === 'en') ||
      templates.find((t) => t.name === templateName)
    );
  };

  const preview = withEmail[0] ? templateFor(withEmail[0]) : undefined;
  const previewBody = preview && withEmail[0] ? renderTemplate(preview.body, donorVars(withEmail[0])) : '';
  const previewSubject = preview && withEmail[0] ? renderTemplate(preview.subject || '', donorVars(withEmail[0])) : '';

  const send = async () => {
    if (!templateName) { setError('Pick a template.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const messages = withEmail.map((d) => {
        const t = templateFor(d);
        const vars = donorVars(d);
        return {
          donorId: d.id,
          to: d.email as string,
          subject: t ? renderTemplate(t.subject || '', vars) : '',
          body: t ? renderTemplate(t.body, vars) : '',
          language: (matchLang ? d.preferred_language : forceLang),
          templateId: t?.id,
        };
      });

      let sent = 0, failed = 0;
      // send in chunks so we stay within serverless limits
      for (let i = 0; i < messages.length; i += 50) {
        const res = await fetch('/api/crm/send/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messages.slice(i, i + 50) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Send failed');
        sent += data.sent || 0; failed += data.failed || 0;
      }
      setResult({ sent, failed, skipped: withoutEmail });
      onSent?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0d0e13] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white">Email {donors.length} donor{donors.length !== 1 ? 's' : ''}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
            <span className="text-emerald-300">{withEmail.length}</span> will be emailed
            {withoutEmail > 0 && <span className="text-slate-400"> · {withoutEmail} have no email (use WhatsApp individually)</span>}
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Template</label>
            <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={matchLang} onChange={(e) => setMatchLang(e.target.checked)} />
            Send each donor in their own language (Hebrew/English)
          </label>
          {!matchLang && (
            <div className="flex gap-2">
              {(['en', 'he'] as const).map((l) => (
                <button key={l} onClick={() => setForceLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${forceLang === l ? 'bg-white/15 text-white font-semibold' : 'bg-white/5 text-slate-400'}`}>
                  {l === 'en' ? 'English' : 'עברית'}
                </button>
              ))}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="border border-white/10 rounded-lg p-3" dir={preview.language === 'he' ? 'rtl' : 'ltr'}>
              <p className="text-xs text-slate-500 mb-1">Preview (first recipient):</p>
              <p className="text-sm font-semibold text-white">{previewSubject}</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">{previewBody.slice(0, 400)}{previewBody.length > 400 ? '…' : ''}</p>
            </div>
          )}

          {error && <p className="text-red-300 text-sm">{error}</p>}
          {result && (
            <p className="text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              ✓ Sent {result.sent}{result.failed > 0 ? `, ${result.failed} failed` : ''}{result.skipped > 0 ? `, ${result.skipped} skipped (no email)` : ''}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">Close</button>
            {!result && (
              <button onClick={send} disabled={busy || withEmail.length === 0}
                className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold text-sm">
                {busy ? 'Sending…' : `Send ${withEmail.length} email${withEmail.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">Note: email sends once your Resend domain is verified. WhatsApp is per-person from each donor&apos;s row.</p>
        </div>
      </div>
    </div>
  );
}

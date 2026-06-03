'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { renderTemplate, donorVars, waLink, normalizePhone } from '@/lib/crm/util';
import type { Donor, MessageTemplate } from '@/lib/crm/types';

export default function ContactModal({
  donor,
  onClose,
  onSent,
}: {
  donor: Donor;
  onClose: () => void;
  onSent?: () => void;
}) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channel, setChannel] = useState<'email' | 'whatsapp'>(donor.email ? 'email' : 'whatsapp');
  const [language, setLanguage] = useState<'en' | 'he'>(donor.preferred_language || 'en');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const vars = useMemo(() => donorVars(donor), [donor]);
  const waPhone = donor.whatsapp_phone || donor.phone || '';

  useEffect(() => {
    supabase
      .from('message_templates')
      .select('*')
      .order('category')
      .then(({ data }) => setTemplates((data as any) ?? []));
  }, [supabase]);

  const visibleTemplates = templates.filter((t) => t.channel === channel && t.language === language);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (t.subject) setSubject(renderTemplate(t.subject, vars));
    setBody(renderTemplate(t.body, vars));
  };

  const sendEmail = async () => {
    if (!donor.email) { setError('This donor has no email address.'); return; }
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await fetch('/api/crm/send/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ donorId: donor.id, to: donor.email, subject, body, language, templateId: templateId || undefined }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.failed > 0) throw new Error(data.error || data.errors?.[0] || 'Send failed');
      setMsg('Email sent ✓');
      onSent?.();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const openWhatsApp = async () => {
    if (!waPhone) { setError('This donor has no phone number.'); return; }
    window.open(waLink(waPhone, body), '_blank');
    try {
      await fetch('/api/crm/send/whatsapp-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donorId: donor.id, to: normalizePhone(waPhone), body, language, templateId: templateId || undefined }),
      });
      onSent?.();
    } catch { /* logging is best-effort */ }
    setMsg('Opened WhatsApp ✓');
  };

  const name = donor.full_name || donor.first_name || 'donor';
  const dir = language === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0d0e13] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white">Contact {name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Channel + language toggles */}
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button onClick={() => setChannel('email')} disabled={!donor.email}
                className={`px-4 py-1.5 text-sm ${channel === 'email' ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-slate-300'} disabled:opacity-30`}>
                ✉ Email
              </button>
              <button onClick={() => setChannel('whatsapp')} disabled={!waPhone}
                className={`px-4 py-1.5 text-sm ${channel === 'whatsapp' ? 'bg-emerald-500 text-black font-semibold' : 'bg-white/5 text-slate-300'} disabled:opacity-30`}>
                💬 WhatsApp
              </button>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(['en', 'he'] as const).map((l) => (
                <button key={l} onClick={() => setLanguage(l)}
                  className={`px-4 py-1.5 text-sm ${language === l ? 'bg-white/15 text-white font-semibold' : 'bg-white/5 text-slate-400'}`}>
                  {l === 'en' ? 'English' : 'עברית'}
                </button>
              ))}
            </div>
          </div>

          {channel === 'email' && !donor.email && (
            <p className="text-amber-300 text-xs">No email on file — use WhatsApp instead.</p>
          )}
          {channel === 'whatsapp' && !waPhone && (
            <p className="text-amber-300 text-xs">No phone on file.</p>
          )}

          {/* Template picker */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Template</label>
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="">— blank / write your own —</option>
              {visibleTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.category.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {channel === 'email' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} dir={dir}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Message</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} dir={dir}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm leading-relaxed" />
            <p className="text-slate-600 text-xs mt-1">
              To: {channel === 'email' ? (donor.email || '—') : (waPhone || '—')}
            </p>
          </div>

          {error && <p className="text-red-300 text-sm">{error}</p>}
          {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">Cancel</button>
            {channel === 'email' ? (
              <button onClick={sendEmail} disabled={busy || !donor.email}
                className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold text-sm">
                {busy ? 'Sending…' : 'Send email'}
              </button>
            ) : (
              <button onClick={openWhatsApp} disabled={!waPhone}
                className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-black font-bold text-sm">
                Open WhatsApp →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

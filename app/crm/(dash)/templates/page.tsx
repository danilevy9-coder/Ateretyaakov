'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { renderTemplate } from '@/lib/crm/util';
import type { MessageTemplate } from '@/lib/crm/types';

const CATEGORIES = ['general', 'reminder', 'thank_you', 'unfulfilled_pledge', 'lapsed', 'failed_payment'];

// Sample values so you can preview exactly how a template will read.
const SAMPLE: Record<string, string> = {
  first_name: 'Yaakov', full_name: 'Yaakov Cohen', amount: '180', balance: '250',
  monthly_amount: '180', currency: '₪', org: 'Yeshiva Ateret Yaakov',
};
const VARS = ['first_name', 'full_name', 'monthly_amount', 'balance', 'amount', 'currency', 'org'];
const blank: Partial<MessageTemplate> = {
  name: '', channel: 'email', language: 'en', category: 'general', subject: '', body: '', is_default: false,
};

export default function TemplatesPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Insert a {{variable}} at the cursor position in the body.
  const insertVar = (v: string) => {
    if (!editing) return;
    const token = `{{${v}}}`;
    const el = bodyRef.current;
    const body = editing.body ?? '';
    if (!el) { setEditing({ ...editing, body: body + token }); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setEditing({ ...editing, body: body.slice(0, start) + token + body.slice(end) });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('message_templates').select('*').order('category').order('language');
    if (error) setError(error.message);
    setTemplates((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name, channel: editing.channel, language: editing.language,
      category: editing.category, subject: editing.subject || null, body: editing.body,
    };
    if (!payload.name || !payload.body) { setError('Name and message body are required.'); return; }
    const res = editing.id
      ? await supabase.from('message_templates').update(payload).eq('id', editing.id)
      : await supabase.from('message_templates').insert(payload);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await supabase.from('message_templates').delete().eq('id', id);
    load();
  };

  const dir = editing?.language === 'he' ? 'rtl' : 'ltr';
  const previewSubject = editing ? renderTemplate(editing.subject || '', SAMPLE) : '';
  const previewBody = editing ? renderTemplate(editing.body || '', SAMPLE) : '';

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-slate-400 text-sm">Email & WhatsApp messages in English and Hebrew.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">+ New template</button>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Variables you can use: <code className="text-amber-300">{'{{first_name}} {{full_name}} {{amount}} {{balance}} {{monthly_amount}} {{currency}} {{org}}'}</code>
      </p>

      {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
      {loading ? <p className="text-slate-500">Loading…</p> : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div key={t.id} className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-white/10 text-slate-300">{t.channel}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-white/10 text-slate-300">{t.language === 'he' ? 'עברית' : 'EN'}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-300">{t.category.replace('_', ' ')}</span>
                    {t.is_default && <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-300">default</span>}
                  </div>
                  {t.subject && <p className="text-slate-400 text-sm mt-1 truncate" dir={t.language === 'he' ? 'rtl' : 'ltr'}>{t.subject}</p>}
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2" dir={t.language === 'he' ? 'rtl' : 'ltr'}>{t.body}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(t)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs">Edit</button>
                  <button onClick={() => remove(t.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl bg-[#0d0e13] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-white mb-4">{editing.id ? 'Edit template' : 'New template'}</h2>
            <div className="space-y-3 text-sm">
              <input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Template name" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <div className="grid grid-cols-3 gap-2">
                <select value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value as any })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <select value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value as any })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  <option value="en">English</option>
                  <option value="he">עברית</option>
                </select>
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              {editing.channel === 'email' && (
                <input value={editing.subject ?? ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  placeholder="Subject" dir={dir} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              )}
              {/* Click to insert a variable at the cursor */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500 self-center mr-1">Insert:</span>
                {VARS.map((v) => (
                  <button key={v} type="button" onClick={() => insertVar(v)}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-amber-500/20 text-amber-300 text-xs font-mono">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <textarea ref={bodyRef} value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={9} placeholder="Message body" dir={dir} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 leading-relaxed" />

              {/* Live preview with sample values */}
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3" dir={dir}>
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide" dir="ltr">Preview (sample values)</p>
                {editing.channel === 'email' && previewSubject && (
                  <p className="text-sm font-semibold text-white mb-1">{previewSubject}</p>
                )}
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{previewBody || <span className="text-slate-600">Start typing to see a preview…</span>}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">Cancel</button>
              <button onClick={save} className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

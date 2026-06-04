'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor } from '@/lib/crm/types';

interface Issue { id: string; type: string; status: string; amount: number | null; detail: string | null; detected_at: string; }
interface Contribution { id: string; amount: number; paid_on: string | null; status: string; method: string | null; campaign: string | null; }
interface Note { id: string; body: string; author: string | null; created_at: string; }

export default function DonorDrawer({
  donor,
  onClose,
  onContact,
  onChanged,
}: {
  donor: Donor;
  onClose: () => void;
  onContact: (d: Donor) => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const sym = currencySymbol(donor.currency);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [edit, setEdit] = useState({
    email: donor.email ?? '', phone: donor.phone ?? '',
    segment: donor.segment, status: donor.status, preferred_language: donor.preferred_language,
  });
  const [savedMsg, setSavedMsg] = useState('');

  const name = donor.full_name || `${donor.first_name ?? ''} ${donor.last_name ?? ''}`.trim() || '—';

  const load = async () => {
    const [i, c, n] = await Promise.all([
      supabase.from('donor_issues').select('*').eq('donor_id', donor.id).order('created_at', { ascending: false }),
      supabase.from('donor_contributions').select('*').eq('donor_id', donor.id).order('paid_on', { ascending: false }).limit(50),
      supabase.from('donor_notes').select('*').eq('donor_id', donor.id).order('created_at', { ascending: false }),
    ]);
    setIssues((i.data as any) ?? []);
    setContribs((c.data as any) ?? []);
    setNotes((n.data as any) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [donor.id]);

  const saveEdit = async () => {
    await supabase.from('donors').update(edit).eq('id', donor.id);
    setSavedMsg('Saved ✓');
    setTimeout(() => setSavedMsg(''), 2000);
    onChanged();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await supabase.from('donor_notes').insert({ donor_id: donor.id, body: noteText.trim() });
    setNoteText('');
    load();
  };

  const setIssueStatus = async (id: string, status: string) => {
    await supabase.from('donor_issues').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id);
    load();
    onChanged();
  };

  const addManualIssue = async () => {
    await supabase.from('donor_issues').insert({ donor_id: donor.id, type: 'manual', status: 'open', detail: 'Manually flagged' });
    load();
    onChanged();
  };

  const deleteDonor = async () => {
    if (!confirm(`Delete ${name}? This removes the donor and all their contributions, issues and notes. This cannot be undone.`)) return;
    const { error } = await supabase.from('donors').delete().eq('id', donor.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    onChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[#0d0e13] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0d0e13] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-white">{name}</h2>
            {donor.hebrew_name && <p className="text-amber-300/70 text-sm" dir="rtl">{donor.hebrew_name}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Money summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/[0.03] border border-white/10 rounded-lg py-3">
              <p className="text-slate-400 text-xs">Pledged</p><p className="font-bold">{fmtMoney(donor.total_pledged, sym)}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-lg py-3">
              <p className="text-slate-400 text-xs">Paid</p><p className="font-bold">{fmtMoney(donor.total_paid, sym)}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-lg py-3">
              <p className="text-slate-400 text-xs">Balance</p><p className={`font-bold ${donor.balance > 0 ? 'text-amber-300' : ''}`}>{fmtMoney(donor.balance, sym)}</p>
            </div>
          </div>

          <button onClick={() => onContact(donor)} className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">
            ✉ / 💬 Contact {name.split(' ')[0]}
          </button>

          {/* Quick edit */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Details</h3>
            <div className="space-y-2 text-sm">
              <input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="Email"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Phone"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <div className="grid grid-cols-3 gap-2">
                <select value={edit.segment} onChange={(e) => setEdit({ ...edit, segment: e.target.value as any })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  <option value="monthly_regular">Monthly</option>
                  <option value="campaign_oneoff">Camp·once</option>
                  <option value="campaign_monthly">Camp·monthly</option>
                  <option value="other">Other</option>
                </select>
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as any })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  <option value="active">Active</option>
                  <option value="lapsed">Lapsed</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select value={edit.preferred_language} onChange={(e) => setEdit({ ...edit, preferred_language: e.target.value as any })}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                  <option value="en">EN</option>
                  <option value="he">HE</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveEdit} className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">Save</button>
                {savedMsg && <span className="text-emerald-300 text-xs">{savedMsg}</span>}
              </div>
            </div>
          </section>

          {/* Issues */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-300">Issues</h3>
              <button onClick={addManualIssue} className="text-xs text-amber-300 hover:underline">+ Flag</button>
            </div>
            {issues.length === 0 ? <p className="text-slate-600 text-sm">No issues.</p> : (
              <ul className="space-y-2">
                {issues.map((i) => (
                  <li key={i.id} className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className={`font-medium ${i.status === 'open' ? 'text-amber-300' : 'text-slate-500 line-through'}`}>
                        {i.type.replace('_', ' ')}
                      </span>
                      {i.amount ? <span className="text-slate-400 ml-2">{fmtMoney(i.amount, sym)}</span> : null}
                      {i.detail && <p className="text-slate-500 text-xs">{i.detail}</p>}
                    </div>
                    {i.status === 'open'
                      ? <button onClick={() => setIssueStatus(i.id, 'resolved')} className="text-xs text-emerald-300 hover:underline">Resolve</button>
                      : <button onClick={() => setIssueStatus(i.id, 'open')} className="text-xs text-slate-400 hover:underline">Reopen</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Contributions */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Contributions</h3>
            {contribs.length === 0 ? <p className="text-slate-600 text-sm">No recorded payments.</p> : (
              <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                {contribs.map((c) => (
                  <li key={c.id} className="flex justify-between border-b border-white/5 py-1">
                    <span className="text-slate-400">{c.paid_on || '—'} {c.method ? `· ${c.method}` : ''}</span>
                    <span className={c.status === 'failed' ? 'text-red-300' : 'text-slate-200'}>{fmtMoney(c.amount, sym)} {c.status !== 'completed' ? `(${c.status})` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Notes</h3>
            <div className="flex gap-2 mb-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note…" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <button onClick={addNote} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">Add</button>
            </div>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <p className="text-slate-200">{n.body}</p>
                  <p className="text-slate-600 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Danger zone */}
          <section className="pt-3 border-t border-white/5">
            <button onClick={deleteDonor}
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2">
              🗑 Delete this donor
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

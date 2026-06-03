'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol, waLink, normalizePhone } from '@/lib/crm/util';
import type { Student, StudentPayment } from '@/lib/crm/types';

interface Note { id: string; body: string; created_at: string; }

const emptyStudent: Partial<Student> = {
  first_name: '', last_name: '', full_name: '', hebrew_name: '',
  status: 'enrolled', class_shiur: '', grade: '',
  parent_name: '', parent_phone: '', parent_email: '', parent_whatsapp: '',
  monthly_tuition: 0, currency: 'USD', notes: '',
};

function firstOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function StudentDrawer({
  student,
  onClose,
  onChanged,
}: {
  student: Student | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const isNew = !student;
  const [form, setForm] = useState<Partial<Student>>(student ?? emptyStudent);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // New-payment form
  const [pay, setPay] = useState({ period: firstOfMonth(), amount_due: 0, amount_paid: 0, method: '' });

  // Parent contact composer
  const [showContact, setShowContact] = useState(false);
  const [cSubject, setCSubject] = useState('');
  const [cBody, setCBody] = useState('');

  const sym = currencySymbol(form.currency);

  const load = async () => {
    if (!student) return;
    const [p, n] = await Promise.all([
      supabase.from('student_payments').select('*').eq('student_id', student.id).order('period', { ascending: false }),
      supabase.from('student_notes').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
    ]);
    setPayments((p.data as any) ?? []);
    setNotes((n.data as any) ?? []);
  };
  useEffect(() => { load(); setPay((x) => ({ ...x, amount_due: Number(student?.monthly_tuition ?? 0) })); /* eslint-disable-next-line */ }, [student?.id]);

  const composeName = () => {
    const f = form.full_name || `${form.first_name ?? ''} ${form.last_name ?? ''}`.trim();
    return f || 'student';
  };

  const save = async () => {
    setError('');
    const payload: any = { ...form };
    if (!payload.full_name && (payload.first_name || payload.last_name)) {
      payload.full_name = `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim();
    }
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.balance;
    delete payload.raw; delete payload.import_batch_id;
    if (isNew) {
      const { error } = await supabase.from('students').insert(payload);
      if (error) { setError(error.message); return; }
      onChanged(); onClose();
    } else {
      const { error } = await supabase.from('students').update(payload).eq('id', student!.id);
      if (error) { setError(error.message); return; }
      setMsg('Saved ✓'); setTimeout(() => setMsg(''), 1500); onChanged();
    }
  };

  const statusFor = (due: number, paid: number) =>
    paid >= due && due > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

  const addPayment = async () => {
    if (!student) return;
    const status = statusFor(pay.amount_due, pay.amount_paid);
    const { error } = await supabase.from('student_payments').upsert({
      student_id: student.id,
      period: pay.period,
      amount_due: pay.amount_due,
      amount_paid: pay.amount_paid,
      status,
      method: pay.method || null,
      paid_on: pay.amount_paid > 0 ? new Date().toISOString().slice(0, 10) : null,
    }, { onConflict: 'student_id,period' });
    if (error) { setError(error.message); return; }
    load(); onChanged();
  };

  const markPaid = async (p: StudentPayment) => {
    await supabase.from('student_payments').update({
      amount_paid: p.amount_due, status: 'paid', paid_on: new Date().toISOString().slice(0, 10),
    }).eq('id', p.id);
    load(); onChanged();
  };

  const deletePayment = async (id: string) => {
    await supabase.from('student_payments').delete().eq('id', id);
    load(); onChanged();
  };

  const addNote = async () => {
    if (!student || !noteText.trim()) return;
    await supabase.from('student_notes').insert({ student_id: student.id, body: noteText.trim() });
    setNoteText(''); load();
  };

  const sendParentEmail = async () => {
    if (!form.parent_email) { setError('No parent email on file.'); return; }
    const res = await fetch('/api/crm/send/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ studentId: student?.id, to: form.parent_email, subject: cSubject, body: cBody }] }),
    });
    const data = await res.json();
    if (!res.ok || data.failed > 0) { setError(data.error || data.errors?.[0] || 'Send failed'); return; }
    setMsg('Email sent ✓'); setShowContact(false); setTimeout(() => setMsg(''), 1500);
  };

  const openParentWhatsApp = () => {
    const phone = form.parent_whatsapp || form.parent_phone || '';
    if (!phone) { setError('No parent phone on file.'); return; }
    window.open(waLink(phone, cBody), '_blank');
    if (student) fetch('/api/crm/send/whatsapp-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id, to: normalizePhone(phone), body: cBody }),
    }).catch(() => {});
  };

  const owed = payments.reduce((a, p) => a + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
  const f = (k: keyof Student) => (form[k] as any) ?? '';
  const set = (k: keyof Student, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[#0d0e13] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0d0e13] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">{isNew ? 'New student' : composeName()}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {error && <p className="text-red-300 text-sm">{error}</p>}
          {msg && <p className="text-emerald-300 text-sm">{msg}</p>}

          {/* Details */}
          <section className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input value={f('first_name')} onChange={(e) => set('first_name', e.target.value)} placeholder="First name" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <input value={f('last_name')} onChange={(e) => set('last_name', e.target.value)} placeholder="Last name" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            </div>
            <input value={f('hebrew_name')} onChange={(e) => set('hebrew_name', e.target.value)} placeholder="Hebrew name" dir="rtl" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <select value={f('status')} onChange={(e) => set('status', e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-2">
                <option value="enrolled">Enrolled</option><option value="applicant">Applicant</option>
                <option value="alumni">Alumni</option><option value="withdrawn">Withdrawn</option>
              </select>
              <input value={f('enrolled_on')} onChange={(e) => set('enrolled_on', e.target.value)} placeholder="Enrolled on (YYYY-MM-DD)" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={f('class_shiur')} onChange={(e) => set('class_shiur', e.target.value)} placeholder="Class / shiur" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <input value={f('grade')} onChange={(e) => set('grade', e.target.value)} placeholder="Grade" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={f('monthly_tuition')} onChange={(e) => set('monthly_tuition', Number(e.target.value))} placeholder="Monthly tuition" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <input value={f('currency')} onChange={(e) => set('currency', e.target.value)} placeholder="Currency (USD)" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            </div>

            <p className="text-slate-400 text-xs pt-2">Parent / guardian</p>
            <input value={f('parent_name')} onChange={(e) => set('parent_name', e.target.value)} placeholder="Parent name" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <input value={f('parent_phone')} onChange={(e) => set('parent_phone', e.target.value)} placeholder="Parent phone" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <input value={f('parent_email')} onChange={(e) => set('parent_email', e.target.value)} placeholder="Parent email" className="bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
            </div>
            <input value={f('parent_whatsapp')} onChange={(e) => set('parent_whatsapp', e.target.value)} placeholder="Parent WhatsApp (if different)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />

            <div className="flex items-center gap-3 pt-1">
              <button onClick={save} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">{isNew ? 'Create student' : 'Save'}</button>
              {!isNew && (
                <button onClick={() => setShowContact((v) => !v)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">✉ / 💬 Contact parent</button>
              )}
            </div>
          </section>

          {/* Parent contact composer */}
          {showContact && !isNew && (
            <section className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2 text-sm">
              <input value={cSubject} onChange={(e) => setCSubject(e.target.value)} placeholder="Subject (email)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <textarea value={cBody} onChange={(e) => setCBody(e.target.value)} rows={5} placeholder="Message…" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2" />
              <div className="flex gap-2">
                <button onClick={sendParentEmail} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Send email</button>
                <button onClick={openParentWhatsApp} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm">Open WhatsApp</button>
              </div>
            </section>
          )}

          {!isNew && (
            <>
              {/* Payments */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300">Tuition payments</h3>
                  <span className={`text-sm ${owed > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>Owed: {fmtMoney(owed, sym)}</span>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 mb-3 grid grid-cols-2 gap-2 text-sm">
                  <label className="text-xs text-slate-400">Month
                    <input type="date" value={pay.period} onChange={(e) => setPay({ ...pay, period: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 mt-1" />
                  </label>
                  <label className="text-xs text-slate-400">Method
                    <input value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} placeholder="card / check / cash" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 mt-1" />
                  </label>
                  <label className="text-xs text-slate-400">Due
                    <input type="number" value={pay.amount_due} onChange={(e) => setPay({ ...pay, amount_due: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 mt-1" />
                  </label>
                  <label className="text-xs text-slate-400">Paid
                    <input type="number" value={pay.amount_paid} onChange={(e) => setPay({ ...pay, amount_paid: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 mt-1" />
                  </label>
                  <button onClick={addPayment} className="col-span-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">Record / update month</button>
                </div>

                {payments.length === 0 ? <p className="text-slate-600 text-sm">No payments recorded.</p> : (
                  <ul className="space-y-1 text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between border-b border-white/5 py-1.5">
                        <span className="text-slate-400">{p.period?.slice(0, 7)}</span>
                        <span className="text-slate-300">{fmtMoney(Number(p.amount_paid), sym)} / {fmtMoney(Number(p.amount_due), sym)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${p.status === 'paid' ? 'bg-emerald-500/15 text-emerald-300' : p.status === 'partial' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-300'}`}>{p.status}</span>
                        <div className="flex gap-2">
                          {p.status !== 'paid' && <button onClick={() => markPaid(p)} className="text-xs text-emerald-300 hover:underline">Mark paid</button>}
                          <button onClick={() => deletePayment(p.id)} className="text-xs text-red-300 hover:underline">✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Notes */}
              <section>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Notes</h3>
                <div className="flex gap-2 mb-2">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note…" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm" />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { applySearch, DONOR_TEXT_FIELDS, DONOR_PHONE_FIELDS, STUDENT_TEXT_FIELDS, STUDENT_PHONE_FIELDS } from '@/lib/crm/search';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor, Student } from '@/lib/crm/types';
import ContactButtons from './ContactButtons';
import DonorDrawer from './DonorDrawer';
import StudentDrawer from './StudentDrawer';
import ContactModal from './ContactModal';

// One search box (top of every CRM page) that finds donors AND students by
// Hebrew / English / Latin name, any phone format, email or city.

export const donorName = (d: Pick<Donor, 'full_name' | 'first_name' | 'last_name'>) =>
  d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || '—';
export const studentName = (s: Pick<Student, 'full_name' | 'first_name' | 'last_name'>) =>
  s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '—';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [donors, setDonors] = useState<Donor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [contact, setContact] = useState<Donor | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setDonors([]); setStudents([]); setError(''); return; }
    const t = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const supabase = createClient();
        const dq = applySearch(supabase.from('donors').select('*'), term, DONOR_TEXT_FIELDS, DONOR_PHONE_FIELDS)
          .order('last_gift_at', { ascending: false, nullsFirst: false }).limit(8);
        const sq = applySearch(supabase.from('students').select('*'), term, STUDENT_TEXT_FIELDS, STUDENT_PHONE_FIELDS)
          .order('full_name', { ascending: true }).limit(6);
        const [d, s] = await Promise.all([dq, sq]);
        if (d.error) throw d.error;
        setDonors((d.data as Donor[]) ?? []);
        setStudents(s.error ? [] : ((s.data as Student[]) ?? []));
      } catch (e: any) {
        setError(e.message || String(e));
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const showPanel = open && q.trim().length >= 2;
  // Render drawers outside the sticky search bar so they cover the page.
  const portal = (node: React.ReactNode) => {
    const el = typeof document !== 'undefined' ? document.getElementById('crm-portal') : null;
    return el ? createPortal(node, el) : node;
  };

  return (
    <div ref={boxRef} className="relative max-w-3xl">
      <label className="sr-only" htmlFor="crm-global-search">Search donors and students</label>
      <div className="flex items-center gap-2 bg-[#fff] border border-slate-300 rounded-xl px-3 shadow-sm focus-within:border-slate-500">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="crm-global-search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          placeholder="Search anyone: name (עברית / English), phone in any format, email, city…"
          className="flex-1 bg-transparent py-2.5 text-[16px] text-slate-900 outline-none border-0"
          autoComplete="off"
        />
        {q && <button onClick={() => { setQ(''); setOpen(false); }} className="text-slate-500 hover:text-slate-900 text-sm px-1">Clear</button>}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 bg-[#fff] border border-slate-200 rounded-xl shadow-xl z-40 max-h-[70vh] overflow-y-auto">
          {error && <p className="px-4 py-3 text-sm text-[#b91c1c]">{error}</p>}
          {loading && <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>}
          {!loading && !error && donors.length === 0 && students.length === 0 && (
            <p className="px-4 py-3 text-[15px] text-slate-700">Nobody found for “{q.trim()}”.</p>
          )}

          {donors.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Donors</h3>
                <a href={`/crm/donors?q=${encodeURIComponent(q.trim())}`} className="text-sm text-sky-700 hover:underline">See all matching donors</a>
              </div>
              <ul>
                {donors.map((d) => (
                  <li key={d.id} className="px-4 py-2.5 border-t border-slate-100 hover:bg-slate-50 flex items-center gap-3 flex-wrap">
                    <button onClick={() => { setDonor(d); setOpen(false); }} className="flex-1 min-w-[180px] text-left">
                      <span className="block text-[16px] font-semibold text-slate-900">
                        {donorName(d)}
                        {d.hebrew_name && <span className="font-normal text-slate-600 ml-3 font-hebrew" dir="rtl">{d.hebrew_name}</span>}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {[d.phone, d.city, d.monthly_amount ? `${fmtMoney(d.monthly_amount, currencySymbol(d.currency))}/month` : null].filter(Boolean).join(' · ') || 'No phone'}
                      </span>
                    </button>
                    <ContactButtons phone={d.phone} whatsapp={d.whatsapp_phone} email={d.email} labels={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {students.length > 0 && (
            <section>
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Students</h3>
                <a href="/crm/students" className="text-sm text-sky-700 hover:underline">All students</a>
              </div>
              <ul>
                {students.map((s) => (
                  <li key={s.id} className="px-4 py-2.5 border-t border-slate-100 hover:bg-slate-50 flex items-center gap-3 flex-wrap">
                    <button onClick={() => { setStudent(s); setOpen(false); }} className="flex-1 min-w-[180px] text-left">
                      <span className="block text-[16px] font-semibold text-slate-900">
                        {studentName(s)}
                        {s.hebrew_name && <span className="font-normal text-slate-600 ml-3 font-hebrew" dir="rtl">{s.hebrew_name}</span>}
                      </span>
                      <span className="block text-sm text-slate-600">
                        Student{s.class_shiur ? ` · ${s.class_shiur}` : ''}{s.parent_name ? ` · parent ${s.parent_name}` : ''}{s.parent_phone ? ` · ${s.parent_phone}` : ''}
                      </span>
                    </button>
                    <ContactButtons phone={s.parent_phone} whatsapp={s.parent_whatsapp} email={s.parent_email} labels={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {(donor || student || contact) && portal(
        <>
          {donor && (
            <DonorDrawer donor={donor} onClose={() => setDonor(null)} onContact={(d) => setContact(d)} onChanged={() => {}} />
          )}
          {student && <StudentDrawer student={student} onClose={() => setStudent(null)} onChanged={() => {}} />}
          {contact && <ContactModal donor={contact} onClose={() => setContact(null)} />}
        </>
      )}
    </div>
  );
}

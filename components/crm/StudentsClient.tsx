'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HelpBox from './HelpBox';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Student } from '@/lib/crm/types';
import StudentDrawer from './StudentDrawer';

const PAGE_SIZE = 50;

const STATUS_COLOR: Record<string, string> = {
  enrolled: 'bg-emerald-500/15 text-emerald-300',
  applicant: 'bg-sky-500/15 text-sky-300',
  alumni: 'bg-slate-500/15 text-slate-300',
  withdrawn: 'bg-red-500/15 text-red-300',
};

type Row = Student & { student_payments?: { amount_due: number; amount_paid: number; status: string }[] };

export default function StudentsClient({ initialStatus }: { initialStatus?: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus || '');
  const [selected, setSelected] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let query = supabase.from('students').select('*, student_payments(amount_due,amount_paid,status)', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${term},parent_name.ilike.${term},parent_phone.ilike.${term},parent_email.ilike.${term}`);
      }
      query = query.order('full_name', { ascending: true, nullsFirst: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count: c, error } = await query;
      if (error) throw error;
      setRows((data as any) ?? []);
      setCount(c ?? 0);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  }, [supabase, q, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [q, status]);

  const owed = (r: Row) =>
    (r.student_payments || []).reduce((a, p) => a + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Yeshiva — Students</h1>
          <p className="text-slate-400 text-sm">{count.toLocaleString()} students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">+ Add student</button>
          <a href="/crm/import" className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">📥 Import</a>
        </div>
      </div>

      <HelpBox>
        <p>Yeshiva enrollment and tuition. <b>+ Add student</b> for one at a time, or 📥 Import an Excel list.</p>
        <p>Click a student to open their card — parents&apos; contacts, monthly tuition, payment record per month
        (paid / partial / unpaid / waived), and notes. Statuses: applicant → enrolled → alumni / withdrawn.</p>
      </HelpBox>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or parent…"
          className="flex-1 min-w-[220px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="applicant">Applicant</option>
          <option value="alumni">Alumni</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {error && <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Student</th>
              <th className="text-left px-4 py-2.5">Class</th>
              <th className="text-left px-4 py-2.5">Parent</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Tuition / mo</th>
              <th className="text-right px-4 py-2.5">Owed</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No students yet.</td></tr>}
            {!loading && rows.map((s) => {
              const sym = currencySymbol(s.currency);
              const name = s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '—';
              const ow = owed(s);
              return (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <button onClick={() => setSelected(s)} className="text-white hover:text-amber-300 font-medium text-left">{name}</button>
                    {s.hebrew_name && <span className="text-amber-300/60 text-xs ml-2" dir="rtl">{s.hebrew_name}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{s.class_shiur || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400">
                    <div>{s.parent_name || '—'}</div>
                    <div className="text-xs text-slate-500">{s.parent_phone || s.parent_email || ''}</div>
                  </td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[s.status] || ''}`}>{s.status}</span></td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{fmtMoney(s.monthly_tuition, sym)}</td>
                  <td className={`px-4 py-2.5 text-right ${ow > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{fmtMoney(ow, sym)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">← Prev</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">Next →</button>
        </div>
      </div>

      {selected && <StudentDrawer student={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {creating && <StudentDrawer student={null} onClose={() => setCreating(false)} onChanged={load} />}
    </div>
  );
}

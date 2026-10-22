'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HelpBox from './HelpBox';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import { applySearch, STUDENT_TEXT_FIELDS, STUDENT_PHONE_FIELDS } from '@/lib/crm/search';
import type { Student } from '@/lib/crm/types';
import StudentDrawer from './StudentDrawer';
import ContactButtons from './ContactButtons';
import { type Category } from './CategoriesClient';
import { LabelChip, LabelEditor, createLabel, loadLabelsWithCounts } from './Labels';

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  enrolled: 'bg-emerald-100 text-emerald-900',
  applicant: 'bg-sky-100 text-sky-900',
  alumni: 'bg-slate-100 text-slate-700',
  withdrawn: 'bg-[#fee2e2] text-[#991b1b]',
};
const STATUS_LABEL: Record<string, string> = {
  enrolled: 'Enrolled', applicant: 'Applicant', alumni: 'Alumni', withdrawn: 'Withdrawn',
};

type Row = Student & {
  student_payments?: { amount_due: number; amount_paid: number; status: string }[];
  student_categories?: { category_id: string }[];
};

export default function StudentsClient({ initialStatus, initialLabel }: { initialStatus?: string; initialLabel?: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus || '');
  const [selected, setSelected] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  // Labels (same list as donors). Student labels need labels.sql to have been run once;
  // until then labelsOn stays false and nothing label-related shows here.
  const [labelsOn, setLabelsOn] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [labelCounts, setLabelCounts] = useState<Map<string, number>>(new Map());
  const [labelFilter, setLabelFilter] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let select = '*, student_payments(amount_due,amount_paid,status)';
      if (labelsOn) {
        select += ', student_categories(category_id)';
        labelFilter.forEach((_, i) => { select += `, lf${i}:student_categories!inner(category_id)`; });
      }
      let query = supabase.from('students').select(select, { count: 'exact' });
      if (labelsOn) labelFilter.forEach((id, i) => { query = query.eq(`lf${i}.category_id`, id); });
      if (status) query = query.eq('status', status);
      // Student or parent name (Hebrew / English), any phone format, email.
      query = applySearch(query, q, STUDENT_TEXT_FIELDS, STUDENT_PHONE_FIELDS);
      query = query.order('full_name', { ascending: true, nullsFirst: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count: c, error } = await query;
      if (error) throw error;
      setRows((data as any) ?? []);
      setCount(c ?? 0);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  }, [supabase, q, status, page, labelsOn, labelFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setPage(0); }, [q, status, labelFilter]);

  const loadLabels = useCallback(async () => {
    const { labels, studentCounts } = await loadLabelsWithCounts(supabase);
    setCats(labels);
    if (studentCounts) { setLabelCounts(studentCounts); setLabelsOn(true); }
    return { labels, on: !!studentCounts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadLabels().then(({ labels, on }) => {
      if (!on || !initialLabel) return;
      const want = initialLabel.trim().toLowerCase();
      const hit = labels.find((l) => l.id === initialLabel || l.name.toLowerCase() === want);
      if (hit) setLabelFilter([hit.id]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLabel]);

  const toggleRowLabel = async (r: Row, label: Category) => {
    const has = (r.student_categories ?? []).some((l) => l.category_id === label.id);
    const { error } = has
      ? await supabase.from('student_categories').delete().eq('student_id', r.id).eq('category_id', label.id)
      : await supabase.from('student_categories').insert({ student_id: r.id, category_id: label.id });
    if (error) { setError(error.message); return; }
    setRows((rs) => rs.map((x) => (x.id !== r.id ? x : {
      ...x,
      student_categories: has
        ? (x.student_categories ?? []).filter((l) => l.category_id !== label.id)
        : [...(x.student_categories ?? []), { category_id: label.id }],
    })));
    setLabelCounts((m) => new Map(m).set(label.id, Math.max(0, (m.get(label.id) ?? 0) + (has ? -1 : 1))));
  };
  const createAndAddRowLabel = async (r: Row, name: string) => {
    const { label, error } = await createLabel(supabase, name, cats);
    if (error || !label) { setError(error || 'Could not create the label.'); return; }
    if (!cats.some((c) => c.id === label.id)) setCats((cs) => [...cs, label].sort((a, b) => a.name.localeCompare(b.name)));
    if (!(r.student_categories ?? []).some((l) => l.category_id === label.id)) await toggleRowLabel(r, label);
  };

  const owed = (r: Row) =>
    (r.student_payments || []).reduce((a, p) => a + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const btnLight = 'px-4 py-2 rounded-lg border border-slate-300 bg-[#fff] hover:bg-slate-50 text-[15px] text-slate-800 font-medium disabled:opacity-50';

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-600 text-[15px]">{count.toLocaleString()} students{q ? ` matching “${q}”` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-[#fff] text-[15px] font-semibold">Add a student</button>
          <a href="/crm/import" className={btnLight}>Import a sheet</a>
        </div>
      </div>

      <HelpBox>
        <p>Yeshiva enrollment and tuition. <b>Add a student</b> one at a time, or import an Excel list.</p>
        <p>Tap a student to open their card: parents&apos; contacts, monthly tuition, payment record per month
        (paid / partial / unpaid / waived) and notes. <b>Call / WhatsApp / Email</b> reach the parent in one tap.</p>
      </HelpBox>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search student or parent: name, phone, email…"
          className="flex-1 min-w-[260px] bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[16px] text-slate-900 focus:outline-none focus:border-slate-600" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"
          className="bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[15px] text-slate-900">
          <option value="">Any status</option>
          <option value="enrolled">Enrolled</option>
          <option value="applicant">Applicant</option>
          <option value="alumni">Alumni</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {labelsOn && cats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4" aria-label="Filter by label">
          <span className="text-[15px] font-semibold text-slate-700 mr-1">Labels:</span>
          {cats.map((c) => (
            <LabelChip
              key={c.id}
              label={c}
              count={labelCounts.get(c.id) ?? 0}
              active={labelFilter.includes(c.id)}
              onClick={() => setLabelFilter((f) => (f.includes(c.id) ? f.filter((x) => x !== c.id) : [...f, c.id]))}
            />
          ))}
          {labelFilter.length > 0 && (
            <button onClick={() => setLabelFilter([])} className="ml-2 text-sm text-sky-700 hover:underline">Clear labels</button>
          )}
        </div>
      )}

      {error && <div className="text-[#991b1b] text-[15px] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="border border-slate-200 rounded-xl overflow-x-auto bg-[#fff]">
        <table className="w-full text-[15px] min-w-[880px]">
          <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Parent · phone</th>
              <th className="text-right px-4 py-3">Tuition / month</th>
              <th className="text-right px-4 py-3">Owed</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Contact parent</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No students found.</td></tr>}
            {!loading && rows.map((s) => {
              const sym = currencySymbol(s.currency);
              const name = s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '—';
              const ow = owed(s);
              return (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(s)} className="text-left group">
                      <span className="block font-semibold text-slate-900 group-hover:underline">{name}</span>
                      {s.hebrew_name && <span className="block text-slate-600 font-hebrew text-left" dir="rtl">{s.hebrew_name}</span>}
                      {s.class_shiur && <span className="block text-sm text-slate-500">{s.class_shiur}</span>}
                    </button>
                    {labelsOn && (
                      <div className="mt-1 min-w-[240px] max-w-[320px]">
                        <LabelEditor
                          compact
                          labels={cats}
                          assigned={new Set((s.student_categories ?? []).map((l) => l.category_id))}
                          onToggle={(l) => toggleRowLabel(s, l)}
                          onCreate={(n) => createAndAddRowLabel(s, n)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <div>{s.parent_name || <span className="text-[#94a3b8]">—</span>}</div>
                    <div className="text-sm text-slate-500" dir="ltr">{s.parent_phone || s.parent_email || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 whitespace-nowrap">{fmtMoney(s.monthly_tuition, sym)}</td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${ow > 0 ? 'text-[#b45309]' : 'text-[#94a3b8]'}`}>{ow > 0 ? fmtMoney(ow, sym) : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-sm ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[s.status] ?? s.status}</span></td>
                  <td className="px-4 py-3">
                    <ContactButtons phone={s.parent_phone} whatsapp={s.parent_whatsapp} email={s.parent_email} className="justify-end" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-[15px]">
        <span className="text-slate-600">Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className={btnLight}>Previous</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className={btnLight}>Next</button>
        </div>
      </div>

      {selected && <StudentDrawer student={selected} onClose={() => setSelected(null)} onChanged={() => { load(); if (labelsOn) loadLabels(); }} />}
      {creating && <StudentDrawer student={null} onClose={() => setCreating(false)} onChanged={load} />}
    </div>
  );
}

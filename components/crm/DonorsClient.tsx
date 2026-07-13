'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor, DonorSegment } from '@/lib/crm/types';
import DonorDrawer from './DonorDrawer';
import ContactModal from './ContactModal';
import BulkContactModal from './BulkContactModal';
import { CategoryChip, type Category } from './CategoriesClient';
import HelpBox from './HelpBox';

const PAGE_SIZE = 50;

const SEGMENT_LABEL: Record<DonorSegment, string> = {
  monthly_regular: 'Monthly',
  campaign_oneoff: 'Campaign·once',
  campaign_monthly: 'Campaign·monthly',
  other: 'Other',
};
const SEGMENT_COLOR: Record<DonorSegment, string> = {
  monthly_regular: 'bg-sky-500/15 text-sky-300',
  campaign_oneoff: 'bg-violet-500/15 text-violet-300',
  campaign_monthly: 'bg-fuchsia-500/15 text-fuchsia-300',
  other: 'bg-slate-500/15 text-slate-300',
};

type SortKey = 'full_name' | 'total_pledged' | 'total_paid' | 'balance' | 'last_gift_at' | 'created_at';
type Row = Donor & {
  donor_issues?: { type: string; status: string }[];
  donor_categories?: { category_id: string }[];
};

interface Props {
  initialSegment?: string;
  initialStatus?: string;
  initialIssueType?: string;
  onlyIssues?: boolean;
}

export default function DonorsClient({ initialSegment, initialStatus, initialIssueType, onlyIssues }: Props) {
  const supabase = createClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState(initialSegment || '');
  const [status, setStatus] = useState(initialStatus || '');
  const [issueType, setIssueType] = useState(initialIssueType || '');
  const [issuesOnly, setIssuesOnly] = useState(!!onlyIssues || !!initialIssueType);
  const [cats, setCats] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [bulkCat, setBulkCat] = useState('');
  const [catBusy, setCatBusy] = useState(false);

  const [sort, setSort] = useState<SortKey>('created_at');
  const [asc, setAsc] = useState(false);

  const [selected, setSelected] = useState<Map<string, Donor>>(new Map());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const [detail, setDetail] = useState<Donor | null>(null);
  const [contactDonor, setContactDonor] = useState<Donor | null>(null);

  // Apply the current filters to a query (shared by the page load + select-all).
  const applyFilters = useCallback((query: any, useInner: boolean) => {
    if (useInner) {
      query = query.eq('donor_issues.status', 'open');
      if (issueType) query = query.eq('donor_issues.type', issueType);
    }
    if (categoryFilter) query = query.eq('donor_categories.category_id', categoryFilter);
    if (segment) query = query.eq('segment', segment);
    if (status) query = query.eq('status', status);
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},last_name.ilike.${term}`);
    }
    return query;
  }, [segment, status, issueType, q, categoryFilter]);

  // Category embed becomes an inner join while filtering by category.
  const catEmbed = useCallback(
    () => `donor_categories${categoryFilter ? '!inner' : ''}(category_id)`,
    [categoryFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const useInner = issuesOnly || !!issueType;
      const select = (useInner ? '*, donor_issues!inner(type,status)' : '*, donor_issues(type,status)') + `, ${catEmbed()}`;
      let query = supabase.from('donors').select(select, { count: 'exact' });
      query = applyFilters(query, useInner);
      query = query.order(sort, { ascending: asc, nullsFirst: false });
      query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count: c, error } = await query;
      if (error) throw error;
      setRows((data as any) ?? []);
      setCount(c ?? 0);
    } catch (e: any) {
      setError(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, applyFilters, issuesOnly, issueType, sort, asc, page]);

  useEffect(() => { load(); }, [load]);
  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setPage(0); }, [q, segment, status, issueType, issuesOnly, sort, asc, categoryFilter]);
  useEffect(() => {
    supabase.from('categories').select('*').order('name')
      .then(({ data }) => setCats((data as Category[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else { setSort(key); setAsc(false); }
  };
  const sortIcon = (key: SortKey) => (sort === key ? (asc ? ' ▲' : ' ▼') : '');

  // ── Selection ──
  const toggleRow = (d: Donor) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(d.id)) next.delete(d.id); else next.set(d.id, d);
      return next;
    });
  };
  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.set(r.id, r));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Map());

  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const useInner = issuesOnly || !!issueType;
      const select = (useInner ? '*, donor_issues!inner(type,status)' : '*') + `, ${catEmbed()}`;
      let query = supabase.from('donors').select(select);
      query = applyFilters(query, useInner);
      query = query.range(0, 4999); // safety cap
      const { data, error } = await query;
      if (error) throw error;
      setSelected((prev) => {
        const next = new Map(prev);
        ((data as unknown as Donor[]) ?? []).forEach((d) => next.set(d.id, d));
        return next;
      });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSelectingAll(false);
    }
  };

  // Export selected donors (or the whole filtered set) to a CSV.
  const exportCsv = async () => {
    setSelectingAll(true);
    setError('');
    try {
      let list: Donor[];
      if (selected.size > 0) {
        list = Array.from(selected.values());
      } else {
        const useInner = issuesOnly || !!issueType;
        const select = (useInner ? '*, donor_issues!inner(type,status)' : '*') + `, ${catEmbed()}`;
        let query = supabase.from('donors').select(select);
        query = applyFilters(query, useInner);
        query = query.range(0, 9999);
        const { data, error } = await query;
        if (error) throw error;
        list = (data as unknown as Donor[]) ?? [];
      }
      const cols: [string, keyof Donor][] = [
        ['Full name', 'full_name'], ['Hebrew name', 'hebrew_name'], ['Email', 'email'], ['Phone', 'phone'],
        ['Segment', 'segment'], ['Status', 'status'], ['Pledged', 'total_pledged'], ['Paid', 'total_paid'],
        ['Balance', 'balance'], ['Monthly', 'monthly_amount'], ['Currency', 'currency'], ['Source', 'source'],
        ['Last gift', 'last_gift_at'],
      ];
      const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const catName = new Map(cats.map((c) => [c.id, c.name]));
      const catsOf = (d: any) =>
        ((d.donor_categories ?? []) as { category_id: string }[])
          .map((l) => catName.get(l.category_id)).filter(Boolean).join('; ');
      const lines = [[...cols.map((c) => c[0]), 'Categories'].join(',')];
      for (const d of list) lines.push([...cols.map((c) => esc((d as any)[c[1]])), esc(catsOf(d))].join(','));
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `donors-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSelectingAll(false);
    }
  };

  // Assign / remove a category for every selected donor.
  const bulkCategory = async (mode: 'add' | 'remove') => {
    if (!bulkCat || selected.size === 0) return;
    setCatBusy(true);
    setError('');
    try {
      const ids = Array.from(selected.keys());
      if (mode === 'add') {
        const rows = ids.map((donor_id) => ({ donor_id, category_id: bulkCat }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('donor_categories')
            .upsert(rows.slice(i, i + 500), { onConflict: 'donor_id,category_id', ignoreDuplicates: true });
          if (error) throw error;
        }
      } else {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await supabase.from('donor_categories')
            .delete().eq('category_id', bulkCat).in('donor_id', ids.slice(i, i + 200));
          if (error) throw error;
        }
      }
      load();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCatBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{onlyIssues ? 'Issues' : 'Donors'}</h1>
          <p className="text-slate-400 text-sm">{count.toLocaleString()} records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={selectingAll}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm">
            {selectingAll ? 'Exporting…' : `⬇ Export CSV${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <a href="/crm/import" className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">📥 Import</a>
        </div>
      </div>

      <HelpBox>
        {onlyIssues ? (
          <>
            <p>Donors that need attention, by problem type: <b>failed payment</b> (card bounced — handled automatically by the
            <a href="/crm/nedarim" className="underline"> Nedarim page</a>), <b>lapsed</b> (stopped giving / finished their commitment),
            <b> unfulfilled pledge</b>, and <b>manual flags</b> you set yourself.</p>
            <p>Click a name for details; resolve an issue there when it&apos;s handled. Select rows with checkboxes to email many at once.</p>
          </>
        ) : (
          <>
            <p><b>Search</b> by name/email/phone · <b>filter</b> by segment, status, category or issue · click a column header to <b>sort</b> · click a <b>name</b> to open the full donor card (edit details, categories, notes, issues, language).</p>
            <p><b>Do things in bulk:</b> tick checkboxes (or &quot;Select all matching&quot; after filtering) → the amber bar lets you email everyone selected or assign/remove a 🏷 category.</p>
            <p><b>Export CSV</b> downloads the current selection (or the whole filtered list). Language EN/HE on each donor controls which language their emails lead with.</p>
          </>
        )}
      </HelpBox>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name, email, phone…"
          className="flex-1 min-w-[220px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">All segments</option>
          <option value="monthly_regular">Monthly regulars</option>
          <option value="campaign_oneoff">Campaign — one-off</option>
          <option value="campaign_monthly">Campaign — monthly</option>
          <option value="other">Other</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="lapsed">Lapsed</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>🏷 {c.name}</option>)}
        </select>
        <select value={issueType} onChange={(e) => { setIssueType(e.target.value); if (e.target.value) setIssuesOnly(true); }}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm">
          <option value="">Any issue</option>
          <option value="unfulfilled_pledge">Unfulfilled pledge</option>
          <option value="lapsed">Lapsed</option>
          <option value="failed_payment">Failed payment</option>
          <option value="manual">Manual flag</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300 px-2">
          <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          Open issues only
        </label>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex-wrap">
          <div className="text-sm text-amber-200">
            <strong>{selected.size}</strong> selected
            {selected.size < count && (
              <button onClick={selectAllMatching} disabled={selectingAll} className="ml-3 underline hover:text-amber-100">
                {selectingAll ? 'selecting…' : `Select all ${count.toLocaleString()} matching`}
              </button>
            )}
            <button onClick={clearSelection} className="ml-3 underline hover:text-amber-100">Clear</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cats.length > 0 && (
              <>
                <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm">
                  <option value="">🏷 Category…</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => bulkCategory('add')} disabled={!bulkCat || catBusy}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm">
                  {catBusy ? '…' : '+ Assign'}
                </button>
                <button onClick={() => bulkCategory('remove')} disabled={!bulkCat || catBusy}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm">
                  − Remove
                </button>
              </>
            )}
            <button onClick={() => setBulkOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">
              ✉ Email {selected.size} selected
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-white/5 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={pageAllSelected} onChange={togglePage} /></th>
              <th className="text-left px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('full_name')}>Name{sortIcon('full_name')}</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Segment</th>
              <th className="text-right px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('total_pledged')}>Pledged{sortIcon('total_pledged')}</th>
              <th className="text-right px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('total_paid')}>Paid{sortIcon('total_paid')}</th>
              <th className="text-right px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('balance')}>Balance{sortIcon('balance')}</th>
              <th className="text-right px-4 py-2.5">Monthly</th>
              <th className="text-left px-4 py-2.5">Issues</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No donors found. Try importing a file.</td></tr>}
            {!loading && rows.map((d) => {
              const sym = currencySymbol(d.currency);
              const openIssues = (d.donor_issues || []).filter((i) => i.status === 'open');
              const name = d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || '—';
              return (
                <tr key={d.id} className={`border-t border-white/5 hover:bg-white/[0.03] ${selected.has(d.id) ? 'bg-amber-500/5' : ''}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleRow(d)} /></td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setDetail(d)} className="text-white hover:text-amber-300 font-medium text-left">{name}</button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    <div className="truncate max-w-[200px]">{d.email || <span className="opacity-40">no email</span>}</div>
                    <div className="text-xs text-slate-500">{d.phone || ''}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs ${SEGMENT_COLOR[d.segment]}`}>{SEGMENT_LABEL[d.segment]}</span>
                    {(d.donor_categories?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {d.donor_categories!.map((l) => {
                          const c = cats.find((x) => x.id === l.category_id);
                          return c ? <CategoryChip key={c.id} cat={c} /> : null;
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{fmtMoney(d.total_pledged, sym)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{fmtMoney(d.total_paid, sym)}</td>
                  <td className={`px-4 py-2.5 text-right ${d.balance > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{fmtMoney(d.balance, sym)}</td>
                  <td className="px-4 py-2.5 text-right text-sky-300">{d.monthly_amount ? fmtMoney(d.monthly_amount, sym) + '/mo' : <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-2.5">
                    {openIssues.length === 0 ? <span className="text-slate-600">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(openIssues.map((i) => i.type))).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-300">{t.replace('_', ' ')}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setContactDonor(d)} title="Contact"
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs">✉ / 💬</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">← Prev</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">Next →</button>
        </div>
      </div>

      {detail && (
        <DonorDrawer donor={detail} onClose={() => setDetail(null)} onContact={(d) => setContactDonor(d)} onChanged={load} />
      )}
      {contactDonor && (
        <ContactModal donor={contactDonor} onClose={() => setContactDonor(null)} onSent={load} />
      )}
      {bulkOpen && (
        <BulkContactModal donors={Array.from(selected.values())} onClose={() => setBulkOpen(false)} onSent={() => { /* keep selection */ }} />
      )}
    </div>
  );
}

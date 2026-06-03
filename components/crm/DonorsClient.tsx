'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor, DonorSegment } from '@/lib/crm/types';
import DonorDrawer from './DonorDrawer';
import ContactModal from './ContactModal';
import BulkContactModal from './BulkContactModal';

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
type Row = Donor & { donor_issues?: { type: string; status: string }[] };

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

  const [q, setQ] = useState('');
  const [segment, setSegment] = useState(initialSegment || '');
  const [status, setStatus] = useState(initialStatus || '');
  const [issueType, setIssueType] = useState(initialIssueType || '');
  const [issuesOnly, setIssuesOnly] = useState(!!onlyIssues || !!initialIssueType);

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
    if (segment) query = query.eq('segment', segment);
    if (status) query = query.eq('status', status);
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},last_name.ilike.${term}`);
    }
    return query;
  }, [segment, status, issueType, q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const useInner = issuesOnly || !!issueType;
      const select = useInner ? '*, donor_issues!inner(type,status)' : '*, donor_issues(type,status)';
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
  useEffect(() => { setPage(0); }, [q, segment, status, issueType, issuesOnly, sort, asc]);

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
      const select = useInner ? '*, donor_issues!inner(type,status)' : '*';
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

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{onlyIssues ? 'Issues' : 'Donors'}</h1>
          <p className="text-slate-400 text-sm">{count.toLocaleString()} records</p>
        </div>
        <a href="/crm/import" className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">📥 Import</a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…"
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
          <button onClick={() => setBulkOpen(true)}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">
            ✉ Email {selected.size} selected
          </button>
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
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs ${SEGMENT_COLOR[d.segment]}`}>{SEGMENT_LABEL[d.segment]}</span></td>
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

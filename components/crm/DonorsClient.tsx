'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import { applySearch, DONOR_TEXT_FIELDS, DONOR_PHONE_FIELDS } from '@/lib/crm/search';
import ContactButtons from './ContactButtons';
import type { Donor, DonorSegment } from '@/lib/crm/types';
import DonorDrawer from './DonorDrawer';
import ContactModal from './ContactModal';
import BulkContactModal from './BulkContactModal';
import { type Category } from './CategoriesClient';
import { LabelChip, LabelEditor, createLabel, loadLabelsWithCounts } from './Labels';
import HelpBox from './HelpBox';

const PAGE_SIZE = 50;

const SEGMENT_LABEL: Record<DonorSegment, string> = {
  monthly_regular: 'Monthly',
  campaign_oneoff: 'Campaign, once',
  campaign_monthly: 'Campaign, monthly',
  other: 'Other',
};
const ISSUE_LABEL: Record<string, string> = {
  failed_payment: 'Card failed', lapsed: 'Lapsed', unfulfilled_pledge: 'Pledge unpaid', manual: 'Flagged',
};
const fmtDate = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

type SortKey = 'full_name' | 'monthly_amount' | 'total_paid' | 'balance' | 'last_gift_at' | 'created_at';
type Row = Donor & {
  donor_issues?: { type: string; status: string }[];
  donor_categories?: { category_id: string }[];
};

interface Props {
  initialSegment?: string;
  initialStatus?: string;
  initialIssueType?: string;
  onlyIssues?: boolean;
  initialQuery?: string;
  /** Label id or name, e.g. /crm/donors?label=Campaign */
  initialLabel?: string;
}

export default function DonorsClient({ initialSegment, initialStatus, initialIssueType, onlyIssues, initialQuery, initialLabel }: Props) {
  const supabase = createClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qInput, setQInput] = useState(initialQuery || '');
  const [q, setQ] = useState(initialQuery || '');
  const [lastPaid, setLastPaid] = useState<Map<string, string>>(new Map());
  const [segment, setSegment] = useState(initialSegment || '');
  const [status, setStatus] = useState(initialStatus || '');
  const [issueType, setIssueType] = useState(initialIssueType || '');
  const [issuesOnly, setIssuesOnly] = useState(!!onlyIssues || !!initialIssueType);
  const [cats, setCats] = useState<Category[]>([]);
  const [labelCounts, setLabelCounts] = useState<Map<string, number>>(new Map());
  // Label filter: one or more label ids; "all" = has every chosen label, "any" = has at least one.
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [labelMatch, setLabelMatch] = useState<'all' | 'any'>('all');
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
    if (labelFilter.length) {
      if (labelMatch === 'any' || labelFilter.length === 1) query = query.in('lf0.category_id', labelFilter);
      else labelFilter.forEach((id, i) => { query = query.eq(`lf${i}.category_id`, id); });
    }
    if (segment) query = query.eq('segment', segment);
    if (status) query = query.eq('status', status);
    // Hebrew / English / Latin names, any phone format, email, city.
    query = applySearch(query, q, DONOR_TEXT_FIELDS, DONOR_PHONE_FIELDS);
    return query;
  }, [segment, status, issueType, q, labelFilter, labelMatch]);

  // Labels always come back in full (for the chips); filtering uses separate
  // aliased inner joins (lf0, lf1…) so a filtered row still shows all its labels.
  const catEmbed = useCallback(() => {
    const parts = ['donor_categories(category_id)'];
    const n = labelFilter.length === 0 ? 0 : (labelMatch === 'any' ? 1 : labelFilter.length);
    for (let i = 0; i < n; i++) parts.push(`lf${i}:donor_categories!inner(category_id)`);
    return parts.join(', ');
  }, [labelFilter, labelMatch]);

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
      const list = ((data as any) ?? []) as Row[];
      setRows(list);
      setCount(c ?? 0);
      // Latest Nedarim charge per donor (real "last gift"), via the existing RPC.
      if (list.length) {
        const { data: stats } = await supabase.rpc('nedarim_donor_payment_stats', { donor_ids: list.map((r) => r.id) });
        setLastPaid(new Map(((stats ?? []) as { donor_id: string; last_paid: string | null }[])
          .filter((x) => x.last_paid).map((x) => [x.donor_id, x.last_paid as string])));
      }
    } catch (e: any) {
      setError(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, applyFilters, issuesOnly, issueType, sort, asc, page]);

  useEffect(() => { load(); }, [load]);
  // Arriving from the top search bar's "See all matching donors".
  useEffect(() => { if (initialQuery !== undefined) setQInput(initialQuery); }, [initialQuery]);
  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(t); }, [qInput]);
  useEffect(() => { setPage(0); }, [q, segment, status, issueType, issuesOnly, sort, asc, labelFilter, labelMatch]);
  const loadLabels = useCallback(async () => {
    const { labels, donorCounts } = await loadLabelsWithCounts(supabase);
    setCats(labels);
    setLabelCounts(donorCounts);
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadLabels().then((labels) => {
      // Arriving from a link like /crm/donors?label=Campaign (id or name).
      if (!initialLabel) return;
      const want = initialLabel.trim().toLowerCase();
      const hit = labels.find((l) => l.id === initialLabel || l.name.toLowerCase() === want);
      if (hit) setLabelFilter([hit.id]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLabel]);

  const toggleLabelFilter = (id: string) =>
    setLabelFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  // Add / remove one label on one donor, right from the list.
  const toggleRowLabel = async (d: Row, label: Category) => {
    const has = (d.donor_categories ?? []).some((l) => l.category_id === label.id);
    const { error } = has
      ? await supabase.from('donor_categories').delete().eq('donor_id', d.id).eq('category_id', label.id)
      : await supabase.from('donor_categories').insert({ donor_id: d.id, category_id: label.id });
    if (error) { setError(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id !== d.id ? r : {
      ...r,
      donor_categories: has
        ? (r.donor_categories ?? []).filter((l) => l.category_id !== label.id)
        : [...(r.donor_categories ?? []), { category_id: label.id }],
    })));
    setLabelCounts((m) => new Map(m).set(label.id, Math.max(0, (m.get(label.id) ?? 0) + (has ? -1 : 1))));
  };
  const createAndAddRowLabel = async (d: Row, name: string) => {
    const { label, error } = await createLabel(supabase, name, cats);
    if (error || !label) { setError(error || 'Could not create the label.'); return; }
    if (!cats.some((c) => c.id === label.id)) setCats((cs) => [...cs, label].sort((a, b) => a.name.localeCompare(b.name)));
    if (!(d.donor_categories ?? []).some((l) => l.category_id === label.id)) await toggleRowLabel(d, label);
  };
  const createBulkLabel = async () => {
    const name = window.prompt('New label name (e.g. Fees, Donation, Campaign, Devora):');
    if (!name || !name.trim()) return;
    const { label, error } = await createLabel(supabase, name, cats);
    if (error || !label) { setError(error || 'Could not create the label.'); return; }
    if (!cats.some((c) => c.id === label.id)) setCats((cs) => [...cs, label].sort((a, b) => a.name.localeCompare(b.name)));
    setBulkCat(label.id);
  };

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
      const lines = [[...cols.map((c) => c[0]), 'Labels'].join(',')];
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

  // Assign / remove a label for every selected donor.
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
      loadLabels();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setCatBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const selCls = 'bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[15px] text-slate-900';
  const btnLight = 'px-4 py-2 rounded-lg border border-slate-300 bg-[#fff] hover:bg-slate-50 text-[15px] text-slate-800 font-medium disabled:opacity-50';
  const sortBtn = (key: SortKey, label: string) => (
    <button onClick={() => toggleSort(key)} className="font-semibold hover:text-slate-900">{label}{sortIcon(key)}</button>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{onlyIssues ? 'Needs attention' : 'Donors'}</h1>
          <p className="text-slate-600 text-[15px]">{count.toLocaleString()} {onlyIssues ? 'donors with an open issue' : 'donors'}{q ? ` matching “${q}”` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={selectingAll} className={btnLight}>
            {selectingAll ? 'Exporting…' : `Download Excel/CSV${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <a href="/crm/import" className={btnLight}>Import a sheet</a>
        </div>
      </div>

      <HelpBox>
        {onlyIssues ? (
          <>
            <p>Donors that need attention, by problem type: <b>card failed</b> (handled by the
            <a href="/crm/nedarim" className="underline"> Nedarim page</a>), <b>lapsed</b> (stopped giving / finished their commitment),
            <b> pledge unpaid</b>, and <b>flags</b> you set yourself.</p>
            <p>Tap a name for the full donor page; mark the issue resolved there when it&apos;s handled.</p>
          </>
        ) : (
          <>
            <p><b>Search</b> by Hebrew or English name, any phone format, email or city. <b>Filter</b> by type, status, issue or <b>label</b> (tap label chips; pick several to narrow down). Tap a column title to <b>sort</b>.</p>
            <p><b>Labels</b> (Fees, Donation, Campaign…): tap <b>+ label</b> on any row to add one or type a new one; tap × on a chip to remove it.</p>
            <p>Tap a <b>name</b> to open the donor page (contact, Nedarim, gifts, messages, notes — all editable). <b>Call / WhatsApp / Email</b> work in one tap.</p>
            <p><b>Bulk:</b> tick boxes (or &quot;Select all matching&quot;) to email everyone selected or add / remove a label for all of them. <b>Download</b> exports the selection (or the whole filtered list).</p>
          </>
        )}
      </HelpBox>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name (עברית / English), phone, email, city…"
          className="flex-1 min-w-[260px] bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[16px] text-slate-900 focus:outline-none focus:border-slate-600" />
        <select value={segment} onChange={(e) => setSegment(e.target.value)} className={selCls} aria-label="Type of donor">
          <option value="">Any type</option>
          <option value="monthly_regular">Monthly regulars</option>
          <option value="campaign_oneoff">Campaign, one-off</option>
          <option value="campaign_monthly">Campaign, monthly</option>
          <option value="other">Other</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="lapsed">Lapsed</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={issueType} onChange={(e) => { setIssueType(e.target.value); if (e.target.value) setIssuesOnly(true); }} className={selCls} aria-label="Issue">
          <option value="">Any issue</option>
          <option value="failed_payment">Card failed</option>
          <option value="lapsed">Lapsed</option>
          <option value="unfulfilled_pledge">Pledge unpaid</option>
          <option value="manual">Flagged by you</option>
        </select>
        <label className="flex items-center gap-2 text-[15px] text-slate-800 px-2">
          <input type="checkbox" className="w-4 h-4" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          Only open issues
        </label>
      </div>

      {/* Label filter: tap chips; counts = donors carrying each label */}
      {cats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4" aria-label="Filter by label">
          <span className="text-[15px] font-semibold text-slate-700 mr-1">Labels:</span>
          {cats.map((c) => (
            <LabelChip
              key={c.id}
              label={c}
              count={labelCounts.get(c.id) ?? 0}
              active={labelFilter.includes(c.id)}
              onClick={() => toggleLabelFilter(c.id)}
              title={labelFilter.includes(c.id) ? `Stop filtering by ${c.name}` : `Show only donors labelled ${c.name}`}
            />
          ))}
          {labelFilter.length > 1 && (
            <span className="flex items-center gap-1 ml-2 text-sm text-slate-700">
              Show donors with
              <select value={labelMatch} onChange={(e) => setLabelMatch(e.target.value as 'all' | 'any')} className="bg-[#fff] border border-slate-300 rounded-md px-1.5 py-0.5 text-sm" aria-label="Match all or any label">
                <option value="all">all of these</option>
                <option value="any">any of these</option>
              </select>
            </span>
          )}
          {labelFilter.length > 0 && (
            <button onClick={() => setLabelFilter([])} className="ml-2 text-sm text-sky-700 hover:underline">Clear labels</button>
          )}
          <a href="/crm/categories" className="ml-auto text-sm text-sky-700 hover:underline">Manage labels</a>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-300 flex-wrap">
          <div className="text-[15px] text-amber-950">
            <strong>{selected.size}</strong> selected
            {selected.size < count && (
              <button onClick={selectAllMatching} disabled={selectingAll} className="ml-3 underline">
                {selectingAll ? 'selecting…' : `Select all ${count.toLocaleString()} matching`}
              </button>
            )}
            <button onClick={clearSelection} className="ml-3 underline">Clear</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={bulkCat}
              onChange={(e) => { if (e.target.value === '__new') createBulkLabel(); else setBulkCat(e.target.value); }}
              className={selCls}
              aria-label="Label for selected"
            >
              <option value="">Label…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">+ New label…</option>
            </select>
            <button onClick={() => bulkCategory('add')} disabled={!bulkCat || catBusy} className={btnLight}>
              {catBusy ? '…' : 'Add label'}
            </button>
            <button onClick={() => bulkCategory('remove')} disabled={!bulkCat || catBusy} className={btnLight}>
              Remove label
            </button>
            <button onClick={() => setBulkOpen(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-[#fff] font-semibold text-[15px]">
              Email {selected.size} selected
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-[#991b1b] text-[15px] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* Table: Name · Phone/WhatsApp · Monthly · Last gift · Status · Contact */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto bg-[#fff]">
        <table className="w-full text-[15px] min-w-[880px]">
          <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-8"><input type="checkbox" className="w-4 h-4" checked={pageAllSelected} onChange={togglePage} aria-label="Select page" /></th>
              <th className="text-left px-4 py-3">{sortBtn('full_name', 'Name · labels')}</th>
              <th className="text-left px-4 py-3">Phone / WhatsApp</th>
              <th className="text-right px-4 py-3">{sortBtn('monthly_amount', 'Monthly')}</th>
              <th className="text-left px-4 py-3">{sortBtn('last_gift_at', 'Last gift')}</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-600">No donors found{q ? ` for “${q}”` : ''}.</td></tr>}
            {!loading && rows.map((d) => {
              const sym = currencySymbol(d.currency);
              const openIssues = (d.donor_issues || []).filter((i) => i.status === 'open');
              const name = d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || '—';
              const nedarimLast = lastPaid.get(d.id) ?? null;
              const last = [d.last_gift_at, nedarimLast].filter(Boolean).sort().pop() ?? null;
              const wa = d.whatsapp_phone && d.whatsapp_phone !== d.phone ? d.whatsapp_phone : null;
              return (
                <tr key={d.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selected.has(d.id) ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-3"><input type="checkbox" className="w-4 h-4" checked={selected.has(d.id)} onChange={() => toggleRow(d)} aria-label={`Select ${name}`} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDetail(d)} className="text-left group">
                      <span className="block font-semibold text-slate-900 group-hover:underline">{name}</span>
                      {d.hebrew_name && <span className="block text-slate-600 font-hebrew text-left" dir="rtl">{d.hebrew_name}</span>}
                    </button>
                    <div className="mt-1 min-w-[260px] max-w-[340px]">
                      <LabelEditor
                        compact
                        labels={cats}
                        assigned={new Set((d.donor_categories ?? []).map((l) => l.category_id))}
                        onToggle={(l) => toggleRowLabel(d, l)}
                        onCreate={(n) => createAndAddRowLabel(d, n)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-800 whitespace-nowrap" dir="ltr">
                    {d.phone || <span className="text-[#94a3b8]">no phone</span>}
                    {wa && <span className="block text-sm text-slate-500">WhatsApp {wa}</span>}
                    {d.city && <span className="block text-sm text-slate-500">{d.city}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {d.monthly_amount ? fmtMoney(d.monthly_amount, sym) : <span className="text-[#94a3b8] font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{last ? fmtDate(last) : <span className="text-[#94a3b8]">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 rounded-md text-sm ${d.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>
                        {d.status === 'active' ? 'Active' : d.status === 'lapsed' ? 'Lapsed' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-sm bg-slate-100 text-slate-700">{SEGMENT_LABEL[d.segment] ?? d.segment}</span>
                      {Array.from(new Set(openIssues.map((i) => i.type))).map((t) => (
                        <span key={t} className={`px-2 py-0.5 rounded-md text-sm font-medium ${t === 'failed_payment' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-amber-100 text-amber-900'}`}>
                          {ISSUE_LABEL[t] ?? t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ContactButtons phone={d.phone} whatsapp={d.whatsapp_phone} email={d.email} className="justify-end" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-[15px]">
        <span className="text-slate-600">Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className={btnLight}>Previous</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className={btnLight}>Next</button>
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

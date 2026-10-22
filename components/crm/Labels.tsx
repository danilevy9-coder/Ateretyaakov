'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_COLORS, type Category } from './CategoriesClient';

// Labels ("tags") for donors and students — e.g. Fees, Donation, Campaign,
// Devora. Stored in the existing `categories` table (one shared list), linked
// through `donor_categories` and, once labels.sql has been run,
// `student_categories`. Each label keeps its email-treatment rule from the
// Labels page; a label created on the fly copies the "no label" rule, so
// tagging someone never changes how they are emailed.

export type Label = Category;
type Supa = ReturnType<typeof createClient>;

/** A coloured chip. Optional × to remove, optional count, optional active state. */
export function LabelChip({
  label, onRemove, onClick, count, active, dim, title, small,
}: {
  label: { name: string; color: string };
  onRemove?: () => void;
  onClick?: () => void;
  count?: number;
  active?: boolean;
  dim?: boolean;
  title?: string;
  /** Tighter chip for table rows. */
  small?: boolean;
}) {
  const color = label.color || '#94a3b8';
  const style: React.CSSProperties = active
    ? { backgroundColor: color, borderColor: color, color: '#fff' }
    : {
        backgroundColor: color + (dim ? '0d' : '26'),
        borderColor: color + (dim ? '40' : '99'),
        color: dim ? '#94a3b8' : '#1e293b',
      };
  const body = (
    <>
      {!active && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, opacity: dim ? 0.4 : 1 }} />}
      <span>{label.name}</span>
      {count !== undefined && <span className={active ? 'opacity-90' : 'text-slate-500'}>{count.toLocaleString()}</span>}
    </>
  );
  const cls = `inline-flex items-center rounded-full font-medium whitespace-nowrap border ${small ? 'gap-1 px-2 py-0 text-[13px]' : 'gap-1.5 px-2.5 py-0.5 text-sm'}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={cls + ' hover:brightness-95'} style={style} aria-pressed={active}>
        {body}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={title}>
      {body}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="-mr-1 ml-0.5 w-4 h-4 leading-none rounded-full text-slate-500 hover:text-slate-900 hover:bg-black/10"
          aria-label={`Remove label ${label.name}`}
          title="Remove label"
        >×</button>
      )}
    </span>
  );
}

/** Create a label (or return the existing one with the same name, any case). */
export async function createLabel(
  supabase: Supa, rawName: string, existing: Label[]
): Promise<{ label?: Label; error?: string }> {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'Type a name for the label.' };
  const same = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (same) return { label: same };

  // Copy the "no label" email rule so adding this label is neutral.
  const row: Record<string, unknown> = { name, color: CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length] };
  const { data: s } = await supabase.from('crm_settings').select('value').eq('key', 'default_treatment').maybeSingle();
  const v = (s as { value?: any } | null)?.value;
  if (v && typeof v === 'object' && ['auto', 'manual', 'none'].includes(v.policy)) {
    row.outreach_policy = v.policy;
    if (Number(v.followup_days) >= 1) row.followup_days = Math.min(99, Math.round(Number(v.followup_days)));
    if (Number(v.max_messages) >= 1) row.max_messages = Math.min(99, Math.round(Number(v.max_messages)));
  }

  const { data, error } = await supabase.from('categories').insert(row).select('*').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: found } = await supabase.from('categories').select('*').ilike('name', name).limit(1);
      if (found && found[0]) return { label: found[0] as Label };
    }
    return { error: error.message };
  }
  return { label: data as Label };
}

/** All labels, with how many donors (and students, when available) carry each. */
export async function loadLabelsWithCounts(supabase: Supa): Promise<{
  labels: Label[]; donorCounts: Map<string, number>; studentCounts: Map<string, number> | null;
}> {
  const donorCounts = new Map<string, number>();
  let studentCounts: Map<string, number> | null = null;

  const withCounts = await supabase.from('categories').select('*, donor_categories(count)').order('name');
  let labels: Label[] = [];
  if (!withCounts.error) {
    for (const r of (withCounts.data ?? []) as any[]) {
      const { donor_categories, ...rest } = r;
      labels.push(rest as Label);
      donorCounts.set(r.id, Number(donor_categories?.[0]?.count ?? 0));
    }
  } else {
    // Fallback: one small count query per label.
    const { data } = await supabase.from('categories').select('*').order('name');
    labels = (data as Label[]) ?? [];
    await Promise.all(labels.map(async (l) => {
      const { count } = await supabase.from('donor_categories').select('category_id', { count: 'exact', head: true }).eq('category_id', l.id);
      donorCounts.set(l.id, count ?? 0);
    }));
  }

  if (await studentLabelsAvailable(supabase)) {
    const { data, error } = await supabase.from('categories').select('id, student_categories(count)');
    if (!error) {
      studentCounts = new Map();
      for (const r of (data ?? []) as any[]) studentCounts.set(r.id, Number(r.student_categories?.[0]?.count ?? 0));
    }
  }
  return { labels, donorCounts, studentCounts };
}

let studentTableKnown: boolean | null = null;
/** Student labels need the student_categories table (labels.sql). */
export async function studentLabelsAvailable(supabase: Supa): Promise<boolean> {
  if (studentTableKnown !== null) return studentTableKnown;
  const { error } = await supabase.from('student_categories').select('student_id', { count: 'exact', head: true }).limit(1);
  studentTableKnown = !error;
  return studentTableKnown;
}

/** Popover: find a label, tick / untick it, or create a new one by typing. */
export function LabelPicker({
  labels, assigned, onToggle, onCreate, onClose, align = 'left', anchor,
}: {
  labels: Label[];
  assigned: Set<string>;
  onToggle: (l: Label) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
  onClose: () => void;
  align?: 'left' | 'right';
  /** The button it opened from; the picker floats next to it (never clipped by a scrolling table). */
  anchor?: DOMRect | null;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    if (anchor) window.addEventListener('scroll', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [onClose, anchor]);

  // Float next to the button, kept inside the screen.
  let floatStyle: React.CSSProperties | undefined;
  if (anchor && typeof window !== 'undefined') {
    const W = 288, H = 340;
    const left = Math.max(8, Math.min(align === 'right' ? anchor.right - W : anchor.left, window.innerWidth - W - 8));
    const below = anchor.bottom + 4;
    // Not enough room underneath → open upwards, its bottom edge just above the button.
    floatStyle = below + H > window.innerHeight && anchor.top - H - 4 > 8
      ? { position: 'fixed', left, bottom: window.innerHeight - anchor.top + 4 }
      : { position: 'fixed', left, top: below };
  }

  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => (term ? labels.filter((l) => l.name.toLowerCase().includes(term)) : labels),
    [labels, term]
  );
  const exact = labels.find((l) => l.name.toLowerCase() === term);

  const create = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    try { await onCreate(q.trim()); setQ(''); } finally { setBusy(false); }
  };
  const onEnter = async () => {
    if (exact) { await onToggle(exact); setQ(''); }
    else if (shown.length === 1 && term) { await onToggle(shown[0]); setQ(''); }
    else await create();
  };

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={floatStyle}
      className={`${floatStyle ? '' : `absolute mt-1 ${align === 'right' ? 'right-0' : 'left-0'}`} z-50 w-72 bg-[#fff] border border-slate-200 rounded-xl shadow-xl p-2 text-left`}
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        placeholder="Find or create a label…"
        className="w-full bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[15px] text-slate-900 outline-none focus:border-slate-600"
        aria-label="Find or create a label"
      />
      <ul className="max-h-64 overflow-y-auto mt-1">
        {shown.map((l) => {
          const on = assigned.has(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onToggle(l)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left text-[15px] text-slate-900"
                aria-pressed={on}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-slate-900 border-slate-900 text-[#fff]' : 'border-slate-400'}`}>{on ? '✓' : ''}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="flex-1 truncate">{l.name}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && !q.trim() && <li className="px-2 py-2 text-sm text-slate-500">No labels yet — type a name to create one.</li>}
      </ul>
      {q.trim() && !exact && (
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-[#fff] text-[15px] font-semibold text-left disabled:opacity-60"
        >
          {busy ? 'Creating…' : `+ Create label “${q.trim()}”`}
        </button>
      )}
    </div>
  );
}

/** Assigned chips (with ×) plus a "+ Label" button that opens the picker. */
export function LabelEditor({
  labels, assigned, onToggle, onCreate, compact, align,
}: {
  labels: Label[];
  assigned: Set<string>;
  onToggle: (l: Label) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
  compact?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const mine = labels.filter((l) => assigned.has(l.id));
  return (
    <div className={`relative flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`} onClick={(e) => e.stopPropagation()}>
      {mine.map((l) => <LabelChip key={l.id} label={l} small={compact} onRemove={() => onToggle(l)} />)}
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { setAnchor(e.currentTarget.getBoundingClientRect()); setOpen((v) => !v); }}
        className={compact
          ? 'px-2 py-0 rounded-full border border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-500 text-[13px]'
          : 'px-3 py-1 rounded-full border border-dashed border-slate-400 text-slate-700 hover:text-slate-900 hover:border-slate-600 text-sm font-medium'}
        aria-label="Add a label"
        title="Add a label"
      >
        {compact ? '+ label' : '+ Add label'}
      </button>
      {open && (
        <LabelPicker
          labels={labels}
          assigned={assigned}
          onToggle={onToggle}
          onCreate={onCreate}
          onClose={() => setOpen(false)}
          align={align}
          anchor={anchor}
        />
      )}
    </div>
  );
}

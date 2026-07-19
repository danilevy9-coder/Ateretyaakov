'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HelpBox from './HelpBox';
import {
  FALLBACK_RULE,
  type OutreachMode,
  type OutreachPolicy,
  type TreatmentRule,
} from '@/lib/crm/outreach';

export interface Category {
  id: string;
  name: string;
  color: string;
  outreach_policy: OutreachPolicy;
  followup_days: number;
  max_messages: number;
}

// A small palette that reads well on the dark theme.
export const CATEGORY_COLORS = [
  '#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa',
  '#fb7185', '#facc15', '#4ade80', '#22d3ee', '#c084fc',
];

export function CategoryChip({ cat, onClick, dim }: { cat: { name: string; color: string }; onClick?: () => void; dim?: boolean }) {
  const inner = (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: cat.color + (dim ? '14' : '2b'), color: dim ? '#94a3b8' : cat.color }}
    >
      {cat.name}
    </span>
  );
  return onClick ? <button onClick={onClick}>{inner}</button> : inner;
}

const POLICY_OPTIONS: { value: OutreachPolicy; label: string; hint: string }[] = [
  { value: 'auto',   label: '🤖 Auto-email',   hint: 'The system emails them by itself (when sending is Automatic)' },
  { value: 'manual', label: '✋ Manual only',   hint: 'Never emailed automatically — you contact them yourself' },
  { value: 'none',   label: '🚫 Do not email', hint: 'Never emailed at all — skipped even in bulk email' },
];

// The treatment controls for one rule (a category, or the no-category default).
function RuleEditor({ rule, onChange }: { rule: TreatmentRule; onChange: (r: TreatmentRule) => void }) {
  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : fallback;
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <select
        value={rule.policy}
        onChange={(e) => onChange({ ...rule, policy: e.target.value as OutreachPolicy })}
        title={POLICY_OPTIONS.find((o) => o.value === rule.policy)?.hint}
        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500/50"
      >
        {POLICY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {rule.policy === 'auto' && (
        <span className="flex items-center gap-1.5 text-slate-300">
          follow up every
          <input
            type="number" min={1} max={99} value={rule.followup_days}
            onChange={(e) => onChange({ ...rule, followup_days: num(e.target.value, rule.followup_days) })}
            className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-center"
          />
          days · stop after
          <input
            type="number" min={1} max={99} value={rule.max_messages}
            onChange={(e) => onChange({ ...rule, max_messages: num(e.target.value, rule.max_messages) })}
            className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-center"
          />
          emails
        </span>
      )}
      {rule.policy === 'manual' && <span className="text-slate-500 text-xs">You email them yourself (Recovery page or Donors grid)</span>}
      {rule.policy === 'none' && <span className="text-slate-500 text-xs">Blocked everywhere — even bulk email skips them</span>}
    </div>
  );
}

export default function CategoriesClient() {
  const supabase = createClient();
  const [cats, setCats] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mode, setMode] = useState<OutreachMode>('manual');
  const [defaultRule, setDefaultRule] = useState<TreatmentRule>({ ...FALLBACK_RULE });
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data }, { data: links }, { data: settings }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('donor_categories').select('category_id'),
      supabase.from('crm_settings').select('key, value').in('key', ['outreach_mode', 'default_treatment']),
    ]);
    setCats((data as Category[]) ?? []);
    const map = new Map<string, number>();
    for (const l of links ?? []) map.set(l.category_id, (map.get(l.category_id) ?? 0) + 1);
    setCounts(map);
    for (const s of settings ?? []) {
      if (s.key === 'outreach_mode') setMode(s.value === 'auto' ? 'auto' : 'manual');
      if (s.key === 'default_treatment' && s.value && typeof s.value === 'object') {
        setDefaultRule({ ...FALLBACK_RULE, ...(s.value as Partial<TreatmentRule>) });
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(''), 2500);
  };

  const saveSetting = async (key: string, value: unknown) => {
    const { error } = await supabase.from('crm_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) setErr(error.message);
    else flash('✓ Saved');
  };

  const setModeAndSave = async (m: OutreachMode) => {
    setMode(m);
    await saveSetting('outreach_mode', m);
  };

  const setDefaultAndSave = async (r: TreatmentRule) => {
    setDefaultRule(r);
    await saveSetting('default_treatment', r);
  };

  const saveRule = async (cat: Category, r: TreatmentRule) => {
    setCats((cs) => cs.map((c) => (c.id === cat.id ? { ...c, outreach_policy: r.policy, followup_days: r.followup_days, max_messages: r.max_messages } : c)));
    const { error } = await supabase.from('categories')
      .update({ outreach_policy: r.policy, followup_days: r.followup_days, max_messages: r.max_messages })
      .eq('id', cat.id);
    if (error) setErr(error.message);
    else flash('✓ Saved');
  };

  const add = async () => {
    setErr('');
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('categories').insert({ name: trimmed, color });
    if (error) { setErr(error.message.includes('duplicate') ? 'A category with that name already exists.' : error.message); return; }
    setName('');
    setColor(CATEGORY_COLORS[(cats.length + 1) % CATEGORY_COLORS.length]);
    load();
  };

  const rename = async (cat: Category) => {
    const next = window.prompt('Rename category:', cat.name);
    if (!next || next.trim() === cat.name) return;
    const { error } = await supabase.from('categories').update({ name: next.trim() }).eq('id', cat.id);
    if (error) setErr(error.message);
    load();
  };

  const recolor = async (cat: Category, c: string) => {
    await supabase.from('categories').update({ color: c }).eq('id', cat.id);
    load();
  };

  const remove = async (cat: Category) => {
    const n = counts.get(cat.id) ?? 0;
    if (!confirm(`Delete "${cat.name}"?${n ? ` It will be removed from ${n} donor(s).` : ''}`)) return;
    await supabase.from('categories').delete().eq('id', cat.id);
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Categories</h1>
      <p className="text-slate-400 text-sm mb-6">
        Label your donors, then decide <b className="text-slate-200">how each group is treated</b> — who the
        system may email by itself, how often, and who is only ever contacted by you.
      </p>

      <HelpBox>
        <p><b>Sending mode</b> is the master switch. <b>✋ Manual</b> (recommended): the system never emails anyone
        by itself — you pick donors on the Recovery page (or Donors grid) and press Send. <b>🤖 Automatic</b>:
        the system sends payment-recovery emails by itself, but <b>only</b> to donors whose category below says
        &quot;Auto-email&quot;, at the pace you set.</p>
        <p><b>Each category has a treatment:</b> 🤖 Auto-email (with &quot;every N days, stop after M emails&quot;) ·
        ✋ Manual only (never automatic) · 🚫 Do not email (blocked everywhere, even bulk email). If a donor has
        several categories, the <b>most careful</b> one wins. Donors with no category follow the
        &quot;no category&quot; rule at the top.</p>
        <p><b>Assign categories</b> from a donor&apos;s card (click the chips) or in bulk from the Donors grid
        (select rows → 🏷). Unsubscribed donors are never emailed, in any mode.</p>
      </HelpBox>

      {(err || saved) && (
        <p className={`text-sm mb-3 ${err ? 'text-red-300' : 'text-emerald-300'}`}>{err || saved}</p>
      )}

      {/* ── Master switch ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-white text-sm">Sending mode:</span>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {([['manual', '✋ Manual — I choose who gets emailed'], ['auto', '🤖 Automatic — follow the category rules']] as [OutreachMode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => setModeAndSave(m)}
                className={`px-3 py-1.5 text-sm transition-colors ${mode === m ? 'bg-amber-500 text-black font-semibold' : 'bg-transparent text-slate-400 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {mode === 'manual'
            ? 'Nothing is ever sent automatically. Bouncing donors pile up on the Nedarim Plus page — select them there and press Send.'
            : 'The daily sync emails bouncing donors — but only those in a 🤖 Auto-email category (or covered by the "no category" rule below).'}
        </p>
      </div>

      {/* ── Default treatment (no category) ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
        <p className="text-sm font-semibold text-white mb-2">Donors with <span className="text-slate-400">no category</span></p>
        <RuleEditor rule={defaultRule} onChange={setDefaultAndSave} />
      </div>

      {/* Add new */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New category name (e.g. Parents, Alumni, Dinner 2026, VIP)…"
          className="flex-1 min-w-[240px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
        />
        <div className="flex gap-1">
          {CATEGORY_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} title={c}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button onClick={add} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">
          + Add
        </button>
      </div>

      {/* List */}
      <div className="mt-4 rounded-xl border border-white/10 divide-y divide-white/5">
        {loading && <p className="px-4 py-6 text-slate-500 text-sm">Loading…</p>}
        {!loading && cats.length === 0 && (
          <p className="px-4 py-6 text-slate-500 text-sm">No categories yet — create your first one above.</p>
        )}
        {cats.map((cat) => (
          <div key={cat.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <CategoryChip cat={cat} />
              <span className="text-slate-500 text-xs">{counts.get(cat.id) ?? 0} donor(s)</span>
              <span className="flex-1" />
              <div className="flex gap-1 mr-2">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c} onClick={() => recolor(cat, c)} title="Change color"
                    className={`w-4 h-4 rounded-full border ${cat.color === c ? 'border-white' : 'border-transparent'} opacity-70 hover:opacity-100`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button onClick={() => rename(cat)} className="text-xs text-slate-400 hover:text-white">Rename</button>
              <button onClick={() => remove(cat)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
            </div>
            <RuleEditor
              rule={{ policy: cat.outreach_policy ?? 'manual', followup_days: cat.followup_days ?? 7, max_messages: cat.max_messages ?? 3 }}
              onChange={(r) => saveRule(cat, r)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

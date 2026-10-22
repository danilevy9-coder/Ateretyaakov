'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HelpBox from './HelpBox';
import { loadLabelsWithCounts } from './Labels';
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

// A small palette for category chips.
export const CATEGORY_COLORS = [
  '#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa',
  '#fb7185', '#facc15', '#4ade80', '#22d3ee', '#c084fc',
];

export function CategoryChip({ cat, onClick, dim }: { cat: { name: string; color: string }; onClick?: () => void; dim?: boolean }) {
  // Light theme: dark text with a coloured dot + tint, so every colour stays readable.
  const inner = (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium whitespace-nowrap border"
      style={{
        backgroundColor: cat.color + (dim ? '0d' : '26'),
        borderColor: cat.color + (dim ? '40' : '99'),
        color: dim ? '#94a3b8' : '#1e293b',
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color, opacity: dim ? 0.4 : 1 }} />
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

// The treatment controls for one rule (a label, or the no-label default).
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
  const [studentCounts, setStudentCounts] = useState<Map<string, number> | null>(null);
  const [mode, setMode] = useState<OutreachMode>('manual');
  const [defaultRule, setDefaultRule] = useState<TreatmentRule>({ ...FALLBACK_RULE });
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Counts come from the database (not by downloading every link row, which
    // stopped counting at 1,000).
    const [withCounts, { data: settings }] = await Promise.all([
      loadLabelsWithCounts(supabase),
      supabase.from('crm_settings').select('key, value').in('key', ['outreach_mode', 'default_treatment']),
    ]);
    setCats(withCounts.labels);
    setCounts(withCounts.donorCounts);
    setStudentCounts(withCounts.studentCounts);
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
    if (error) { setErr(error.message.includes('duplicate') ? 'A label with that name already exists.' : error.message); return; }
    setName('');
    setColor(CATEGORY_COLORS[(cats.length + 1) % CATEGORY_COLORS.length]);
    load();
  };

  const rename = async (cat: Category) => {
    const next = window.prompt('Rename label:', cat.name);
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
    const sn = studentCounts?.get(cat.id) ?? 0;
    const from = [n ? `${n} donor(s)` : '', sn ? `${sn} student(s)` : ''].filter(Boolean).join(' and ');
    if (!confirm(`Delete the label "${cat.name}"?${from ? ` It will be removed from ${from}.` : ''}`)) return;
    await supabase.from('categories').delete().eq('id', cat.id);
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Labels</h1>
      <p className="text-slate-400 text-sm mb-6">
        Tag donors{studentCounts ? ' and students' : ''} with labels like <b className="text-slate-200">Fees, Donation, Campaign, Devora</b> — as many
        as you like per person. Tap a label&apos;s count to see everyone who has it. Each label can also decide
        <b className="text-slate-200"> how that group is emailed</b>.
      </p>

      <HelpBox>
        <p><b>Sending mode</b> is the master switch. <b>✋ Manual</b> (recommended): the system never emails anyone
        by itself — you pick donors on the Recovery page (or Donors grid) and press Send. <b>🤖 Automatic</b>:
        the system sends payment-recovery emails by itself, but <b>only</b> to donors whose label below says
        &quot;Auto-email&quot;, at the pace you set.</p>
        <p><b>Adding labels:</b> on the Donors list tap <b>+ label</b> under a name, or on a donor&apos;s page tap
        <b> + Add label</b>. Type a new name to create a label on the spot. Tap × on a chip to remove it.
        Filter the Donors list by tapping label chips above the table.</p>
        <p><b>Each label has an email treatment:</b> 🤖 Auto-email (with &quot;every N days, stop after M emails&quot;) ·
        ✋ Manual only (never automatic) · 🚫 Do not email (blocked everywhere, even bulk email). If a donor has
        several labels, the <b>most careful</b> one wins. Donors with no label follow the
        &quot;no label&quot; rule at the top. A label created on the fly copies the &quot;no label&quot; rule, so
        tagging someone doesn&apos;t change how they&apos;re emailed.</p>
        <p><b>In bulk:</b> on the Donors grid tick rows → choose a label → Add label. Unsubscribed donors are never emailed, in any mode.</p>
      </HelpBox>

      {(err || saved) && (
        <p className={`text-sm mb-3 ${err ? 'text-red-300' : 'text-emerald-300'}`}>{err || saved}</p>
      )}

      {/* ── Master switch ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-white text-sm">Sending mode:</span>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {([['manual', '✋ Manual — I choose who gets emailed'], ['auto', '🤖 Automatic — follow the label rules']] as [OutreachMode, string][]).map(([m, label]) => (
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
            : 'The daily sync emails bouncing donors — but only those with a 🤖 Auto-email label (or covered by the "no label" rule below).'}
        </p>
      </div>

      {/* ── Default treatment (no category) ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
        <p className="text-sm font-semibold text-white mb-2">Donors with <span className="text-slate-400">no label</span></p>
        <RuleEditor rule={defaultRule} onChange={setDefaultAndSave} />
      </div>

      {/* Add new */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New label (e.g. Fees, Donation, Campaign, Devora, Dinner 2026)…"
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
          <p className="px-4 py-6 text-slate-500 text-sm">No labels yet — create your first one above.</p>
        )}
        {cats.map((cat) => (
          <div key={cat.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <CategoryChip cat={cat} />
              <a href={`/crm/donors?label=${cat.id}`} className="text-sky-700 hover:underline text-sm" title={`Show donors labelled ${cat.name}`}>
                {(counts.get(cat.id) ?? 0).toLocaleString()} donor(s)
              </a>
              {studentCounts && (
                <a href={`/crm/students?label=${cat.id}`} className="text-sky-700 hover:underline text-sm" title={`Show students labelled ${cat.name}`}>
                  {(studentCounts.get(cat.id) ?? 0).toLocaleString()} student(s)
                </a>
              )}
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

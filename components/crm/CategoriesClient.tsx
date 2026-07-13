'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import HelpBox from './HelpBox';

export interface Category { id: string; name: string; color: string }

// A small palette that reads well on the dark theme.
export const CATEGORY_COLORS = [
  '#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa',
  '#fb7185', '#facc15', '#4ade80', '#22d3ee', '#c084fc',
];

export function CategoryChip({ cat, onClick, dim }: { cat: Category; onClick?: () => void; dim?: boolean }) {
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

export default function CategoriesClient() {
  const supabase = createClient();
  const [cats, setCats] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCats((data as Category[]) ?? []);
    const { data: links } = await supabase.from('donor_categories').select('category_id');
    const map = new Map<string, number>();
    for (const l of links ?? []) map.set(l.category_id, (map.get(l.category_id) ?? 0) + 1);
    setCounts(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

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
        Create your own donor labels — then assign them from the Donors grid (select donors → assign)
        or inside a donor&apos;s card. Filter the grid by category any time.
      </p>

      <HelpBox>
        <p><b>Create</b> a category below (name + color). <b>Assign it</b> two ways: open any donor&apos;s card and click the
        chip, or select many donors in the Donors grid and use the 🏷 control in the amber bar.</p>
        <p><b>Use it:</b> the Donors grid has an &quot;All categories&quot; filter — combine with other filters, then bulk-email or
        export exactly that group. Renaming or recoloring updates everywhere instantly; deleting removes the label
        from all donors (the donors themselves are untouched).</p>
      </HelpBox>

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
      {err && <p className="text-red-300 text-sm mb-3">{err}</p>}

      {/* List */}
      <div className="mt-4 rounded-xl border border-white/10 divide-y divide-white/5">
        {loading && <p className="px-4 py-6 text-slate-500 text-sm">Loading…</p>}
        {!loading && cats.length === 0 && (
          <p className="px-4 py-6 text-slate-500 text-sm">No categories yet — create your first one above.</p>
        )}
        {cats.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
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
        ))}
      </div>
    </div>
  );
}

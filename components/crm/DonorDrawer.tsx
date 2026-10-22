'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor } from '@/lib/crm/types';
import { type Category } from './CategoriesClient';
import { LabelEditor, createLabel } from './Labels';
import ContactButtons from './ContactButtons';

// The donor's whole story on one screen: contact, address, Nedarim standing
// orders, every gift, emails/WhatsApps already sent, notes, labels —
// with every field editable. Reads/writes only existing tables.

interface Issue { id: string; type: string; status: string; amount: number | null; detail: string | null; detected_at: string; }
interface Contribution { id: string; amount: number; paid_on: string | null; status: string; method: string | null; campaign: string | null; }
interface Note { id: string; body: string; author: string | null; created_at: string; }
interface Keva {
  keva_id: string; amount: number | null; currency: string; enabled: boolean;
  error_text: string | null; error_kind: string | null; bouncing_since: string | null;
  next_charge: string | null; charges_done: number | null; charges_remaining: number | null;
  last_num: string | null; tokef: string | null; groupe: string | null;
}
interface NPayment { id: string; amount: number | null; currency: string; paid_at: string | null; transaction_type: string | null; groupe: string | null; }
interface LogRow { id: string; created_at: string; channel: string; subject: string | null; body: string | null; status: string; to_address: string | null; error: string | null; }

type Form = {
  first_name: string; last_name: string; full_name: string; hebrew_name: string; latin_name: string;
  email: string; phone: string; whatsapp_phone: string;
  address_line: string; city: string; state: string; postal_code: string; country: string;
  segment: Donor['segment']; status: Donor['status']; preferred_language: Donor['preferred_language'];
  monthly_amount: string; currency: string; source: string; notes: string;
};

const toForm = (d: Donor): Form => ({
  first_name: d.first_name ?? '', last_name: d.last_name ?? '', full_name: d.full_name ?? '',
  hebrew_name: d.hebrew_name ?? '', latin_name: d.latin_name ?? '',
  email: d.email ?? '', phone: d.phone ?? '', whatsapp_phone: d.whatsapp_phone ?? '',
  address_line: d.address_line ?? '', city: d.city ?? '', state: d.state ?? '', postal_code: d.postal_code ?? '', country: d.country ?? '',
  segment: d.segment, status: d.status, preferred_language: d.preferred_language,
  monthly_amount: d.monthly_amount != null ? String(d.monthly_amount) : '', currency: d.currency ?? 'ILS',
  source: d.source ?? '', notes: d.notes ?? '',
});

export const SEGMENT_LABEL: Record<string, string> = {
  monthly_regular: 'Monthly regular', campaign_oneoff: 'Campaign, one-off', campaign_monthly: 'Campaign, monthly', other: 'Other',
};
export const STATUS_LABEL: Record<string, string> = { active: 'Active', lapsed: 'Lapsed', inactive: 'Inactive' };
const ISSUE_LABEL: Record<string, string> = {
  failed_payment: 'Card failed', lapsed: 'Lapsed / ended', unfulfilled_pledge: 'Pledge not paid', manual: 'Flagged by you',
};

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function kevaState(k: Keva): { label: string; cls: string } {
  if (!k.enabled) return { label: 'Stopped', cls: 'bg-slate-100 text-slate-700' };
  if (k.error_kind === 'card_failure') return { label: 'Card bouncing', cls: 'bg-[#fee2e2] text-[#991b1b]' };
  if (k.error_kind === 'completed') return { label: 'Finished', cls: 'bg-amber-100 text-amber-900' };
  return { label: 'Active', cls: 'bg-emerald-100 text-emerald-900' };
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-[#fff] border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, dir }: { label: string; value?: React.ReactNode; dir?: 'rtl' | 'ltr' }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-[15px] text-slate-900 break-words text-left" dir={dir}>{value || <span className="text-[#94a3b8]">—</span>}</dd>
    </div>
  );
}

const inputCls = 'w-full bg-[#fff] border border-slate-300 rounded-lg px-3 py-2 text-[15px] text-slate-900 focus:outline-none focus:border-slate-600';

function Input({ label, value, onChange, dir, type = 'text', wide }: {
  label: string; value: string; onChange: (v: string) => void; dir?: 'rtl' | 'ltr'; type?: string; wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <input type={type} value={value} dir={dir} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

export default function DonorDrawer({
  donor,
  onClose,
  onContact,
  onChanged,
}: {
  donor: Donor;
  onClose: () => void;
  onContact: (d: Donor) => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [cur, setCur] = useState<Donor>(donor);
  const sym = currencySymbol(cur.currency);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [kevas, setKevas] = useState<Keva[]>([]);
  const [npays, setNpays] = useState<NPayment[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(toForm(donor));
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const [allCats, setAllCats] = useState<Category[]>([]);
  const [myCats, setMyCats] = useState<Set<string>>(new Set());
  const [showAllGifts, setShowAllGifts] = useState(false);

  const name = cur.full_name || `${cur.first_name ?? ''} ${cur.last_name ?? ''}`.trim() || '—';
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    const [i, c, n, cat, mine, kv, np, ml] = await Promise.all([
      supabase.from('donor_issues').select('*').eq('donor_id', donor.id).order('created_at', { ascending: false }),
      supabase.from('donor_contributions').select('*').eq('donor_id', donor.id).order('paid_on', { ascending: false }).limit(100),
      supabase.from('donor_notes').select('*').eq('donor_id', donor.id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('donor_categories').select('category_id').eq('donor_id', donor.id),
      supabase.from('nedarim_keva').select('*').eq('donor_id', donor.id).order('amount', { ascending: false }),
      supabase.from('nedarim_payments').select('id, amount, currency, paid_at, transaction_type, groupe')
        .eq('donor_id', donor.id).order('paid_at', { ascending: false }).limit(100),
      supabase.from('message_log').select('id, created_at, channel, subject, body, status, to_address, error')
        .eq('donor_id', donor.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setIssues((i.data as any) ?? []);
    setContribs((c.data as any) ?? []);
    setNotes((n.data as any) ?? []);
    setAllCats((cat.data as Category[]) ?? []);
    setMyCats(new Set(((mine.data as any[]) ?? []).map((r) => r.category_id)));
    setKevas((kv.data as any) ?? []);
    setNpays((np.data as any) ?? []);
    setLog((ml.data as any) ?? []);
  };
  useEffect(() => { setCur(donor); setForm(toForm(donor)); load(); /* eslint-disable-next-line */ }, [donor.id]);

  // Every gift in one list, newest first: Nedarim charges + recorded contributions.
  const gifts = useMemo(() => {
    const a = npays.map((p) => ({
      key: 'n' + p.id, date: p.paid_at, amount: Number(p.amount ?? 0), sym: currencySymbol(p.currency),
      what: ['Nedarim', p.transaction_type, p.groupe].filter(Boolean).join(' · '), failed: false,
    }));
    const b = contribs.map((c) => ({
      key: 'c' + c.id, date: c.paid_on, amount: Number(c.amount ?? 0), sym,
      what: ['Recorded', c.method, c.campaign, c.status !== 'completed' ? c.status : null].filter(Boolean).join(' · '),
      failed: c.status === 'failed',
    }));
    return [...a, ...b].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  }, [npays, contribs, sym]);

  const lastGift = gifts.find((g) => !g.failed)?.date || cur.last_gift_at;
  const nedarimTotal = npays.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const toggleCategory = async (cat: Category) => {
    const { error } = myCats.has(cat.id)
      ? await supabase.from('donor_categories').delete().eq('donor_id', donor.id).eq('category_id', cat.id)
      : await supabase.from('donor_categories').insert({ donor_id: donor.id, category_id: cat.id });
    if (error) { setError(error.message); return; }
    setMyCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
      return next;
    });
    onChanged();
  };

  const createAndAddLabel = async (labelName: string) => {
    const { label, error } = await createLabel(supabase, labelName, allCats);
    if (error || !label) { setError(error || 'Could not create the label.'); return; }
    if (!allCats.some((c) => c.id === label.id)) setAllCats((cs) => [...cs, label].sort((a, b) => a.name.localeCompare(b.name)));
    if (!myCats.has(label.id)) await toggleCategory(label);
  };

  const saveEdit = async () => {
    setError('');
    const orig = toForm(cur);
    const patch: Record<string, unknown> = {};
    (Object.keys(form) as (keyof Form)[]).forEach((k) => {
      if (form[k] === orig[k]) return;
      if (k === 'monthly_amount') {
        const n = form.monthly_amount.trim() === '' ? null : Number(form.monthly_amount.replace(/[^0-9.]/g, ''));
        patch.monthly_amount = n != null && Number.isFinite(n) ? n : null;
      } else if (k === 'segment' || k === 'status' || k === 'preferred_language' || k === 'currency') {
        patch[k] = form[k];
      } else {
        patch[k] = (form[k] as string).trim() === '' ? null : (form[k] as string).trim();
      }
    });
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    const { data, error } = await supabase.from('donors').update(patch).eq('id', donor.id).select('*').single();
    if (error) { setError('Could not save: ' + error.message); return; }
    setCur(data as Donor);
    setForm(toForm(data as Donor));
    setEditing(false);
    setSavedMsg('Saved');
    setTimeout(() => setSavedMsg(''), 2000);
    onChanged();
  };

  const resubscribe = async () => {
    const { error } = await supabase.from('donors').update({ unsubscribed: false, unsubscribed_at: null }).eq('id', donor.id);
    if (error) { setError(error.message); return; }
    setCur((d) => ({ ...d, unsubscribed: false, unsubscribed_at: null }));
    onChanged();
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const { error } = await supabase.from('donor_notes').insert({ donor_id: donor.id, body: noteText.trim() });
    if (error) { setError(error.message); return; }
    setNoteText('');
    load();
  };

  const setIssueStatus = async (id: string, status: string) => {
    await supabase.from('donor_issues').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id);
    load();
    onChanged();
  };

  const addManualIssue = async () => {
    await supabase.from('donor_issues').insert({ donor_id: donor.id, type: 'manual', status: 'open', detail: 'Manually flagged' });
    load();
    onChanged();
  };

  const deleteDonor = async () => {
    if (!confirm(`Delete ${name}? This removes the donor and all their contributions, issues and notes. This cannot be undone.`)) return;
    const { error } = await supabase.from('donors').delete().eq('id', donor.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    onChanged();
    onClose();
  };

  const openIssues = issues.filter((i) => i.status === 'open');
  const address = [cur.address_line, cur.city, cur.state, cur.postal_code, cur.country].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.35)]" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-[#f6f7f9] border-l border-slate-200 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#fff] border-b border-slate-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">{name}</h2>
              {cur.hebrew_name && <p className="text-lg text-slate-700 font-hebrew text-left" dir="rtl">{cur.hebrew_name}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2 text-sm">
                <span className={`px-2 py-0.5 rounded-md font-medium ${cur.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>
                  {STATUS_LABEL[cur.status] ?? cur.status}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{SEGMENT_LABEL[cur.segment] ?? cur.segment}</span>
                {openIssues.map((i) => (
                  <span key={i.id} className={`px-2 py-0.5 rounded-md font-medium ${i.type === 'failed_payment' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-amber-100 text-amber-900'}`}>
                    {ISSUE_LABEL[i.type] ?? i.type}
                  </span>
                ))}
                {cur.unsubscribed && <span className="px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#991b1b]">Unsubscribed from email</span>}
              </div>
              {/* Labels: chips with ×, "+ Add label" to pick or create one */}
              <div className="mt-2">
                <LabelEditor labels={allCats} assigned={myCats} onToggle={toggleCategory} onCreate={createAndAddLabel} />
              </div>
            </div>
            <button onClick={onClose} className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-100 text-sm font-medium">Close</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <ContactButtons phone={cur.phone} whatsapp={cur.whatsapp_phone} email={cur.email} size="md" />
            <button onClick={() => onContact(cur)}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-[#fff] hover:bg-slate-700 text-[15px] font-medium">
              Send a message from a template…
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="text-[15px] text-[#991b1b] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3">{error}</div>}

          {/* Money at a glance */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Monthly', cur.monthly_amount ? fmtMoney(cur.monthly_amount, sym) : '—'],
              ['Last gift', fmtDate(lastGift)],
              ['Given (Nedarim)', npays.length ? fmtMoney(nedarimTotal, currencySymbol(npays[0]?.currency)) : '—'],
              ['Total paid (records)', fmtMoney(cur.total_paid, sym)],
            ].map(([l, v]) => (
              <div key={l} className="bg-[#fff] border border-slate-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</p>
                <p className="text-lg font-bold text-slate-900">{v}</p>
              </div>
            ))}
          </div>
          {cur.balance > 0 && (
            <p className="text-[15px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Still owes {fmtMoney(cur.balance, sym)} of a {fmtMoney(cur.total_pledged, sym)} pledge.
            </p>
          )}

          {/* Contact & details */}
          <Section
            title="Contact & details"
            action={
              editing ? (
                <div className="flex gap-2">
                  <button onClick={() => { setForm(toForm(cur)); setEditing(false); }} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800">Cancel</button>
                  <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-slate-900 text-[#fff] text-sm font-semibold">Save changes</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {savedMsg && <span className="text-sm text-emerald-700 font-medium">{savedMsg}</span>}
                  <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800 hover:bg-slate-50 font-medium">Edit</button>
                </div>
              )
            }
          >
            {!editing ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Phone" value={cur.phone} dir="ltr" />
                <Field label="WhatsApp" value={cur.whatsapp_phone || (cur.phone ? 'same as phone' : '')} dir="ltr" />
                <Field label="Email" value={cur.email} />
                <Field label="Emails in" value={cur.preferred_language === 'he' ? 'Hebrew' : 'English'} />
                <div className="col-span-2"><Field label="Address" value={address} /></div>
                <Field label="First name" value={cur.first_name} />
                <Field label="Last name" value={cur.last_name} />
                <Field label="Hebrew name" value={cur.hebrew_name} dir="rtl" />
                <Field label="Latin name" value={cur.latin_name} />
                <Field label="Source / campaign" value={cur.source} />
                <Field label="Donor ID (sheet)" value={cur.external_id} />
                {cur.notes && <div className="col-span-2"><Field label="Notes field" value={<span className="whitespace-pre-wrap">{cur.notes}</span>} /></div>}
              </dl>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" value={form.first_name} onChange={set('first_name')} />
                <Input label="Last name" value={form.last_name} onChange={set('last_name')} />
                <Input label="Full name (as shown)" value={form.full_name} onChange={set('full_name')} wide />
                <Input label="Hebrew name" value={form.hebrew_name} onChange={set('hebrew_name')} dir="rtl" />
                <Input label="Latin name" value={form.latin_name} onChange={set('latin_name')} />
                <Input label="Phone" value={form.phone} onChange={set('phone')} dir="ltr" type="tel" />
                <Input label="WhatsApp (if different)" value={form.whatsapp_phone} onChange={set('whatsapp_phone')} dir="ltr" type="tel" />
                <Input label="Email" value={form.email} onChange={set('email')} type="email" wide />
                <Input label="Street address" value={form.address_line} onChange={set('address_line')} wide />
                <Input label="City" value={form.city} onChange={set('city')} />
                <Input label="State / region" value={form.state} onChange={set('state')} />
                <Input label="Postal code" value={form.postal_code} onChange={set('postal_code')} />
                <Input label="Country" value={form.country} onChange={set('country')} />
                <Input label="Monthly amount" value={form.monthly_amount} onChange={set('monthly_amount')} type="text" />
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Currency</span>
                  <select value={form.currency} onChange={(e) => set('currency')(e.target.value)} className={inputCls}>
                    {Array.from(new Set(['ILS', 'USD', 'GBP', 'EUR', form.currency])).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Type of donor</span>
                  <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as Donor['segment'] })} className={inputCls}>
                    {Object.entries(SEGMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Status</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Donor['status'] })} className={inputCls}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Emails in</span>
                  <select value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value as Donor['preferred_language'] })} className={inputCls}>
                    <option value="en">English</option>
                    <option value="he">Hebrew</option>
                  </select>
                </label>
                <Input label="Source / campaign" value={form.source} onChange={set('source')} />
                <label className="block col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes field</span>
                  <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={3} className={inputCls} />
                </label>
                <p className="col-span-2 text-sm text-slate-500">Totals (paid, pledged, balance) are calculated from imports and payments, so they aren&apos;t edited here.</p>
              </div>
            )}
          </Section>

          {/* Nedarim */}
          <Section title="Nedarim standing orders" action={<a href="/crm/nedarim" className="text-sm text-sky-700 hover:underline">Nedarim page</a>}>
            {kevas.length === 0 ? (
              <p className="text-[15px] text-slate-600">No Nedarim standing order linked to this donor.</p>
            ) : (
              <ul className="space-y-2">
                {kevas.map((k) => {
                  const st = kevaState(k);
                  return (
                    <li key={k.keva_id} className="border border-slate-200 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[16px] font-semibold text-slate-900">
                          {fmtMoney(Number(k.amount ?? 0), currencySymbol(k.currency))} / month
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-sm font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {[
                          k.charges_done != null ? `${k.charges_done} charges done` : null,
                          k.charges_remaining != null ? `${k.charges_remaining} left` : 'no end date',
                          k.next_charge ? `next ${fmtDate(k.next_charge)}` : null,
                          k.last_num ? `card ••${k.last_num}${k.tokef ? ` exp ${k.tokef.slice(0, 2)}/${k.tokef.slice(2)}` : ''}` : null,
                          k.groupe,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {k.error_kind === 'card_failure' && (
                        <p className="text-sm text-[#991b1b] mt-1">
                          Bouncing{k.bouncing_since ? ` since ${fmtDate(k.bouncing_since)}` : ''}{k.error_text ? `: ${k.error_text}` : ''}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Gifts */}
          <Section title={`Gifts${gifts.length ? ` (${gifts.length})` : ''}`}>
            {gifts.length === 0 ? <p className="text-[15px] text-slate-600">No gifts recorded yet.</p> : (
              <>
                <ul className="divide-y divide-slate-100">
                  {(showAllGifts ? gifts : gifts.slice(0, 8)).map((g) => (
                    <li key={g.key} className="flex items-center justify-between py-2 gap-3">
                      <span className="text-[15px] text-slate-700">{fmtDate(g.date)} <span className="text-slate-500 text-sm">· {g.what}</span></span>
                      <span className={`text-[15px] font-semibold ${g.failed ? 'text-[#b91c1c]' : 'text-slate-900'}`}>{fmtMoney(g.amount, g.sym)}</span>
                    </li>
                  ))}
                </ul>
                {gifts.length > 8 && (
                  <button onClick={() => setShowAllGifts((v) => !v)} className="mt-2 text-sm text-sky-700 hover:underline">
                    {showAllGifts ? 'Show fewer' : `Show all ${gifts.length}`}
                  </button>
                )}
              </>
            )}
          </Section>

          {/* Messages already sent */}
          <Section title={`Messages sent${log.length ? ` (${log.length})` : ''}`}>
            {log.length === 0 ? <p className="text-[15px] text-slate-600">No emails or WhatsApps sent from the CRM yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {log.map((m) => (
                  <li key={m.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] text-slate-900 font-medium truncate">
                        {m.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}: {m.subject || (m.body ? m.body.slice(0, 60) : '(no subject)')}
                      </span>
                      <span className={`shrink-0 text-sm ${m.status === 'failed' || m.status === 'bounced' ? 'text-[#b91c1c]' : 'text-slate-500'}`}>{m.status}</span>
                    </div>
                    <p className="text-sm text-slate-500">{fmtDate(m.created_at)}{m.to_address ? ` · to ${m.to_address}` : ''}{m.error ? ` · ${m.error}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <div className="flex gap-2 mb-3">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note (e.g. called, will pay next week)…" className={inputCls} />
              <button onClick={addNote} className="px-4 py-2 rounded-lg bg-slate-900 text-[#fff] text-[15px] font-medium">Add</button>
            </div>
            {notes.length === 0 ? <p className="text-[15px] text-slate-600">No notes yet.</p> : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <p className="text-[15px] text-slate-900 whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(n.created_at).toLocaleString('en-GB')}{n.author ? ` · ${n.author}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Issues */}
          <Section title="Issues" action={<button onClick={addManualIssue} className="text-sm text-sky-700 hover:underline">Flag for follow-up</button>}>
            {issues.length === 0 ? <p className="text-[15px] text-slate-600">No issues.</p> : (
              <ul className="space-y-2">
                {issues.map((i) => (
                  <li key={i.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                    <div>
                      <span className={`text-[15px] font-medium ${i.status === 'open' ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                        {ISSUE_LABEL[i.type] ?? i.type}
                      </span>
                      {i.amount ? <span className="text-slate-600 ml-2">{fmtMoney(i.amount, sym)}</span> : null}
                      <span className="text-sm text-slate-500 ml-2">{fmtDate(i.detected_at)} · {i.status}</span>
                      {i.detail && <p className="text-sm text-slate-600">{i.detail}</p>}
                    </div>
                    {i.status === 'open'
                      ? <button onClick={() => setIssueStatus(i.id, 'resolved')} className="text-sm px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-50">Mark resolved</button>
                      : <button onClick={() => setIssueStatus(i.id, 'open')} className="text-sm text-slate-600 hover:underline">Reopen</button>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="text-sm text-slate-500">
            Labels (Fees, Donation, Campaign…) sit under the name at the top: “+ Add label” picks one or creates a new one, × removes it.{' '}
            <a href="/crm/categories" className="text-sky-700 hover:underline">Manage labels</a>
          </p>

          {cur.unsubscribed && (
            <div className="flex items-center justify-between bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 text-[15px]">
              <span className="text-[#991b1b]">Unsubscribed from emails{cur.unsubscribed_at ? ` on ${fmtDate(cur.unsubscribed_at)}` : ''}</span>
              <button onClick={resubscribe} className="text-sm text-sky-700 hover:underline">Re-subscribe</button>
            </div>
          )}

          <div className="pt-2">
            <button onClick={deleteDonor} className="text-[#b91c1c] hover:underline text-sm">Delete this donor…</button>
          </div>
        </div>
      </div>
    </div>
  );
}

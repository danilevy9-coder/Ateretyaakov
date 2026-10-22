'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fmtMoney, currencySymbol } from '@/lib/crm/util';
import type { Donor, Student } from '@/lib/crm/types';
import ContactButtons from './ContactButtons';
import DonorDrawer from './DonorDrawer';
import StudentDrawer from './StudentDrawer';
import ContactModal from './ContactModal';

// "Today" — the work list: who to call, the latest gifts, and tuition owed.
// Everything comes from existing tables (nedarim_keva, nedarim_payments,
// donors, students, student_payments); nothing here writes to the database.

interface Keva {
  keva_id: string; donor_id: string | null; client_name: string | null; phone: string | null; email: string | null;
  amount: number | null; currency: string; enabled: boolean; error_text: string | null; error_kind: string | null;
  bouncing_since: string | null; next_charge: string | null; charges_remaining: number | null;
}
interface Pay {
  id: string; donor_id: string | null; client_name: string | null; phone: string | null; email: string | null;
  amount: number | null; currency: string; paid_at: string | null; transaction_type: string | null;
}
interface CallRow { key: string; donor: Donor | null; name: string; phone: string | null; email: string | null; amount: number; currency: string; note: string; tone: 'red' | 'amber'; }
interface OwedRow { student: Student; owed: number; months: number; }

const fmtDate = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const dName = (d: Donor | null, fallback: string | null) =>
  (d && (d.full_name || `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim())) || fallback || 'Unknown donor';

async function donorsByIds(ids: string[]): Promise<Map<string, Donor>> {
  const supabase = createClient();
  const out = new Map<string, Donor>();
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 150) {
    const { data } = await supabase.from('donors').select('*').in('id', uniq.slice(i, i + 150));
    for (const d of (data ?? []) as Donor[]) out.set(d.id, d);
  }
  return out;
}

function Panel({ title, sub, link, children }: { title: string; sub?: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="bg-[#fff] border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {sub && <p className="text-[15px] text-slate-600">{sub}</p>}
        </div>
        {link && <Link href={link.href} className="text-[15px] text-sky-700 hover:underline whitespace-nowrap">{link.label}</Link>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-5 py-6 text-[15px] text-slate-600">{children}</p>;

export default function TodayClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bouncing, setBouncing] = useState<CallRow[]>([]);
  const [bouncingTotal, setBouncingTotal] = useState(0);
  const [renewals, setRenewals] = useState<CallRow[]>([]);
  const [gifts, setGifts] = useState<{ p: Pay; donor: Donor | null }[]>([]);
  const [owed, setOwed] = useState<OwedRow[]>([]);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [contact, setContact] = useState<Donor | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const supabase = createClient();
      const [kv, pays, sp] = await Promise.all([
        supabase.from('nedarim_keva')
          .select('keva_id, donor_id, client_name, phone, email, amount, currency, enabled, error_text, error_kind, bouncing_since, next_charge, charges_remaining')
          .eq('enabled', true).limit(3000),
        supabase.from('nedarim_payments')
          .select('id, donor_id, client_name, phone, email, amount, currency, paid_at, transaction_type')
          .order('paid_at', { ascending: false, nullsFirst: false }).limit(10),
        supabase.from('student_payments').select('student_id, amount_due, amount_paid, status')
          .in('status', ['unpaid', 'partial']).limit(5000),
      ]);
      if (kv.error) throw kv.error;
      const kevas = (kv.data ?? []) as Keva[];
      const payRows = (pays.data ?? []) as Pay[];

      // 1. Cards bouncing — one row per donor, biggest monthly amount first.
      const bounce = kevas.filter((k) => k.error_kind === 'card_failure');
      // 2. Renewals — finished their commitment, or 2 or fewer charges left.
      const renew = kevas.filter((k) => k.error_kind !== 'card_failure' &&
        (k.error_kind === 'completed' || (k.charges_remaining != null && k.charges_remaining <= 2)));

      const donors = await donorsByIds([...bounce, ...renew, ...payRows].map((x) => x.donor_id as string));

      const group = (list: Keva[], note: (k: Keva) => string, tone: 'red' | 'amber'): CallRow[] => {
        const by = new Map<string, Keva[]>();
        for (const k of list) {
          const key = k.donor_id ?? 'k' + k.keva_id;
          by.set(key, [...(by.get(key) ?? []), k]);
        }
        return Array.from(by.entries()).map(([key, ks]) => {
          const main = ks.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
          const d = main.donor_id ? donors.get(main.donor_id) ?? null : null;
          return {
            key, donor: d, name: dName(d, main.client_name),
            phone: d?.phone || main.phone, email: d?.email || main.email,
            amount: ks.reduce((s, k) => s + Number(k.amount ?? 0), 0), currency: main.currency,
            note: note(main), tone,
          };
        }).sort((a, b) => b.amount - a.amount);
      };

      const b = group(bounce, (k) => `Card failing${k.bouncing_since ? ` since ${fmtDate(k.bouncing_since)}` : ''}${k.error_text ? ` · ${k.error_text}` : ''}`, 'red');
      setBouncing(b.slice(0, 12));
      setBouncingTotal(b.length);
      setRenewals(group(renew, (k) => k.error_kind === 'completed'
        ? 'Standing order finished: ask to renew'
        : `${k.charges_remaining} charge${k.charges_remaining === 1 ? '' : 's'} left${k.next_charge ? ` · next ${fmtDate(k.next_charge)}` : ''}`, 'amber').slice(0, 12));
      setGifts(payRows.map((p) => ({ p, donor: p.donor_id ? donors.get(p.donor_id) ?? null : null })));

      // 4. Tuition owed per student.
      const owedBy = new Map<string, { owed: number; months: number }>();
      for (const r of (sp.data ?? []) as { student_id: string; amount_due: number; amount_paid: number }[]) {
        const o = Math.max(0, Number(r.amount_due) - Number(r.amount_paid));
        if (o <= 0) continue;
        const cur = owedBy.get(r.student_id) ?? { owed: 0, months: 0 };
        owedBy.set(r.student_id, { owed: cur.owed + o, months: cur.months + 1 });
      }
      const top = Array.from(owedBy.entries()).sort((a, b2) => b2[1].owed - a[1].owed).slice(0, 10);
      if (top.length) {
        const { data: st } = await supabase.from('students').select('*').in('id', top.map(([id]) => id));
        const sMap = new Map(((st ?? []) as Student[]).map((s) => [s.id, s]));
        setOwed(top.filter(([id]) => sMap.has(id)).map(([id, v]) => ({ student: sMap.get(id)!, ...v })));
      } else setOwed([]);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const CallList = ({ rows }: { rows: CallRow[] }) => (
    <ul>
      {rows.map((r) => (
        <li key={r.key} className="px-5 py-3 border-t border-slate-100 first:border-t-0 flex items-center gap-3 flex-wrap">
          <button className="flex-1 min-w-[200px] text-left group" onClick={() => r.donor && setDonor(r.donor)} disabled={!r.donor}>
            <span className="block text-[16px] font-semibold text-slate-900 group-hover:underline">
              {r.name}
              {r.donor?.hebrew_name && <span className="font-normal text-slate-600 ml-3 font-hebrew" dir="rtl">{r.donor.hebrew_name}</span>}
            </span>
            <span className={`block text-sm ${r.tone === 'red' ? 'text-[#b91c1c]' : 'text-[#b45309]'}`}>{r.note}</span>
          </button>
          <span className="text-[16px] font-bold text-slate-900 whitespace-nowrap">{fmtMoney(r.amount, currencySymbol(r.currency))}<span className="text-sm font-normal text-slate-500">/mo</span></span>
          <ContactButtons phone={r.phone} whatsapp={r.donor?.whatsapp_phone} email={r.email} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      {error && <div className="text-[#991b1b] text-[15px] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3">Could not load today&apos;s list: {error}</div>}

      <div className="grid xl:grid-cols-2 gap-6">
        <Panel title="Call today: cards failing" sub={loading ? 'Loading…' : `${bouncingTotal} donor${bouncingTotal === 1 ? '' : 's'} whose Nedarim charge is bouncing, biggest first`}
          link={{ href: '/crm/nedarim', label: 'All on Nedarim page' }}>
          {!loading && bouncing.length === 0 ? <Empty>No failing cards right now.</Empty> : <CallList rows={bouncing} />}
        </Panel>

        <Panel title="Renewals due" sub={loading ? 'Loading…' : 'Standing orders that just finished or have 2 or fewer charges left'}
          link={{ href: '/crm/nedarim', label: 'Nedarim page' }}>
          {!loading && renewals.length === 0 ? <Empty>No renewals due.</Empty> : <CallList rows={renewals} />}
        </Panel>

        <Panel title="Latest gifts" sub="Last 10 charges from Nedarim" link={{ href: '/crm/donors', label: 'All donors' }}>
          {!loading && gifts.length === 0 ? <Empty>No gifts imported from Nedarim yet.</Empty> : (
            <ul>
              {gifts.map(({ p, donor: d }) => (
                <li key={p.id} className="px-5 py-3 border-t border-slate-100 first:border-t-0 flex items-center gap-3 flex-wrap">
                  <span className="w-20 text-[15px] text-slate-600 whitespace-nowrap">{fmtDate(p.paid_at)}</span>
                  <button className="flex-1 min-w-[180px] text-left group" onClick={() => d && setDonor(d)} disabled={!d}>
                    <span className="block text-[16px] font-semibold text-slate-900 group-hover:underline">{dName(d, p.client_name)}</span>
                    {p.transaction_type && <span className="block text-sm text-slate-500">{p.transaction_type}</span>}
                  </button>
                  <span className="text-[16px] font-bold text-emerald-800 whitespace-nowrap">{fmtMoney(Number(p.amount ?? 0), currencySymbol(p.currency))}</span>
                  <ContactButtons phone={d?.phone || p.phone} whatsapp={d?.whatsapp_phone} email={d?.email || p.email} labels={false} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Tuition owed" sub="Students with unpaid or part-paid months, most owed first" link={{ href: '/crm/students', label: 'All students' }}>
          {!loading && owed.length === 0 ? <Empty>No tuition owed.</Empty> : (
            <ul>
              {owed.map(({ student: s, owed: o, months }) => (
                <li key={s.id} className="px-5 py-3 border-t border-slate-100 first:border-t-0 flex items-center gap-3 flex-wrap">
                  <button className="flex-1 min-w-[200px] text-left group" onClick={() => setStudent(s)}>
                    <span className="block text-[16px] font-semibold text-slate-900 group-hover:underline">
                      {s.full_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '—'}
                    </span>
                    <span className="block text-sm text-slate-600">{months} month{months === 1 ? '' : 's'} open{s.parent_name ? ` · parent ${s.parent_name}` : ''}</span>
                  </button>
                  <span className="text-[16px] font-bold text-[#b45309] whitespace-nowrap">{fmtMoney(o, currencySymbol(s.currency))}</span>
                  <ContactButtons phone={s.parent_phone} whatsapp={s.parent_whatsapp} email={s.parent_email} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {donor && <DonorDrawer donor={donor} onClose={() => setDonor(null)} onContact={(d) => setContact(d)} onChanged={() => {}} />}
      {student && <StudentDrawer student={student} onClose={() => setStudent(null)} onChanged={load} />}
      {contact && <ContactModal donor={contact} onClose={() => setContact(null)} />}
    </div>
  );
}

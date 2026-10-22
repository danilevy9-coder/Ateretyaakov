'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Plain-word navigation (no emoji-only icons), with a one-line hint under
// each item so it's obvious what lives where.
const links = [
  { href: '/crm', label: 'Today', hint: 'Who to call, latest gifts' },
  { href: '/crm/donors', label: 'Donors', hint: 'Everyone who gives' },
  { href: '/crm/students', label: 'Students', hint: 'Yeshiva & tuition' },
  { href: '/crm/issues', label: 'Needs attention', hint: 'Open issues' },
  { href: '/crm/nedarim', label: 'Nedarim payments', hint: 'Standing orders, bounces' },
  { href: '/crm/categories', label: 'Categories', hint: 'Groups & lists' },
  { href: '/crm/templates', label: 'Message templates', hint: 'Email / WhatsApp texts' },
  { href: '/crm/import', label: 'Import', hint: 'Upload a spreadsheet' },
  { href: '/crm/help', label: 'Help', hint: 'How this works' },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openIssues, setOpenIssues] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('donor_issues').select('*', { count: 'exact', head: true }).eq('status', 'open')
      .then(({ count }) => setOpenIssues(count ?? 0));
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/crm/login');
    router.refresh();
  };

  const isActive = (href: string) =>
    href === '/crm' ? pathname === '/crm' : pathname.startsWith(href);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-slate-200 bg-[#fdfdfd] sticky top-0 z-30">
        <span className="font-bold text-slate-900">Ateret Yaakov · CRM</span>
        <button onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-sm font-medium">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <aside
        className={`${
          open ? 'block' : 'hidden'
        } md:block md:sticky md:top-0 md:h-screen w-full md:w-64 shrink-0 border-r border-slate-200 bg-[#fdfdfd] p-4 flex flex-col overflow-y-auto`}
      >
        <div className="hidden md:block px-3 mb-6">
          <p className="font-bold text-lg text-slate-900 leading-tight">Ateret Yaakov</p>
          <p className="text-slate-500 text-sm">Donors &amp; students</p>
        </div>

        <nav className="space-y-0.5 flex-1">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  active ? 'bg-slate-900 text-[#fff]' : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight">{l.label}</span>
                  <span className={`block text-xs leading-tight mt-0.5 ${active ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>{l.hint}</span>
                </span>
                {l.href === '/crm/issues' && openIssues != null && openIssues > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">{openIssues}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-3 mt-3">
          <p className="text-slate-500 text-sm px-3 mb-2 truncate" title={email}>
            Signed in as {email}
          </p>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-[15px] text-slate-800 hover:bg-slate-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

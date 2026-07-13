'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const links = [
  { href: '/crm', label: 'Dashboard', icon: '📊' },
  { href: '/crm/donors', label: 'Donors', icon: '🤝' },
  { href: '/crm/issues', label: 'Issues', icon: '⚠️' },
  { href: '/crm/nedarim', label: 'Nedarim Plus', icon: '💳' },
  { href: '/crm/categories', label: 'Categories', icon: '🏷️' },
  { href: '/crm/import', label: 'Import', icon: '📥' },
  { href: '/crm/templates', label: 'Templates', icon: '✉️' },
  { href: '/crm/students', label: 'Yeshiva', icon: '🎓' },
  { href: '/crm/help', label: 'Help', icon: '❓' },
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
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 bg-[#0b0c10] sticky top-0 z-30">
        <span className="font-bold text-amber-400">Ateret CRM</span>
        <button onClick={() => setOpen((v) => !v)} className="text-2xl">☰</button>
      </div>

      <aside
        className={`${
          open ? 'block' : 'hidden'
        } md:block md:sticky md:top-0 md:h-screen w-full md:w-60 shrink-0 border-r border-white/10 bg-[#0d0e13] p-4 flex flex-col`}
      >
        <div className="hidden md:flex items-center gap-2 px-2 mb-6">
          <span className="text-2xl">🕎</span>
          <div>
            <p className="font-bold text-white leading-none">Ateret Yaakov</p>
            <p className="text-amber-400/70 text-xs mt-0.5">CRM</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(l.href)
                  ? 'bg-amber-500/15 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{l.icon}</span>
              <span className="flex-1">{l.label}</span>
              {l.href === '/crm/issues' && openIssues != null && openIssues > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-xs font-bold">{openIssues}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-3 mt-3">
          <p className="text-slate-500 text-xs px-3 mb-2 truncate" title={email}>
            {email}
          </p>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            ↪ Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import LenisProvider from '@/components/LenisProvider';
import CustomCursor from '@/components/CustomCursor';
import SiteFooter from '@/components/SiteFooter';
import { LangProvider } from '@/lib/yd/lang';
import YdShell from '@/components/yd/core';

/**
 * Public pages get the new look (shared header, menu, footer, EN | עב toggle).
 * /admin keeps its original chrome. /crm is outside this layout entirely.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '/';
  if (path.startsWith('/admin')) {
    return (
      <div className="grain-overlay">
        <LenisProvider>
          <CustomCursor />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <SiteFooter />
        </LenisProvider>
      </div>
    );
  }
  return (
    <LenisProvider>
      <LangProvider>
        <YdShell>{children}</YdShell>
      </LangProvider>
    </LenisProvider>
  );
}

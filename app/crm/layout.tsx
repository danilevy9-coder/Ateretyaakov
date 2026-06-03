import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM | Ateret Yaakov',
  robots: { index: false, follow: false },
};

// Minimal wrapper — the authenticated shell (sidebar) lives in (dash)/layout.
export default function CrmRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#0b0c10] text-slate-100">{children}</div>;
}

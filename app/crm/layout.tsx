import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM | Ateret Yaakov',
  robots: { index: false, follow: false },
};

// Minimal wrapper — the authenticated shell (sidebar) lives in (dash)/layout.
// `crm-light` switches the CRM to the light, readable theme (see globals.css).
export default function CrmRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="crm-light min-h-screen bg-[#f6f7f9] text-slate-900 text-base">
      {children}
      {/* drawers opened from the top search bar render here, above everything */}
      <div id="crm-portal" />
    </div>
  );
}

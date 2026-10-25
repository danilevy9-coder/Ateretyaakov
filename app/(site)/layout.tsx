import SiteShell from '@/components/yd/SiteShell';

/**
 * Layout for the public marketing site (home, gallery, staff, support, admin).
 * The CRM lives under /crm with its own layout and does NOT get this chrome.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

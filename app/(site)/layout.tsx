import Navbar from '@/components/Navbar';
import LenisProvider from '@/components/LenisProvider';
import CustomCursor from '@/components/CustomCursor';
import SiteFooter from '@/components/SiteFooter';

/**
 * Layout for the public marketing site (home, gallery, staff, support, admin).
 * The CRM lives under /crm with its own layout and does NOT get this chrome
 * (no smooth-scroll, custom cursor or marketing navbar).
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

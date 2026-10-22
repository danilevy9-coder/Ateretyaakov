import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/crm/Sidebar';
import GlobalSearch from '@/components/crm/GlobalSearch';

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this, but double-check on the server.
  if (!user) redirect('/crm/login');

  return (
    <div className="md:flex">
      <Sidebar email={user.email ?? ''} />
      <div className="flex-1 min-w-0">
        <div className="sticky top-14 md:top-0 z-20 bg-[#f6f7f9] border-b border-slate-200 px-4 md:px-8 py-3">
          <GlobalSearch />
        </div>
        {children}
      </div>
    </div>
  );
}

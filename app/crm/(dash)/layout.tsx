import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/crm/Sidebar';

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
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

import { Suspense } from 'react';
import LoginForm from '@/components/crm/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

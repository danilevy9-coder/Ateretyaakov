import { Suspense } from 'react';
import ResetPasswordForm from '@/components/crm/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

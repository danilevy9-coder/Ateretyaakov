'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  // The email link signs the visitor in with a one-time recovery session.
  // That exchange happens async right after the page loads, so we wait for it.
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw1.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setError('The two passwords don’t match.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) {
        setError(error.message);
        return;
      }
      router.replace('/crm');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-white/[0.03] border border-white/10 rounded-2xl p-8"
    >
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🔑</div>
        <h1 className="text-xl font-bold text-white">Choose a new password</h1>
        <p className="text-slate-400 text-sm mt-1">Ateret Yaakov CRM</p>
      </div>

      {checking && <p className="text-slate-400 text-sm text-center">Checking your reset link…</p>}

      {!checking && !ready && (
        <p className="text-amber-300 text-sm text-center">
          This reset link is invalid or has expired.{' '}
          <a href="/crm/login" className="underline">Back to sign in</a> and tap
          “Forgot password?” to get a fresh one.
        </p>
      )}

      {!checking && ready && (
        <>
          <label className="block text-xs text-slate-400 mb-1">New password</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            autoFocus
            required
            minLength={8}
            className="w-full mb-4 px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm"
            placeholder="At least 8 characters"
          />

          <label className="block text-xs text-slate-400 mb-1">New password, again</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            minLength={8}
            className="w-full mb-5 px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm"
            placeholder="••••••••"
          />

          {error && (
            <p className="text-red-400 text-xs mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save new password →'}
          </button>
        </>
      )}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/crm';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-white/[0.03] border border-white/10 rounded-2xl p-8"
    >
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🕎</div>
        <h1 className="text-xl font-bold text-white">Ateret Yaakov CRM</h1>
        <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
      </div>

      <label className="block text-xs text-slate-400 mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
        required
        className="w-full mb-4 px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm"
        placeholder="you@example.org"
      />

      <label className="block text-xs text-slate-400 mb-1">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
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
        disabled={loading}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold rounded-lg transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign in →'}
      </button>
    </form>
  );
}

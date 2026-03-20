import React, { useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck, Sprout } from 'lucide-react';
import { saveUser, StoredUser } from '../services/authLocal';

export const AuthView = ({ onLogin }: { onLogin: (user: StoredUser) => void }) => {
  const [email, setEmail] = useState('admin@school.com');
  const [password, setPassword] = useState('NdoveraAdmin!2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to sign in.');
      const user = payload?.user as StoredUser;
      saveUser(user);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151619] p-8 shadow-2xl shadow-black/40">
        <div className="text-center space-y-4">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-900/20">
            <Sprout className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Sign in to Ndovera</h2>
            <p className="mt-2 text-sm text-zinc-400">Secure tenant access with your Ndovera identity.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              <Mail size={14} /> Ndovera email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-500"
              placeholder="owner@ndovera.app"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              <LockKeyhole size={14} /> Password
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-500"
              placeholder="Your secure password"
            />
          </label>

          {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-bold uppercase tracking-[0.18em] text-emerald-400">
            <ShieldCheck size={14} /> Default workspace access
          </div>
          <p className="mt-2">Use the seeded admin identity while onboarding the production flow.</p>
        </div>
      </div>
    </div>
  );
};
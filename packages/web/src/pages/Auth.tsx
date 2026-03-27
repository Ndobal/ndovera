import React, { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck, Sprout } from 'lucide-react';
import { fetchWithAuth } from '../services/apiClient';
import { saveUser, StoredUser } from '../services/authLocal';
import { fetchPublicBrandingContext } from '../services/publicSiteBranding';

export const AuthView = ({ onLogin, onBack, onRegisterSchool }: { onLogin: (user: StoredUser) => void; onBack: () => void; onRegisterSchool: () => void }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState({
    schoolName: 'Ndovera',
    logoUrl: '/ndovera.png' as string | null,
    primaryColor: '#4F46E5',
    templateVariant: 'bright-future' as 'signature' | 'bright-future',
    isTenant: false,
  });

  useEffect(() => {
    let active = true;
    void fetchPublicBrandingContext().then((context) => {
      if (!active) return;
      setBranding({
        schoolName: context.schoolName,
        logoUrl: context.logoUrl,
        primaryColor: context.primaryColor,
        templateVariant: context.templateVariant,
        isTenant: context.isTenant,
      });
    });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      }) as { user?: StoredUser; error?: string };
      const user = payload?.user as StoredUser;
      if (!user) throw new Error(payload?.error || 'Unable to sign in.');
      saveUser(user);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const isBrightFuture = branding.templateVariant === 'bright-future';

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isBrightFuture ? 'bg-slate-50' : 'bg-[#0A0B0D]'}`}>
      <div className={`w-full max-w-md rounded-3xl p-8 shadow-2xl ${isBrightFuture ? 'border border-slate-200 bg-white shadow-slate-200/70' : 'border border-white/10 bg-[#151619] shadow-black/40'}`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${isBrightFuture ? 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'}`}>
            <ArrowLeft size={14} /> Back
          </button>
          {!branding.isTenant ? (
            <button type="button" onClick={onRegisterSchool} className="rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition" style={{ background: branding.primaryColor }}>
              Register your school
            </button>
          ) : null}
        </div>
        <div className="text-center space-y-4">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-xl" style={{ background: branding.logoUrl ? '#ffffff' : branding.primaryColor }}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.schoolName} className="h-full w-full object-contain" />
            ) : (
              <Sprout className="text-white" size={32} />
            )}
          </div>
          <div>
            <h2 className={`text-3xl font-bold tracking-tight ${isBrightFuture ? 'text-slate-900' : 'text-white'}`}>Sign in to {branding.schoolName}</h2>
            <p className={`mt-2 text-sm ${isBrightFuture ? 'text-slate-500' : 'text-zinc-400'}`}>{branding.isTenant ? 'Use your school-issued credentials for this tenant workspace.' : 'Secure platform access with your Ndovera identity.'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${isBrightFuture ? 'text-slate-500' : 'text-zinc-500'}`}>
              <Mail size={14} /> Ndovera ID or email
            </span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              type="text"
              className={`w-full rounded-2xl px-4 py-3 outline-none transition ${isBrightFuture ? 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-400' : 'border border-white/10 bg-white/5 text-white focus:border-emerald-500'}`}
              placeholder="Student ID, staff ID, parent ID, or email"
            />
          </label>

          <label className="block">
            <span className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${isBrightFuture ? 'text-slate-500' : 'text-zinc-500'}`}>
              <LockKeyhole size={14} /> Password
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className={`w-full rounded-2xl px-4 py-3 outline-none transition ${isBrightFuture ? 'border border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-400' : 'border border-white/10 bg-white/5 text-white focus:border-emerald-500'}`}
              placeholder="Administrator password"
            />
          </label>

          {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <button type="submit" disabled={loading} className="w-full rounded-2xl px-4 py-3 font-bold text-white transition disabled:opacity-60" style={{ background: branding.primaryColor }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={`mt-6 rounded-2xl p-4 text-xs ${isBrightFuture ? 'border border-slate-200 bg-slate-50 text-slate-600' : 'border border-white/10 bg-black/20 text-zinc-400'}`}>
          <div className="flex items-center gap-2 font-bold uppercase tracking-[0.18em]" style={{ color: branding.primaryColor }}>
            <ShieldCheck size={14} /> Default workspace access
          </div>
          <p className="mt-2">{branding.isTenant ? `Use your ${branding.schoolName} ID or email with your password.` : 'Use your school-issued ID or email with your password.'}</p>
        </div>
      </div>
    </div>
  );
};
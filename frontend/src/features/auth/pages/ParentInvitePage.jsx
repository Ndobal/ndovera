import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { acceptParentInvite, getParentInvite } from '../../school/services/schoolApi';

// A parent's invitation: their children and student codes, and the form that sets up their account.

const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const LABEL = 'block text-sm font-bold text-[#191970] dark:text-slate-100';
const FIELDS = [['name', 'Full name', 'text', 'name'], ['email', 'Email address', 'email', 'email'], ['phone', 'Phone number', 'tel', 'tel'], ['dateOfBirth', 'Date of birth', 'date', 'bday'], ['occupation', 'Occupation', 'text', 'organization-title'], ['password', 'Choose a password (at least 8 characters)', 'password', 'new-password']];

export default function ParentInvitePage() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [failed, setFailed] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', dateOfBirth: '', occupation: '', password: '' });
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    getParentInvite(token).then(setInvite).catch(err => setFailed(err.message));
  }, [token]);

  const send = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      setDone(await acceptParentInvite(token, form));
    } catch (err) {
      setExisting(Boolean(err.data?.existing));
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f3f6ff] p-4 text-[#191970] dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-lg space-y-4 py-6">
        {failed ? <p role="alert" className="rounded-3xl bg-white p-6 text-base font-bold text-rose-900 shadow dark:bg-slate-900 dark:text-rose-200">{failed}</p> : null}
        {!failed && !invite ? <p role="status" className="rounded-3xl bg-white p-6 shadow dark:bg-slate-900">Loading your invitation…</p> : null}
        {invite && !done ? (
          <>
            <section className="rounded-3xl bg-white p-6 shadow dark:bg-slate-900">
              <div className="flex items-center gap-3">
                {invite.logoUrl ? <img src={invite.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain" /> : null}
                <h1 className="text-xl font-black text-[#800000] dark:text-amber-200">{invite.schoolName}</h1>
              </div>
              <p className="mt-3 text-sm">You are invited to follow your {invite.children.length === 1 ? "child's" : "children's"} school life on Ndovera.</p>
              <ul className="mt-3 space-y-2">
                {invite.children.map(child => (
                  <li key={child.code || child.name} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm dark:bg-white/10">
                    <span className="font-black">{child.name}</span>{child.className ? ` · ${child.className}` : ''}
                    {child.code ? <span className="block text-xs font-semibold">Student code: {child.code}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
            <form onSubmit={send} className="space-y-3 rounded-3xl bg-white p-6 shadow dark:bg-slate-900" aria-label="Your details">
              {FIELDS.map(([key, label, type, autoComplete]) => (
                <label key={key} className={LABEL}>{key === 'password' && existing ? 'Your current Ndovera password' : label}
                  <input className={FIELD} type={type} autoComplete={autoComplete} required value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              {error ? <p role="alert" className="text-sm font-bold text-rose-800 dark:text-rose-300">{error}</p> : null}
              <button type="submit" disabled={busy} className="w-full rounded-2xl bg-[#1a5c38] py-3 text-base font-black text-white disabled:opacity-60">{busy ? 'Saving…' : 'Submit'}</button>
            </form>
          </>
        ) : null}
        {done ? (
          <section role="status" className="space-y-3 rounded-3xl bg-white p-6 shadow dark:bg-slate-900">
            <h1 className="text-xl font-black text-[#1a5c38] dark:text-emerald-300">You are all set</h1>
            <p className="text-sm">Sign in with {done.email} or {done.phone}, and your password.</p>
            <Link to="/login" className="inline-block rounded-2xl bg-[#191970] px-6 py-3 font-black text-white dark:bg-white dark:text-[#191970]">Sign in</Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}

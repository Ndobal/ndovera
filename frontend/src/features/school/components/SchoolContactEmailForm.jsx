import React, { useEffect, useState } from 'react';
import { getMySchoolContactEmail, setMySchoolContactEmail } from '../../tenants/services/tenantApi';

/**
 * Where Ndovera writes to the school: invoices, receipts and notices. The sign-up email
 * is not changed and stays the owner's sign-in.
 */
export default function SchoolContactEmailForm() {
  const [value, setValue] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMySchoolContactEmail()
      .then(data => { setValue(data.contactEmail || ''); setSignUpEmail(data.signUpEmail || ''); })
      .catch(() => {});
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await setMySchoolContactEmail(value.trim());
      setMessage(`Saved. Ndovera will write to ${result.sendsTo}.`);
    } catch (err) {
      setError(err.message || 'Could not save the email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4] p-5 dark:border-white/5 dark:bg-slate-800/40">
      <h3 className="mb-1 text-base font-semibold text-[#800000] dark:text-slate-100">School communication email</h3>
      <p className="mb-3 text-sm text-[#191970] dark:text-slate-300">
        Ndovera sends invoices, receipts and notices about your school here. It does not change how anyone signs in
        {signUpEmail ? <> (the sign-up email <b>{signUpEmail}</b> stays the owner&apos;s sign-in)</> : null}. Leave it empty to use the sign-up email.
      </p>
      <div className="flex flex-wrap gap-2">
        <input type="email" value={value} onChange={event => setValue(event.target.value)} placeholder="e.g. accounts@yourschool.com" aria-label="School communication email"
          className="min-w-[14rem] flex-1 rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white" />
        <button type="submit" disabled={busy} className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {message ? <p role="status" className="mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </form>
  );
}

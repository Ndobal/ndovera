import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { checkoutPayLink, confirmPayLink, getPayLink } from './practiceApi';
import { localMoney } from '../../shared/pricing/localPrice';

// The page behind "Ask someone to pay": anyone with the link can buy this pass for the child, with no account.

const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';

export default function PassPayPage() {
  const { token } = useParams();
  const [link, setLink] = useState(null);
  const [failed, setFailed] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tx = new URLSearchParams(window.location.search).get('practice_tx') || '';
    (tx ? confirmPayLink(token, tx).catch(() => null) : Promise.resolve(null))
      .then(() => getPayLink(token)).then(setLink).catch(err => setFailed(err.message));
  }, [token]);

  const pay = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const { checkoutUrl } = await checkoutPayLink(token, { email, name });
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f3f6ff] p-4 text-[#191970] dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-md space-y-4 rounded-3xl bg-white p-6 shadow dark:bg-slate-900">
        {failed ? <p role="alert" className="font-bold text-rose-900 dark:text-rose-200">{failed}</p> : null}
        {!failed && !link ? <p role="status">Loading…</p> : null}
        {link ? (
          <>
            <div className="flex items-center gap-3">
              {link.logoUrl ? <img src={link.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain" /> : null}
              <p className="text-sm font-bold">{link.schoolName}</p>
            </div>
            {link.paid ? (
              <div role="status">
                <h1 className="text-xl font-black text-[#1a5c38] dark:text-emerald-300">Thank you!</h1>
                <p className="mt-2 text-sm">{link.childName}'s {link.label} is paid for and ready to use.</p>
              </div>
            ) : link.expired ? (
              <p role="alert" className="font-bold text-rose-900 dark:text-rose-200">This payment link has expired. Ask {link.childName} for a new one.</p>
            ) : (
              <>
                <h1 className="text-xl font-black text-[#800000] dark:text-amber-200">Help {link.childName} with practice</h1>
                <p className="text-sm">{link.childName} is asking you to pay for a {link.label}.</p>
                <p className="text-2xl font-black">{localMoney(link.amountNaira, link.pricing)}</p>
                <form onSubmit={pay} className="space-y-3" aria-label="Pay for this pass">
                  <label className="block text-sm font-bold">Your name<input className={FIELD} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></label>
                  <label className="block text-sm font-bold">Your email, for the payment receipt<input type="email" required className={FIELD} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>
                  {error ? <p role="alert" className="text-sm font-bold text-rose-800 dark:text-rose-300">{error}</p> : null}
                  <button type="submit" disabled={busy} className="w-full rounded-2xl bg-[#1a5c38] py-3 font-black text-white disabled:opacity-60">{busy ? 'Opening payment…' : 'Pay now'}</button>
                </form>
                <p className="text-xs">You pay on Flutterwave's secure page. The pass goes straight to {link.childName}'s account.</p>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

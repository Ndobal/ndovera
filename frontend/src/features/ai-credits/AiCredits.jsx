import React, { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Ndovera AI credits for teachers: what a generation costs, what you hold, and
// credit bundles to buy (1 credit = ₦1 of Ndovera AI). Generation never takes
// money directly — only credits (aiPay.ts / aiTutor.ts in the Worker).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method, credentials: 'include', body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || 'Request failed.'), { status: response.status, data });
  return data;
}

export const getAiWallet = () => request('/api/ai-pay/wallet');
export const getCreditBundles = () => request('/api/ai/credit-bundles');
export const buyCreditBundle = (bundle, target = 'individual') => request('/api/ai/access/top-up/initiate', { method: 'POST', body: { bundle, target } });

const KIND_LABELS = { assignment: 'an assignment, quiz or test', exam: 'an examination paper', notes: 'student notes' };
const formatDate = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

/** Is this error "not enough credits"? */
export function needsCredits(error) {
  return error?.status === 402 || Boolean(error?.data?.needsCredits);
}

export function BundlePicker({ onClose, canFundSchool }) {
  const [bundles, setBundles] = useState([]);
  const [target, setTarget] = useState('individual');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [schoolAllowed, setSchoolAllowed] = useState(Boolean(canFundSchool));
  useEffect(() => { getCreditBundles().then(data => { setBundles(data.bundles || []); setSchoolAllowed(Boolean(data.canBuyForSchool)); }).catch(err => setError(err.message)); }, []);
  const buy = async bundle => {
    setBusy(bundle.key); setError('');
    try {
      const result = await buyCreditBundle(bundle.key, bundle.schoolOnly ? 'school' : target);
      if (result.paymentLink) window.location.assign(result.paymentLink);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Buy AI credits">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">⚡ Ndovera AI credit bundles</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">1 credit = ₦1 of Ndovera AI. Notes 50 · assignments 100 · exams 200 credits per subject; regenerating a whole set is half.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl px-3 py-1 text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>
        {schoolAllowed ? (
          <div className="mb-4 flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5" role="radiogroup" aria-label="Whose credits">
            {[['individual', 'For me'], ['school', 'For my staff (school wallet)']].map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={target === key} onClick={() => setTarget(key)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${target === key ? 'bg-white shadow dark:bg-slate-800' : ''}`}>{label}</button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {bundles.filter(bundle => !bundle.schoolOnly || schoolAllowed).map(bundle => (
            <div key={bundle.key} className={`relative rounded-3xl border-2 p-5 ${bundle.popular ? 'border-fuchsia-500 shadow-lg' : 'border-slate-200 dark:border-white/10'}`}>
              {bundle.popular ? <span className="absolute -top-3 right-4 rounded-full bg-fuchsia-600 px-3 py-0.5 text-xs font-black text-white">Most popular</span> : null}
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">{bundle.label}</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{(bundle.credits + bundle.bonus).toLocaleString()} <span className="text-base font-bold">credits</span></p>
              {bundle.bonus ? <p className="text-sm font-bold text-emerald-600">includes {bundle.bonus.toLocaleString()} bonus</p> : null}
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{bundle.blurb}</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => buy(bundle)} className="mt-3 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-2.5 font-black text-white disabled:opacity-60">
                {busy === bundle.key ? 'Opening checkout…' : `Buy for ₦${bundle.priceNaira.toLocaleString()}`}
              </button>
            </div>
          ))}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

/**
 * The cost of a generation and the credits held. `shortfall` (the data of a 402
 * error) turns it into the "not enough credits" prompt.
 */
export default function AiCreditsBar({ kind = 'assignment', regenerate = false, shortfall = null, onRetry }) {
  const [wallet, setWallet] = useState(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => getAiWallet().then(data => setWallet(data.wallet)).catch(() => null), []);
  useEffect(() => { load(); }, [load, shortfall]);
  if (!wallet) return null;
  const price = Math.ceil((wallet.prices?.[kind] || 0) * (regenerate ? 0.5 : 1));
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm ${shortfall ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100' : 'bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100'}`} role={shortfall ? 'alert' : 'status'}>
      <span className="text-lg" aria-hidden="true">⚡</span>
      <span className="flex-1">
        {wallet.active
          ? <>Writing {KIND_LABELS[kind] || 'this'} uses <strong>{price} credits</strong>. You have <strong>{wallet.credits.toLocaleString()}</strong>{wallet.schoolCredits ? <> (school: {wallet.schoolCredits.toLocaleString()})</> : null}.</>
          : <>Free until {formatDate(wallet.startsAt)} — from then, {KIND_LABELS[kind] || 'this'} uses <strong>{price} AI credits</strong>. You have {wallet.credits.toLocaleString()}.</>}
        {shortfall ? <> Not enough credits for this — get a bundle to continue.</> : null}
      </span>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-3 py-1.5 font-black text-white dark:bg-cyan-400 dark:text-black">Get credits</button>
      {shortfall && onRetry ? <button type="button" onClick={() => { load(); onRetry(); }} className="rounded-xl border border-current px-3 py-1.5 font-black">Try again</button> : null}
      {open ? <BundlePicker canFundSchool={wallet.canFundSchool} onClose={() => { setOpen(false); load(); }} /> : null}
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import {
  getMyGrowthPartner,
  saveGrowthPartnerBank,
  withdrawGrowthPartnerEarnings,
  resetReferralOwnerPassword,
} from '../../../features/public/services/publicSiteApi';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const card = 'rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur';
const input = 'mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40';
const lbl = 'text-xs font-semibold uppercase tracking-[0.18em] text-white/60';

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/55">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent || 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function GrowthPartnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [bank, setBank] = useState({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
  const [resetInfo, setResetInfo] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getMyGrowthPartner();
      setData(result);
      setBank({
        bankName: result.partner?.bankName || '',
        bankCode: result.partner?.bankCode || '',
        accountNumber: result.partner?.accountNumber || '',
        accountName: result.partner?.accountName || '',
      });
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load your partner dashboard.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveBank(event) {
    event.preventDefault();
    setBusy('bank'); setNotice(''); setError('');
    try { await saveGrowthPartnerBank(bank); setNotice('Bank details saved.'); await load(); }
    catch (e) { setError(e.message || 'Could not save bank details.'); }
    finally { setBusy(''); }
  }

  async function withdraw() {
    setBusy('withdraw'); setNotice(''); setError('');
    try { const r = await withdrawGrowthPartnerEarnings(); setNotice(r.message || 'Withdrawal initiated.'); await load(); }
    catch (e) { setError(e.message || 'Withdrawal failed.'); }
    finally { setBusy(''); }
  }

  async function resetReferral(tenantId) {
    setBusy(`reset-${tenantId}`); setNotice(''); setError(''); setResetInfo(null);
    try { const r = await resetReferralOwnerPassword(tenantId); setResetInfo({ tenantId, ...r }); setNotice(r.emailed ? 'Reset link emailed to the owner.' : 'Reset link generated — share it below.'); }
    catch (e) { setError(e.message || 'Could not reset that owner password.'); }
    finally { setBusy(''); }
  }

  function copy(text) { navigator.clipboard?.writeText(text); setNotice('Copied to clipboard.'); }

  if (error && !data) {
    return <div className="p-8 text-white"><div className={card}><p className="text-rose-300">{error}</p></div></div>;
  }
  if (!data) return <div className="p-8 text-white/70">Loading your partner dashboard…</div>;

  const p = data.partner || {};

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-white">
      <section className={card}>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">Growth Partner</p>
        <h1 className="mt-2 text-3xl font-black">Welcome, {p.name}</h1>
        <p className="mt-2 text-white/70">Share your referral link. When a school registers and pays through it, you earn commission — 30% for your first 10 schools, 50% after that — plus a share of ongoing term payments.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className={lbl}>Your referral link</p>
            <p className="mt-1 break-all rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm">{data.referralLink}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => copy(data.referralLink)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black">Copy link</button>
            <button type="button" onClick={() => copy(p.referralCode)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold">Code: {p.referralCode}</button>
          </div>
        </div>
      </section>

      {notice ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Schools referred" value={data.referralCount} />
        <Stat label="Total earned" value={naira.format(data.totalEarned)} accent="text-emerald-300" />
        <Stat label="Withdrawn" value={naira.format(data.totalWithdrawn)} />
        <Stat label="Available" value={naira.format(data.available)} accent="text-emerald-300" />
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Withdraw earnings</h2>
          <button type="button" onClick={withdraw} disabled={busy === 'withdraw' || data.available <= 0} className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black disabled:opacity-40">
            {busy === 'withdraw' ? 'Processing…' : `Withdraw ${naira.format(data.available)}`}
          </button>
        </div>
        <p className="mt-2 text-sm text-white/60">Payouts go instantly to the bank account below via our secure gateway. Add your account first.</p>
        <form onSubmit={saveBank} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Bank name</label><input className={input} value={bank.bankName} onChange={e => setBank(c => ({ ...c, bankName: e.target.value }))} /></div>
          <div><label className={lbl}>Bank code</label><input className={input} value={bank.bankCode} onChange={e => setBank(c => ({ ...c, bankCode: e.target.value }))} placeholder="e.g. 058" /></div>
          <div><label className={lbl}>Account number</label><input className={input} value={bank.accountNumber} onChange={e => setBank(c => ({ ...c, accountNumber: e.target.value }))} /></div>
          <div><label className={lbl}>Account name</label><input className={input} value={bank.accountName} onChange={e => setBank(c => ({ ...c, accountName: e.target.value }))} /></div>
          <div className="sm:col-span-2"><button type="submit" disabled={busy === 'bank'} className="rounded-xl border border-white/20 px-5 py-2 text-sm font-bold disabled:opacity-40">{busy === 'bank' ? 'Saving…' : 'Save bank details'}</button></div>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-xl font-bold">Your referred schools</h2>
        {data.referrals?.length ? (
          <div className="mt-4 space-y-3">
            {data.referrals.map(ref => (
              <div key={ref.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{ref.schoolName}</p>
                    <p className="text-xs text-white/50">Referred {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : ''}</p>
                  </div>
                  <button type="button" onClick={() => resetReferral(ref.tenantId)} disabled={busy === `reset-${ref.tenantId}`} className="rounded-xl border border-sky-400/40 px-4 py-2 text-xs font-semibold text-sky-200 disabled:opacity-40">
                    {busy === `reset-${ref.tenantId}` ? 'Generating…' : 'Reset owner password'}
                  </button>
                </div>
                {resetInfo && resetInfo.tenantId === ref.tenantId ? (
                  <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-xs">
                    <p className="break-all text-white/80">{resetInfo.resetUrl}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={resetInfo.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-400/40 px-3 py-1.5 font-semibold text-emerald-200">Share via WhatsApp</a>
                      <button type="button" onClick={() => copy(resetInfo.resetUrl)} className="rounded-lg border border-white/20 px-3 py-1.5 font-semibold">Copy link</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-white/60">No referrals yet. Share your link to get started.</p>}
      </section>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import {
  getGrowthPartnerDetail,
  resetGrowthPartnerPassword,
  appointGrowthPartnerRepresentative,
  initiatePartnerPayout,
  markPartnerPayoutPaid,
} from '../services/publicSiteApi';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const PANEL = 'rounded-2xl border border-[#c9a96e]/40 bg-[#fff8ee] p-4 dark:border-white/10 dark:bg-slate-900/50';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300';
const VALUE = 'mt-1 text-sm font-semibold text-[#14215b] dark:text-slate-100';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';
const BTN = 'rounded-xl bg-[#800020] px-4 py-2 text-xs font-bold text-[#b5e3f4] disabled:opacity-50';
const BTN_ALT = 'rounded-xl border border-[#191970]/30 px-4 py-2 text-xs font-bold text-[#191970] disabled:opacity-50 dark:border-white/20 dark:text-slate-100';

// Green when a step is done, amber when it still blocks a payout.
function Step({ done, label, detail }) {
  return (
    <div className={`${PANEL} border-l-4 ${done ? 'border-l-[#1a5c38]' : 'border-l-[#c9a96e]'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-black ${done ? 'text-[#1a5c38]' : 'text-[#800020]'}`}>{done ? '✓' : '!'}</span>
        <p className={LABEL}>{label}</p>
      </div>
      <p className={VALUE}>{detail}</p>
    </div>
  );
}

export default function GrowthPartnerDetail({ partnerId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [payout, setPayout] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payRemark, setPayRemark] = useState('');
  const [rep, setRep] = useState({ level: '', territory: '' });

  const load = useCallback(async () => {
    try {
      const result = await getGrowthPartnerDetail(partnerId);
      setData(result);
      setRep({
        level: result.representative?.level || '',
        territory: result.representative?.territory || '',
      });
      setError('');
    } catch (e) { setError(e.message || 'Could not load this partner.'); }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  async function run(key, action, successMessage) {
    setBusy(key); setNotice(''); setError('');
    try {
      const result = await action();
      if (successMessage) setNotice(successMessage);
      await load();
      return result;
    } catch (e) { setError(e.message || 'That action failed.'); return null; }
    finally { setBusy(''); }
  }

  function copy(text) { navigator.clipboard?.writeText(text); setNotice('Copied to clipboard.'); }

  if (error && !data) {
    return (
      <section className="mt-6 rounded-2xl border-2 border-[#800020]/40 bg-[#fff8ee] p-5 dark:bg-slate-950/70">
        <p className="text-sm font-semibold text-[#800020] dark:text-rose-300">{error}</p>
        <button type="button" onClick={onClose} className={`mt-3 ${BTN_ALT}`}>Close</button>
      </section>
    );
  }
  if (!data) return <section className="mt-6 rounded-2xl border border-[#c9a96e]/40 bg-[#fff8ee] p-5 dark:bg-slate-950/70"><p className="text-sm text-[#191970] dark:text-slate-300">Loading partner…</p></section>;

  const partner = data.partner || {};
  const verification = data.verification || {};
  const account = data.payoutAccount || {};
  const login = data.login || {};
  const tier = data.tier || {};
  const canPay = verification.complete && account.complete && (data.available || 0) > 0;

  return (
    <section className="mt-6 space-y-4 rounded-2xl border-2 border-[#1a5c38]/35 bg-[#fff8ee] p-5 shadow-[0_12px_28px_rgba(26,92,56,0.1)] dark:border-cyan-300/35 dark:bg-slate-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={LABEL}>Growth partner</p>
          <h3 className="mt-1 text-2xl font-black text-[#800000] dark:text-blue-400">{partner.name}</h3>
          <p className="text-sm text-[#191970] dark:text-slate-300">
            {partner.email} · referral <span className="font-mono">{partner.referralCode}</span> · code <span className="font-mono">{partner.discountCode}</span>
          </p>
          <p className="mt-1 text-xs font-bold text-[#1a5c38] dark:text-emerald-300">{tier.label}</p>
        </div>
        <button type="button" onClick={onClose} className={BTN_ALT}>Close</button>
      </div>

      {notice ? <p className="rounded-xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-2.5 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-2.5 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      {/* Readiness — everything that must be true before money can move. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Step done={login.hasAccount} label="Sign-in" detail={login.hasAccount ? (login.mustChangePassword ? 'Awaiting first sign-in' : 'Active') : 'No account yet'} />
        <Step done={verification.complete} label="Verification" detail={verification.complete ? 'NIN and utility bill on file' : !verification.nin ? 'NIN missing' : 'Utility bill missing'} />
        <Step done={account.complete} label="Payout account" detail={account.complete ? `${account.bankName} · ${account.accountNumber}` : 'Not added'} />
        <Step done={(data.available || 0) > 0} label="Available to pay" detail={naira.format(data.available || 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Schools referred', String(data.referralCount || 0)],
          ['Total earned', naira.format(data.totalEarned || 0)],
          ['Available', naira.format(data.available || 0)],
          ['Awaiting confirmation', naira.format(data.awaitingAcknowledgement || 0)],
          ['Settled', naira.format(data.settled || 0)],
        ].map(([label, value]) => (
          <div key={label} className={PANEL}>
            <p className={LABEL}>{label}</p>
            <p className={VALUE}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pay */}
      <div className={PANEL}>
        <p className={LABEL}>Pay this partner</p>
        {!canPay ? (
          <p className="mt-2 text-sm text-[#800020] dark:text-amber-200">
            {(data.available || 0) <= 0 ? 'Nothing available to pay right now.'
              : !verification.complete ? 'Blocked: verification is incomplete.'
              : 'Blocked: no payout account on file.'}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-xs text-[#4a5578] dark:text-slate-400">Amount (blank = all available)</span>
              <input type="number" min="0" className={`${INPUT} mt-1 w-44`} value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)} placeholder={naira.format(data.available || 0)} />
            </label>
            <button
              type="button"
              disabled={busy === 'pay'}
              onClick={async () => {
                const result = await run('pay', () => initiatePartnerPayout(partnerId, payoutAmount === '' ? 0 : Number(payoutAmount)), '');
                if (result) { setPayout(result); setPayoutAmount(''); setNotice('Payout started. Send the transfer, then record it below.'); }
              }}
              className={BTN}
            >
              {busy === 'pay' ? 'Starting…' : 'Pay now'}
            </button>
          </div>
        )}

        {payout ? (
          <div className="mt-3 rounded-xl border border-[#1a5c38]/40 bg-white/80 p-3 dark:bg-slate-900/60">
            <p className="text-sm font-black text-[#14215b] dark:text-slate-100">Send {naira.format(payout.payout?.amount || 0)} to:</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['Bank', payout.bank?.bankName],
                ['Bank code', payout.bank?.bankCode],
                ['Account number', payout.bank?.accountNumber],
                ['Account name', payout.bank?.accountName],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-[#c9a96e]/40 px-3 py-1.5">
                  <span className="text-xs text-[#4a5578] dark:text-slate-400">{label}</span>
                  <span className="font-mono text-sm font-bold text-[#14215b] dark:text-slate-100">{value || '—'}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => copy(payout.bank?.accountNumber || '')} className={`mt-2 ${BTN_ALT}`}>Copy account number</button>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block flex-1 min-w-[12rem]">
                <span className="text-xs text-[#4a5578] dark:text-slate-400">Remark for the partner</span>
                <input className={`${INPUT} mt-1`} value={payRemark} onChange={e => setPayRemark(e.target.value)}
                  placeholder="e.g. Transfer sent from GTBank, ref 8842" />
              </label>
              <button
                type="button"
                disabled={busy === 'markpaid'}
                onClick={async () => {
                  await run('markpaid', () => markPartnerPayoutPaid(payout.payout.id, payRemark), 'Recorded. The partner will be asked to confirm receipt.');
                  setPayout(null); setPayRemark('');
                }}
                className={BTN}
              >
                {busy === 'markpaid' ? 'Recording…' : 'I have paid'}
              </button>
            </div>
          </div>
        ) : null}

        {(data.withdrawals || []).length ? (
          <div className="mt-3 space-y-2">
            {data.withdrawals.slice(0, 6).map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c9a96e]/30 px-3 py-2 text-sm">
                <span className="font-bold text-[#14215b] dark:text-slate-100">{naira.format(item.amount)}</span>
                <span className="text-xs text-[#4a5578] dark:text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  item.status === 'awaiting_ack' ? 'bg-[#c9a96e] text-[#191970]'
                    : item.status === 'processing' ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-[#1a5c38] text-white'
                }`}>
                  {item.status === 'awaiting_ack' ? 'Awaiting partner confirmation' : item.status === 'processing' ? 'Not yet sent' : 'Settled'}
                </span>
                {item.status === 'processing' ? (
                  <button type="button" onClick={() => setPayout({ payout: item, bank: account })} className={BTN_ALT}>Record payment</button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Sign-in + representative */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={PANEL}>
          <p className={LABEL}>Sign-in access</p>
          <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">
            {login.lastPasswordChange ? `Password last set ${new Date(login.lastPasswordChange).toLocaleDateString()}.` : 'No password set yet.'}
          </p>
          <button
            type="button"
            disabled={busy === 'password'}
            onClick={async () => {
              const result = await run('password', () => resetGrowthPartnerPassword(partnerId), '');
              if (result) { setCredentials(result); setNotice('New sign-in details issued — shown once.'); }
            }}
            className={`mt-2 ${BTN_ALT}`}
          >
            {busy === 'password' ? 'Issuing…' : 'Issue new password'}
          </button>
          {credentials ? (
            <div className="mt-3 space-y-2 rounded-xl border border-[#800020]/30 bg-white/80 p-3 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#4a5578] dark:text-slate-400">Password</span>
                <code className="rounded bg-[#191970] px-2 py-1 text-xs font-bold text-white">{credentials.password}</code>
                <button type="button" onClick={() => copy(credentials.password)} className={BTN_ALT}>Copy</button>
              </div>
              {credentials.setPasswordUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#4a5578] dark:text-slate-400">Set-password link</span>
                  <span className="max-w-full break-all text-[11px] text-[#191970] dark:text-slate-200">{credentials.setPasswordUrl}</span>
                  <button type="button" onClick={() => copy(credentials.setPasswordUrl)} className={BTN_ALT}>Copy</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={PANEL}>
          <p className={LABEL}>Representative appointment</p>
          <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">
            State and regional representatives see partner conversations for schools in their territory. National and global see all.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select value={rep.level} onChange={e => setRep(c => ({ ...c, level: e.target.value }))} className={INPUT}>
              <option value="">Not appointed</option>
              <option value="state">State</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
              <option value="global">Global</option>
            </select>
            <input value={rep.territory} onChange={e => setRep(c => ({ ...c, territory: e.target.value }))}
              className={INPUT} placeholder="State or region covered" />
            <button type="button" disabled={busy === 'rep' || !rep.level}
              onClick={() => run('rep', () => appointGrowthPartnerRepresentative(partnerId, rep), 'Representative appointment saved.')}
              className={BTN}>
              {busy === 'rep' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Verification + code pricing */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={PANEL}>
          <p className={LABEL}>Verification documents</p>
          <p className={VALUE}>NIN: {verification.nin || 'Not submitted'}</p>
          {verification.utilityBillUrl ? (
            <a href={verification.utilityBillUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-[#14215b] underline dark:text-sky-300">
              View utility bill
            </a>
          ) : <p className="mt-1 text-sm text-[#800020] dark:text-amber-200">No utility bill uploaded.</p>}
        </div>

        <div className={PANEL}>
          <p className={LABEL}>What this partner is selling</p>
          <p className={VALUE}>
            Onboarding {data.offer?.setupFee != null ? naira.format(data.offer.setupFee) : `${naira.format(data.offer?.standardSetupFee || 0)} (standard)`}
          </p>
          <p className={VALUE}>
            Per user / term {data.offer?.studentFeePerTerm != null ? naira.format(data.offer.studentFeePerTerm) : `${naira.format(data.offer?.standardStudentFeePerTerm || 0)} (standard)`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(data.links?.referralLink || '')} className={BTN_ALT}>Copy referral link</button>
            <button type="button" onClick={() => copy(data.links?.pricingLink || '')} className={BTN_ALT}>Copy pricing link</button>
          </div>
        </div>
      </div>

      {/* Referrals */}
      <div className={PANEL}>
        <p className={LABEL}>Referred schools</p>
        {(data.referrals || []).length === 0 ? (
          <p className="mt-2 text-sm text-[#4a5578] dark:text-slate-400">No referrals yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#c9a96e]/40">
                  {['School', 'Location', 'Status', 'Payment'].map(head => (
                    <th key={head} className="py-2 pr-3 text-[10px] font-bold uppercase tracking-wide text-[#800020] dark:text-fuchsia-300">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[#14215b] dark:text-slate-200">
                {data.referrals.map(referral => (
                  <tr key={referral.id} className="border-b border-[#c9a96e]/20">
                    <td className="py-2 pr-3 font-semibold">{referral.schoolName}</td>
                    <td className="py-2 pr-3 text-xs">{[referral.localGovernmentArea, referral.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-2 pr-3 text-xs">{referral.status}</td>
                    <td className="py-2 pr-3 text-xs">{referral.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Earnings statement */}
      <div className={PANEL}>
        <p className={LABEL}>Commission statement</p>
        {(data.commissions || []).length === 0 ? (
          <p className="mt-2 text-sm text-[#4a5578] dark:text-slate-400">Nothing earned yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {data.commissions.slice(0, 12).map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[#14215b] dark:text-slate-200">{item.note || item.kind}</span>
                <span className="text-xs text-[#4a5578] dark:text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                <span className="font-bold text-[#1a5c38] dark:text-emerald-300">{naira.format(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

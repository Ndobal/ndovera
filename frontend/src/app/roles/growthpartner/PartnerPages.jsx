import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  saveGrowthPartnerBank,
  saveGrowthPartnerVerification,
  uploadGrowthPartnerUtilityBill,
  resetReferralOwnerPassword,
  saveGrowthPartnerDiscount,
  acknowledgePartnerPayout,
  getConversations,
  getConversationMessages,
  sendConversationMessage,
} from '../../../features/public/services/publicSiteApi';
import { changePassword, getStoredAuth, persistAuth } from '../../../features/auth/services/authApi';
import { CARD, INPUT, LABEL, BODY, MUTED, BTN_PRIMARY, BTN_SECONDARY, PageHeader, Stat, Notice, EmptyState, naira } from './partnerUi';

function copy(text, setNotice) {
  navigator.clipboard?.writeText(text);
  setNotice('Copied to clipboard.');
}

/* ------------------------------------------------------------------ Overview */

export function OverviewPage({ data, reload }) {
  const [notice, setNotice] = useState('');
  const partner = data.partner || {};
  const tier = data.tier || {};
  const progress = tier.threshold ? Math.min(100, Math.round((tier.schools / tier.threshold) * 100)) : 100;

  return (
    <>
      <PageHeader
        title={`Welcome, ${partner.name || 'Partner'}`}
        subtitle="Share your referral link. When a school registers and pays through it, you earn commission on the onboarding fee plus a share of every term payment."
      />
      <Notice notice={notice} />

      <section className={CARD}>
        <p className={LABEL}>Your referral link</p>
        <p className="mt-2 break-all rounded-xl border border-[#1a5c38]/30 bg-white/80 px-3 py-2.5 text-sm text-[#191970] dark:bg-slate-900/60 dark:text-slate-100">
          {data.referralLink}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(data.referralLink, setNotice)} className={BTN_PRIMARY}>Copy link</button>
          <button type="button" onClick={() => copy(partner.discountCode || partner.referralCode, setNotice)} className={BTN_SECONDARY}>
            Code: {partner.discountCode || '—'}
          </button>
        </div>
        <p className={`mt-3 ${MUTED}`}>
          This link applies your discount code automatically. School owners using it cannot swap in another partner&apos;s code.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Schools referred" value={data.referralCount ?? 0} />
        <Stat label="Total earned" value={naira.format(data.totalEarned || 0)} tone="text-[#1a5c38] dark:text-emerald-300" />
        <Stat label="Paid out" value={naira.format(data.settled || 0)} />
        <Stat label="Available" value={naira.format(data.available || 0)} tone="text-[#1a5c38] dark:text-emerald-300" />
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">{tier.label || 'Partner tier'}</h2>
          <p className={MUTED}>{Math.round((tier.currentRate || 0) * 100)}% of each onboarding fee</p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
          <div className="h-full rounded-full bg-[#1a5c38] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className={`mt-2 ${BODY}`}>
          {tier.schoolsToNextRate > 0
            ? `${tier.schools} of ${tier.threshold} schools. ${tier.schoolsToNextRate} more and your rate rises to ${Math.round((tier.nextRate || 0) * 100)}%.`
            : 'You are on the top rate. Every new school earns you 50% of its onboarding fee.'}
        </p>
      </section>

      {data.awaitingAcknowledgement > 0 ? (
        <section className={CARD}>
          <h2 className="text-lg font-black text-[#800020] dark:text-fuchsia-300">A payment needs your confirmation</h2>
          <p className={`mt-2 ${BODY}`}>
            {naira.format(data.awaitingAcknowledgement)} has been sent to you. Open Earnings to confirm you received it.
          </p>
        </section>
      ) : null}

      <PartnerReloadButton reload={reload} />
    </>
  );
}

function PartnerReloadButton({ reload }) {
  return (
    <button type="button" onClick={reload} className={`${BTN_SECONDARY} w-full sm:w-auto`}>Refresh</button>
  );
}

/* ----------------------------------------------------------------- Referrals */

export function ReferralsPage({ data, reload }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [resetInfo, setResetInfo] = useState(null);

  async function resetOwner(tenantId) {
    setBusy(tenantId); setNotice(''); setError(''); setResetInfo(null);
    try {
      const result = await resetReferralOwnerPassword(tenantId);
      setResetInfo({ tenantId, ...result });
      setNotice(result.emailed ? 'Reset link emailed to the owner.' : 'Reset link generated — share it below.');
    } catch (e) {
      setError(e.message || 'Could not reset that owner password.');
    } finally { setBusy(''); }
  }

  const referrals = data.referrals || [];

  return (
    <>
      <PageHeader title="Your referred schools" subtitle="Every school that registered through your link or code." />
      <Notice notice={notice} error={error} />

      {referrals.length === 0 ? (
        <EmptyState>No referrals yet. Share your link from the Overview page to get started.</EmptyState>
      ) : (
        <div className="space-y-3">
          {referrals.map(referral => (
            <article key={referral.id} className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">{referral.schoolName}</h2>
                  <p className={MUTED}>Referred {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString() : ''}</p>
                </div>
                <button type="button" onClick={() => resetOwner(referral.tenantId)} disabled={busy === referral.tenantId} className={BTN_SECONDARY}>
                  {busy === referral.tenantId ? 'Generating…' : 'Reset owner password'}
                </button>
              </div>
              {resetInfo && resetInfo.tenantId === referral.tenantId ? (
                <div className="mt-3 rounded-2xl border border-[#14215b]/25 bg-white/70 p-3 dark:bg-slate-900/50">
                  <p className="break-all text-xs text-[#191970] dark:text-slate-200">{resetInfo.resetUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={resetInfo.whatsappUrl} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>Share via WhatsApp</a>
                    <button type="button" onClick={() => copy(resetInfo.resetUrl, setNotice)} className={BTN_SECONDARY}>Copy link</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <PartnerReloadButton reload={reload} />
    </>
  );
}

/* ------------------------------------------------------------------ Earnings */

export function EarningsPage({ data, reload }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [remarks, setRemarks] = useState({});

  async function acknowledge(payout) {
    setBusy(payout.id); setNotice(''); setError('');
    try {
      await acknowledgePartnerPayout(payout.id, remarks[payout.id] || '');
      setNotice('Payment confirmed. Thank you — your balance has been updated.');
      await reload();
    } catch (e) {
      setError(e.message || 'Could not confirm that payment.');
    } finally { setBusy(''); }
  }

  const withdrawals = data.withdrawals || [];
  const commissions = data.commissions || [];

  return (
    <>
      <PageHeader title="Earnings and payouts" subtitle="What you have earned, what has been paid, and anything waiting on your confirmation." />
      <Notice notice={notice} error={error} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total earned" value={naira.format(data.totalEarned || 0)} tone="text-[#1a5c38] dark:text-emerald-300" />
        <Stat label="Available" value={naira.format(data.available || 0)} />
        <Stat label="Awaiting your confirmation" value={naira.format(data.awaitingAcknowledgement || 0)} tone="text-[#800020] dark:text-fuchsia-300" />
        <Stat label="Settled" value={naira.format(data.settled || 0)} />
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Payments</h2>
        <p className={`mt-1 ${MUTED}`}>Ami sends payment to your payout account. Confirm each one so it is recorded as settled.</p>
        {withdrawals.length === 0 ? (
          <div className="mt-4"><EmptyState>No payments yet.</EmptyState></div>
        ) : (
          <div className="mt-4 space-y-3">
            {withdrawals.map(payout => (
              <div key={payout.id} className="rounded-2xl border border-[#c9a96e]/40 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-black text-[#191970] dark:text-slate-100">{naira.format(payout.amount)}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    payout.status === 'awaiting_ack' ? 'bg-[#800020] text-[#b5e3f4]'
                      : payout.status === 'processing' ? 'bg-[#c9a96e] text-[#191970]'
                      : 'bg-[#1a5c38] text-white'
                  }`}>
                    {payout.status === 'awaiting_ack' ? 'Confirm receipt'
                      : payout.status === 'processing' ? 'Processing'
                      : 'Settled'}
                  </span>
                </div>
                <p className={`mt-1 ${MUTED}`}>
                  Reference {payout.reference}
                  {payout.paidAt ? ` • sent ${new Date(payout.paidAt).toLocaleDateString()}` : ''}
                </p>
                {payout.paidRemark ? <p className={`mt-2 ${BODY}`}><span className="font-bold">Ami:</span> {payout.paidRemark}</p> : null}

                {payout.status === 'awaiting_ack' ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className={LABEL}>Your remark (optional)</span>
                      <input
                        className={INPUT}
                        value={remarks[payout.id] || ''}
                        onChange={e => setRemarks(current => ({ ...current, [payout.id]: e.target.value }))}
                        placeholder="e.g. Received in full, thank you"
                      />
                    </label>
                    <button type="button" onClick={() => acknowledge(payout)} disabled={busy === payout.id} className={BTN_PRIMARY}>
                      {busy === payout.id ? 'Confirming…' : 'Acknowledge receipt'}
                    </button>
                  </div>
                ) : null}
                {payout.ackRemark ? <p className={`mt-2 ${MUTED}`}>You noted: {payout.ackRemark}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Earnings statement</h2>
        {commissions.length === 0 ? (
          <div className="mt-4"><EmptyState>Nothing earned yet.</EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#c9a96e]/40">
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-400">Date</th>
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-400">Detail</th>
                  <th className="py-2 text-right text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[#191970] dark:text-slate-200">
                {commissions.map(item => (
                  <tr key={item.id} className="border-b border-[#c9a96e]/20">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</td>
                    <td className="py-2.5 pr-3">{item.note || item.kind}</td>
                    <td className="py-2.5 text-right font-bold">{naira.format(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <PartnerReloadButton reload={reload} />
    </>
  );
}

/* ------------------------------------------------------------------- Pricing */

export function PricingPage({ data, reload }) {
  const offer = data.offer || {};
  const [form, setForm] = useState({ setupFeeNaira: offer.setupFee ?? '', studentFeeNaira: offer.studentFeePerTerm ?? '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ setupFeeNaira: offer.setupFee ?? '', studentFeeNaira: offer.studentFeePerTerm ?? '' });
  }, [offer.setupFee, offer.studentFeePerTerm]);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setNotice(''); setError('');
    try {
      await saveGrowthPartnerDiscount({
        setupFeeNaira: form.setupFeeNaira === '' ? null : Number(form.setupFeeNaira),
        studentFeeNaira: form.studentFeeNaira === '' ? null : Number(form.studentFeeNaira),
      });
      setNotice('Your code pricing has been updated.');
      await reload();
    } catch (e) { setError(e.message || 'Could not update your code pricing.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Your code pricing"
        subtitle={`Set what schools pay when they register through your code ${data.partner?.discountCode || ''}. Leave a field empty to charge the standard price. Your commission is a share of the onboarding fee actually paid, so discounting also lowers what you earn.`}
      />
      <Notice notice={notice} error={error} />

      <form onSubmit={save} className={CARD}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Onboarding fee (₦)</span>
            <input type="number" min={offer.minSetupFee || 0} max={offer.standardSetupFee || undefined} className={INPUT}
              value={form.setupFeeNaira} onChange={e => setForm(c => ({ ...c, setupFeeNaira: e.target.value }))}
              placeholder={`Standard ${naira.format(offer.standardSetupFee || 0)}`} />
            <span className={`mt-1 block ${MUTED}`}>Lowest allowed: {naira.format(offer.minSetupFee || 0)}</span>
          </label>
          <label className="block">
            <span className={LABEL}>Per active user / term (₦)</span>
            <input type="number" min={offer.minStudentFeePerTerm || 0} max={offer.standardStudentFeePerTerm || undefined} className={INPUT}
              value={form.studentFeeNaira} onChange={e => setForm(c => ({ ...c, studentFeeNaira: e.target.value }))}
              placeholder={`Standard ${naira.format(offer.standardStudentFeePerTerm || 0)}`} />
            <span className={`mt-1 block ${MUTED}`}>Lowest allowed: {naira.format(offer.minStudentFeePerTerm || 0)}</span>
          </label>
        </div>
        <button type="submit" disabled={busy} className={`mt-4 ${BTN_PRIMARY}`}>{busy ? 'Saving…' : 'Save pricing'}</button>
      </form>

      {data.pricingLink ? (
        <section className={CARD}>
          <p className={LABEL}>Your priced pricing page</p>
          <p className="mt-2 break-all text-sm text-[#191970] dark:text-slate-200">{data.pricingLink}</p>
          <button type="button" onClick={() => copy(data.pricingLink, setNotice)} className={`mt-3 ${BTN_SECONDARY}`}>Copy link</button>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- Toolkit */

export function ToolkitPage({ data }) {
  const [notice, setNotice] = useState('');
  const [students, setStudents] = useState(250);
  const offer = data.offer || {};
  const tier = data.tier || {};

  const setupFee = offer.setupFee ?? offer.standardSetupFee ?? 0;
  const perUser = offer.studentFeePerTerm ?? offer.standardStudentFeePerTerm ?? 0;
  const signup = Math.round(setupFee * (tier.currentRate || 0.3));
  const perTerm = Math.round(students * perUser * 0.05);

  const pitch = `Hello! I can help your school get online with NDOVERA — school website, results, fees, attendance and parent access in one place.\n\nOnboarding: ${naira.format(setupFee)}\nThen ${naira.format(perUser)} per active user each term.\n\nRegister here: ${data.referralLink || ''}`;

  return (
    <>
      <PageHeader title="Partner toolkit" subtitle="Work out what a school is worth to you, and send a message that is accurate about your pricing." />
      <Notice notice={notice} />

      <section className={CARD}>
        <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Commission calculator</h2>
        <label className="mt-3 block max-w-xs">
          <span className={LABEL}>Students at the school</span>
          <input type="number" min="0" className={INPUT} value={students} onChange={e => setStudents(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat label="You earn at signup" value={naira.format(signup)} tone="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="You earn each term after" value={naira.format(perTerm)} tone="text-[#1a5c38] dark:text-emerald-300" />
        </div>
        <p className={`mt-3 ${MUTED}`}>
          Signup is {Math.round((tier.currentRate || 0.3) * 100)}% of the onboarding fee at your current tier. Term commission is 5% of the school&apos;s term billing. Estimates only.
        </p>
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Ready-to-send message</h2>
        <p className={`mt-1 ${MUTED}`}>Already carries your link and your prices, so nothing is quoted wrongly.</p>
        <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-[#c9a96e]/40 bg-white/80 p-4 text-sm text-[#191970] dark:bg-slate-900/60 dark:text-slate-200">{pitch}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(pitch, setNotice)} className={BTN_PRIMARY}>Copy message</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(pitch)}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>Send on WhatsApp</a>
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------- Verification */

export function VerificationPage({ data, reload }) {
  const [nin, setNin] = useState(data.partner?.nin || '');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const partner = data.partner || {};

  async function save(event) {
    event.preventDefault();
    setBusy(true); setNotice(''); setError('');
    try {
      await saveGrowthPartnerVerification({ nin });
      if (file) await uploadGrowthPartnerUtilityBill(file);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setNotice('Identity details saved securely.');
      await reload();
    } catch (e) { setError(e.message || 'Could not save your verification details.'); }
    finally { setBusy(false); }
  }

  const ninDone = Boolean(partner.nin);
  const billDone = Boolean(partner.utilityBillUrl);

  return (
    <>
      <PageHeader title="Identity verification" subtitle="Your NIN and a recent utility bill are needed before payout details can be used. Files are visible only to you and Ami." />
      <Notice notice={notice} error={error} />

      <section className={CARD}>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${ninDone ? 'bg-[#1a5c38] text-white' : 'bg-[#c9a96e] text-[#191970]'}`}>
            {ninDone ? 'NIN on file' : 'NIN needed'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${billDone ? 'bg-[#1a5c38] text-white' : 'bg-[#c9a96e] text-[#191970]'}`}>
            {billDone ? 'Utility bill on file' : 'Utility bill needed'}
          </span>
        </div>

        <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>NIN</span>
            <input inputMode="numeric" maxLength={11} className={INPUT} value={nin}
              onChange={e => setNin(e.target.value.replace(/\D/g, ''))} placeholder="11-digit NIN" />
          </label>
          <label className="block">
            <span className={LABEL}>Utility bill (PDF or image, up to 5 MB)</span>
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
              className={`${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a5c38] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white`}
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? 'Saving…' : 'Save verification'}</button>
            {partner.utilityBillUrl ? (
              <a href={partner.utilityBillUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#14215b] underline dark:text-sky-300">View uploaded bill</a>
            ) : null}
          </div>
        </form>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------------- Bank */

export function BankPage({ data, reload }) {
  const partner = data.partner || {};
  const [form, setForm] = useState({
    bankName: partner.bankName || '', bankCode: partner.bankCode || '',
    accountNumber: partner.accountNumber || '', accountName: partner.accountName || '',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true); setNotice(''); setError('');
    try {
      await saveGrowthPartnerBank(form);
      setNotice('Payout account saved.');
      await reload();
    } catch (e) { setError(e.message || 'Could not save your bank details.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Payout account" subtitle="Where Ami sends your earnings. Complete identity verification first." />
      <Notice notice={notice} error={error} />
      <form onSubmit={save} className={CARD}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={LABEL}>Bank name</span>
            <input className={INPUT} value={form.bankName} onChange={e => setForm(c => ({ ...c, bankName: e.target.value }))} /></label>
          <label className="block"><span className={LABEL}>Bank code</span>
            <input className={INPUT} value={form.bankCode} onChange={e => setForm(c => ({ ...c, bankCode: e.target.value }))} placeholder="e.g. 058" /></label>
          <label className="block"><span className={LABEL}>Account number</span>
            <input inputMode="numeric" className={INPUT} value={form.accountNumber} onChange={e => setForm(c => ({ ...c, accountNumber: e.target.value }))} /></label>
          <label className="block"><span className={LABEL}>Account name</span>
            <input className={INPUT} value={form.accountName} onChange={e => setForm(c => ({ ...c, accountName: e.target.value }))} /></label>
        </div>
        <button type="submit" disabled={busy} className={`mt-4 ${BTN_PRIMARY}`}>{busy ? 'Saving…' : 'Save bank details'}</button>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ Security */

export function SecurityPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setNotice(''); setError('');
    if (form.newPassword.length < 8) { setError('Your new password must be at least 8 characters.'); return; }
    if (form.newPassword !== form.confirmPassword) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const token = getStoredAuth()?.token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      persistAuth(await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }, token));
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice('Password updated. Use it the next time you sign in.');
    } catch (e) { setError(e.message || 'Could not update your password.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Security" subtitle="Change the password you use to sign in. Pick something only you know — at least 8 characters." />
      <Notice notice={notice} error={error} />
      <form onSubmit={save} className={CARD}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block"><span className={LABEL}>Current password</span>
            <input type="password" autoComplete="current-password" className={INPUT} value={form.currentPassword}
              onChange={e => setForm(c => ({ ...c, currentPassword: e.target.value }))} /></label>
          <label className="block"><span className={LABEL}>New password</span>
            <input type="password" autoComplete="new-password" className={INPUT} value={form.newPassword}
              onChange={e => setForm(c => ({ ...c, newPassword: e.target.value }))} /></label>
          <label className="block"><span className={LABEL}>Confirm new password</span>
            <input type="password" autoComplete="new-password" className={INPUT} value={form.confirmPassword}
              onChange={e => setForm(c => ({ ...c, confirmPassword: e.target.value }))} /></label>
        </div>
        <button type="submit" disabled={busy} className={`mt-4 ${BTN_PRIMARY}`}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </>
  );
}

/* ------------------------------------------------------- Messages & community */

export function ConversationsPage({ kind, title, subtitle, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const visible = useMemo(
    () => conversations.filter(item => (kind === 'community' ? item.kind === 'community' : item.kind === 'school')),
    [conversations, kind],
  );

  const loadConversations = useCallback(async () => {
    try {
      const result = await getConversations();
      const list = result.conversations || [];
      setConversations(list);
      onUnreadChange?.(list.filter(item => item.kind === 'school').reduce((sum, item) => sum + (item.unread || 0), 0));
      setError('');
      return list;
    } catch (e) {
      setError(e.message || 'Could not load conversations.');
      return [];
    }
  }, [onUnreadChange]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeId || visible.length === 0) return;
    setActiveId(visible[0].id);
  }, [visible, activeId]);

  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getConversationMessages(activeId);
        if (!cancelled) setMessages(result.messages || []);
      } catch { /* keep whatever is on screen */ }
    };
    load();
    // Light polling keeps a conversation current without a socket layer.
    const timer = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    setBusy(true);
    try {
      await sendConversationMessage(activeId, text);
      setDraft('');
      const result = await getConversationMessages(activeId);
      setMessages(result.messages || []);
      await loadConversations();
    } catch (e) { setError(e.message || 'Could not send that message.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Notice error={error} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {kind !== 'community' ? (
          <section className={`${CARD} lg:max-h-[32rem] lg:overflow-y-auto`}>
            <p className={LABEL}>Conversations</p>
            {visible.length === 0 ? (
              <div className="mt-3"><EmptyState>No conversations yet. One is created for each school you refer.</EmptyState></div>
            ) : (
              <div className="mt-3 space-y-2">
                {visible.map(item => (
                  <button key={item.id} type="button" onClick={() => setActiveId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                      item.id === activeId
                        ? 'border-[#800020] bg-[#efd4a0]/70 dark:border-fuchsia-300/50 dark:bg-slate-800'
                        : 'border-[#c9a96e]/30 bg-white/70 hover:bg-[#efd4a0]/40 dark:border-white/10 dark:bg-slate-900/50'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-[#191970] dark:text-slate-100">{item.title}</span>
                      {item.unread > 0 ? <span className="rounded-full bg-[#1a5c38] px-2 text-[11px] font-bold text-white">{item.unread}</span> : null}
                    </div>
                    {item.lastMessage ? (
                      <p className={`mt-1 truncate ${MUTED}`}>{item.lastMessage.senderName}: {item.lastMessage.body}</p>
                    ) : <p className={`mt-1 ${MUTED}`}>No messages yet</p>}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className={`${CARD} flex min-h-[24rem] flex-col ${kind === 'community' ? 'lg:col-span-2' : ''}`}>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: '26rem' }}>
            {messages.length === 0 ? (
              <EmptyState>{kind === 'community' ? 'No posts yet. Ami and partners will post here.' : 'No messages yet. Say hello.'}</EmptyState>
            ) : messages.map(message => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  message.mine
                    ? 'bg-[#800020] text-[#fff8ee]'
                    : 'bg-white text-[#191970] dark:bg-slate-800 dark:text-slate-100'
                }`}>
                  {!message.mine ? (
                    <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{message.senderName} · {message.senderRole}</p>
                  ) : null}
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">{message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="mt-3 flex gap-2 border-t border-[#c9a96e]/40 pt-3 dark:border-white/10">
            <input className={`${INPUT} mt-0 flex-1`} value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={activeId ? 'Write a message' : 'Select a conversation'} disabled={!activeId} />
            <button type="submit" disabled={busy || !activeId || !draft.trim()} className={BTN_PRIMARY}>{busy ? '…' : 'Send'}</button>
          </form>
        </section>
      </div>
    </>
  );
}

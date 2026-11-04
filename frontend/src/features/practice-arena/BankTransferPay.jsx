import React, { useState } from 'react';
import { getBankDetails, makeBankClaim } from './practiceApi';

// For anyone the card page does not work for: transfer to Ndovera, press "I have paid", send the receipt on WhatsApp.

export default function BankTransferPay({ payload, disabled = false, className = '' }) {
  const [bank, setBank] = useState(null);
  const [reference, setReference] = useState('');
  const [claim, setClaim] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const open = () => getBankDetails(payload).then(setBank).catch(err => setMessage(err.message));
  const paid = async () => {
    setBusy(true); setMessage('');
    try { setClaim(await makeBankClaim({ ...payload, reference })); } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };
  return (
    <div className={className}>
      {!bank ? <button type="button" disabled={disabled} onClick={open} className="w-full text-sm font-bold text-slate-900 underline disabled:opacity-50 dark:text-white">Pay by bank transfer instead</button> : null}
      {bank && !claim ? (
        <div className="space-y-2 rounded-2xl bg-slate-100 p-3 text-sm text-slate-900 dark:bg-white/10 dark:text-white">
          <p className="font-black">Transfer ₦{Number(bank.amountNaira).toLocaleString()} to:</p>
          <p>{bank.bankName}<br />{bank.accountName}<br /><strong className="text-lg">{bank.accountNumber}</strong></p>
          <label className="block font-bold">Your transfer reference (optional)
            <input value={reference} onChange={event => setReference(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white" />
          </label>
          <button type="button" disabled={busy} onClick={paid} className="w-full rounded-2xl bg-[#1a5c38] py-2 font-black text-white disabled:opacity-60">{busy ? 'Saving…' : 'I have paid'}</button>
        </div>
      ) : null}
      {claim ? (
        <div role="status" className="space-y-2 rounded-2xl bg-slate-100 p-3 text-sm text-slate-900 dark:bg-white/10 dark:text-white">
          <p className="font-bold">Now send your payment receipt to Ndovera on WhatsApp, so it can be checked. Claim number: {claim.claimNo}</p>
          <a href={claim.whatsappUrl} target="_blank" rel="noreferrer noopener" className="inline-block rounded-xl bg-[#25D366] px-3 py-2 font-black text-[#06301a]">Send receipt on WhatsApp</a>
          <p>The pass opens as soon as Ndovera confirms the payment.</p>
        </div>
      ) : null}
      {message ? <p role="alert" className="mt-1 text-xs font-bold text-rose-800 dark:text-rose-300">{message}</p> : null}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBankClaim, markBankClaim } from './practiceApi';

// One bank-transfer payment: the account, the exact amount, "I have paid", then the receipt on WhatsApp.

const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';

export default function BankPayPage() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [failed, setFailed] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getBankClaim(id).then(setClaim).catch(err => setFailed(err.message)); }, [id]);
  const paid = async event => {
    event.preventDefault();
    setBusy(true); setFailed('');
    try { setClaim(await markBankClaim(id, reference)); } catch (err) { setFailed(err.message); } finally { setBusy(false); }
  };
  return (
    <main className="min-h-screen bg-[#f3f6ff] p-4 text-[#191970] dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-white p-6 shadow dark:bg-slate-900">
        {failed ? <p role="alert" className="font-bold text-rose-900 dark:text-rose-200">{failed}</p> : null}
        {!claim && !failed ? <p role="status">Loading…</p> : null}
        {claim ? (
          <>
            <h1 className="text-xl font-black text-[#800000] dark:text-amber-200">Pay by bank transfer</h1>
            <p className="text-sm">{claim.label}</p>
            {claim.status === 'approved' ? <p role="status" className="font-black text-[#1a5c38] dark:text-emerald-300">Your payment is confirmed. Thank you.</p> : null}
            {claim.status === 'rejected' ? <p role="alert" className="font-bold text-rose-900 dark:text-rose-200">Ndovera could not find this payment. Please send your receipt on WhatsApp to +{claim.whatsapp}.</p> : null}
            {claim.status === 'opened' ? (
              <>
                <p className="text-sm font-bold">Transfer exactly:</p>
                <p className="text-3xl font-black">₦{Number(claim.payNaira).toLocaleString()}</p>
                <dl className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-900 dark:bg-white/10 dark:text-white">
                  <dt className="font-semibold">Bank</dt><dd className="mb-2 font-black">{claim.bankName}</dd>
                  <dt className="font-semibold">Account name</dt><dd className="mb-2 font-black">{claim.accountName}</dd>
                  <dt className="font-semibold">Account number</dt><dd className="text-xl font-black">{claim.accountNumber}</dd>
                </dl>
                <form onSubmit={paid} className="space-y-3" aria-label="I have paid">
                  <label className="block text-sm font-bold">Your transfer reference (optional)<input className={FIELD} value={reference} onChange={event => setReference(event.target.value)} /></label>
                  <button type="submit" disabled={busy} className="w-full rounded-2xl bg-[#1a5c38] py-3 font-black text-white disabled:opacity-60">{busy ? 'Saving…' : 'I have paid'}</button>
                </form>
              </>
            ) : null}
            {claim.status === 'waiting' ? (
              <div role="status" className="space-y-3 text-sm">
                <p className="font-bold">Now send your payment receipt to Ndovera on WhatsApp, so it can be checked. Claim number: {claim.id}</p>
                <a href={claim.whatsappUrl} target="_blank" rel="noreferrer noopener" className="block rounded-2xl bg-[#25D366] py-3 text-center font-black text-[#06301a]">Send receipt on WhatsApp</a>
                <p>Attach the receipt picture in the chat. Your purchase opens as soon as Ndovera confirms the payment.</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

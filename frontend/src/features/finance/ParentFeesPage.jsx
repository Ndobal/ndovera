import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMyFeeAccounts, getSchoolPaymentDetails, listFinanceClaims, naira, submitFeeClaim } from './financeApi';
import { BillingPeriodBanner, CARD, ChargeTable, INPUT, Metric, Notice, PaymentsTable, PRIMARY, ReceiptDialog, SECONDARY, StatusChip, TD, TH } from './FinanceShared';

// The parent's (or student's) fees: what is owed now, earlier balances kept
// separate, how to pay, claims for payments made, history and receipts.
// Schools that have not issued bills through fee structures keep the earlier
// fees page, passed in as `fallback`.

function ClaimForm({ account, onSubmitted }) {
  const owing = useMemo(() => [...account.previousOutstanding, ...account.current.filter(charge => charge.balance > 0)], [account]);
  const [chosen, setChosen] = useState(() => new Set(owing.map(charge => charge.id)));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = id => setChosen(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function submit() {
    setBusy(true); setError('');
    try {
      const { claim } = await submitFeeClaim({ studentId: account.studentId, amount: Number(amount), method, reference, paidAt, note, obligationIds: [...chosen] });
      onSubmitted(claim);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!owing.length) return <p className="text-sm text-[#191970]">Nothing is owed, so there is nothing to claim.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[#191970]">Which fees did this payment cover?</p>
      <ul className="space-y-1">
        {owing.map(charge => (
          <li key={charge.id}><label className="flex items-center gap-2 text-sm text-[#191970]"><input type="checkbox" checked={chosen.has(charge.id)} onChange={() => toggle(charge.id)} />{charge.feeItem} · {charge.sessionName} {charge.termName} — {naira(charge.balance)} owed</label></li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Amount paid" type="number" min="0" placeholder="Amount paid" className={`${INPUT} w-40`} value={amount} onChange={event => setAmount(event.target.value)} />
        <select aria-label="How you paid" className={INPUT} value={method} onChange={event => setMethod(event.target.value)}><option value="transfer">Bank transfer</option><option value="cash">Cash</option><option value="pos">POS</option><option value="cheque">Cheque</option></select>
        <input aria-label="Reference" placeholder="Transfer reference" className={INPUT} value={reference} onChange={event => setReference(event.target.value)} />
        <input aria-label="Date paid" type="date" className={INPUT} value={paidAt} onChange={event => setPaidAt(event.target.value)} />
      </div>
      <textarea aria-label="Note" rows={2} placeholder="Anything the school should know (optional)" className={`${INPUT} w-full`} value={note} onChange={event => setNote(event.target.value)} />
      <Notice text={error} tone="error" />
      <button type="button" className={PRIMARY} disabled={busy || !Number(amount) || !chosen.size} onClick={submit}>{busy ? 'Sending…' : 'Submit claim'}</button>
    </div>
  );
}

function AccountPanel({ account, claims, onChanged }) {
  const [panel, setPanel] = useState('');
  const [payment, setPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [notice, setNotice] = useState('');
  const open = key => setPanel(previous => (previous === key ? '' : key));
  useEffect(() => { if (panel === 'pay' && !payment) getSchoolPaymentDetails().then(data => setPayment(data.paymentDetails || {})).catch(() => setPayment({})); }, [panel, payment]);
  const myClaims = claims.filter(claim => claim.studentId === account.studentId);

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Total outstanding" value={naira(account.totals.totalOutstanding)} />
          <Metric label="Previous outstanding" value={naira(account.totals.previousOutstanding)} hint="From earlier terms and sessions" />
          <Metric label="Current term" value={naira(account.totals.currentTermOutstanding)} hint={`of ${naira(account.totals.currentTermCharges)} charged`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={panel === 'breakdown' ? PRIMARY : SECONDARY} onClick={() => open('breakdown')}>View breakdown</button>
          <button type="button" className={panel === 'pay' ? PRIMARY : SECONDARY} onClick={() => open('pay')}>Pay</button>
          <button type="button" className={panel === 'claim' ? PRIMARY : SECONDARY} onClick={() => open('claim')}>Submit claim</button>
          <button type="button" className={panel === 'history' ? PRIMARY : SECONDARY} onClick={() => open('history')}>Payment history</button>
          <button type="button" className={panel === 'receipts' ? PRIMARY : SECONDARY} onClick={() => open('receipts')}>Receipts</button>
        </div>
        <Notice text={notice} />
      </section>

      {panel === 'breakdown' && (
        <>
          <section className={`${CARD} space-y-2`}><h4 className="font-black text-[#800000] dark:text-white">Previous outstanding fees</h4><ChargeTable charges={account.previousOutstanding} empty="No earlier balances." /></section>
          <section className={`${CARD} space-y-2`}><h4 className="font-black text-[#800000] dark:text-white">Current term</h4><ChargeTable charges={account.current} empty="No charges for this term yet." /></section>
        </>
      )}
      {panel === 'pay' && (
        <section className={`${CARD} space-y-2 text-[#191970] dark:text-slate-200`}>
          <h4 className="font-black text-[#800000] dark:text-white">How to pay</h4>
          {!payment ? <p role="status">Loading…</p> : payment.accountNumber ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="font-semibold">Bank</dt><dd>{payment.bankName}</dd>
              <dt className="font-semibold">Account name</dt><dd>{payment.accountName}</dd>
              <dt className="font-semibold">Account number</dt><dd className="font-mono text-base font-bold">{payment.accountNumber}</dd>
              {payment.paymentReferenceHint && <><dt className="font-semibold">Reference</dt><dd>{payment.paymentReferenceHint}</dd></>}
            </dl>
          ) : <p className="text-sm">The school has not published its payment account yet. Please ask the school office.</p>}
          {payment?.paymentInstructions && <p className="text-sm">{payment.paymentInstructions}</p>}
          <p className="text-sm">After paying, use <button type="button" className="font-bold text-[#800020] underline" onClick={() => setPanel('claim')}>Submit claim</button> so the school can confirm it and issue your receipt.</p>
        </section>
      )}
      {panel === 'claim' && (
        <section className={`${CARD} space-y-2`}>
          <h4 className="font-black text-[#800000] dark:text-white">Tell the school about a payment</h4>
          <ClaimForm account={account} onSubmitted={claim => { setPanel(''); setNotice(claim.status === 'auto_resolved' ? 'Those fees are already settled — no action needed.' : 'Claim sent. You will see it resolved here once the school confirms the payment.'); onChanged(); }} />
        </section>
      )}
      {panel === 'history' && (
        <section className={`${CARD} space-y-3`}>
          <h4 className="font-black text-[#800000] dark:text-white">Payment history</h4>
          <PaymentsTable payments={account.payments} receipts={account.receipts} onReceipt={setReceipt} />
          <h4 className="font-black text-[#800000] dark:text-white">Your claims</h4>
          {!myClaims.length ? <p className="text-sm text-[#191970] dark:text-slate-300">No claims.</p> : (
            <table className="w-full text-sm text-[#191970] dark:text-slate-200">
              <thead><tr><th className={TH}>Sent</th><th className={TH}>Amount</th><th className={TH}>Reference</th><th className={TH}>Status</th></tr></thead>
              <tbody>{myClaims.map(claim => <tr key={claim.id} className="border-t border-[#c9a96e]/30"><td className={TD}>{new Date(claim.createdAt).toLocaleDateString()}</td><td className={TD}>{naira(claim.amount)}</td><td className={TD}>{claim.reference || '—'}</td><td className={TD}><StatusChip status={claim.status} />{claim.status === 'rejected' && claim.resolutionNote ? <span className="block text-xs">{claim.resolutionNote}</span> : null}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}
      {panel === 'receipts' && (
        <section className={`${CARD} space-y-2`}>
          <h4 className="font-black text-[#800000] dark:text-white">Receipts</h4>
          {!account.receipts.length ? <p className="text-sm text-[#191970] dark:text-slate-300">No receipts yet.</p> : (
            <ul className="space-y-1">{account.receipts.map(item => (
              <li key={item.id}><button type="button" className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-left text-sm text-[#191970]" onClick={() => setReceipt(item)}>
                <span className="flex-1 font-semibold">{item.receiptNo}</span><span>{naira(item.snapshot?.amountPaid)}</span><span>{item.snapshot?.paidOn}</span>{item.status === 'reversed' && <StatusChip status="reversed" />}
              </button></li>
            ))}</ul>
          )}
        </section>
      )}
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

export default function ParentFeesPage({ fallback = null }) {
  const [data, setData] = useState(null);
  const [claims, setClaims] = useState([]);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState('');
  const load = useCallback(() => {
    getMyFeeAccounts().then(result => { setData(result); setSelected(previous => previous || result.accounts[0]?.studentId || ''); }).catch(() => setFailed(true));
    listFinanceClaims().then(result => setClaims(result.claims)).catch(() => setClaims([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (failed) return fallback;
  if (!data) return <p role="status" className="p-4">Loading fees…</p>;
  // Only schools billing through fee structures use this page; others keep the earlier one.
  const usesStructures = data.accounts.some(account => account.history.some(charge => charge.source === 'obligation'));
  if (!usesStructures && fallback) return fallback;
  const account = data.accounts.find(item => item.studentId === selected) || data.accounts[0];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Fees</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">School fees</h1>
        {data.accounts.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.accounts.map(item => <button key={item.studentId} type="button" onClick={() => setSelected(item.studentId)} className={item.studentId === account?.studentId ? PRIMARY : SECONDARY}>{item.studentName}</button>)}
          </div>
        )}
      </section>
      <BillingPeriodBanner period={data.period} />
      {account ? <AccountPanel key={account.studentId} account={account} claims={claims} onChanged={load} /> : <p className="text-sm">No children are linked to your account yet.</p>}
    </div>
  );
}

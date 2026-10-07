import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addChargeAdjustment, cancelCharge, getChargeHistory, getStudentAccount, naira, recordStudentPayment,
  reverseFinancePayment, searchFinanceStudents,
} from './financeApi';
import { CARD, ChargeTable, INPUT, Metric, Notice, PaymentsTable, PRIMARY, ReceiptDialog, SECONDARY, TD, TH } from './FinanceShared';

// One student's continuous ledger: this term's charges, earlier balances kept
// as their own obligations, payments allocated per charge, adjustments,
// reversals and receipts.

const ADJUSTMENT_KINDS = [['discount', 'Discount'], ['scholarship', 'Scholarship'], ['waiver', 'Waiver (clears what is owed)'], ['credit', 'Credit'], ['debit', 'Debit (adds to the charge)']];
const METHODS = [['cash', 'Cash'], ['transfer', 'Bank transfer'], ['pos', 'POS'], ['cheque', 'Cheque'], ['online', 'Online']];
const today = () => new Date().toISOString().slice(0, 10);

function PaymentForm({ account, onDone, prefill }) {
  const owing = useMemo(() => [...account.previousOutstanding, ...account.current.filter(charge => charge.balance > 0)], [account]);
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
  const [method, setMethod] = useState(prefill?.method || 'transfer');
  const [reference, setReference] = useState(prefill?.reference || '');
  const [payerName, setPayerName] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [shares, setShares] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const allocated = Object.values(shares).reduce((sum, value) => sum + (Number(value) || 0), 0);

  // Oldest first, within the charges ticked by the claim (if any).
  const fillOldestFirst = useCallback(() => {
    let left = Number(amount) || 0;
    const next = {};
    for (const charge of owing) {
      if (prefill?.obligationIds?.length && !prefill.obligationIds.includes(charge.id)) continue;
      if (left <= 0) break;
      const share = Math.min(charge.balance, left);
      next[charge.id] = String(Math.round(share * 100) / 100);
      left -= share;
    }
    setShares(next);
  }, [amount, owing, prefill]);

  async function submit() {
    setBusy(true); setError('');
    try {
      const allocations = Object.entries(shares).filter(([, value]) => Number(value) > 0).map(([obligationId, value]) => ({ obligationId, amount: Number(value) }));
      const result = await recordStudentPayment(account.studentId, { amount: Number(amount), method, reference, payerName, paidOn, allocations, claimId: prefill?.claimId, idempotencyKey });
      onDone(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!owing.length) return <p className="text-sm text-[#191970]">Nothing is owed on this account.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input aria-label="Amount received" type="number" min="0" placeholder="Amount received" className={`${INPUT} w-40`} value={amount} onChange={event => setAmount(event.target.value)} />
        <select aria-label="Method" className={INPUT} value={method} onChange={event => setMethod(event.target.value)}>{METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <input aria-label="Reference" placeholder="Reference / teller no." className={INPUT} value={reference} onChange={event => setReference(event.target.value)} />
        <input aria-label="Paid by" placeholder="Paid by" className={INPUT} value={payerName} onChange={event => setPayerName(event.target.value)} />
        <input aria-label="Date paid" type="date" className={INPUT} value={paidOn} onChange={event => setPaidOn(event.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm text-[#191970]">
          <thead><tr><th className={TH}>Pay towards</th><th className={TH}>Owed</th><th className={TH}>This payment</th></tr></thead>
          <tbody>{owing.map(charge => (
            <tr key={charge.id} className="border-t border-[#c9a96e]/30">
              <td className={TD}>{charge.feeItem}<span className="block text-xs">{charge.sessionName} · {charge.termName}</span></td>
              <td className={TD}>{naira(charge.balance)}</td>
              <td className={TD}><input aria-label={`Amount for ${charge.feeItem} ${charge.termName}`} type="number" min="0" max={charge.balance} className={`${INPUT} w-32`} value={shares[charge.id] || ''} onChange={event => setShares(previous => ({ ...previous, [charge.id]: event.target.value }))} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={SECONDARY} onClick={fillOldestFirst} disabled={!Number(amount)}>Fill oldest first</button>
        <span className={`text-sm font-bold ${Math.abs(allocated - (Number(amount) || 0)) < 0.005 ? 'text-[#1a5c38]' : 'text-rose-700'}`}>Allocated {naira(allocated)} of {naira(Number(amount) || 0)}</span>
      </div>
      <Notice text={error} tone="error" />
      <button type="button" className={PRIMARY} disabled={busy || !Number(amount) || Math.abs(allocated - Number(amount)) > 0.005} onClick={submit}>{busy ? 'Recording…' : 'Record payment & issue receipt'}</button>
    </div>
  );
}

function ChargePanel({ charge, context, onChanged, onClose }) {
  const [history, setHistory] = useState(null);
  const [kind, setKind] = useState('discount');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  useEffect(() => { getChargeHistory(charge.id).then(setHistory).catch(err => setNotice({ text: err.message, tone: 'error' })); }, [charge.id]);
  const act = async (action, text) => {
    try { await action(); setNotice({ text, tone: 'ok' }); setAmount(''); setReason(''); onChanged(); getChargeHistory(charge.id).then(setHistory); } catch (err) { setNotice({ text: err.message, tone: 'error' }); }
  };
  return (
    <section className={`${CARD} space-y-3`} aria-label={`${charge.feeItem} details`}>
      <div className="flex items-center gap-2"><h4 className="flex-1 font-black text-[#800000]">{charge.feeItem} · {charge.sessionName} {charge.termName}</h4><button type="button" className={SECONDARY} onClick={onClose}>Close</button></div>
      {charge.source === 'legacy' && <p className="text-sm text-[#191970]">This charge comes from Term Fees. Adjust it there; payments can be taken here.</p>}
      {context.canManage && charge.source !== 'legacy' && !['cancelled'].includes(charge.status) && (
        <div className="space-y-2 rounded-2xl bg-white/70 p-3">
          <p className="text-sm font-bold text-[#191970]">Adjust this charge (the original amount is kept)</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Adjustment type" className={INPUT} value={kind} onChange={event => setKind(event.target.value)}>{ADJUSTMENT_KINDS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            {kind !== 'waiver' && <input aria-label="Adjustment amount" type="number" min="0" placeholder="Amount" className={`${INPUT} w-32`} value={amount} onChange={event => setAmount(event.target.value)} />}
            <input aria-label="Reason" placeholder="Reason (required)" className={`${INPUT} flex-1`} value={reason} onChange={event => setReason(event.target.value)} />
            <button type="button" className={PRIMARY} disabled={!reason.trim()} onClick={() => act(() => addChargeAdjustment(charge.id, { kind, amount: Number(amount), reason }), 'Adjustment recorded.')}>Apply</button>
          </div>
          {context.canCancel && charge.amountPaid === 0 && <button type="button" className="text-xs font-bold text-rose-700 underline" disabled={!reason.trim()} onClick={() => act(() => cancelCharge(charge.id, reason), 'Charge cancelled.')}>Cancel this charge instead (uses the reason above)</button>}
        </div>
      )}
      <Notice text={notice.text} tone={notice.tone} />
      {!history ? <p role="status">Loading history…</p> : (
        <div className="grid gap-3 md:grid-cols-2 text-sm text-[#191970]">
          <div><p className="font-bold">Payments towards it</p>{history.allocations.length ? <ul className="mt-1 space-y-0.5">{history.allocations.map((row, index) => <li key={index}>{new Date(row.createdAt).toLocaleDateString()} · {naira(row.amount)} {row.amount < 0 ? '(reversal)' : ''} {row.reference}</li>)}</ul> : <p>None.</p>}</div>
          <div><p className="font-bold">Adjustments</p>{history.adjustments.length ? <ul className="mt-1 space-y-0.5">{history.adjustments.map((row, index) => <li key={index}>{new Date(row.createdAt).toLocaleDateString()} · {row.kind} {naira(row.amount)} — {row.reason} ({row.authorizedBy})</li>)}</ul> : <p>None.</p>}</div>
          <div className="md:col-span-2"><p className="font-bold">Audit</p><ul className="mt-1 space-y-0.5">{history.audit.map((row, index) => <li key={index}>{new Date(row.createdAt).toLocaleString()} · {row.action.replace(/_/g, ' ')} by {row.actorName || '—'}{row.reason ? ` — ${row.reason}` : ''}</li>)}</ul></div>
        </div>
      )}
    </section>
  );
}

function AccountView({ studentId, context, prefill, onPrefillUsed }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [openCharge, setOpenCharge] = useState(null);
  const [paying, setPaying] = useState(Boolean(prefill));
  const [receipt, setReceipt] = useState(null);
  const [reversing, setReversing] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getStudentAccount(studentId).then(setAccount).catch(err => setError(err.message)), [studentId]);
  useEffect(() => { setAccount(null); load(); }, [load]);

  if (error) return <Notice text={error} tone="error" />;
  if (!account) return <p role="status">Loading account…</p>;
  const actions = charge => <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setOpenCharge(charge)}>Details</button>;

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <h3 className="text-xl font-black text-[#800000] dark:text-white">{account.studentName}</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total outstanding" value={naira(account.totals.totalOutstanding)} />
          <Metric label="Earlier balances" value={naira(account.totals.previousOutstanding)} hint="From previous terms and sessions" />
          <Metric label="This term outstanding" value={naira(account.totals.currentTermOutstanding)} hint={`of ${naira(account.totals.currentTermCharges)} charged`} />
          <Metric label="Paid this term" value={naira(account.totals.paidThisTerm)} />
        </div>
        {context.canRecordPayments && <button type="button" className={PRIMARY} onClick={() => setPaying(value => !value)}>{paying ? 'Hide payment form' : 'Record a payment'}</button>}
        {paying && <div className="rounded-2xl bg-white/70 p-3"><PaymentForm account={account} prefill={prefill} onDone={result => { setPaying(false); onPrefillUsed?.(); setNotice(`Payment recorded. Receipt ${result.receipt?.receiptNo}.${result.resolvedClaims?.length ? ` ${result.resolvedClaims.length} claim(s) resolved.` : ''}`); setReceipt(result.receipt ? { ...result.receipt, status: 'valid' } : null); load(); }} /></div>}
        <Notice text={notice} />
      </section>
      {openCharge && <ChargePanel charge={openCharge} context={context} onChanged={load} onClose={() => setOpenCharge(null)} />}
      <section className={`${CARD} space-y-2`}><h4 className="font-black text-[#800000] dark:text-white">Previous outstanding fees</h4><ChargeTable charges={account.previousOutstanding} actions={actions} empty="No earlier balances." /></section>
      <section className={`${CARD} space-y-2`}><h4 className="font-black text-[#800000] dark:text-white">Current term charges</h4><ChargeTable charges={account.current} actions={actions} empty="No charges for this term yet." /></section>
      <section className={`${CARD} space-y-2`}>
        <h4 className="font-black text-[#800000] dark:text-white">Payments</h4>
        <PaymentsTable payments={account.payments} receipts={account.receipts} onReceipt={setReceipt} onReverse={context.canRecordPayments ? setReversing : null} />
        {reversing && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 p-3">
            <span className="text-sm font-bold text-rose-900">Reverse {naira(reversing.amount)} of {reversing.paidOn}? The payment stays on record.</span>
            <input aria-label="Reason for reversal" placeholder="Reason (required)" className={`${INPUT} flex-1`} value={reverseReason} onChange={event => setReverseReason(event.target.value)} />
            <button type="button" className={`${PRIMARY} !bg-rose-700`} disabled={!reverseReason.trim()} onClick={async () => {
              try { await reverseFinancePayment(reversing.id, reverseReason); setNotice('Payment reversed.'); setReversing(null); setReverseReason(''); load(); } catch (err) { setNotice(err.message); }
            }}>Reverse</button>
            <button type="button" className={SECONDARY} onClick={() => setReversing(null)}>Keep</button>
          </div>
        )}
      </section>
      <section className={`${CARD} space-y-2`}>
        <h4 className="font-black text-[#800000] dark:text-white">Full history</h4>
        <ChargeTable charges={account.history} actions={actions} empty="No charges yet." />
      </section>
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

export default function StudentAccountsTab({ context, focus, onFocusUsed }) {
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(focus?.studentId || '');
  useEffect(() => { if (focus?.studentId) setSelected(focus.studentId); }, [focus]);
  useEffect(() => {
    const timer = setTimeout(() => { searchFinanceStudents({ q, classId }).then(data => setStudents(data.students)).catch(() => setStudents([])); }, 250);
    return () => clearTimeout(timer);
  }, [q, classId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className={`${CARD} space-y-2`} aria-label="Find a student">
        <input aria-label="Search students" placeholder="Search by name…" className={`${INPUT} w-full`} value={q} onChange={event => setQ(event.target.value)} />
        <select aria-label="Class" className={`${INPUT} w-full`} value={classId} onChange={event => setClassId(event.target.value)}>
          <option value="">All classes</option>
          {context.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {students.map(student => (
            <li key={student.studentId}><button type="button" onClick={() => setSelected(student.studentId)} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${selected === student.studentId ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#191970]'}`}>{student.studentName || student.studentId}<span className="block text-xs opacity-80">{student.className}</span></button></li>
          ))}
        </ul>
      </aside>
      <div>{selected ? <AccountView key={selected} studentId={selected} context={context} prefill={focus?.studentId === selected ? focus.prefill : null} onPrefillUsed={onFocusUsed} /> : <p className="text-sm text-[#191970] dark:text-slate-300">Choose a student to see their account.</p>}</div>
    </div>
  );
}

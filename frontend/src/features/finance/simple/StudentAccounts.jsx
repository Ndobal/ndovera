import React, { useCallback, useEffect, useState } from 'react';
import { ReceiptDialog } from '../FinanceShared';
import {
  ACCOUNT_STATUS, addCharge, adjustAccount, billNewStudents, getAccount, listAccounts, naira, recordSimplePayment, reversePayment, settleClassMove,
} from './simpleFeesApi';

// The accountant's everyday screen: every student's balance, and each
// student's account written so a parent could follow it.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4] hover:bg-[#154a2e]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const TH = 'p-2 text-left text-xs font-bold uppercase text-[#800020]';
const METHODS = [['cash', 'Cash'], ['transfer', 'Transfer'], ['pos', 'POS'], ['online', 'Online']];

export function StatusChip({ status }) {
  const style = ACCOUNT_STATUS[status] || ACCOUNT_STATUS.unpaid;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${style.className}`}>{style.label}</span>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <div className="mb-3 flex items-center gap-2"><h2 className="flex-1 text-lg font-black text-[#800000]">{title}</h2><button type="button" aria-label="Close" className="text-xl font-bold text-[#800020]" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

/** Record a payment: student, amount, method, optional reference and note. Nothing else. */
export function RecordPaymentDialog({ student, presetAmount, claim, onClose, onDone }) {
  const [studentQuery, setStudentQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [chosen, setChosen] = useState(student || null);
  const [amount, setAmount] = useState(presetAmount ? String(presetAmount) : '');
  const [method, setMethod] = useState(claim?.method && METHODS.some(([key]) => key === claim.method) ? claim.method : 'cash');
  const [reference, setReference] = useState(claim?.reference || '');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key] = useState(() => `simple-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (chosen || !studentQuery.trim()) { setMatches([]); return undefined; }
    const timer = setTimeout(() => listAccounts({ q: studentQuery }).then(data => setMatches(data.accounts.slice(0, 8))).catch(() => setMatches([])), 250);
    return () => clearTimeout(timer);
  }, [studentQuery, chosen]);

  async function submit() {
    setBusy(true); setError('');
    try {
      const result = await recordSimplePayment(chosen.studentId, { amount: Number(amount), method, reference, paidOn, note, idempotencyKey: key, claimId: claim?.id });
      onDone(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="space-y-3">
        {chosen ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#fff6e0] px-3 py-2">
            <span className="flex-1 font-bold">{chosen.studentName} {chosen.className ? <span className="font-normal">· {chosen.className}</span> : null}</span>
            {chosen.balance !== undefined && <span className="text-sm">Balance {naira(chosen.balance)}</span>}
            {!student && <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setChosen(null)}>Change</button>}
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold uppercase text-[#800020]">Student<input autoFocus className={FIELD} value={studentQuery} onChange={event => setStudentQuery(event.target.value)} placeholder="Type a name…" /></label>
            <ul className="mt-1 space-y-1">{matches.map(item => <li key={item.studentId}><button type="button" className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm hover:bg-[#fff6e0]" onClick={() => setChosen(item)}>{item.studentName} · {item.className} · balance {naira(item.balance)}</button></li>)}</ul>
          </div>
        )}
        <label className="block text-xs font-bold uppercase text-[#800020]">Amount (₦)<input type="number" min="0" className={`${FIELD} text-lg font-bold`} value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
          {METHODS.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={method === value} className={method === value ? PRIMARY : SECONDARY} onClick={() => setMethod(value)}>{label}</button>)}
        </div>
        <label className="block text-xs font-bold uppercase text-[#800020]">Reference (optional)<input className={FIELD} value={reference} onChange={event => setReference(event.target.value)} /></label>
        <label className="block text-xs font-bold uppercase text-[#800020]">Date<input type="date" className={FIELD} value={paidOn} onChange={event => setPaidOn(event.target.value)} /></label>
        <label className="block text-xs font-bold uppercase text-[#800020]">Note (optional)<input className={FIELD} value={note} onChange={event => setNote(event.target.value)} /></label>
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        <button type="button" className={`${PRIMARY} w-full`} disabled={busy || !chosen || !(Number(amount) > 0)} onClick={submit}>{busy ? 'Recording…' : 'Record Payment'}</button>
        <p className="text-xs">The balance updates and a receipt is issued straight away. Earlier balances are paid first.</p>
      </div>
    </Modal>
  );
}

function AdjustDialog({ kind, studentId, onClose, onDone }) {
  const isCharge = kind === 'charge';
  const [type, setType] = useState(kind === 'credit' ? 'credit' : 'discount');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      if (isCharge) await addCharge(studentId, { description, amount: Number(amount), reason: reason || description });
      else await adjustAccount(studentId, { kind: type, amount: Number(amount), reason });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={isCharge ? 'Add Charge' : kind === 'credit' ? 'Add Credit' : 'Give Discount'} onClose={onClose}>
      <div className="space-y-3">
        {isCharge ? (
          <label className="block text-xs font-bold uppercase text-[#800020]">What for<input className={FIELD} value={description} onChange={event => setDescription(event.target.value)} placeholder="e.g. Lost textbook" /></label>
        ) : kind !== 'credit' && (
          <div className="flex flex-wrap gap-2">
            {[['discount', 'Discount'], ['scholarship', 'Scholarship'], ['waiver', 'Waive this term']].map(([value, label]) => <button key={value} type="button" className={type === value ? PRIMARY : SECONDARY} onClick={() => setType(value)}>{label}</button>)}
          </div>
        )}
        {type !== 'waiver' && <label className="block text-xs font-bold uppercase text-[#800020]">Amount (₦)<input type="number" min="0" className={FIELD} value={amount} onChange={event => setAmount(event.target.value)} /></label>}
        <label className="block text-xs font-bold uppercase text-[#800020]">Reason (required — kept in the audit trail)<input className={FIELD} value={reason} onChange={event => setReason(event.target.value)} placeholder={kind === 'credit' ? 'e.g. Previous overpayment' : isCharge ? 'Optional if the description says it' : 'e.g. Merit scholarship'} /></label>
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        <button type="button" className={`${PRIMARY} w-full`} disabled={busy || (isCharge ? !description.trim() || !(Number(amount) > 0) : !reason.trim() || (type !== 'waiver' && !(Number(amount) > 0)))} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function printStatement(data) {
  const s = data.statement;
  const rows = s.lines.map(line => `<tr><td>${line.date || ''}</td><td>${line.description}</td><td style="text-align:right">${line.charge ? naira(line.charge) : '—'}</td><td style="text-align:right">${line.credit ? naira(line.credit) : '—'}</td></tr>`).join('');
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  win.document.write(`<html><head><title>Statement — ${data.student.studentName}</title><style>body{font-family:Arial,sans-serif;color:#191970;padding:24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}h1{color:#800000}</style></head><body>
    <h1>${data.student.studentName} — ${data.student.className || ''}</h1><p>${data.term.sessionName} · ${data.term.name} fee statement</p>
    <p><b>Amount payable:</b> ${naira(s.totalPayable)} &nbsp; <b>Paid:</b> ${naira(s.paid)} &nbsp; <b>Balance:</b> ${naira(s.balance)}</p>
    <table><thead><tr><th>Date</th><th>Description</th><th>Charge</th><th>Paid / Adjustment</th></tr></thead><tbody>${rows}
    <tr><td></td><td><b>Balance</b></td><td></td><td style="text-align:right"><b>${naira(s.balance)}</b></td></tr></tbody></table>
    <script>window.onload = () => window.print()</script></body></html>`);
  win.document.close();
}

export function StudentAccount({ studentId, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getAccount(studentId).then(setData).catch(err => setError(err.message)), [studentId]);
  useEffect(() => { load(); }, [load]);
  const changed = message => { setDialog(''); setNotice(message); load(); onChanged?.(); };

  if (error) return <p role="alert" className="font-semibold text-rose-700">{error}</p>;
  if (!data) return <p role="status">Loading account…</p>;
  const s = data.statement;
  return (
    <div className="space-y-4">
      <button type="button" className={SECONDARY} onClick={onBack}>← All students</button>
      <section className={`${CARD} space-y-3`}>
        <h2 className="text-2xl font-black text-[#800000] dark:text-white">{data.student.studentName} <span className="text-base font-semibold text-[#191970] dark:text-slate-300">— {data.student.className}</span></h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-3"><p className="text-xs font-bold uppercase text-[#800020]">Amount Payable</p><p className="text-2xl font-black text-[#191970]">{naira(s.totalPayable)}</p></div>
          <div className="rounded-2xl bg-white p-3"><p className="text-xs font-bold uppercase text-[#800020]">Paid</p><p className="text-2xl font-black text-[#1a5c38]">{naira(s.paid)}</p></div>
          <div className="rounded-2xl bg-white p-3"><p className="text-xs font-bold uppercase text-[#800020]">Balance</p><p className={`text-2xl font-black ${s.balance > 0 ? 'text-rose-700' : 'text-[#191970]'}`}>{naira(s.balance)}</p><StatusChip status={s.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.canRecordPayments && <button type="button" className={PRIMARY} disabled={data.unbilled} onClick={() => setDialog('pay')}>Record Payment</button>}
          {data.canAdjust && <button type="button" className={SECONDARY} disabled={data.unbilled} onClick={() => setDialog('charge')}>Add Charge</button>}
          {data.canAdjust && <button type="button" className={SECONDARY} disabled={data.unbilled} onClick={() => setDialog('discount')}>Give Discount</button>}
          {data.canAdjust && <button type="button" className={SECONDARY} disabled={data.unbilled} onClick={() => setDialog('credit')}>Credit</button>}
          <button type="button" className={SECONDARY} onClick={() => printStatement(data)}>Print Statement</button>
        </div>
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#1a5c38]">{notice}</p>}
      </section>

      {data.unbilled && (
        <section className="space-y-2 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
          <p className="font-bold">{data.student.studentName} has no fee account for {data.term.name} yet.</p>
          <p className="text-sm">{data.student.className} standard term fee: <strong>{naira(data.standardFee)}</strong></p>
          {data.canAdjust && <button type="button" className={PRIMARY} onClick={async () => { try { await billNewStudents([studentId]); changed('Fee account created. Add any charges or discounts below.'); } catch (err) { setError(err.message); } }}>Create Fee Account</button>}
        </section>
      )}

      {data.classMove && data.canAdjust && (
        <section className="space-y-2 rounded-3xl border-2 border-sky-300 bg-sky-50 p-5 text-sky-950">
          <p className="font-bold">{data.student.studentName} moved class this term. Their fees were set for the previous class.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SECONDARY} onClick={async () => { await settleClassMove(studentId, 'keep'); changed('Kept the existing term fees.'); }}>Keep existing term fees</button>
            <button type="button" className={PRIMARY} onClick={async () => { await settleClassMove(studentId, 'difference'); changed(`Applied the ${data.student.className} fee difference.`); }}>Apply {data.student.className} fee difference</button>
            <button type="button" className={SECONDARY} onClick={async () => { await settleClassMove(studentId, 'custom'); setDialog('charge'); }}>Custom adjustment</button>
          </div>
        </section>
      )}

      <section className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm text-[#191970] dark:text-slate-200">
            <thead><tr><th className={TH}>Description</th><th className={`${TH} text-right`}>Charge</th><th className={`${TH} text-right`}>Paid / Adjustment</th></tr></thead>
            <tbody>
              {s.lines.map((line, index) => (
                <React.Fragment key={index}>
                  <tr className="border-t border-[#c9a96e]/30">
                    <td className="p-2">
                      {line.kind === 'outstanding' ? <button type="button" className="font-bold text-[#800020] underline" onClick={() => setShowHistory(open => !open)}>Outstanding Fee {showHistory ? '▾' : '▸'}</button> : line.description}
                      {line.date && line.kind !== 'fee' ? <span className="ml-2 text-xs text-slate-500">{line.date}</span> : null}
                    </td>
                    <td className="p-2 text-right">{line.charge ? naira(line.charge) : '—'}</td>
                    <td className="p-2 text-right">{line.credit ? naira(line.credit) : '—'}</td>
                  </tr>
                  {line.kind === 'outstanding' && showHistory && (
                    <tr><td colSpan={3} className="bg-white/70 p-2">
                      <table className="w-full text-xs"><thead><tr><th className="text-left">Source</th><th className="text-right">Original</th><th className="text-right">Carried forward</th></tr></thead>
                        <tbody>{s.outstandingSources.map((source, i) => <tr key={i}><td>{source.sessionName} {source.termName} — {source.feeItem}</td><td className="text-right">{naira(source.original)}</td><td className="text-right">{naira(source.carriedForward)}</td></tr>)}
                          <tr className="font-bold"><td>Total Outstanding</td><td /><td className="text-right">{naira(s.outstanding)}</td></tr></tbody></table>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
              <tr className="border-t-2 border-[#191970] font-black"><td className="p-2">Balance</td><td /><td className="p-2 text-right">{naira(s.balance)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {data.payments?.length > 0 && (
        <section className={CARD}>
          <h3 className="mb-2 font-black text-[#800000] dark:text-white">Payments & receipts</h3>
          <ul className="space-y-1 text-sm text-[#191970] dark:text-slate-200">
            {data.payments.map(payment => {
              const paymentReceipt = data.receipts.find(item => item.paymentId === payment.id);
              return (
                <li key={payment.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2">
                  <span className="flex-1">{payment.paidOn} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}{payment.status !== 'confirmed' ? ` · ${payment.status}` : ''}</span>
                  <span className="font-bold">{naira(payment.amount)}</span>
                  {paymentReceipt && <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setReceipt(paymentReceipt)}>Receipt</button>}
                  {data.canRecordPayments && payment.status === 'confirmed' && <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={async () => {
                    const reason = window.prompt?.('Why is this payment being reversed?');
                    if (!reason) return;
                    try { await reversePayment(payment.id, reason); changed('Payment reversed. It stays on record beside the reversal.'); } catch (err) { setError(err.message); }
                  }}>Reverse</button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {dialog === 'pay' && <RecordPaymentDialog student={{ studentId, studentName: data.student.studentName, className: data.student.className, balance: s.balance }} onClose={() => setDialog('')} onDone={result => { changed(`Payment recorded. Receipt ${result.receipt?.receiptNo || ''}.`); setReceipt(result.receipt ? { ...result.receipt, status: 'valid' } : null); }} />}
      {['charge', 'discount', 'credit'].includes(dialog) && <AdjustDialog kind={dialog} studentId={studentId} onClose={() => setDialog('')} onDone={() => changed('Saved and recorded in the audit trail.')} />}
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

export default function StudentAccounts({ classes, initialStudentId, onChanged }) {
  const [filters, setFilters] = useState({ q: '', classId: '', status: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(initialStudentId || '');
  const load = useCallback(() => listAccounts(filters).then(setData).catch(err => setError(err.message)), [filters]);
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (initialStudentId) setOpen(initialStudentId); }, [initialStudentId]);

  if (open) return <StudentAccount studentId={open} onBack={() => { setOpen(''); load(); }} onChanged={onChanged} />;
  return (
    <div className="space-y-4">
      <section className={`${CARD} flex flex-wrap gap-2`}>
        <input aria-label="Search student" className={`${FIELD} max-w-xs`} placeholder="Search student…" value={filters.q} onChange={event => setFilters(previous => ({ ...previous, q: event.target.value }))} />
        <select aria-label="Class" className={`${FIELD} max-w-[12rem]`} value={filters.classId} onChange={event => setFilters(previous => ({ ...previous, classId: event.target.value }))}>
          <option value="">All Classes</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Status" className={`${FIELD} max-w-[12rem]`} value={filters.status} onChange={event => setFilters(previous => ({ ...previous, status: event.target.value }))}>
          <option value="">Everyone</option><option value="owing">Owing</option><option value="unpaid">Unpaid</option><option value="part_payment">Part Payment</option><option value="paid">Paid</option><option value="overpaid">Overpaid</option><option value="not_billed">No account yet</option>
        </select>
      </section>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}
      <section className={CARD}>
        {!data ? <p role="status">Loading…</p> : !data.accounts.length ? <p className="text-sm text-[#191970] dark:text-slate-300">No students match.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm text-[#191970] dark:text-slate-200">
              <thead><tr><th className={TH}>Student</th><th className={TH}>Class</th><th className={`${TH} text-right`}>Term Fee</th><th className={`${TH} text-right`}>Outstanding</th><th className={`${TH} text-right`}>Total Payable</th><th className={`${TH} text-right`}>Paid</th><th className={`${TH} text-right`}>Balance</th><th className={TH}>Status</th><th className={TH}><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {data.accounts.map(account => (
                  <tr key={account.studentId} className="border-t border-[#c9a96e]/30 hover:bg-white/50">
                    <td className="p-2 font-semibold">{account.studentName}{account.classMove ? <span className="ml-1 text-xs text-sky-700">(moved class)</span> : null}</td>
                    <td className="p-2">{account.className}</td>
                    <td className="p-2 text-right">{naira(account.termFee)}</td>
                    <td className="p-2 text-right">{account.outstanding ? naira(account.outstanding) : '—'}</td>
                    <td className="p-2 text-right">{naira(account.totalPayable)}</td>
                    <td className="p-2 text-right">{naira(account.paid)}</td>
                    <td className="p-2 text-right font-black">{naira(account.balance)}</td>
                    <td className="p-2"><StatusChip status={account.status} /></td>
                    <td className="p-2"><button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setOpen(account.studentId)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

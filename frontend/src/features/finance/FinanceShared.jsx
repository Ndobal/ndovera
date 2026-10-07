import React from 'react';
import { STATUS_LABELS, STATUS_STYLES, naira } from './financeApi';

export const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
export const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
export const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4] hover:bg-[#154a2e]`;
export const SECONDARY = `${BTN} bg-white text-[#800020] border border-[#c9a96e]/50`;
export const INPUT = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
export const TH = 'p-2 text-left text-xs font-bold uppercase text-[#800020]';
export const TD = 'p-2 align-top';

export function StatusChip({ status }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-800'}`}>{STATUS_LABELS[status] || status}</span>;
}

export function Notice({ text, tone = 'ok' }) {
  if (!text) return null;
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-[#1a5c38]'}`}>{text}</p>;
}

export function Metric({ label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl bg-white/80 p-4 text-left shadow-sm ${onClick ? 'hover:ring-2 hover:ring-[#800020]/40' : ''}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#800020]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#191970]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#191970]/70">{hint}</p>}
    </Tag>
  );
}

export function BillingPeriodBanner({ period }) {
  if (!period) return null;
  return period.configured ? (
    <div className="rounded-2xl bg-[#191970] px-4 py-3 text-[#b5e3f4]" role="status">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a96e]">Active billing period</p>
      <p className="text-lg font-black">{period.sessionName} · {period.termName}</p>
    </div>
  ) : (
    <div className="rounded-2xl bg-amber-100 px-4 py-3 text-amber-900" role="status">
      <p className="text-sm font-bold">No term is open. Open a session and term in Academic Sessions before issuing bills.</p>
    </div>
  );
}

/** A table of charges: fee item, period, amounts and status, with optional per-row actions. */
export function ChargeTable({ charges, actions, empty = 'Nothing here.' }) {
  if (!charges?.length) return <p className="text-sm text-[#191970]/80 dark:text-slate-300">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm text-[#191970] dark:text-slate-200">
        <thead><tr><th className={TH}>Fee</th><th className={TH}>Period</th><th className={TH}>Charged</th><th className={TH}>Adjustments</th><th className={TH}>Paid</th><th className={TH}>Balance</th><th className={TH}>Status</th>{actions && <th className={TH}><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>
          {charges.map(charge => (
            <tr key={charge.id} className="border-t border-[#c9a96e]/30">
              <td className={TD}><span className="font-semibold">{charge.feeItem}</span>{charge.source === 'legacy' && <span className="ml-1 text-xs text-[#191970]/60">(earlier record)</span>}{charge.frequency === 'annual' && <span className="ml-1 text-xs text-[#191970]/60">(annual)</span>}</td>
              <td className={TD}>{charge.sessionName} · {charge.termName}{charge.className ? <span className="block text-xs text-[#191970]/60">{charge.className}</span> : null}</td>
              <td className={TD}>{naira(charge.amount)}</td>
              <td className={TD}>{charge.adjustmentsTotal ? naira(charge.adjustmentsTotal) : '—'}</td>
              <td className={TD}>{naira(charge.amountPaid)}</td>
              <td className={`${TD} font-bold`}>{naira(charge.balance)}</td>
              <td className={TD}><StatusChip status={charge.status} /></td>
              {actions && <td className={`${TD} whitespace-nowrap`}>{actions(charge)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A receipt, exactly as it was when issued. */
export function ReceiptDialog({ receipt, schoolName, onClose }) {
  if (!receipt) return null;
  const snap = receipt.snapshot || {};
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#191970]/60 p-4" role="dialog" aria-modal="true" aria-label={`Receipt ${receipt.receiptNo}`}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-[#191970] shadow-2xl print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            {schoolName && <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{schoolName}</p>}
            <h2 className="text-xl font-black">Receipt {receipt.receiptNo}</h2>
            <p className="text-xs">Issued {new Date(snap.issuedAt || receipt.createdAt).toLocaleString()}{snap.recordedBy ? ` by ${snap.recordedBy}` : ''}</p>
          </div>
          {receipt.status === 'reversed' && <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase text-rose-800">Reversed</span>}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="font-semibold">Student</dt><dd>{snap.studentName || snap.studentId}</dd>
          {snap.payerName && <><dt className="font-semibold">Paid by</dt><dd>{snap.payerName}</dd></>}
          <dt className="font-semibold">Date paid</dt><dd>{snap.paidOn}</dd>
          <dt className="font-semibold">Method</dt><dd>{snap.method}{snap.reference ? ` · ${snap.reference}` : ''}</dd>
          {snap.period && <><dt className="font-semibold">Billing period</dt><dd>{snap.period.sessionName} · {snap.period.termName}</dd></>}
        </dl>
        <table className="mt-4 w-full text-sm">
          <thead><tr><th className={TH}>Paid for</th><th className={TH}>Amount</th><th className={TH}>Left on it</th></tr></thead>
          <tbody>{(snap.items || []).map((item, index) => (
            <tr key={index} className="border-t border-slate-200"><td className={TD}>{item.feeItem}<span className="block text-xs text-slate-500">{item.sessionName} · {item.termName}</span></td><td className={TD}>{naira(item.amount)}</td><td className={TD}>{naira(item.balanceAfter)}</td></tr>
          ))}</tbody>
        </table>
        <dl className="mt-4 grid grid-cols-2 gap-1 border-t border-slate-200 pt-3 text-sm">
          <dt>Balance before</dt><dd className="text-right">{naira(snap.previousBalance)}</dd>
          <dt className="font-bold">Amount paid</dt><dd className="text-right font-bold">{naira(snap.amountPaid)}</dd>
          <dt>Balance remaining</dt><dd className="text-right">{naira(snap.remainingBalance)}</dd>
        </dl>
        <div className="mt-5 flex justify-end gap-2 print:hidden">
          <button type="button" className={SECONDARY} onClick={() => window.print()}>Print</button>
          <button type="button" className={PRIMARY} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function PaymentsTable({ payments, onReverse, onReceipt, receipts = [] }) {
  if (!payments?.length) return <p className="text-sm text-[#191970]/80 dark:text-slate-300">No payments yet.</p>;
  const receiptFor = paymentId => receipts.find(receipt => receipt.paymentId === paymentId);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm text-[#191970] dark:text-slate-200">
        <thead><tr><th className={TH}>Date</th><th className={TH}>Amount</th><th className={TH}>Method</th><th className={TH}>Recorded by</th><th className={TH}>Status</th><th className={TH}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {payments.map(payment => {
            const receipt = receiptFor(payment.id);
            return (
              <tr key={payment.id} className="border-t border-[#c9a96e]/30">
                <td className={TD}>{payment.paidOn}</td>
                <td className={`${TD} font-semibold`}>{naira(payment.amount)}</td>
                <td className={TD}>{payment.method}{payment.reference ? <span className="block text-xs">{payment.reference}</span> : null}</td>
                <td className={TD}>{payment.recordedBy || '—'}</td>
                <td className={TD}><StatusChip status={payment.status} />{payment.reversalReason ? <span className="block text-xs">{payment.reversalReason}</span> : null}</td>
                <td className={`${TD} whitespace-nowrap space-x-2`}>
                  {receipt && onReceipt && <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => onReceipt(receipt)}>Receipt</button>}
                  {onReverse && payment.status === 'confirmed' && <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={() => onReverse(payment)}>Reverse</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

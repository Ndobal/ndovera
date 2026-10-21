import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMyTenant } from '../school/services/schoolApi';
import { getMyTermBills } from '../tenants/services/tenantApi';

// The school's account with Ndovera: what is owed (with Pay now), every invoice and receipt,
// the plan and rate, earlier payments, and where to buy credits and student bundles.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/50';
export const nairaAmount = value => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const shortDate = value => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Sent, unpaid Ndovera bills: the total, the earliest due date and whether one is overdue. */
export function outstandingOf(bills = []) {
  const open = bills.filter(bill => bill.status !== 'paid' && bill.status !== 'draft').sort((a, b) => String(a.graceUntil || a.dueAt || '').localeCompare(String(b.graceUntil || b.dueAt || '')));
  const total = open.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const dueAt = open[0]?.graceUntil || open[0]?.dueAt || null;
  const overdue = Boolean(dueAt && new Date(dueAt) <= new Date());
  return { open, total, dueAt, overdue, payUrl: open.find(bill => bill.payUrl)?.payUrl || '' };
}

/**
 * This term's Ndovera fee in words. It is paid only when this term's own bill is paid
 * (Flutterwave or Ndovera recorded it); onboarding and earlier terms never count.
 */
export function termFeeView(currentTerm) {
  if (!currentTerm || currentTerm.status === 'unknown') return null;
  const period = [currentTerm.term, currentTerm.session].filter(Boolean).join(', ');
  const amount = Number(currentTerm.amount || currentTerm.estimate?.amount || 0);
  if (currentTerm.status === 'paid') return { paid: true, period, amount, text: `${period}: paid${currentTerm.paidAt ? ` on ${shortDate(currentTerm.paidAt)}` : ''}.` };
  if (currentTerm.status === 'not_invoiced') {
    return { paid: false, period, amount, estimated: !currentTerm.amount, text: `${period}: not paid yet. Ndovera will send this term's invoice${amount ? ` (about ${nairaAmount(amount)})` : ''}; you can pay online once it arrives.` };
  }
  return { paid: false, period, amount, overdue: currentTerm.status === 'overdue', text: `${period}: not paid${currentTerm.dueAt ? `, due by ${shortDate(currentTerm.dueAt)}` : ''}.` };
}

function StatusPill({ status, overdue }) {
  const label = status === 'paid' ? 'Paid' : overdue ? 'Overdue' : 'Due';
  const tone = status === 'paid' ? 'bg-emerald-100 text-emerald-800' : overdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900';
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}

export default function SubscriptionPage() {
  const location = useLocation();
  const role = location.pathname.split('/')[2] || 'owner';
  const [bills, setBills] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getMyTermBills().then(result => { setBills(result.bills || []); setCurrentTerm(result.currentTerm || null); }),
      getMyTenant().then(setTenantData).catch(() => null),
    ]).catch(err => setError(err.message || 'Could not load your subscription.')).finally(() => setLoading(false));
  }, []);

  const { open, total, dueAt, overdue, payUrl } = outstandingOf(bills);
  const termFee = termFeeView(currentTerm);
  const unpaidTerm = termFee && !termFee.paid;
  const tenant = tenantData?.tenant;
  const quote = tenantData?.quote;
  const payments = tenantData?.payments || [];
  const rate = Number(quote?.studentFeePerTerm || quote?.userFeePerTerm || tenant?.studentFeePerTerm || 0);
  const students = Number(quote?.billableUserCount ?? tenant?.billableUserCount ?? tenant?.studentCount ?? 0);

  const extras = [
    { title: 'WhatsApp & SMS credits', text: 'Message units for parent notifications by WhatsApp and SMS.', to: `/roles/${role}/communications`, cta: 'Buy message credits' },
    { title: 'Ndovera AI credits', text: 'Credits for AI lesson materials, assessments and the AI assistant.', to: '/ai-tutor', cta: 'Top up AI credits' },
    { title: 'Student practice bundles', text: 'Practice passes for WAEC, NECO, JAMB, BECE and Common Entrance, by subject.', to: `/roles/${role}/practice-passes`, cta: 'Buy student bundles' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] text-white shadow-lg">
        <div className="h-2 bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]" />
        <div className="flex flex-wrap items-center gap-4 p-5">
          <img src={`${process.env.PUBLIC_URL || ''}/apple-touch-icon.png`} alt="" className="h-14 w-14 rounded-2xl bg-white p-1" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">Ndovera subscription</p>
            <h1 className="text-2xl font-black">{tenant?.schoolName || 'Your school'}</h1>
            <p className="text-sm text-[#b5e3f4]">Bills from Ndovera, receipts, and credits for your school.</p>
          </div>
        </div>
      </header>

      {loading ? <p className={CARD}>Loading…</p> : null}
      {error ? <p role="alert" className="rounded-2xl bg-rose-100 p-4 font-semibold text-rose-900">{error}</p> : null}

      {!loading && (
        <section className={`${CARD} ${open.length || unpaidTerm ? (overdue ? 'border-rose-400 bg-rose-50' : 'border-amber-300 bg-amber-50') : ''}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#800020]">Balance due to Ndovera</p>
              <p className={`text-3xl font-black ${open.length ? 'text-[#800000]' : 'text-[#1a5c38]'}`}>{nairaAmount(total)}</p>
              <p className="text-sm text-[#191970]">
                {open.length
                  ? (overdue ? `Overdue since ${shortDate(dueAt)}. The Owner, HoS and ICT accounts are locked until it is paid.` : `Due by ${shortDate(dueAt)}.`)
                  : unpaidTerm ? 'No invoice has been sent for this term yet.' : 'Nothing is due. Thank you.'}
              </p>
              {termFee ? <p className={`mt-1 text-sm font-bold ${termFee.paid ? 'text-[#1a5c38]' : 'text-[#800000]'}`}>This term — {termFee.text}</p> : null}
            </div>
            {payUrl ? <a href={payUrl} className="rounded-full bg-[#1a5c38] px-6 py-3 text-base font-black text-white shadow">Pay now</a> : null}
          </div>
        </section>
      )}

      {!loading && (
        <section className={CARD}>
          <h2 className="mb-3 text-lg font-black text-[#800000]">Invoices and receipts</h2>
          {bills.length === 0 ? <p className="text-sm text-[#191970]">No invoices from Ndovera yet.</p> : (
            <ul className="space-y-2">
              {bills.map(bill => {
                const late = bill.status !== 'paid' && (bill.graceUntil || bill.dueAt) && new Date(bill.graceUntil || bill.dueAt) <= new Date();
                return (
                  <li key={bill.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#c9a96e]/30 bg-white/80 p-3 dark:bg-slate-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#191970] dark:text-slate-100">{bill.invoiceNo || 'Term bill'} · {[bill.term, bill.session].filter(Boolean).join(', ')}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {nairaAmount(bill.amount)} · {bill.status === 'paid' ? `paid ${shortDate(bill.paidAt)}${bill.receiptNo ? ` · receipt ${bill.receiptNo}` : ''}` : `due ${shortDate(bill.graceUntil || bill.dueAt)}`}
                      </p>
                    </div>
                    <StatusPill status={bill.status} overdue={late} />
                    {bill.viewUrl ? <a href={bill.viewUrl} className="rounded-xl bg-[#191970] px-3 py-1.5 text-xs font-bold text-[#c9a96e]">{bill.status === 'paid' ? 'View receipt' : 'View invoice'}</a> : null}
                    {bill.payUrl ? <a href={bill.payUrl} className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white">Pay now</a> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {!loading && (
        <section className={CARD}>
          <h2 className="mb-3 text-lg font-black text-[#800000]">Your plan</h2>
          <div className="grid grid-cols-1 gap-4 text-sm text-[#191970] sm:grid-cols-4">
            <div><p className="text-xs font-bold uppercase text-[#800020]">Plan</p><p>{quote?.planName || tenant?.planKey || '—'}</p></div>
            <div><p className="text-xs font-bold uppercase text-[#800020]">Per student, per term</p><p>{rate ? nairaAmount(rate) : '—'}</p></div>
            <div><p className="text-xs font-bold uppercase text-[#800020]">Active students</p><p>{students}</p></div>
            <div><p className="text-xs font-bold uppercase text-[#800020]">This term (estimate)</p><p>{rate && students ? nairaAmount(rate * students) : '—'}</p></div>
          </div>
          <p className="mt-2 text-xs text-slate-600">Ndovera bills per active student each term. Staff, teachers and parents are not charged.</p>
        </section>
      )}

      <section className={CARD}>
        <h2 className="mb-3 text-lg font-black text-[#800000]">Credits and bundles</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {extras.map(item => (
            <div key={item.title} className="flex flex-col rounded-2xl border border-[#c9a96e]/40 bg-[#fff8ef] p-4 dark:bg-slate-800/60">
              <p className="font-black text-[#191970] dark:text-slate-100">{item.title}</p>
              <p className="mt-1 flex-1 text-xs text-slate-600 dark:text-slate-300">{item.text}</p>
              <Link to={item.to} className="mt-3 rounded-xl bg-[#800020] px-3 py-2 text-center text-sm font-bold text-[#b5e3f4]">{item.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {!loading && payments.length > 0 && (
        <section className={CARD}>
          <h2 className="mb-3 text-lg font-black text-[#800000]">Earlier payments</h2>
          <ul className="space-y-2">
            {payments.map((payment, index) => (
              <li key={payment.id || payment.txRef || index} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 p-3 text-sm text-[#191970]">
                <span className="font-semibold">{payment.txRef || 'Payment'}</span>
                <span>{nairaAmount(payment.amount || (payment.amountCents || 0) / 100)}</span>
                <span className="text-xs">{shortDate(payment.paidAt || payment.createdAt)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{payment.status || '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyTermBills } from '../tenants/services/tenantApi';
import { nairaAmount, outstandingOf, shortDate, termFeeView } from './SubscriptionPage';

/** On the overview: what the school owes Ndovera, with Pay now and More (the Subscription page). */
export default function SubscriptionSummaryCard({ role = 'owner' }) {
  const [bills, setBills] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyTermBills().then(result => { if (!cancelled) { setBills(result.bills || []); setCurrentTerm(result.currentTerm || null); } }).catch(() => { if (!cancelled) setBills([]); });
    return () => { cancelled = true; };
  }, []);

  if (bills === null) return null;
  const { open, total, dueAt, overdue, payUrl } = outstandingOf(bills);
  // "All paid" only when this term's own fee is paid, never because no bill exists yet.
  const termFee = termFeeView(currentTerm);
  const unpaidTerm = !open.length && termFee && !termFee.paid;
  const tone = unpaidTerm ? 'border-amber-300 bg-amber-50' : !open.length ? 'border-emerald-300 bg-emerald-50' : overdue ? 'border-rose-400 bg-rose-50' : 'border-amber-300 bg-amber-50';
  const headline = open.length ? `${nairaAmount(total)} due` : unpaidTerm ? 'Term fee not paid' : termFee?.paid ? 'All paid' : 'Nothing due';

  return (
    <section aria-label="Ndovera subscription" className={`flex flex-wrap items-center gap-4 rounded-3xl border-2 p-4 shadow-sm ${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#800020]">Ndovera subscription</p>
        <p className={`text-2xl font-black ${open.length || unpaidTerm ? 'text-[#800000]' : 'text-[#1a5c38]'}`}>{headline}</p>
        <p className="text-sm text-[#191970]">
          {open.length
            ? (overdue ? `Overdue since ${shortDate(dueAt)}: Owner, HoS and ICT access is locked until paid.` : `Please pay by ${shortDate(dueAt)}.`)
            : unpaidTerm ? termFee.text : termFee?.paid ? `${termFee.text} See receipts, credits and bundles under More.` : 'No outstanding bill. See receipts, credits and bundles under More.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {payUrl ? <a href={payUrl} className="rounded-full bg-[#1a5c38] px-5 py-2.5 text-sm font-black text-white shadow">Pay now</a> : null}
        <Link to={`/roles/${role}/subscription`} className="rounded-full bg-[#191970] px-5 py-2.5 text-sm font-bold text-[#c9a96e]">More</Link>
      </div>
    </section>
  );
}

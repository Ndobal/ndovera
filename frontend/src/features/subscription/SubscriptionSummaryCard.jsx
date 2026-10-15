import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyTermBills } from '../tenants/services/tenantApi';
import { nairaAmount, outstandingOf, shortDate } from './SubscriptionPage';

/** On the overview: what the school owes Ndovera, with Pay now and More (the Subscription page). */
export default function SubscriptionSummaryCard({ role = 'owner' }) {
  const [bills, setBills] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyTermBills().then(result => { if (!cancelled) setBills(result.bills || []); }).catch(() => { if (!cancelled) setBills([]); });
    return () => { cancelled = true; };
  }, []);

  if (bills === null) return null;
  const { open, total, dueAt, overdue, payUrl } = outstandingOf(bills);
  const tone = !open.length ? 'border-emerald-300 bg-emerald-50' : overdue ? 'border-rose-400 bg-rose-50' : 'border-amber-300 bg-amber-50';

  return (
    <section aria-label="Ndovera subscription" className={`flex flex-wrap items-center gap-4 rounded-3xl border-2 p-4 shadow-sm ${tone}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#800020]">Ndovera subscription</p>
        <p className={`text-2xl font-black ${open.length ? 'text-[#800000]' : 'text-[#1a5c38]'}`}>{open.length ? `${nairaAmount(total)} due` : 'All paid'}</p>
        <p className="text-sm text-[#191970]">
          {open.length
            ? (overdue ? `Overdue since ${shortDate(dueAt)}: Owner, HoS and ICT access is locked until paid.` : `Please pay by ${shortDate(dueAt)}.`)
            : 'No outstanding bill. See receipts, credits and bundles under More.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {payUrl ? <a href={payUrl} className="rounded-full bg-[#1a5c38] px-5 py-2.5 text-sm font-black text-white shadow">Pay now</a> : null}
        <Link to={`/roles/${role}/subscription`} className="rounded-full bg-[#191970] px-5 py-2.5 text-sm font-bold text-[#c9a96e]">More</Link>
      </div>
    </section>
  );
}

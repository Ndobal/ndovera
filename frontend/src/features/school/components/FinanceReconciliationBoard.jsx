import React, { useEffect, useMemo, useState } from 'react';
import { getFeesLedger, getFeeReceipts, getFeePaymentClaims } from '../services/schoolApi';

const PAGE = 'p-8 max-w-7xl mx-auto space-y-6';
const HEADER = 'rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10';
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/30';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

const CLAIM_PILL = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function FinanceReconciliationBoard() {
  const [ledger, setLedger] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getFeesLedger().then(d => d?.ledger || []).catch(() => []),
      getFeeReceipts().then(d => d?.receipts || []).catch(() => []),
      getFeePaymentClaims().then(d => d?.claims || []).catch(() => []),
    ])
      .then(([ledgerData, receiptData, claimData]) => {
        if (ignore) return;
        setLedger(ledgerData);
        setReceipts(receiptData);
        setClaims(claimData);
      })
      .catch(e => { if (!ignore) setError(e.message || 'Could not load reconciliation data.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const stats = useMemo(() => {
    const ledgerCollected = ledger.reduce((sum, e) => sum + Number(e.amountPaid || 0), 0);
    const receiptsTotal = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const variance = ledgerCollected - receiptsTotal;
    const pendingClaims = claims.filter(c => String(c.status || '').toLowerCase() === 'pending');
    const pendingTotal = pendingClaims.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const approvedClaims = claims.filter(c => String(c.status || '').toLowerCase() === 'approved');
    return { ledgerCollected, receiptsTotal, variance, pendingClaims, pendingTotal, approvedClaims };
  }, [ledger, receipts, claims]);

  if (loading) return <div className={PAGE}><div className={CARD}><p className="text-[#800020]">Loading reconciliation…</p></div></div>;

  return (
    <div className={PAGE}>
      <div className={HEADER}>
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Reconciliation</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Match recorded fee collections against issued receipts and verify outstanding parent payment claims.</p>
      </div>

      {error ? <div className={CARD}><p className="text-[#800000] text-sm">{error}</p></div> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Recorded Collected</p><p className="text-xl font-bold text-emerald-700 mt-1">{formatNaira(stats.ledgerCollected)}</p><p className="text-xs text-[#191970] mt-0.5">From fee ledger</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Receipts Issued</p><p className="text-xl font-bold text-[#800000] mt-1">{formatNaira(stats.receiptsTotal)}</p><p className="text-xs text-[#191970] mt-0.5">{receipts.length} receipt{receipts.length === 1 ? '' : 's'}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Variance</p><p className={`text-xl font-bold mt-1 ${Math.abs(stats.variance) < 1 ? 'text-emerald-700' : 'text-red-700'}`}>{formatNaira(stats.variance)}</p><p className="text-xs text-[#191970] mt-0.5">{Math.abs(stats.variance) < 1 ? 'Reconciled' : 'Needs review'}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Pending Claims</p><p className="text-xl font-bold text-amber-600 mt-1">{formatNaira(stats.pendingTotal)}</p><p className="text-xs text-[#191970] mt-0.5">{stats.pendingClaims.length} awaiting verification</p></div>
      </div>

      <div className={CARD}>
        <h2 className="text-lg font-bold text-[#800000] mb-1">Unreconciled — Payment Claims Awaiting Verification</h2>
        <p className="text-[#191970] text-sm mb-4">Parent/student bank-transfer claims that have not yet been matched to a receipt. Verify them on the Fees page to reconcile.</p>
        {stats.pendingClaims.length === 0 ? <p className="text-[#800020] text-sm">No payment claims are awaiting verification.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Class</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Reference</th>
                  <th className="pb-2 pr-4">Paid On</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingClaims.map((c, i) => (
                  <tr key={c.id || i} className="border-b border-[#c9a96e]/20">
                    <td className="py-2 pr-4 text-[#191970] font-semibold">{c.studentName || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970]">{c.className || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970] font-semibold">{formatNaira(c.amount)}</td>
                    <td className="py-2 pr-4 text-[#191970] capitalize">{String(c.paymentMethod || '').replace(/-/g, ' ') || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970] font-mono text-xs">{c.paymentReference || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970]">{c.paidAt ? new Date(c.paidAt).toLocaleDateString() : '—'}</td>
                    <td className="py-2"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${CLAIM_PILL.pending}`}>Pending</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={CARD}>
        <h2 className="text-lg font-bold text-[#800000] mb-1">Reconciled — Verified Claims</h2>
        <p className="text-[#191970] text-sm mb-4">Approved claims that were matched to an issued receipt.</p>
        {stats.approvedClaims.length === 0 ? <p className="text-[#800020] text-sm">No verified claims yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Receipt No.</th>
                  <th className="pb-2 pr-4">Verified By</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.approvedClaims.map((c, i) => (
                  <tr key={c.id || i} className="border-b border-[#c9a96e]/20">
                    <td className="py-2 pr-4 text-[#191970] font-semibold">{c.studentName || '—'}</td>
                    <td className="py-2 pr-4 text-emerald-700 font-semibold">{formatNaira(c.amount)}</td>
                    <td className="py-2 pr-4 text-[#191970] font-mono text-xs">{c.receiptNo || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970]">{c.verifiedBy || '—'}</td>
                    <td className="py-2"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${CLAIM_PILL.approved}`}>Reconciled</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

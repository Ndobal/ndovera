import React, { useEffect, useState } from 'react';
import { getMyTenant } from '../../../features/school/services/schoolApi';

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-[#191970] dark:text-slate-300 mt-1">{value || '—'}</p>
    </div>
  );
}

function StatusPill({ status }) {
  const map = { active: 'bg-emerald-100 text-emerald-700', paid: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', suspended: 'bg-red-100 text-red-700' };
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status || '—'}</span>;
}

export default function OwnerFinance({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    getMyTenant()
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const tenant = data?.tenant;
  const payments = data?.payments || [];
  const quote = data?.quote;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>
      )}
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Finance</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">School subscription fees and payment history.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
            <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100 mb-4">Payment Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoRow label="Plan" value={quote?.planName || tenant?.planKey} />
              <InfoRow label="Setup Fee" value={quote?.setupFee ? `₦${quote.setupFee.toLocaleString()}` : null} />
              <div>
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Status</p>
                <div className="mt-1"><StatusPill status={tenant?.paymentStatus} /></div>
              </div>
              <InfoRow label="Student Fee/Term" value={quote?.studentFeePerTerm ? `₦${quote.studentFeePerTerm.toLocaleString()}/student` : null} />
              <InfoRow label="Student Count" value={tenant?.studentCount} />
              <InfoRow label="Term Total" value={quote?.termTotal ? `₦${quote.termTotal.toLocaleString()}` : null} />
            </div>
          </div>

          <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
            <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100 mb-4">Payment History</h2>
            {payments.length === 0 ? (
              <p className="text-[#800020] dark:text-slate-400 text-sm">No payment records found.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((p, i) => (
                  <div key={p.id || i} className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[#800020] dark:text-slate-400 font-semibold text-sm">{p.txRef || 'Payment'}</p>
                      <p className="text-[#191970] dark:text-slate-300 text-sm">₦{(p.amount || p.amountCents / 100 || 0).toLocaleString()}</p>
                      {p.paidAt && <p className="text-xs text-[#800020]/70 dark:text-slate-500 mt-0.5">{new Date(p.paidAt).toLocaleDateString()}</p>}
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
            <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100 mb-4">Quick Actions</h2>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => showToast('Coming soon')} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl text-sm transition-colors">View Invoice</button>
              <button onClick={() => showToast('Coming soon')} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl text-sm transition-colors">Update Payment Method</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { getFeeReceipts } from '../services/schoolApi';
import FeeReceiptDialog from './FeeReceiptDialog';

const PAGE = 'p-8 max-w-7xl mx-auto space-y-6';
const HEADER = 'rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10';
const CARD = 'rounded-3xl p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/30';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none focus:border-[#800020]';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function StatusPill({ status }) {
  const map = { Paid: 'bg-emerald-100 text-emerald-700', Partial: 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-700' };
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status || '—'}</span>;
}

export default function FeeReceiptsBoard() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    let ignore = false;
    getFeeReceipts()
      .then(data => { if (!ignore) setReceipts(data?.receipts || []); })
      .catch(e => { if (!ignore) setError(e.message || 'Could not load receipts.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return receipts;
    return receipts.filter(r =>
      String(r.studentName || '').toLowerCase().includes(term)
      || String(r.receiptNo || '').toLowerCase().includes(term)
      || String(r.className || '').toLowerCase().includes(term),
    );
  }, [receipts, search]);

  const totalAmount = useMemo(() => receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0), [receipts]);

  return (
    <div className={PAGE}>
      <div className={HEADER}>
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Receipts</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Every fee receipt issued for this school, generated from confirmed payments. Receipts cannot be deleted.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Receipts Issued</p><p className="text-2xl font-bold text-[#800000] mt-1">{receipts.length}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Total Receipted</p><p className="text-2xl font-bold text-emerald-700 mt-1">{formatNaira(totalAmount)}</p></div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#800000]">Receipt Ledger</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student, class, or receipt no." className={`${INPUT} max-w-xs`} />
        </div>
        {loading ? <p className="text-[#800020] text-sm">Loading receipts…</p>
          : error ? <p className="text-[#800000] text-sm">{error}</p>
          : filtered.length === 0 ? <p className="text-[#800020] text-sm">{receipts.length === 0 ? 'No receipts have been issued yet.' : 'No receipts match your search.'}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40">
                    <th className="pb-2 pr-4">Receipt No.</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Class</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Balance After</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id || r.receiptNo || i} className="border-b border-[#c9a96e]/20">
                      <td className="py-2 pr-4 text-[#191970] font-mono text-xs">{r.receiptNo || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970]">{r.recordedAt ? new Date(r.recordedAt).toLocaleDateString() : '—'}</td>
                      <td className="py-2 pr-4 text-[#191970] font-semibold">{r.studentName || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970]">{r.className || '—'}</td>
                      <td className="py-2 pr-4 text-emerald-700 font-semibold">{formatNaira(r.amount)}</td>
                      <td className="py-2 pr-4 text-[#191970]">{formatNaira(r.balanceAfter)}</td>
                      <td className="py-2 pr-4"><StatusPill status={r.statusAfter} /></td>
                      <td className="py-2"><button onClick={() => setSelectedReceipt(r)} className="rounded-xl bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-4 py-1.5 text-xs">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <FeeReceiptDialog receipt={selectedReceipt} isOpen={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
}

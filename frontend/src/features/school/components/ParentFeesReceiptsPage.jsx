import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../../app/roles/student/StudentSectionShell';
import { getFeeReceipts, getFeesLedger } from '../services/schoolApi';

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff]';
const BTN = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function ParentFeesReceiptsPage() {
  const [ledger, setLedger] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([getFeesLedger(), getFeeReceipts()])
      .then(([ledgerResult, receiptResult]) => {
        if (cancelled) return;
        const nextLedger = (ledgerResult?.ledger || []).map(entry => ({ ...entry, id: entry.studentId || entry.id }));
        setLedger(nextLedger);
        setReceipts(receiptResult?.receipts || []);
        setSelectedStudentId(current => (nextLedger.some(entry => entry.id === current) ? current : String(nextLedger[0]?.id || '')));
      })
      .catch(loadError => {
        if (!cancelled) {
          setLedger([]);
          setReceipts([]);
          setError(loadError instanceof Error ? loadError.message : 'Could not load fees and receipts.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const students = useMemo(() => [...ledger].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))), [ledger]);
  const selectedStudent = students.find(student => student.id === selectedStudentId) || students[0] || null;
  const studentReceipts = useMemo(() => receipts.filter(receipt => receipt.studentId === selectedStudent?.id), [receipts, selectedStudent?.id]);

  return (
    <StudentSectionShell
      title="Fees & Receipts"
      subtitle="Track each linked child balance, payment progress, and printed receipt history from one page."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Fees"
    >
      <style>{'@media print { body * { visibility: hidden; } #parent-fees-receipt-print, #parent-fees-receipt-print * { visibility: visible; } #parent-fees-receipt-print { position: absolute; inset: 0; margin: 0; padding: 32px; width: 100%; background: #f5deb3; } }'}</style>

      <div className="space-y-6">
        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Linked Child</p>
              <p className="mt-2 text-xl font-bold text-[#800000] dark:text-white">{selectedStudent ? `${selectedStudent.name}${selectedStudent.className ? ` • ${selectedStudent.className}` : ''}` : 'No linked child yet'}</p>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Fee reminders stay active while a balance remains open. Receipts below are generated from approved school fee payments.</p>
            </div>
            <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} className="rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white">
              {students.map(student => (
                <option key={student.id} value={student.id}>{student.name}{student.className ? ` • ${student.className}` : ''}</option>
              ))}
            </select>
          </div>
          {!loading && !students.length ? <p className="mt-4 text-sm text-[#800020] dark:text-[#bf00ff]">No linked child fees record is available yet.</p> : null}
          {error ? <p className="mt-4 text-sm text-[#800000] dark:text-rose-200">{error}</p> : null}
        </section>

        {selectedStudent ? (
          <section className="grid gap-5 md:grid-cols-4">
            <div className={CARD}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Expected</p><h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{formatNaira(selectedStudent.feeAmount)}</h3></div>
            <div className={CARD}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Paid</p><h3 className="mt-3 text-3xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(selectedStudent.amountPaid)}</h3></div>
            <div className={CARD}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Balance</p><h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(selectedStudent.balance)}</h3></div>
            <div className={CARD}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Receipts</p><h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{studentReceipts.length}</h3><p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]"><span className={BADGE}>{selectedStudent.status || 'Not Tracked'}</span></p></div>
          </section>
        ) : null}

        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Current Ledger</h2>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Live fee position for the selected child.</p>
            </div>
            {selectedStudent ? <span className={BADGE}>{selectedStudent.status || 'Not Tracked'}</span> : null}
          </div>
          {selectedStudent ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Student</span><span className="font-bold text-[#191970] dark:text-white">{selectedStudent.name}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Class</span><span className="font-bold text-[#191970] dark:text-white">{selectedStudent.className || 'Not assigned'}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Expected Amount</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.feeAmount)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Amount Paid</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.amountPaid)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Outstanding Balance</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.balance)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Last Updated</span><span className="font-bold text-[#191970] dark:text-white">{formatDateTime(selectedStudent.updatedAt)}</span></div>
            </div>
          ) : <p className="mt-4 text-sm text-[#800020] dark:text-[#bf00ff]">Select a linked child to view the ledger.</p>}
        </section>

        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Receipts</h2>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Every recorded payment keeps a printable receipt trail here.</p>
            </div>
            {selectedStudent ? <span className={BADGE}>{studentReceipts.length} Receipt{studentReceipts.length === 1 ? '' : 's'}</span> : null}
          </div>

          <div className="mt-5 space-y-3">
            {loading ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">Loading receipts...</p> : null}
            {!loading && selectedStudent && studentReceipts.length === 0 ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">No receipts have been recorded for this child yet.</p> : null}
            {studentReceipts.map(receipt => (
              <article key={receipt.id} className={`${INNER} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
                <div className="space-y-2">
                  <p className="text-lg font-bold text-[#191970] dark:text-white">{receipt.receiptNo}</p>
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">{formatDateTime(receipt.recordedAt)} • {receipt.paymentType || 'cash'}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={BADGE}>Paid {formatNaira(receipt.amount)}</span>
                    <span className={BADGE}>Balance {formatNaira(receipt.balanceAfter)}</span>
                    <span className={BADGE}>{receipt.statusAfter || 'Recorded'}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedReceipt(receipt)} className={BTN}>Print Receipt</button>
              </article>
            ))}
          </div>
        </section>
      </div>

      {selectedReceipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className={`${CARD} w-full max-w-lg`} id="parent-fees-receipt-print">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Payment Receipt</h3>
                <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Parent receipt printout for recorded school fee payment.</p>
              </div>
              <span className={BADGE}>{selectedReceipt.statusAfter || 'Recorded'}</span>
            </div>
            <div className="mt-6 space-y-3">
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Receipt No</span><span className="font-bold text-[#191970] dark:text-white">{selectedReceipt.receiptNo}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Date</span><span className="font-bold text-[#191970] dark:text-white">{formatDateTime(selectedReceipt.recordedAt)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Student</span><span className="font-bold text-[#191970] dark:text-white">{selectedReceipt.studentName}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Class</span><span className="font-bold text-[#191970] dark:text-white">{selectedReceipt.className || 'Not assigned'}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Amount Paid</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedReceipt.amount)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Total Paid So Far</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedReceipt.amountPaidAfter)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Balance After Payment</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedReceipt.balanceAfter)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Recorded By</span><span className="font-bold text-[#191970] dark:text-white">{selectedReceipt.recordedBy || 'School finance office'}</span></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => window.print()} className={BTN}>Print Receipt</button>
              <button onClick={() => setSelectedReceipt(null)} className="rounded-2xl border border-[#800020]/30 bg-white/60 px-4 py-2 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </StudentSectionShell>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../../app/roles/student/StudentSectionShell';
import FeeReceiptDialog from './FeeReceiptDialog';
import {
  getFeePaymentClaims,
  getFeeReceipts,
  getFeesLedger,
  getFeesPaymentDetails,
  submitFeePaymentClaim,
} from '../services/schoolApi';
import { resolveActiveParentChildId, writeActiveParentChildId } from '../../../app/roles/parent/parentChildSelection';

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
  const [claims, setClaims] = useState([]);
  const [paymentDetails, setPaymentDetails] = useState({ bankName: '', accountName: '', accountNumber: '', paymentInstructions: '', paymentReferenceHint: '' });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimForm, setClaimForm] = useState({
    amount: '',
    paymentMethod: 'bank-transfer',
    payerName: '',
    paymentReference: '',
    paymentNote: '',
    paidAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([getFeesLedger(), getFeeReceipts(), getFeesPaymentDetails(), getFeePaymentClaims()])
      .then(([ledgerResult, receiptResult, paymentDetailsResult, claimResult]) => {
        if (cancelled) return;
        const nextLedger = (ledgerResult?.ledger || []).map(entry => ({ ...entry, id: entry.studentId || entry.id }));
        setLedger(nextLedger);
        setReceipts(receiptResult?.receipts || []);
        setPaymentDetails(paymentDetailsResult?.paymentDetails || { bankName: '', accountName: '', accountNumber: '', paymentInstructions: '', paymentReferenceHint: '' });
        setClaims(claimResult?.claims || []);
        setSelectedStudentId(current => resolveActiveParentChildId(nextLedger, current));
      })
      .catch(loadError => {
        if (!cancelled) {
          setLedger([]);
          setReceipts([]);
          setClaims([]);
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
  const studentClaims = useMemo(() => claims.filter(claim => claim.studentId === selectedStudent?.id), [claims, selectedStudent?.id]);
  const receiptCountByStudentId = useMemo(() => receipts.reduce((map, receipt) => {
    const studentId = String(receipt?.studentId || '');
    if (!studentId) return map;
    map.set(studentId, Number(map.get(studentId) || 0) + 1);
    return map;
  }, new Map()), [receipts]);
  const claimCountByStudentId = useMemo(() => claims.reduce((map, claim) => {
    const studentId = String(claim?.studentId || '');
    if (!studentId) return map;
    map.set(studentId, Number(map.get(studentId) || 0) + 1);
    return map;
  }, new Map()), [claims]);

  useEffect(() => {
    if (!selectedStudent) return;
    setClaimForm(current => ({
      ...current,
      amount: current.amount || String(Math.max(Number(selectedStudent.balance || 0), 0) || Number(selectedStudent.feeAmount || 0) || ''),
    }));
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudentId) {
      writeActiveParentChildId(selectedStudentId);
    }
  }, [selectedStudentId]);

  async function handleSubmitClaim() {
    if (!selectedStudent) return;

    setSubmittingClaim(true);
    setError('');
    setNotice('');

    try {
      const result = await submitFeePaymentClaim({
        studentId: selectedStudent.id,
        amount: Number(claimForm.amount || 0),
        paymentMethod: claimForm.paymentMethod,
        payerName: claimForm.payerName,
        paymentReference: claimForm.paymentReference,
        paymentNote: claimForm.paymentNote,
        paidAt: claimForm.paidAt,
      });

      setClaims(current => [result?.claim, ...current].filter(Boolean));
      setNotice('Payment claim submitted. The school finance team will verify it and issue the receipt after approval.');
      setClaimForm(current => ({
        ...current,
        amount: String(Math.max(Number(selectedStudent.balance || 0), 0) || Number(selectedStudent.feeAmount || 0) || ''),
        paymentReference: '',
        paymentNote: '',
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit payment claim.');
    } finally {
      setSubmittingClaim(false);
    }
  }

  function renderClaimStatus(status) {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    if (normalizedStatus === 'verified') return 'Verified';
    if (normalizedStatus === 'rejected') return 'Rejected';
    return 'Pending';
  }

  return (
    <StudentSectionShell
      title="Fees & Receipts"
      subtitle="Track each linked child balance, payment progress, and printed receipt history from one page."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Fees"
    >
      <style>{'@media print { body * { visibility: hidden; } #parent-fees-receipt-print, #parent-fees-receipt-print * { visibility: visible; } #parent-fees-receipt-print { position: absolute; inset: 0; margin: 0; padding: 32px; width: 100%; background: #f5deb3; } }'}</style>

      <div className="space-y-6">
        {notice ? <section className="rounded-2xl border border-[#1a5c38]/20 bg-[#e4f4e6] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/20 dark:bg-[#03181a] dark:text-[#7df9ff]">{notice}</section> : null}

        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">All Children This Term</p>
              <p className="mt-2 text-xl font-bold text-[#800000] dark:text-white">Term fee sessions for every linked child</p>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Open one child card to review balance, receipts, and payment claims without leaving the fees page.</p>
            </div>
            <span className={BADGE}>{students.length} Linked Child{students.length === 1 ? '' : 'ren'}</span>
          </div>

          <div className="mt-5 space-y-3">
            {students.map(student => {
              const studentId = String(student.id || '');
              const isOpen = studentId === String(selectedStudentId || '');
              const receiptCount = Number(receiptCountByStudentId.get(studentId) || 0);
              const claimCount = Number(claimCountByStudentId.get(studentId) || 0);

              return (
                <article key={student.id} className={INNER}>
                  <button type="button" onClick={() => setSelectedStudentId(student.id)} className="flex w-full flex-wrap items-center justify-between gap-4 text-left">
                    <div>
                      <p className="text-lg font-bold text-[#191970] dark:text-white">{student.name}</p>
                      <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">{student.className || 'Class pending'}{student.displayId ? ` • ${student.displayId}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={BADGE}>Balance {formatNaira(student.balance)}</span>
                      <span className={BADGE}>{receiptCount} Receipt{receiptCount === 1 ? '' : 's'}</span>
                      <span className={BADGE}>{claimCount} Claim{claimCount === 1 ? '' : 's'}</span>
                      <span className={BADGE}>{isOpen ? 'Open' : 'Open Session'}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className={`${CARD} !p-4`}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Expected</p><p className="mt-2 text-2xl font-bold text-[#800000] dark:text-[#0000ff]">{formatNaira(student.feeAmount)}</p></div>
                      <div className={`${CARD} !p-4`}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Paid</p><p className="mt-2 text-2xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(student.amountPaid)}</p></div>
                      <div className={`${CARD} !p-4`}><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Status</p><p className="mt-2 text-sm font-bold text-[#191970] dark:text-white">{student.status || 'Not tracked'}</p></div>
                    </div>
                  ) : null}
                </article>
              );
            })}
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
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Student ID</span><span className="font-bold text-[#191970] dark:text-white">{selectedStudent.displayId || selectedStudent.id || 'Not assigned'}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Class</span><span className="font-bold text-[#191970] dark:text-white">{selectedStudent.className || 'Not assigned'}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Expected Amount</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.feeAmount)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Amount Paid</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.amountPaid)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Outstanding Balance</span><span className="font-bold text-[#191970] dark:text-white">{formatNaira(selectedStudent.balance)}</span></div>
              <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Last Updated</span><span className="font-bold text-[#191970] dark:text-white">{formatDateTime(selectedStudent.updatedAt)}</span></div>
            </div>
          ) : <p className="mt-4 text-sm text-[#800020] dark:text-[#bf00ff]">Select a linked child to view the ledger.</p>}
        </section>

        <section className={CARD}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">School Payment Details</h2>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Pay into the school account below, then submit an “I have paid” claim so the finance team can verify and issue the receipt.</p>
            </div>
            {selectedStudent ? <span className={BADGE}>{studentClaims.length} Claim{studentClaims.length === 1 ? '' : 's'}</span> : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Bank</span><span className="font-bold text-[#191970] dark:text-white">{paymentDetails.bankName || 'Awaiting school update'}</span></div>
            <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Account Name</span><span className="font-bold text-[#191970] dark:text-white">{paymentDetails.accountName || 'Awaiting school update'}</span></div>
            <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Account Number</span><span className="font-bold text-[#191970] dark:text-white">{paymentDetails.accountNumber || 'Awaiting school update'}</span></div>
            <div className={`${INNER} flex items-center justify-between`}><span className="font-semibold text-[#800020] dark:text-[#bf00ff]">Reference Hint</span><span className="font-bold text-[#191970] dark:text-white">{paymentDetails.paymentReferenceHint || 'Use student name or receipt reference.'}</span></div>
          </div>

          <div className={`${INNER} mt-4`}>
            <p className="font-semibold text-[#800020] dark:text-[#bf00ff]">Instructions</p>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">{paymentDetails.paymentInstructions || 'Finance office payment instructions will appear here once the school updates them.'}</p>
          </div>
        </section>

        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">I Have Paid</h2>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Submit the payment claim after transfer so the school can verify it and issue the official receipt.</p>
            </div>
            {selectedStudent ? <span className={BADGE}>{selectedStudent.name}</span> : null}
          </div>

          {selectedStudent ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Amount Paid
                <input type="number" value={claimForm.amount} onChange={event => setClaimForm(current => ({ ...current, amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white" />
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Payment Date
                <input type="date" value={claimForm.paidAt} onChange={event => setClaimForm(current => ({ ...current, paidAt: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white" />
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Payment Method
                <select value={claimForm.paymentMethod} onChange={event => setClaimForm(current => ({ ...current, paymentMethod: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white">
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="cash-deposit">Cash Deposit</option>
                  <option value="mobile-money">Mobile Money</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Payer Name
                <input value={claimForm.payerName} onChange={event => setClaimForm(current => ({ ...current, payerName: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white" placeholder="Who made the transfer?" />
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Reference / Teller No.
                <input value={claimForm.paymentReference} onChange={event => setClaimForm(current => ({ ...current, paymentReference: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white" placeholder={paymentDetails.paymentReferenceHint || 'Enter transfer reference'} />
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff] xl:col-span-3">Notes For Finance Office
                <textarea value={claimForm.paymentNote} onChange={event => setClaimForm(current => ({ ...current, paymentNote: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white" placeholder="Any extra detail that helps finance verify the payment quickly." />
              </label>
            </div>
          ) : <p className="mt-4 text-sm text-[#800020] dark:text-[#bf00ff]">Select a linked child to submit a payment claim.</p>}

          <div className="mt-5 flex justify-end">
            <button onClick={handleSubmitClaim} disabled={!selectedStudent || submittingClaim} className={BTN}>{submittingClaim ? 'Submitting...' : 'Submit Claim'}</button>
          </div>
        </section>

        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Claim History</h2>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Track pending, approved, and rejected payment claims for the selected child.</p>
            </div>
            {selectedStudent ? <span className={BADGE}>{studentClaims.length} Claim{studentClaims.length === 1 ? '' : 's'}</span> : null}
          </div>

          <div className="mt-5 space-y-3">
            {!loading && selectedStudent && studentClaims.length === 0 ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">No payment claims have been submitted for this child yet.</p> : null}
            {studentClaims.map(claim => (
              <article key={claim.id} className={`${INNER} flex flex-col gap-4 md:flex-row md:items-start md:justify-between`}>
                <div className="space-y-2">
                  <p className="text-lg font-bold text-[#191970] dark:text-white">{formatNaira(claim.amount)} • {renderClaimStatus(claim.status)}</p>
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">{formatDateTime(claim.updatedAt || claim.claimedAt)} • {claim.paymentMethod || 'bank-transfer'}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={BADGE}>{claim.paymentReference || 'No reference supplied'}</span>
                    {claim.receiptNo ? <span className={BADGE}>Receipt {claim.receiptNo}</span> : null}
                    {claim.verifiedAt ? <span className={BADGE}>Reviewed {formatDateTime(claim.verifiedAt)}</span> : null}
                  </div>
                  {claim.paymentNote ? <p className="text-sm text-[#191970] dark:text-[#39ff14]">{claim.paymentNote}</p> : null}
                  {claim.verificationNote ? <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Finance note: {claim.verificationNote}</p> : null}
                </div>
                <span className={BADGE}>{renderClaimStatus(claim.status)}</span>
              </article>
            ))}
          </div>
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
                    <span className={BADGE}>ID {receipt.studentDisplayId || selectedStudent?.displayId || selectedStudent?.id || 'Not assigned'}</span>
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

      <FeeReceiptDialog
        receipt={selectedReceipt}
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        printId="parent-fees-receipt-print"
        title="Parent Copy School Fees Receipt"
        subtitle="Official receipt for an approved and recorded school fee payment."
      />
    </StudentSectionShell>
  );
}
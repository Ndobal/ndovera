import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getParentResult } from '../service/resultEngineService';
import { getFeesLedger, getFeesPaymentDetails, getSession } from '../../school/services/schoolApi';
import ResultRecordViewer from './ResultRecordViewer';
import { readActiveParentChildId, writeActiveParentChildId } from '../../../app/roles/parent/parentChildSelection';

const RESULTS_FEES_POPUP_KEY = 'resultsFeesPopupDismissedPeriod';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

export default function ParentResultView() {
  const navigate = useNavigate();
  const [result, setResult] = useState({ students: [], publications: [], documents: [], activeRecord: null, activeStudentId: '' });
  const [activeChildId, setActiveChildId] = useState(() => readActiveParentChildId());
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // First-view fees invoice popup (shows once per term with the school account details).
  const [feesLedger, setFeesLedger] = useState([]);
  const [feesPaymentDetails, setFeesPaymentDetails] = useState({ bankName: '', accountName: '', accountNumber: '', paymentReferenceHint: '' });
  const [feesPopupOpen, setFeesPopupOpen] = useState(false);
  const [feesPeriodKey, setFeesPeriodKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getFeesLedger().catch(() => ({ ledger: [] })),
      getFeesPaymentDetails().catch(() => ({ paymentDetails: {} })),
      getSession().catch(() => ({ session: null })),
    ]).then(([ledgerResult, paymentResult, sessionResult]) => {
      if (cancelled) return;
      const ledger = ledgerResult?.ledger || [];
      setFeesLedger(ledger);
      setFeesPaymentDetails(paymentResult?.paymentDetails || {});
      const periodKey = `${sessionResult?.session?.session || ''}::${sessionResult?.session?.term || ''}`;
      setFeesPeriodKey(periodKey);
      const outstanding = ledger.reduce((sum, child) => sum + Math.max(Number(child?.balance ?? (Number(child?.feeAmount || 0) - Number(child?.amountPaid || 0))), 0), 0);
      let dismissed = '';
      try { dismissed = window.localStorage.getItem(RESULTS_FEES_POPUP_KEY) || ''; } catch {}
      // Show on first results view for a new term while fees are outstanding.
      if (outstanding > 0 && periodKey && dismissed !== periodKey) {
        setFeesPopupOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const feesTotals = useMemo(() => feesLedger.reduce((totals, child) => {
    const expected = Number(child?.feeAmount || 0);
    const paid = Number(child?.amountPaid || 0);
    totals.expected += expected;
    totals.paid += paid;
    totals.balance += Math.max(Number(child?.balance ?? (expected - paid)), 0);
    return totals;
  }, { expected: 0, paid: 0, balance: 0 }), [feesLedger]);

  function dismissFeesPopup() {
    try { window.localStorage.setItem(RESULTS_FEES_POPUP_KEY, feesPeriodKey); } catch {}
    setFeesPopupOpen(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      setLoading(true);
      setError('');
      try {
        const nextResult = await getParentResult(activeChildId);
        if (cancelled) return;
        setResult(nextResult);
        setSelectedRecordId(nextResult.activeRecord?.id || '');
        if (nextResult.activeStudentId && nextResult.activeStudentId !== activeChildId) {
          writeActiveParentChildId(nextResult.activeStudentId);
          setActiveChildId(nextResult.activeStudentId);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load parent result records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadResult();
    return () => {
      cancelled = true;
    };
  }, [activeChildId]);

  useEffect(() => {
    if (activeChildId) {
      writeActiveParentChildId(activeChildId);
    }
  }, [activeChildId]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {feesPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onClick={dismissFeesPopup}>
          <div className="w-full max-w-lg rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-6 shadow-2xl dark:border-[#bf00ff]/30 dark:bg-[#1a001d]" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">School Fees Invoice</p>
                <h2 className="mt-1 text-2xl font-black text-[#800000] dark:text-white">{formatNaira(feesTotals.expected)} total</h2>
                <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Paid {formatNaira(feesTotals.paid)} • Outstanding {formatNaira(feesTotals.balance)}</p>
              </div>
              <button type="button" onClick={dismissFeesPopup} className="rounded-full border border-[#800020]/30 px-3 py-1 text-sm font-bold text-[#800020] dark:border-[#bf00ff]/40 dark:text-[#bf00ff]">✕</button>
            </div>

            <div className="mt-4 space-y-2">
              {feesLedger.map(child => (
                <div key={child.id} className="flex items-center justify-between rounded-2xl border border-[#c9a96e]/30 bg-white/70 px-3 py-2 text-sm dark:border-[#bf00ff]/20 dark:bg-black/20">
                  <span className="font-semibold text-[#800000] dark:text-white">{child.name || 'Child'}</span>
                  <span className="text-[#191970] dark:text-[#39ff14]">{formatNaira(child.feeAmount)} • bal {formatNaira(child.balance ?? (Number(child.feeAmount || 0) - Number(child.amountPaid || 0)))}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-3 text-sm dark:border-[#bf00ff]/20 dark:bg-black/20">
              <p className="font-bold text-[#800020] dark:text-[#bf00ff]">Pay into the school account</p>
              <p className="mt-1 text-[#191970] dark:text-white">{feesPaymentDetails.bankName || 'Bank: awaiting school update'}</p>
              <p className="text-[#191970] dark:text-white">{feesPaymentDetails.accountName || 'Account name: awaiting school update'}</p>
              <p className="text-[#191970] dark:text-white">{feesPaymentDetails.accountNumber || 'Account number: awaiting school update'}</p>
              <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Reference: {feesPaymentDetails.paymentReferenceHint || 'Use the student name'}. Online Paynow payment is coming soon.</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { dismissFeesPopup(); navigate('/roles/parent/fees'); }} className="rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">Go To Fees & Pay</button>
              <button type="button" onClick={dismissFeesPopup} className="rounded-2xl border border-[#800020]/30 px-5 py-2.5 text-sm font-bold text-[#800020] dark:border-[#bf00ff]/40 dark:text-[#bf00ff]">Close</button>
            </div>
          </div>
        </div>
      )}

      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">Parent Dashboard</p>
        <h1 className="text-3xl command-title neon-title">Results</h1>
        <p className="text-slate-300 mt-1">Official published records grouped by child, session, and term.</p>
      </section>

      {error && <section className="glass-surface rounded-3xl p-6 text-sm text-rose-100 border border-rose-300/30 bg-rose-500/20">{error}</section>}
      {loading && <section className="glass-surface rounded-3xl p-6 text-slate-200">Loading result records...</section>}

      {!loading && (
        <ResultRecordViewer
          students={result.students}
          activeStudentId={activeChildId || result.activeStudentId}
          onSelectStudent={(studentId) => {
            writeActiveParentChildId(studentId);
            setActiveChildId(studentId);
          }}
          records={result.publications}
          selectedRecordId={selectedRecordId}
          onSelectRecord={setSelectedRecordId}
          documents={result.documents}
          lockedByFees={result.lockedByFees}
          feeStatus={result.feeStatus}
          emptyMessage="Parent result access will appear here after the school publishes approved student results."
        />
      )}
    </div>
  );
}

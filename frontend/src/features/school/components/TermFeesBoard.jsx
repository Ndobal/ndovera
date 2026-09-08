import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAcademicOverview, getClasses, getFeeAssessments, generateFeeAssessments,
  carryOpeningBalances, getStudentFeeHistory, getStudentFeeOutstanding,
  recordStudentFeePayment,
} from '../services/schoolApi';

const CARD = 'rounded-3xl p-5 sm:p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const BTN_GHOST = 'rounded-2xl border border-[#800020]/30 px-4 py-2 text-sm font-bold text-[#800020] transition hover:bg-[#800020]/10 disabled:opacity-60 dark:border-white/20 dark:text-slate-200';
const LABEL = 'text-xs font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

const STATUS_STYLES = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  waived: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const naira = (value) => `₦${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Stat({ label, value, tone = '' }) {
  return (
    <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:border-white/10 dark:bg-slate-800/40">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#800020] dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone || 'text-[#14215b] dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLES[status] || STATUS_STYLES.unpaid}`}>{status}</span>;
}

/** Record a payment and say exactly which charges it settles. */
function PaymentDialog({ student, onClose, onRecorded }) {
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState('auto');
  const [split, setSplit] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Generated once per dialog so a double-tap cannot become two payments.
  const [idempotencyKey] = useState(() => `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let cancelled = false;
    getStudentFeeOutstanding(student.studentId)
      .then(data => { if (!cancelled) setOutstanding(data?.outstanding || []); })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load outstanding charges.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.studentId]);

  const totalOutstanding = outstanding.reduce((sum, item) => sum + Number(item.outstanding || 0), 0);
  const splitTotal = Object.values(split).reduce((sum, value) => sum + Number(value || 0), 0);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const allocations = mode === 'split'
        ? Object.entries(split)
          .filter(([, value]) => Number(value) > 0)
          .map(([assessmentId, value]) => ({ assessmentId, amount: Number(value) }))
        : undefined;

      const payload = {
        amount: mode === 'split' ? splitTotal : Number(amount),
        paymentType,
        paymentReference: reference,
        idempotencyKey,
        ...(allocations ? { allocations } : {}),
      };

      const result = await recordStudentFeePayment(student.studentId, payload);
      onRecorded(result);
    } catch (e) {
      setError(e.message || 'Could not record the payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-[var(--safe-bottom)] sm:items-center sm:p-4 sm:pb-4" role="presentation" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-5 sm:rounded-3xl dark:border-white/10 dark:bg-slate-900"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Record payment</h3>
        <p className="mt-0.5 text-sm text-[#191970] dark:text-slate-300">{student.studentName} · {student.className || 'No class'}</p>

        {loading ? <p className="mt-4 text-sm text-[#4a5578]">Loading charges…</p> : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}

            <div className="rounded-2xl border border-[#c9a96e]/30 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
              <p className={LABEL}>Outstanding charges</p>
              <div className="mt-2 space-y-2">
                {outstanding.map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-[#14215b] dark:text-slate-200">
                      {item.sessionName} {item.termName}
                      {item.assessmentKind === 'opening_balance' ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">brought forward</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <strong className="text-[#800000] dark:text-slate-100">{naira(item.outstanding)}</strong>
                      {mode === 'split' ? (
                        <input
                          type="number" min="0" max={item.outstanding} step="0.01"
                          value={split[item.id] || ''}
                          onChange={e => setSplit(s => ({ ...s, [item.id]: e.target.value }))}
                          placeholder="0"
                          className={`${INPUT} w-28 py-1`}
                        />
                      ) : null}
                    </span>
                  </div>
                ))}
                {!outstanding.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">Nothing outstanding. Generate this term's fees first.</p> : null}
              </div>
              <p className="mt-2 border-t border-[#c9a96e]/30 pt-2 text-sm font-bold text-[#14215b] dark:border-white/10 dark:text-slate-100">
                Total due {naira(totalOutstanding)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode('auto')} className={mode === 'auto' ? BTN : BTN_GHOST}>Oldest debt first</button>
              <button type="button" onClick={() => setMode('split')} className={mode === 'split' ? BTN : BTN_GHOST}>Split by charge</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === 'auto' ? (
                <label className="block"><span className={LABEL}>Amount paid</span>
                  <input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={`${INPUT} mt-1 w-full`} /></label>
              ) : (
                <div><span className={LABEL}>Amount paid</span>
                  <p className="mt-1 rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm font-bold text-[#14215b] dark:bg-slate-800 dark:text-slate-100">{naira(splitTotal)}</p></div>
              )}
              <label className="block"><span className={LABEL}>Method</span>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className={`${INPUT} mt-1 w-full`}>
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank transfer</option>
                  <option value="pos">POS</option>
                  <option value="cheque">Cheque</option>
                </select></label>
              <label className="block sm:col-span-2"><span className={LABEL}>Reference (optional)</span>
                <input value={reference} onChange={e => setReference(e.target.value)} className={`${INPUT} mt-1 w-full`} /></label>
            </div>

            {mode === 'auto' && Number(amount) > 0 && Number(amount) > totalOutstanding ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                That is more than the {naira(totalOutstanding)} owed. Reduce the amount, or split it across specific charges.
              </p>
            ) : null}

            <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 border-t border-[#c9a96e]/35 bg-[#fff8ee]/95 px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:pb-3 dark:border-white/10 dark:bg-slate-900/95">
              <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
              <button type="submit" disabled={busy || !outstanding.length} className={BTN}>
                {busy ? 'Recording…' : 'Record payment & issue receipt'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** A student's complete fee position, term by term. */
function HistoryDialog({ student, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getStudentFeeHistory(student.studentId)
      .then(data => { if (!cancelled) setHistory(data); })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load the history.'); });
    return () => { cancelled = true; };
  }, [student.studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-[var(--safe-bottom)] sm:items-center sm:p-4 sm:pb-4" role="presentation" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-5 sm:rounded-3xl dark:border-white/10 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">{student.studentName}</h3>
        <p className="text-sm text-[#191970] dark:text-slate-300">Financial history</p>

        {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {!history && !error ? <p className="mt-3 text-sm text-[#4a5578]">Loading…</p> : null}

        {history ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Stat label="Previous outstanding" value={naira(history.summary.previousOutstanding)} tone="text-amber-700 dark:text-amber-300" />
              <Stat label="Current term charges" value={naira(history.summary.currentCharges)} />
              <Stat label="Total due now" value={naira(history.summary.totalDue)} tone="text-[#800000] dark:text-red-300" />
            </div>

            {history.statement.map(session => (
              <div key={session.sessionName} className="mt-4">
                <h4 className="text-sm font-black uppercase tracking-wide text-[#800020] dark:text-slate-300">{session.sessionName}</h4>
                <div className="mt-2 space-y-2">
                  {session.terms.map(term => (
                    <div key={term.termName} className="rounded-2xl border border-[#c9a96e]/30 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
                      <p className="font-bold text-[#14215b] dark:text-slate-100">{term.termName}</p>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
                        <span className="text-[#4a5578] dark:text-slate-400">Assessed<br /><strong className="text-[#14215b] dark:text-slate-100">{naira(term.assessed)}</strong></span>
                        <span className="text-[#4a5578] dark:text-slate-400">Paid<br /><strong className="text-emerald-700 dark:text-emerald-300">{naira(term.paid)}</strong></span>
                        <span className="text-[#4a5578] dark:text-slate-400">Outstanding<br /><strong className={term.outstanding > 0 ? 'text-[#800000] dark:text-red-300' : 'text-[#14215b] dark:text-slate-100'}>{naira(term.outstanding)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <h4 className="mt-5 text-sm font-black uppercase tracking-wide text-[#800020] dark:text-slate-300">Payments</h4>
            <div className="mt-2 space-y-1">
              {history.payments.map(payment => {
                const parts = history.allocations.filter(a => a.paymentId === payment.id);
                return (
                  <div key={payment.id} className="rounded-xl border border-[#c9a96e]/30 bg-white/60 p-2 text-sm dark:border-white/10 dark:bg-slate-800/40">
                    <p className="flex flex-wrap justify-between gap-2">
                      <strong className="text-[#14215b] dark:text-slate-100">{naira(payment.amount)}</strong>
                      <span className="text-xs text-[#4a5578] dark:text-slate-400">
                        {payment.paymentType} · {payment.recordedAt ? new Date(payment.recordedAt).toLocaleDateString() : ''}
                        {payment.receiptNo ? ` · receipt ${payment.receiptNo}` : ''}
                      </span>
                    </p>
                    {parts.length ? (
                      <p className="text-xs text-[#4a5578] dark:text-slate-400">
                        Settled: {parts.map(part => `${part.sessionName} ${part.termName} (${naira(part.amount)})`).join(', ')}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {!history.payments.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No payments recorded yet.</p> : null}
            </div>
          </>
        ) : null}

        <div className="sticky bottom-0 -mx-5 mt-4 flex justify-end border-t border-[#c9a96e]/35 bg-[#fff8ee]/95 px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:pb-3 dark:border-white/10 dark:bg-slate-900/95">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function TermFeesBoard() {
  const [overview, setOverview] = useState(null);
  const [classes, setClasses] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState({ termId: '', classId: '', status: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payFor, setPayFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const loadDashboard = useCallback(async (nextFilters) => {
    const data = await getFeeAssessments(nextFilters);
    setDashboard(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overviewData, classData] = await Promise.all([
          getAcademicOverview(),
          getClasses().then(d => d?.classes || []).catch(() => []),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setClasses(classData);
        const termId = overviewData?.activeTerm?.id || '';
        setFilters(f => ({ ...f, termId }));
        await loadDashboard({ termId });
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load fee assessments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadDashboard]);

  const allTerms = useMemo(() => overview?.terms || [], [overview]);

  async function applyFilters(next) {
    setFilters(next);
    setError('');
    try {
      await loadDashboard(next);
    } catch (e) {
      setError(e.message || 'Could not load fee assessments.');
    }
  }

  async function handleGenerate() {
    const term = allTerms.find(t => t.id === filters.termId) || overview?.activeTerm;
    if (!term) { setError('Open a term first.'); return; }
    if (!window.confirm(`Generate ${term.name} fees for every enrolled student? Students are billed for the class they hold this session, and anything already paid is kept.`)) return;

    setBusy('generate'); setError(''); setNotice('');
    try {
      const result = await generateFeeAssessments({ termId: term.id });
      setNotice(`${term.name}: ${result.created} assessment${result.created === 1 ? '' : 's'} created, ${result.updated} refreshed${result.skipped ? `, ${result.skipped} skipped` : ''}.`);
      await loadDashboard(filters);
    } catch (e) {
      setError(e.message || 'Could not generate the fees.');
    } finally {
      setBusy('');
    }
  }

  async function handleCarryForward(dryRun) {
    setBusy('carry'); setError(''); setNotice('');
    try {
      const result = await carryOpeningBalances({ termId: filters.termId, dryRun });
      if (dryRun) {
        setNotice(result.carriedCount
          ? `Preview: ${result.carriedCount} student${result.carriedCount === 1 ? '' : 's'} would carry ${naira(result.carriedTotal)} of arrears into ${result.termName}. Nothing has been written.`
          : 'Preview: no arrears to carry forward.');
      } else {
        setNotice(`${result.carriedCount} opening balance${result.carriedCount === 1 ? '' : 's'} totalling ${naira(result.carriedTotal)} carried into ${result.termName}.`);
        await loadDashboard(filters);
      }
    } catch (e) {
      setError(e.message || 'Could not carry the balances forward.');
    } finally {
      setBusy('');
    }
  }

  const rows = useMemo(() => {
    const list = dashboard?.assessments || [];
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(row => `${row.studentName} ${row.studentDisplayId} ${row.className}`.toLowerCase().includes(needle));
  }, [dashboard, search]);

  if (loading) return <p className="text-sm text-[#800020] dark:text-slate-300">Loading fee assessments…</p>;

  const hasSession = Boolean(overview?.activeSession);

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#fff8ee] px-3 py-2 text-sm font-semibold text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{notice}</p> : null}

      {!hasSession ? (
        <div className={CARD}>
          <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">No active session</h3>
          <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
            Set up an academic session and open a term under Settings → Sessions &amp; Terms. Fees are billed per term, so a term has to be running before charges can be raised.
          </p>
        </div>
      ) : null}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">
              {dashboard?.term ? `${dashboard.term.name}` : 'Term fees'}
            </h3>
            <p className="text-sm text-[#191970] dark:text-slate-300">{overview?.activeSession?.name || ''}</p>
          </div>
          <button type="button" onClick={handleGenerate} disabled={busy === 'generate' || !hasSession} className={BTN}>
            {busy === 'generate' ? 'Generating…' : 'Generate term fees'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Assessed this term" value={naira(dashboard?.currentTerm?.assessed)} />
          <Stat label="Collected" value={naira(dashboard?.currentTerm?.collected)} tone="text-emerald-700 dark:text-emerald-300" />
          <Stat label="Outstanding" value={naira(dashboard?.currentTerm?.outstanding)} tone="text-[#800000] dark:text-red-300" />
          <Stat label="Students billed" value={dashboard?.currentTerm?.studentCount ?? 0} />
        </div>

        <h4 className="mt-5 text-sm font-black uppercase tracking-wide text-[#800020] dark:text-slate-300">Brought forward from earlier terms</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Stat label="Carried forward" value={naira(dashboard?.previousOutstanding?.carriedForward)} />
          <Stat label="Recovered" value={naira(dashboard?.previousOutstanding?.recovered)} tone="text-emerald-700 dark:text-emerald-300" />
          <Stat label="Still owed" value={naira(dashboard?.previousOutstanding?.remaining)} tone="text-amber-700 dark:text-amber-300" />
        </div>
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className={`${INPUT} flex-1 min-w-[160px]`} />
          <select value={filters.termId} onChange={e => applyFilters({ ...filters, termId: e.target.value })} className={INPUT}>
            <option value="">Active term</option>
            {allTerms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
          <select value={filters.classId} onChange={e => applyFilters({ ...filters, classId: e.target.value })} className={INPUT}>
            <option value="">All classes</option>
            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.arm ? ` ${cls.arm}` : ''}</option>)}
          </select>
          <select value={filters.status} onChange={e => applyFilters({ ...filters, status: e.target.value })} className={INPUT}>
            <option value="">Any status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partly paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* Desktop table */}
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#c9a96e]/40 text-xs uppercase tracking-wide text-[#800020] dark:border-white/10 dark:text-slate-400">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2 text-right">Assessed</th>
                <th className="px-2 py-2 text-right">Paid</th>
                <th className="px-2 py-2 text-right">Outstanding</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                  <td className="px-2 py-2 font-semibold text-[#14215b] dark:text-slate-100">
                    {row.studentName}
                    {row.discountAmount > 0 ? <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">-{naira(row.discountAmount)}</span> : null}
                  </td>
                  <td className="px-2 py-2 text-[#4a5578] dark:text-slate-300">{row.className || '—'}</td>
                  <td className="px-2 py-2 text-right text-[#14215b] dark:text-slate-100">{naira(row.netAmount)}</td>
                  <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{naira(row.amountPaid)}</td>
                  <td className="px-2 py-2 text-right font-bold text-[#800000] dark:text-red-300">{naira(row.outstanding)}</td>
                  <td className="px-2 py-2"><StatusPill status={row.status} /></td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setPayFor(row)} className="rounded-lg bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white">Pay</button>
                      <button type="button" onClick={() => setHistoryFor(row)} className="rounded-lg border border-[#c9a96e]/40 px-3 py-1.5 text-xs font-semibold text-[#14215b] dark:border-white/20 dark:text-slate-200">History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-3 space-y-2 md:hidden">
          {rows.map(row => (
            <div key={row.id} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:border-white/10 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[#14215b] dark:text-slate-100">{row.studentName}</p>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">{row.className || '—'}</p>
                </div>
                <StatusPill status={row.status} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span className="text-[#4a5578] dark:text-slate-400">Assessed<br /><strong className="text-[#14215b] dark:text-slate-100">{naira(row.netAmount)}</strong></span>
                <span className="text-[#4a5578] dark:text-slate-400">Paid<br /><strong className="text-emerald-700 dark:text-emerald-300">{naira(row.amountPaid)}</strong></span>
                <span className="text-[#4a5578] dark:text-slate-400">Owed<br /><strong className="text-[#800000] dark:text-red-300">{naira(row.outstanding)}</strong></span>
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setPayFor(row)} className="flex-1 rounded-lg bg-[#1a5c38] px-3 py-2 text-xs font-bold text-white">Record payment</button>
                <button type="button" onClick={() => setHistoryFor(row)} className="rounded-lg border border-[#c9a96e]/40 px-3 py-2 text-xs font-semibold text-[#14215b] dark:border-white/20 dark:text-slate-200">History</button>
              </div>
            </div>
          ))}
        </div>

        {!rows.length ? (
          <p className="mt-3 text-sm text-[#4a5578] dark:text-slate-400">
            No assessments for this view. Use “Generate term fees” once the fee template for this term is set up.
          </p>
        ) : null}
      </section>

      <section className={CARD}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Bring old balances forward</h3>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
          Fees kept before termly assessments existed are recorded as a single running total per student, which cannot be split back into terms.
          This carries whatever each student still owes into the current term as one “balance brought forward” charge. The old records are left untouched, and running it twice changes nothing.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 pb-[var(--safe-bottom)]">
          <button type="button" onClick={() => handleCarryForward(true)} disabled={busy === 'carry'} className={BTN_GHOST}>Preview</button>
          <button type="button" onClick={() => handleCarryForward(false)} disabled={busy === 'carry'} className={BTN}>
            {busy === 'carry' ? 'Working…' : 'Carry balances forward'}
          </button>
        </div>
      </section>

      {payFor ? (
        <PaymentDialog
          student={payFor}
          onClose={() => setPayFor(null)}
          onRecorded={async (result) => {
            setPayFor(null);
            setNotice(result.duplicate
              ? 'That payment had already been recorded.'
              : `${naira(result.payment.amount)} recorded${result.receipt?.receiptNo ? ` · receipt ${result.receipt.receiptNo}` : ''}.`);
            await loadDashboard(filters).catch(() => null);
          }}
        />
      ) : null}

      {historyFor ? <HistoryDialog student={historyFor} onClose={() => setHistoryFor(null)} /> : null}
    </div>
  );
}

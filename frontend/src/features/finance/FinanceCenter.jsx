import React, { useCallback, useEffect, useState } from 'react';
import {
  getFinanceAudit, getFinanceContext, getFinanceDashboard, listFinanceClaims, naira, reviewFinanceClaim, searchFeeArchives,
} from './financeApi';
import FeeStructuresTab from './FeeStructuresTab';
import StudentAccountsTab from './StudentAccountsTab';
import { BillingPeriodBanner, CARD, ChargeTable, INPUT, Metric, Notice, PRIMARY, SECONDARY, StatusChip, TD, TH } from './FinanceShared';

// Fees & Billing: one workspace for the Owner, Head of School and Accountant.
// Every view works inside the active billing period (session → term) and
// shows earlier balances separately rather than folding them into this term.

const TABS = [['dashboard', 'Dashboard'], ['structures', 'Fee Structures'], ['accounts', 'Student Accounts'], ['claims', 'Claims'], ['archives', 'Fee Archives'], ['audit', 'Audit']];

function DashboardTab({ context, onDrill }) {
  const [filters, setFilters] = useState({ classId: '', feeItem: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setData(null); getFinanceDashboard(filters).then(setData).catch(err => setError(err.message)); }, [filters]);
  if (error) return <Notice text={error} tone="error" />;
  if (!data) return <p role="status">Loading…</p>;
  const termFilter = { sessionId: context.period.sessionId, termId: context.period.termId, classId: filters.classId, feeItem: filters.feeItem };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Class" className={INPUT} value={filters.classId} onChange={event => setFilters(previous => ({ ...previous, classId: event.target.value }))}>
          <option value="">All classes</option>
          {context.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Fee type" className={INPUT} value={filters.feeItem} onChange={event => setFilters(previous => ({ ...previous, feeItem: event.target.value }))}>
          <option value="">All fee types</option>
          {data.byItem.map(row => <option key={row.feeItem} value={row.feeItem}>{row.feeItem}</option>)}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Expected" value={naira(data.expected)} hint="This term, after adjustments" onClick={() => onDrill('archives', termFilter)} />
        <Metric label="Collected" value={naira(data.collected)} onClick={() => onDrill('archives', { ...termFilter, status: 'settled' })} />
        <Metric label="Outstanding" value={naira(data.outstanding)} onClick={() => onDrill('archives', { ...termFilter, status: 'owing' })} />
        <Metric label="Previous-term arrears" value={naira(data.previousTermArrears)} hint="Kept separate from this term" onClick={() => onDrill('archives', { status: 'owing', classId: filters.classId })} />
        <Metric label="Collection rate" value={`${data.collectionRate}%`} />
        <Metric label="Students owing" value={data.studentsOwing} onClick={() => onDrill('archives', { ...termFilter, status: 'owing' })} />
        <Metric label="Unresolved claims" value={data.unresolvedClaims} onClick={() => onDrill('claims')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h4 className="mb-2 font-black text-[#800000] dark:text-white">By class</h4>
          <table className="w-full text-sm text-[#191970] dark:text-slate-200">
            <thead><tr><th className={TH}>Class</th><th className={TH}>Expected</th><th className={TH}>Collected</th><th className={TH}>Outstanding</th></tr></thead>
            <tbody>{data.byClass.map(row => (
              <tr key={row.classId} className="cursor-pointer border-t border-[#c9a96e]/30 hover:bg-white/50" onClick={() => onDrill('archives', { ...termFilter, classId: row.classId, status: 'owing' })}>
                <td className={TD}>{row.className}</td><td className={TD}>{naira(row.expected)}</td><td className={TD}>{naira(row.collected)}</td><td className={`${TD} font-bold`}>{naira(row.outstanding)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!data.byClass.length && <p className="text-sm">No bills issued this term yet.</p>}
        </section>
        <section className={CARD}>
          <h4 className="mb-2 font-black text-[#800000] dark:text-white">Recent payments</h4>
          <ul className="space-y-1 text-sm text-[#191970] dark:text-slate-200">
            {data.recentPayments.map(row => (
              <li key={row.id} className="flex flex-wrap gap-2 border-t border-[#c9a96e]/30 pt-1">
                <span className="flex-1">{row.studentName} · {row.method}{row.receiptNo ? ` · ${row.receiptNo}` : ''}</span>
                <span className="font-semibold">{naira(row.amount)}</span>
                {row.status === 'reversed' && <StatusChip status="reversed" />}
              </li>
            ))}
          </ul>
          {!data.recentPayments.length && <p className="text-sm">No payments yet.</p>}
        </section>
      </div>
    </div>
  );
}

export function ClaimsTab({ onPay }) {
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const load = useCallback(() => listFinanceClaims({ status }).then(setData).catch(err => setNotice({ text: err.message, tone: 'error' })), [status]);
  useEffect(() => { load(); }, [load]);
  const act = async (claim, action, reviewNote) => {
    try { await reviewFinanceClaim(claim.id, action, reviewNote); setRejecting(null); setNote(''); load(); } catch (err) { setNotice({ text: err.message, tone: 'error' }); }
  };
  return (
    <section className={`${CARD} space-y-3`}>
      <div className="flex flex-wrap gap-2">
        {[['open', 'Open'], ['resolved', 'Resolved'], ['auto_resolved', 'Auto-resolved'], ['rejected', 'Rejected'], ['', 'All']].map(([key, label]) => (
          <button key={key || 'all'} type="button" onClick={() => setStatus(key)} className={status === key ? PRIMARY : SECONDARY}>{label}</button>
        ))}
      </div>
      <Notice text={notice.text} tone={notice.tone} />
      {!data ? <p role="status">Loading…</p> : !data.claims.length ? <p className="text-sm text-[#191970] dark:text-slate-300">No claims here.</p> : (
        <ul className="space-y-2">
          {data.claims.map(claim => (
            <li key={claim.id} className="rounded-2xl bg-white/70 p-3 text-sm text-[#191970]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-bold">{claim.studentName} · {naira(claim.amount)}</span>
                <StatusChip status={claim.status} />
              </div>
              <p>{claim.method || 'Payment'}{claim.reference ? ` · ref ${claim.reference}` : ''}{claim.paidAt ? ` · paid ${claim.paidAt}` : ''} · claimed by {claim.claimantName || '—'} on {new Date(claim.createdAt).toLocaleDateString()}</p>
              {claim.note && <p className="italic">“{claim.note}”</p>}
              {claim.resolutionNote && <p className="text-xs">{claim.resolutionNote}{claim.resolvedBy ? ` — ${claim.resolvedBy}` : ''}</p>}
              {data.canReview && ['submitted', 'under_review'].includes(claim.status) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {claim.status === 'submitted' && <button type="button" className={SECONDARY} onClick={() => act(claim, 'start_review')}>Start review</button>}
                  <button type="button" className={PRIMARY} onClick={() => onPay(claim)}>Confirm payment</button>
                  <button type="button" className={`${SECONDARY} !text-rose-700`} onClick={() => setRejecting(claim.id)}>Reject</button>
                </div>
              )}
              {rejecting === claim.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input aria-label="Reason for rejecting" placeholder="Reason (the parent will see this)" className={`${INPUT} flex-1`} value={note} onChange={event => setNote(event.target.value)} />
                  <button type="button" className={`${PRIMARY} !bg-rose-700`} disabled={!note.trim()} onClick={() => act(claim, 'reject', note)}>Reject claim</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ArchivesTab({ context, initialFilters }) {
  const [filters, setFilters] = useState({ view: 'charges', status: 'settled', ...initialFilters });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setFilters(previous => ({ ...previous, ...initialFilters })); }, [initialFilters]);
  useEffect(() => { setData(null); searchFeeArchives(filters).then(setData).catch(err => setError(err.message)); }, [filters]);
  const set = patch => setFilters(previous => ({ ...previous, ...patch }));
  const session = context.sessions.find(item => item.id === filters.sessionId);
  const rows = data?.obligations || [];
  const totals = rows.reduce((sum, row) => ({ charged: sum.charged + row.netAmount, paid: sum.paid + row.amountPaid, balance: sum.balance + Math.max(row.balance, 0) }), { charged: 0, paid: 0, balance: 0 });

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-2`} aria-label="Archive filters">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={filters.view === 'charges' ? PRIMARY : SECONDARY} onClick={() => set({ view: 'charges' })}>Charges</button>
          <button type="button" className={filters.view === 'payments' ? PRIMARY : SECONDARY} onClick={() => set({ view: 'payments' })}>Payments against earlier debts</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Session" className={INPUT} value={filters.sessionId || ''} onChange={event => set({ sessionId: event.target.value, termId: '' })}>
            <option value="">All sessions</option>{context.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Term" className={INPUT} value={filters.termId || ''} onChange={event => set({ termId: event.target.value })} disabled={!session}>
            <option value="">All terms</option>{(session?.terms || []).map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
          <select aria-label="Class" className={INPUT} value={filters.classId || ''} onChange={event => set({ classId: event.target.value })}>
            <option value="">All classes</option>{context.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {filters.view === 'charges' ? (
            <>
              <input aria-label="Fee type" placeholder="Fee type (e.g. Tuition)" className={INPUT} value={filters.feeItem || ''} onChange={event => set({ feeItem: event.target.value })} />
              <select aria-label="Payment status" className={INPUT} value={filters.status || ''} onChange={event => set({ status: event.target.value })}>
                <option value="">Any status</option><option value="settled">Settled</option><option value="owing">Owing</option>
                <option value="not_paid">Not paid</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option>
                <option value="overpaid">Overpaid</option><option value="waived">Waived</option><option value="cancelled">Cancelled</option>
              </select>
              <label className="text-xs font-bold text-[#800020]">Billed from <input type="date" className={INPUT} value={filters.from || ''} onChange={event => set({ from: event.target.value })} /></label>
              <label className="text-xs font-bold text-[#800020]">to <input type="date" className={INPUT} value={filters.to || ''} onChange={event => set({ to: event.target.value })} /></label>
            </>
          ) : (
            <>
              <select aria-label="Debts not from session" className={INPUT} value={filters.debtSessionNot || ''} onChange={event => set({ debtSessionNot: event.target.value })}>
                <option value="">Debts from any session</option>{context.sessions.map(item => <option key={item.id} value={item.id}>Debts from before {item.name}</option>)}
              </select>
              <label className="text-xs font-bold text-[#800020]">Paid from <input type="date" className={INPUT} value={filters.paidFrom || ''} onChange={event => set({ paidFrom: event.target.value })} /></label>
              <label className="text-xs font-bold text-[#800020]">to <input type="date" className={INPUT} value={filters.paidTo || ''} onChange={event => set({ paidTo: event.target.value })} /></label>
            </>
          )}
        </div>
      </section>
      <Notice text={error} tone="error" />
      {!data ? <p role="status">Searching…</p> : filters.view === 'payments' ? (
        <section className={CARD}>
          <p className="mb-2 text-sm font-bold text-[#191970]">{data.payments.length} payment line(s) · {naira(data.payments.reduce((sum, row) => sum + row.amount, 0))}</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm text-[#191970] dark:text-slate-200">
            <thead><tr><th className={TH}>Paid on</th><th className={TH}>Student</th><th className={TH}>Debt from</th><th className={TH}>Fee</th><th className={TH}>Amount</th><th className={TH}>Receipt</th></tr></thead>
            <tbody>{data.payments.map((row, index) => <tr key={index} className="border-t border-[#c9a96e]/30"><td className={TD}>{row.paidOn}</td><td className={TD}>{row.studentName}<span className="block text-xs">{row.className}</span></td><td className={TD}>{row.debtPeriod}</td><td className={TD}>{row.feeItem}</td><td className={`${TD} font-semibold`}>{naira(row.amount)}</td><td className={TD}>{row.receiptNo}</td></tr>)}</tbody>
          </table></div>
        </section>
      ) : (
        <section className={`${CARD} space-y-2`}>
          <p className="text-sm font-bold text-[#191970] dark:text-white">{rows.length} charge(s) · charged {naira(totals.charged)} · paid {naira(totals.paid)} · owing {naira(totals.balance)}</p>
          <ChargeTable charges={rows.map(row => ({ ...row, feeItem: `${row.studentName || row.studentId} — ${row.feeItem}` }))} empty="Nothing matches these filters." />
        </section>
      )}
    </div>
  );
}

export function AuditTab() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getFinanceAudit({ limit: 300 }).then(data => setEntries(data.entries)).catch(err => setError(err.message)); }, []);
  if (error) return <Notice text={error} tone="error" />;
  if (!entries) return <p role="status">Loading…</p>;
  return (
    <section className={CARD}>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm text-[#191970] dark:text-slate-200">
        <thead><tr><th className={TH}>When</th><th className={TH}>Who</th><th className={TH}>Action</th><th className={TH}>Before</th><th className={TH}>After</th><th className={TH}>Reason</th></tr></thead>
        <tbody>{entries.map(row => (
          <tr key={row.id} className="border-t border-[#c9a96e]/30">
            <td className={TD}>{new Date(row.createdAt).toLocaleString()}</td><td className={TD}>{row.actorName || '—'}</td><td className={TD}>{row.action.replace(/_/g, ' ')}</td>
            <td className={`${TD} max-w-[14rem] break-words text-xs`}>{row.oldValue == null ? '—' : JSON.stringify(row.oldValue)}</td>
            <td className={`${TD} max-w-[14rem] break-words text-xs`}>{row.newValue == null ? '—' : JSON.stringify(row.newValue)}</td>
            <td className={TD}>{row.reason || '—'}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

export default function FinanceCenter({ initialTab = 'dashboard' }) {
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initialTab);
  const [archiveFilters, setArchiveFilters] = useState({});
  const [accountFocus, setAccountFocus] = useState(null);
  useEffect(() => { getFinanceContext().then(setContext).catch(err => setError(err.message)); }, []);

  if (error) return <div className="p-4"><Notice text={error} tone="error" /></div>;
  if (!context) return <p role="status" className="p-4">Loading Fees &amp; Billing…</p>;

  const drill = (target, filters = {}) => { if (target === 'archives') setArchiveFilters({ view: 'charges', status: '', ...filters }); setTab(target); };
  const payClaim = claim => { setAccountFocus({ studentId: claim.studentId, prefill: { claimId: claim.id, amount: claim.amount, reference: claim.reference, method: claim.method || 'transfer', obligationIds: claim.obligationIds } }); setTab('accounts'); };

  return (
    <div className="space-y-4">
      <BillingPeriodBanner period={context.period} />
      <nav className="flex gap-1.5 overflow-x-auto" aria-label="Fees and billing">
        {TABS.filter(([key]) => key !== 'audit' || context.canRecordPayments).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#800020]'}`}>{label}</button>
        ))}
      </nav>
      {tab === 'dashboard' && <DashboardTab context={context} onDrill={drill} />}
      {tab === 'structures' && <FeeStructuresTab context={context} />}
      {tab === 'accounts' && <StudentAccountsTab context={context} focus={accountFocus} onFocusUsed={() => setAccountFocus(null)} />}
      {tab === 'claims' && <ClaimsTab onPay={payClaim} />}
      {tab === 'archives' && <ArchivesTab context={context} initialFilters={archiveFilters} />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

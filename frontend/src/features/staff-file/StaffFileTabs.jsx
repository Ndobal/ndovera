import React, { useCallback, useEffect, useState } from 'react';
import {
  addStaffLoanPayment, addStaffRecord, addStaffReview, adjustStaffLoan, assignStaffTask, confirmStaffLoanPayment, createStaffLoan, decideStaffLoan,
  evaluateStaffTask, fileStaffReport, getRewardCertificate, getStaffAttendance, getStaffAudit, getStaffFinance, getStaffLoans, getStaffRecordHistory,
  getStaffRecords, getStaffReports, getStaffReviews, getStaffRewards, getStaffSubmissions, getStaffTasks, giveStaffReward, respondToStaffReport,
  reviseStaffRecord, setStaffReportStatus, updateStaffTask,
} from './staffFileApi';
import { uploadComplianceFile } from '../compliance/complianceApi';
import { BODY, CARD, HEADING, INNER, INPUT, LABEL, PRIMARY, SECONDARY, StatusChip, naira } from '../compliance/complianceUi';

// The tabs of the Digital Staff Office File. Each tab loads its own data and
// shows only the actions the server says this viewer may take.

const PRINT_CSS = '@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { position: absolute; inset: 0; padding: 2rem; background: #fff; } .no-print { display: none !important; } }';
const date = value => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function useLoad(loader, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    loader().then(next => { setData(next); setError(''); }).catch(err => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

function Feedback({ error, message }) {
  return (
    <>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{message}</p>}
    </>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const run = async (action, success = '') => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); return true; } catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  };
  return { busy, error, message, run };
}

function FilePicker({ label, onUploaded }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm ${BODY}`}>
      <span className="rounded-xl border border-dashed border-[#c9a96e]/70 px-3 py-1.5">{busy ? 'Uploading…' : label}</span>
      <input type="file" className="sr-only" aria-label={label} disabled={busy} onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true);
        try { onUploaded(await uploadComplianceFile(file)); } finally { setBusy(false); event.target.value = ''; }
      }} />
    </label>
  );
}

function Files({ files = [] }) {
  if (!files.length) return null;
  return <p className="mt-1 flex flex-wrap gap-2 text-xs">{files.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="underline">📎 {file.name}</a>)}</p>;
}

// ─── Records ─────────────────────────────────────────────────────────────────

const VISIBILITY_LABELS = { staff: 'Visible to the staff member', management: 'Management only', private: 'Private — the staff member, HoS, Owner and Accountant only', restricted: 'Owner only' };

function RecordForm({ staffId, categories, visibilities, initial, ownContactsOnly, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || { category: ownContactsOnly ? 'next_of_kin' : categories[0]?.key, title: '', detail: '', effectiveFrom: '', effectiveTo: '', status: '', visibility: visibilities.length === 1 ? visibilities[0] : '', files: [] });
  const { busy, error, run } = useAction();
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const choices = ownContactsOnly ? categories.filter(category => ['next_of_kin', 'emergency_contact'].includes(category.key)) : categories;
  const save = () => run(async () => {
    const payload = { ...form, visibility: form.visibility || undefined };
    if (initial?.id) await reviseStaffRecord(staffId, initial.id, payload); else await addStaffRecord(staffId, payload);
    onSaved();
  });
  return (
    <div className={`${INNER} grid gap-2 text-sm sm:grid-cols-2 ${BODY}`}>
      <label>Kind of record
        <select value={form.category} disabled={Boolean(initial)} onChange={event => set({ category: event.target.value })} className={`${INPUT} mt-1 w-full`}>
          {choices.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
        </select>
      </label>
      <label>Title<input value={form.title} onChange={event => set({ title: event.target.value })} className={`${INPUT} mt-1 w-full`} placeholder="e.g. Appointed Mathematics Teacher" /></label>
      <label className="sm:col-span-2">Details<textarea rows={3} value={form.detail} onChange={event => set({ detail: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>From<input type="date" value={form.effectiveFrom} onChange={event => set({ effectiveFrom: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>To (blank if current)<input type="date" value={form.effectiveTo} onChange={event => set({ effectiveTo: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      {!ownContactsOnly && (
        <label>Who can see it
          <select value={form.visibility} onChange={event => set({ visibility: event.target.value })} className={`${INPUT} mt-1 w-full`}>
            {visibilities.length > 1 && <option value="">Default for this kind of record</option>}
            {visibilities.map(value => <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <FilePicker label="Attach document" onUploaded={file => set({ files: [...(form.files || []), file] })} />
        <Files files={form.files} />
      </div>
      {error && <p role="alert" className="font-semibold text-rose-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" disabled={busy} onClick={save} className={PRIMARY}>{busy ? 'Saving…' : initial ? 'Save new version' : 'Add record'}</button>
        <button type="button" onClick={onCancel} className={SECONDARY}>Cancel</button>
      </div>
    </div>
  );
}

export function RecordsTab({ staffId }) {
  const { data, error, reload } = useLoad(() => getStaffRecords(staffId), [staffId]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  const records = data.records.filter(record => !filter || record.category === filter);
  const labelOf = key => data.categories.find(category => category.key === key)?.label || key;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Kind of record" className={INPUT}>
          <option value="">All records</option>
          {data.categories.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
        </select>
        {(data.canAdd || data.canAddOwnContacts) && !editing && <button type="button" className={PRIMARY} onClick={() => setEditing('new')}>Add record</button>}
      </div>
      {editing === 'new' && <RecordForm staffId={staffId} categories={data.categories} visibilities={data.visibilities} ownContactsOnly={!data.canAdd} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {!records.length && <p className={`${CARD} ${BODY}`}>No records here yet.</p>}
      {records.map(record => (editing === record.id
        ? <RecordForm key={record.id} staffId={staffId} categories={data.categories} visibilities={data.visibilities} initial={record} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
        : (
          <article key={record.id} className={INNER}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className={LABEL}>{record.visibility === 'private' ? '🔒 ' : ''}{labelOf(record.category)} · {VISIBILITY_LABELS[record.visibility]}</p>
                <p className={`font-black ${HEADING}`}>{record.title}</p>
                <p className={`text-xs ${BODY}`}>{record.effectiveFrom ? `${date(record.effectiveFrom)} – ${record.effectiveTo ? date(record.effectiveTo) : 'present'}` : date(record.createdAt)} · entered by {record.createdByName}</p>
                {record.detail && <p className={`mt-1 whitespace-pre-wrap text-sm ${BODY}`}>{record.detail}</p>}
                <Files files={record.files} />
              </div>
              <div className="flex gap-2">
                {data.canAdd && <button type="button" className={SECONDARY} onClick={() => setEditing(record.id)}>Edit</button>}
                {record.supersedesId && <button type="button" className={SECONDARY} onClick={() => getStaffRecordHistory(staffId, record.id).then(result => setHistory(result.versions))}>History</button>}
              </div>
            </div>
          </article>
        )))}
      {history && (
        <section className={CARD} aria-label="Record history">
          <div className="flex items-center justify-between"><h3 className={`font-black ${HEADING}`}>Every version</h3><button type="button" className={SECONDARY} onClick={() => setHistory(null)}>Close</button></div>
          <ol className={`mt-2 space-y-2 text-sm ${BODY}`}>
            {history.map((version, index) => <li key={version.id}><strong>{index === 0 ? 'Current' : `Version ${history.length - index}`}</strong> — {version.title} · {date(version.createdAt)} by {version.createdByName}{version.detail ? ` — ${version.detail}` : ''}</li>)}
          </ol>
        </section>
      )}
    </div>
  );
}

// ─── Loans ───────────────────────────────────────────────────────────────────

const LOAN_STATUS_LABELS = { submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', declined: 'Declined', active: 'Active', cleared: 'Cleared' };

function LoanStatement({ loan, staffName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Loan statement">
      <style>{PRINT_CSS}</style>
      <div className="print-area max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-[#191970]">
        <h2 className="text-xl font-black">{loan.status === 'cleared' ? 'Loan Clearance Statement' : 'Loan Statement'} — {loan.number}</h2>
        <p className="text-sm">{staffName} · issued {date(loan.issuedOn)}</p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            <tr><td>Principal</td><td className="text-right font-semibold">{naira(loan.principal)}</td></tr>
            {loan.adjusted ? <tr><td>Adjustments</td><td className="text-right">{naira(loan.adjusted)}</td></tr> : null}
            <tr><td>Total paid</td><td className="text-right">{naira(loan.totalPaid)}</td></tr>
            {loan.waived ? <tr><td>Waived</td><td className="text-right">{naira(loan.waived)}</td></tr> : null}
            <tr className="border-t"><td className="font-black">Outstanding</td><td className="text-right font-black">{naira(loan.outstanding)}</td></tr>
          </tbody>
        </table>
        <h3 className="mt-4 font-black">Transactions</h3>
        <table className="mt-1 w-full text-xs">
          <thead><tr className="text-left"><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Confirmed by</th></tr></thead>
          <tbody>{loan.transactions.map(tx => <tr key={tx.id} className="border-t"><td>{date(tx.paidOn || tx.createdAt)}</td><td>{tx.type}</td><td>{naira(tx.amount)}</td><td>{tx.status.replace('_', ' ')}</td><td>{tx.confirmedByName || '—'}</td></tr>)}</tbody>
        </table>
        {loan.status === 'cleared' && <p className="mt-4 text-lg font-black text-emerald-700">✓ Loan Cleared — 100% paid on {date(loan.clearedAt)}</p>}
        <div className="no-print mt-4 flex gap-2"><button type="button" className={PRIMARY} onClick={() => window.print()}>Print</button><button type="button" className={SECONDARY} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function LoanCard({ loan, canManage, isSelf, staffName, onChanged }) {
  const { busy, error, message, run } = useAction();
  const [payment, setPayment] = useState({ amount: '', paidOn: '', proof: [] });
  const [statement, setStatement] = useState(false);
  const [adjust, setAdjust] = useState({ type: 'waiver', amount: '', reason: '' });
  const decide = (decision, extra = {}) => run(() => decideStaffLoan(loan.id, { decision, ...extra }).then(onChanged), `Loan ${decision === 'activate' ? 'activated' : `${decision}d`}.`);
  return (
    <article className={INNER}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`font-black ${HEADING}`}>Staff Loan #{loan.number} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{LOAN_STATUS_LABELS[loan.status]}</span></p>
          <p className={`text-xs ${BODY}`}>{loan.purpose || (loan.source === 'existing' ? 'Recorded from before Ndovera' : '')}</p>
        </div>
        <button type="button" className={SECONDARY} onClick={() => setStatement(true)}>{loan.status === 'cleared' ? 'Clearance statement' : 'Statement'}</button>
      </div>
      <dl className={`mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 ${BODY}`}>
        <div><dt className={LABEL}>Principal</dt><dd className="font-semibold">{naira(loan.principal)}</dd></div>
        <div><dt className={LABEL}>Total paid</dt><dd className="font-semibold">{naira(loan.totalPaid)}</dd></div>
        <div><dt className={LABEL}>Outstanding</dt><dd className="font-black">{naira(loan.outstanding)}</dd></div>
        <div><dt className={LABEL}>Monthly</dt><dd>{loan.monthlyInstalment ? naira(loan.monthlyInstalment) : '—'}{loan.nextPaymentOn ? ` · next ${date(loan.nextPaymentOn)}` : ''}</dd></div>
      </dl>
      {loan.awaitingConfirmation > 0 && <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">🟡 {naira(loan.awaitingConfirmation)} awaiting confirmation</p>}
      {canManage && !isSelf && loan.transactions.filter(tx => tx.status === 'awaiting_confirmation').map(tx => (
        <div key={tx.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className={BODY}>{naira(tx.amount)} paid {date(tx.paidOn)} — {tx.createdByName}</span><Files files={tx.proof} />
          <button type="button" disabled={busy} className={SECONDARY} onClick={() => run(() => confirmStaffLoanPayment(loan.id, tx.id, { confirm: true }).then(onChanged), 'Payment confirmed.')}>Confirm</button>
          <button type="button" disabled={busy} className={SECONDARY} onClick={() => { const note = window.prompt('Why is this payment being rejected?'); if (note) run(() => confirmStaffLoanPayment(loan.id, tx.id, { confirm: false, note }).then(onChanged), 'Payment rejected.'); }}>Reject</button>
        </div>
      ))}
      {canManage && !isSelf && (
        <div className="mt-2 flex flex-wrap gap-2">
          {['submitted'].includes(loan.status) && <button type="button" disabled={busy} className={SECONDARY} onClick={() => decide('review')}>Mark under review</button>}
          {['submitted', 'under_review'].includes(loan.status) && <button type="button" disabled={busy} className={SECONDARY} onClick={() => decide('approve')}>Approve</button>}
          {['submitted', 'under_review', 'approved'].includes(loan.status) && <button type="button" disabled={busy} className={SECONDARY} onClick={() => { const note = window.prompt('Reason for declining'); if (note) decide('decline', { note }); }}>Decline</button>}
          {loan.status === 'approved' && <button type="button" disabled={busy} className={PRIMARY} onClick={() => decide('activate', { nextPaymentOn: window.prompt('First repayment date (YYYY-MM-DD)', '') || undefined })}>Disburse — make active</button>}
        </div>
      )}
      {loan.status === 'active' && (isSelf || canManage) && (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <label className={BODY}>Amount<input type="number" min="1" value={payment.amount} onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))} className={`${INPUT} ml-1 w-32`} /></label>
          <label className={BODY}>Date<input type="date" value={payment.paidOn} onChange={event => setPayment(current => ({ ...current, paidOn: event.target.value }))} className={`${INPUT} ml-1`} /></label>
          {isSelf && <FilePicker label="Proof (optional)" onUploaded={file => setPayment(current => ({ ...current, proof: [...current.proof, file] }))} />}
          <button type="button" disabled={busy || !payment.amount} className={PRIMARY} onClick={() => run(() => addStaffLoanPayment(loan.id, payment).then(() => { setPayment({ amount: '', paidOn: '', proof: [] }); onChanged(); }), isSelf ? 'Payment reported — waiting for confirmation.' : 'Verified payment recorded.')}>
            {isSelf ? 'I have paid' : 'Record verified payment'}
          </button>
        </div>
      )}
      {loan.status === 'active' && canManage && !isSelf && (
        <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <select value={adjust.type} onChange={event => setAdjust(current => ({ ...current, type: event.target.value }))} aria-label="Change type" className={INPUT}><option value="waiver">Waive</option><option value="adjustment">Adjust (+/−)</option></select>
          <input type="number" value={adjust.amount} onChange={event => setAdjust(current => ({ ...current, amount: event.target.value }))} placeholder="Amount" aria-label="Adjustment amount" className={`${INPUT} w-28`} />
          <input value={adjust.reason} onChange={event => setAdjust(current => ({ ...current, reason: event.target.value }))} placeholder="Reason (kept in the audit trail)" aria-label="Adjustment reason" className={`${INPUT} min-w-[200px] flex-1`} />
          <button type="button" disabled={busy} className={SECONDARY} onClick={() => run(() => adjustStaffLoan(loan.id, adjust).then(() => { setAdjust({ type: 'waiver', amount: '', reason: '' }); onChanged(); }), 'Loan updated.')}>Apply</button>
        </div>
      )}
      <Feedback error={error} message={message} />
      {statement && <LoanStatement loan={loan} staffName={staffName} onClose={() => setStatement(false)} />}
    </article>
  );
}

export function LoansTab({ staffId, staffName }) {
  const { data, error, reload } = useLoad(() => getStaffLoans(staffId), [staffId]);
  const [form, setForm] = useState(null);
  const { busy, error: formError, run } = useAction();
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  const save = () => run(() => createStaffLoan(staffId, form).then(() => { setForm(null); reload(); }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {data.canApply && !form && <button type="button" className={PRIMARY} onClick={() => setForm({ principal: '', purpose: '', periodMonths: '', monthlyInstalment: '' })}>Apply for a loan</button>}
        {data.canManage && !data.canApply && !form && <button type="button" className={SECONDARY} onClick={() => setForm({ existing: true, principal: '', issuedOn: '', alreadyRepaid: '', monthlyInstalment: '', purpose: '' })}>Record an existing loan</button>}
      </div>
      {form && (
        <div className={`${INNER} grid gap-2 text-sm sm:grid-cols-2 ${BODY}`}>
          <label>Amount (₦)<input type="number" min="1" value={form.principal} onChange={event => setForm(current => ({ ...current, principal: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label>Purpose<input value={form.purpose} onChange={event => setForm(current => ({ ...current, purpose: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          {form.existing ? (
            <>
              <label>Date issued<input type="date" value={form.issuedOn} onChange={event => setForm(current => ({ ...current, issuedOn: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
              <label>Already repaid (₦)<input type="number" min="0" value={form.alreadyRepaid} onChange={event => setForm(current => ({ ...current, alreadyRepaid: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
            </>
          ) : (
            <label>Repayment period (months)<input type="number" min="1" value={form.periodMonths} onChange={event => setForm(current => ({ ...current, periodMonths: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          )}
          <label>Monthly instalment (₦, optional)<input type="number" min="1" value={form.monthlyInstalment} onChange={event => setForm(current => ({ ...current, monthlyInstalment: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          {formError && <p role="alert" className="font-semibold text-rose-700 sm:col-span-2">{formError}</p>}
          <div className="flex gap-2 sm:col-span-2"><button type="button" disabled={busy} onClick={save} className={PRIMARY}>{form.existing ? 'Record loan' : 'Submit application'}</button><button type="button" className={SECONDARY} onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      {!data.loans.length && <p className={`${CARD} ${BODY}`}>No loans on file.</p>}
      {data.loans.map(loan => <LoanCard key={loan.id} loan={loan} canManage={data.canManage} isSelf={data.canApply} staffName={staffName} onChanged={reload} />)}
    </div>
  );
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function TasksTab({ staffId }) {
  const { data, error, reload } = useLoad(() => getStaffTasks(staffId), [staffId]);
  const [form, setForm] = useState(null);
  const { busy, error: actionError, message, run } = useAction();
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <div className="space-y-3">
      {data.canAssign && !form && <button type="button" className={PRIMARY} onClick={() => setForm({ title: '', description: '', dueOn: '', priority: 'normal' })}>Assign a task</button>}
      {form && (
        <div className={`${INNER} grid gap-2 text-sm sm:grid-cols-2 ${BODY}`}>
          <label className="sm:col-span-2">Task<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label className="sm:col-span-2">Details<textarea rows={2} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label>Due<input type="date" value={form.dueOn} onChange={event => setForm(current => ({ ...current, dueOn: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label>Priority<select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))} className={`${INPUT} mt-1 w-full`}>{['low', 'normal', 'high', 'urgent'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} className={PRIMARY} onClick={() => run(() => assignStaffTask({ ...form, staffIds: [staffId] }).then(() => { setForm(null); reload(); }), 'Task assigned.')}>Assign</button>
            <button type="button" className={SECONDARY} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      <Feedback error={actionError} message={message} />
      {!data.tasks.length && <p className={`${CARD} ${BODY}`}>No tasks.</p>}
      {data.tasks.map(task => (
        <article key={task.id} className={INNER}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className={`font-black ${HEADING}`}>{task.title}</p>
              <p className={`text-xs ${BODY}`}>Assigned by {task.assignedByName} · due {date(task.dueOn)} · priority {task.priority} · <strong>{task.status.replace('_', ' ')}</strong></p>
              {task.description && <p className={`mt-1 text-sm ${BODY}`}>{task.description}</p>}
              {task.progressNote && <p className={`mt-1 text-sm italic ${BODY}`}>“{task.progressNote}”</p>}
              <Files files={task.evidence} />
              {task.rating && <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{task.rating}{task.score != null ? ` — ${task.score}/100` : ''}{task.comments ? ` · ${task.comments}` : ''} ({task.evaluatedByName})</p>}
            </div>
          </div>
          {data.canUpdate && task.status !== 'completed' && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={SECONDARY} onClick={() => { const note = window.prompt('Progress note'); if (note !== null) run(() => updateStaffTask(task.id, { status: 'in_progress', note }).then(reload), 'Progress saved.'); }}>Update progress</button>
              <FilePicker label="Add evidence" onUploaded={file => run(() => updateStaffTask(task.id, { status: task.status === 'assigned' ? 'in_progress' : task.status, evidence: [file] }).then(reload))} />
              <button type="button" disabled={busy} className={PRIMARY} onClick={() => { const note = window.prompt('What was done?'); if (note !== null) run(() => updateStaffTask(task.id, { status: 'submitted', note }).then(reload), 'Submitted for evaluation.'); }}>Submit as done</button>
            </div>
          )}
          {data.canAssign && task.status !== 'completed' && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={LABEL}>Mark completed:</span>
              {data.ratings.map(rating => (
                <button key={rating} type="button" disabled={busy} className={SECONDARY} onClick={() => {
                  const score = window.prompt('Score out of 100 (optional)', '');
                  const comments = window.prompt('Comments (optional)', '') || '';
                  run(() => evaluateStaffTask(task.id, { rating, score: score === null || score === '' ? undefined : Number(score), comments }).then(reload), 'Task completed.');
                }}>{rating}</button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function ReviewsTab({ staffId }) {
  const { data, error, reload } = useLoad(() => getStaffReviews(staffId), [staffId]);
  const [form, setForm] = useState(null);
  const { busy, error: actionError, run } = useAction();
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <div className="space-y-3">
      {data.canWrite && !form && <button type="button" className={PRIMARY} onClick={() => setForm({ periodLabel: '', criteria: data.criteria.map(label => ({ label, score: '' })), comments: '', internalNotes: '' })}>Record a performance review</button>}
      {form && (
        <div className={`${INNER} space-y-2 text-sm ${BODY}`}>
          <label className="block">Period<input value={form.periodLabel} onChange={event => setForm(current => ({ ...current, periodLabel: event.target.value }))} placeholder="Term 1 2026/2027" className={`${INPUT} mt-1 w-full`} /></label>
          <div className="grid gap-2 sm:grid-cols-2">
            {form.criteria.map((criterion, index) => (
              <label key={criterion.label} className="flex items-center justify-between gap-2">{criterion.label}
                <input type="number" min="0" max="100" value={criterion.score} aria-label={`${criterion.label} score`} onChange={event => setForm(current => ({ ...current, criteria: current.criteria.map((item, at) => (at === index ? { ...item, score: event.target.value } : item)) }))} className={`${INPUT} w-20`} />
              </label>
            ))}
          </div>
          <label className="block">Comments the staff member sees<textarea rows={2} value={form.comments} onChange={event => setForm(current => ({ ...current, comments: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label className="block">Internal notes (management only)<textarea rows={2} value={form.internalNotes} onChange={event => setForm(current => ({ ...current, internalNotes: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <Feedback error={actionError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={PRIMARY} onClick={() => run(() => addStaffReview(staffId, { ...form, criteria: form.criteria.filter(item => item.score !== '').map(item => ({ label: item.label, score: Number(item.score) })) }).then(() => { setForm(null); reload(); }))}>Save review</button>
            <button type="button" className={SECONDARY} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      <section className={CARD}>
        <h3 className={`mb-2 font-black ${HEADING}`}>Formal performance reviews</h3>
        {!data.formal.length && <p className={`text-sm ${BODY}`}>None recorded.</p>}
        {data.formal.map(review => (
          <article key={review.id} className={`${INNER} mb-2`}>
            <p className={`font-black ${HEADING}`}>{review.periodLabel} — {review.overall}%</p>
            <p className={`text-sm ${BODY}`}>{review.criteria.map(item => `${item.label}: ${item.score}%`).join(' · ')}</p>
            {review.comments && <p className={`mt-1 text-sm ${BODY}`}>{review.comments}</p>}
            {review.internalNotes && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Internal: {review.internalNotes}</p>}
            <p className={`text-xs ${BODY}`}>{review.reviewerName} · {date(review.createdAt)}</p>
          </article>
        ))}
      </section>
      <section className={CARD}>
        <h3 className={`mb-2 font-black ${HEADING}`}>Peer reviews</h3>
        {!data.peer.length && <p className={`text-sm ${BODY}`}>No peer reviews yet.</p>}
        {data.peer.map(entry => <p key={entry.evaluationId} className={`text-sm ${BODY}`}>{entry.title}{entry.periodLabel ? ` (${entry.periodLabel})` : ''}: average {entry.average ?? '—'} from {entry.responses} review{entry.responses === 1 ? '' : 's'}</p>)}
      </section>
    </div>
  );
}

// ─── Reports about staff ─────────────────────────────────────────────────────

const REPORT_STATUS_LABELS = { submitted: 'Submitted', under_review: 'Under review', response_requested: 'Staff response requested', investigated: 'Investigated', substantiated: 'Substantiated', unsubstantiated: 'Unsubstantiated', action_taken: 'Action taken', closed: 'Closed' };

export function ReportsTab({ staffId, isSelf }) {
  const { data, error, reload } = useLoad(() => getStaffReports(staffId), [staffId]);
  const [form, setForm] = useState(null);
  const { busy, error: actionError, message, run } = useAction();
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <div className="space-y-3">
      {!isSelf && !form && <button type="button" className={SECONDARY} onClick={() => setForm({ category: 'Professional conduct', details: '', confidential: true })}>Report a concern</button>}
      {form && (
        <div className={`${INNER} space-y-2 text-sm ${BODY}`}>
          <label className="block">Category<input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label className="block">What happened<textarea rows={4} value={form.details} onChange={event => setForm(current => ({ ...current, details: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.confidential} onChange={event => setForm(current => ({ ...current, confidential: event.target.checked }))} />Keep my name from the staff member (management will still know)</label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={PRIMARY} onClick={() => run(() => fileStaffReport(staffId, form).then(() => { setForm(null); reload(); }), 'Report filed. Management will review it.')}>File report</button>
            <button type="button" className={SECONDARY} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      <Feedback error={actionError} message={message} />
      {!data.reports.length && <p className={`${CARD} ${BODY}`}>{isSelf ? 'No reports require your attention.' : 'No reports on file.'}</p>}
      {data.reports.map(report => (
        <article key={report.id} className={INNER}>
          <p className={LABEL}>Report — {date(report.createdAt)} · {report.category}</p>
          <p className={`font-black ${HEADING}`}>Status: {REPORT_STATUS_LABELS[report.status] || report.status}</p>
          <p className={`mt-1 whitespace-pre-wrap text-sm ${BODY}`}>{report.details}</p>
          {report.reporterName && <p className={`text-xs ${BODY}`}>Reported by {report.reporterName}{report.confidential ? ' (confidential — not shown to the staff member)' : ''}</p>}
          {report.managementResponse && <p className={`mt-1 text-sm ${BODY}`}><strong>Management:</strong> {report.managementResponse}</p>}
          {report.staffResponse && <p className={`mt-1 text-sm ${BODY}`}><strong>Staff response:</strong> {report.staffResponse}</p>}
          {report.outcome && <p className={`mt-1 text-sm ${BODY}`}><strong>Outcome:</strong> {report.outcome}</p>}
          {data.canRespond && report.status !== 'closed' && (
            <button type="button" className={`${PRIMARY} mt-2`} disabled={busy} onClick={() => { const response = window.prompt('Your response', report.staffResponse || ''); if (response) run(() => respondToStaffReport(report.id, response).then(reload), 'Response saved.'); }}>
              {report.staffResponse ? 'Update my response' : 'Respond'}
            </button>
          )}
          {data.canInvestigate && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select defaultValue="" aria-label="Move report to" className={INPUT} onChange={event => {
                const status = event.target.value;
                if (!status) return;
                const managementResponse = window.prompt('Note to record with this step (optional)', '') || '';
                const outcome = ['substantiated', 'unsubstantiated', 'action_taken', 'closed'].includes(status) ? (window.prompt('Outcome (optional)', '') || '') : '';
                run(() => setStaffReportStatus(report.id, { status, managementResponse, outcome }).then(reload), 'Report updated.');
                event.target.value = '';
              }}>
                <option value="">Move to…</option>
                {data.statuses.filter(status => status !== report.status).map(status => <option key={status} value={status}>{REPORT_STATUS_LABELS[status]}</option>)}
              </select>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

function Certificate({ rewardId, onClose }) {
  const { data, error } = useLoad(() => getRewardCertificate(rewardId), [rewardId]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Certificate">
      <style>{PRINT_CSS}</style>
      <div className="print-area w-full max-w-3xl rounded-3xl border-8 border-double border-[#c9a96e] bg-[#fffdf5] p-10 text-center text-[#191970]">
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            {data.school.logoUrl && <img src={data.school.logoUrl} alt="" className="mx-auto h-16 w-16 object-contain" />}
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em]">{data.school.name}</p>
            <h2 className="mt-4 text-4xl font-black text-[#800000]">{data.reward.title}</h2>
            <p className="mt-6 text-sm uppercase tracking-widest">Presented to</p>
            <p className="mt-1 text-3xl font-black">{data.staff.name}</p>
            {data.reward.reason && <p className="mx-auto mt-4 max-w-lg text-base">{data.reward.reason}</p>}
            <p className="mt-6 text-sm">{data.reward.periodLabel || date(data.reward.awardedOn)}</p>
            <p className="mt-8 text-sm">Awarded by {data.reward.awardedByName}</p>
          </>
        )}
        <div className="no-print mt-6 flex justify-center gap-2"><button type="button" className={PRIMARY} onClick={() => window.print()}>Print</button><button type="button" className={SECONDARY} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export function RewardsTab({ staffId }) {
  const { data, error, reload } = useLoad(() => getStaffRewards(staffId), [staffId]);
  const [form, setForm] = useState(null);
  const [certificate, setCertificate] = useState('');
  const { busy, error: actionError, run } = useAction();
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <div className="space-y-3">
      {data.canGive && !form && <button type="button" className={PRIMARY} onClick={() => setForm({ title: '', type: 'certificate', reason: '', periodLabel: '', badge: '🏆' })}>Give an award</button>}
      {form && (
        <div className={`${INNER} grid gap-2 text-sm sm:grid-cols-2 ${BODY}`}>
          <label>Award<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Outstanding Teacher Award" className={`${INPUT} mt-1 w-full`} /></label>
          <label>Kind<select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))} className={`${INPUT} mt-1 w-full`}>{data.types.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="sm:col-span-2">Reason<input value={form.reason} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
          <label>Period<input value={form.periodLabel} onChange={event => setForm(current => ({ ...current, periodLabel: event.target.value }))} placeholder="First Term 2026/2027" className={`${INPUT} mt-1 w-full`} /></label>
          <label>Badge<select value={form.badge} onChange={event => setForm(current => ({ ...current, badge: event.target.value }))} className={`${INPUT} mt-1 w-full`}>{['🏆', '🥇', '⭐', '🎖️', '📚', '⏰', '💡', '❤️'].map(badge => <option key={badge} value={badge}>{badge}</option>)}</select></label>
          <Feedback error={actionError} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} className={PRIMARY} onClick={() => run(() => giveStaffReward(staffId, form).then(() => { setForm(null); reload(); }))}>Award</button>
            <button type="button" className={SECONDARY} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {!data.rewards.length && <p className={`${CARD} ${BODY}`}>No awards yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.rewards.map(reward => (
          <article key={reward.id} className={INNER}>
            <p className={`font-black ${HEADING}`}>{reward.badge} {reward.title}</p>
            <p className={`text-sm ${BODY}`}>Awarded: {reward.periodLabel || date(reward.awardedOn)}{reward.reason ? ` · ${reward.reason}` : ''}</p>
            <p className={`text-xs ${BODY}`}>Awarded by {reward.awardedByName}</p>
            {reward.certificate && <button type="button" className={`${SECONDARY} mt-2`} onClick={() => setCertificate(reward.id)}>Certificate</button>}
          </article>
        ))}
      </div>
      {certificate && <Certificate rewardId={certificate} onClose={() => setCertificate('')} />}
    </div>
  );
}

// ─── Read-only tabs ──────────────────────────────────────────────────────────

export function SubmissionsTab({ staffId }) {
  const { data, error } = useLoad(() => getStaffSubmissions(staffId), [staffId]);
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <div className="space-y-3">
      <section className={CARD}>
        <h3 className={`mb-2 font-black ${HEADING}`}>This week</h3>
        {!data.items.length && <p className={`text-sm ${BODY}`}>No submission requirements apply.</p>}
        {data.items.map(item => (
          <div key={`${item.ruleId}:${item.periodKey}`} className={`flex flex-wrap items-center justify-between gap-2 py-1 text-sm ${BODY}`}>
            <span>{item.ruleName}{item.missing.length ? <span className="text-rose-700 dark:text-rose-300"> — missing: {item.missing.join(', ')}</span> : ''}</span>
            <StatusChip item={item} />
          </div>
        ))}
      </section>
      {data.history.length > 0 && (
        <section className={CARD}>
          <h3 className={`mb-2 font-black ${HEADING}`}>Compliance history</h3>
          <table className={`w-full text-sm ${BODY}`}>
            <thead><tr className="text-left">{['Week', 'Required', 'On time', 'Late', 'Missing'].map(head => <th key={head} className={LABEL}>{head}</th>)}</tr></thead>
            <tbody>{data.history.map(week => <tr key={week.weekStart} className="border-t border-[#c9a96e]/25"><td className="py-1">{week.label}</td><td>{week.required}</td><td>{week.onTime}</td><td>{week.late}</td><td>{week.missing + week.partial}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <section className={CARD}>
        <h3 className={`mb-2 font-black ${HEADING}`}>Submitted work</h3>
        {!data.work.length && <p className={`text-sm ${BODY}`}>Nothing submitted yet.</p>}
        <ul className={`space-y-1 text-sm ${BODY}`}>{data.work.map(item => <li key={item.id}>{date(item.submittedAt)} — {item.typeLabel}: {item.subjectName} {item.className}{item.periodLabel ? `, ${item.periodLabel}` : ''} <span className="text-xs">({item.status.replace('_', ' ')})</span></li>)}</ul>
      </section>
    </div>
  );
}

export function AttendanceTab({ staffId }) {
  const { data, error } = useLoad(() => getStaffAttendance(staffId), [staffId]);
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  const a = data.attendance;
  return (
    <section className={`${CARD} space-y-2`}>
      <p className={`text-sm ${BODY}`}>Since {date(a.from)}: present {a.daysPresent} of {a.schoolDays} school days{a.rate != null ? ` (${a.rate}%)` : ''}, late on {a.lateDays} day{a.lateDays === 1 ? '' : 's'}.</p>
      <ul className={`space-y-1 text-sm ${BODY}`}>{a.recent.map((row, index) => <li key={`${row.date}-${index}`}>{date(row.date)} — {row.action.replace(/_/g, ' ')}{row.late ? ` · late ${row.lateMinutes} min` : ''}</li>)}</ul>
    </section>
  );
}

export function FinanceTab({ staffId }) {
  const { data, error } = useLoad(() => getStaffFinance(staffId), [staffId]);
  if (error) return <Feedback error={error} />;
  if (!data) return <p role="status" className={BODY}>Loading…</p>;
  return (
    <section className={CARD}>
      <h3 className={`mb-2 font-black ${HEADING}`}>Payroll history</h3>
      {!data.payroll.length && <p className={`text-sm ${BODY}`}>No payroll entries.</p>}
      {data.payroll.length > 0 && (
        <table className={`w-full text-sm ${BODY}`}>
          <thead><tr className="text-left">{['Period', 'Gross', 'Deductions', 'Net', 'Status'].map(head => <th key={head} className={LABEL}>{head}</th>)}</tr></thead>
          <tbody>{data.payroll.map(row => <tr key={row.period} className="border-t border-[#c9a96e]/25"><td className="py-1">{row.period}</td><td>{naira(row.gross)}</td><td>{naira(row.deductions)}</td><td className="font-semibold">{naira(row.net)}</td><td>{row.paymentStatus || row.status}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

export function ActivityTab({ staffId, activity, canAudit }) {
  const { data } = useLoad(() => (canAudit ? getStaffAudit(staffId) : Promise.resolve(null)), [staffId, canAudit]);
  return (
    <div className="space-y-3">
      <section className={CARD}>
        <h3 className={`mb-2 font-black ${HEADING}`}>Timeline</h3>
        {!activity.length && <p className={`text-sm ${BODY}`}>Nothing yet.</p>}
        <ol className={`space-y-1 text-sm ${BODY}`}>{activity.map((entry, index) => <li key={`${entry.at}-${index}`}><span className="font-semibold">{date(entry.at)}</span> — {entry.text}</li>)}</ol>
      </section>
      {canAudit && data?.audit && (
        <section className={CARD}>
          <h3 className={`mb-2 font-black ${HEADING}`}>Audit trail</h3>
          <ol className={`space-y-1 text-xs ${BODY}`}>{data.audit.map(entry => <li key={entry.id}>{new Date(entry.createdAt).toLocaleString()} — <strong>{entry.actorName}</strong> ({entry.actorRole}) {entry.action.replace(/_/g, ' ')}{entry.reason ? ` · “${entry.reason}”` : ''}</li>)}</ol>
        </section>
      )}
    </div>
  );
}

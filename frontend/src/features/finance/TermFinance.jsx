import React, { useEffect, useMemo, useState } from 'react';
import { getTermFinanceReport, runFinanceAI } from '../school/services/schoolApi';
import { getFeeReports, getFeesOverview, naira } from './simple/simpleFeesApi';

// The Finance tabs that read a term's money: Income & Expenditure, the written
// finance report, and the current term's fee template. All three follow the
// term the school is in (Academic Sessions) and take their fee figures from
// student accounts, so they agree with Fees & Billing.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-slate-200';
const HEADING = 'text-lg font-black text-[#800000] dark:text-white';
const LABEL = 'text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-[#c9a96e]';
const BTN = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white hover:bg-[#154a2e] disabled:opacity-50';
const OUTLINE = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-4 py-2 text-sm font-bold text-[#800020] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100';
const TH = 'p-2 text-left text-xs font-bold uppercase text-[#800020] dark:text-[#c9a96e]';
const TD = 'p-2';
const GOOD = 'text-[#1a5c38] dark:text-emerald-300';
const BAD = 'text-[#9f1239] dark:text-rose-300';

export function formatDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(value || ''))) return '';
  return new Date(`${String(value).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function TermPicker({ terms, value, onChange }) {
  if (!terms?.length) return null;
  return (
    <select aria-label="Term" value={value} onChange={event => onChange(event.target.value)} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm font-semibold text-[#191970] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100">
      {terms.map(term => <option key={term.id} value={term.id}>{term.sessionName} · {term.name}{term.current ? ' (current)' : ''}</option>)}
    </select>
  );
}

function Stat({ label, value, note, tone = '' }) {
  return (
    <div className={CARD}>
      <p className={LABEL}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone || 'text-[#191970] dark:text-white'}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs font-semibold">{note}</p>}
    </div>
  );
}

function Table({ columns, rows, align = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[#c9a96e]/40">{columns.map((column, index) => <th key={`${column}-${index}`} className={`${TH} ${align[index] === 'right' ? 'text-right' : ''}`}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[#c9a96e]/20 last:border-0">
              {row.map((cell, index) => <td key={index} className={`${TD} ${align[index] === 'right' ? 'text-right' : ''} ${index === 0 ? 'font-semibold' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function periodText(window) {
  if (!window) return '';
  return `${formatDay(window.from)} – ${formatDay(window.to)}${window.ongoing ? ' (to date)' : ''}`;
}

/** Income & Expenditure for a term: fees collected (as in Fees & Billing) against spending dated inside the term. */
export function IncomeExpenditure() {
  const [termId, setTermId] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setReport(null); setError('');
    getTermFinanceReport(termId).then(result => setReport(result.report || null)).catch(err => setError(err.message || 'Could not load the term.'));
  }, [termId]);

  if (error) return <section className={CARD}><p role="alert" className="font-semibold">{error}</p></section>;
  if (!report) return <section className={CARD}><p role="status">Loading the term's figures…</p></section>;
  const { fees, spending, payroll, previous } = report;
  const max = Math.max(fees.collected, spending.total, 1);
  const change = (now, then) => (then > 0 ? `${now >= then ? '+' : '−'}${Math.abs(Math.round(((now - then) / then) * 100))}%` : '—');

  return (
    <div className="space-y-4">
      <section className={`${CARD} flex flex-wrap items-center gap-3`}>
        <div className="flex-1">
          <h2 className={HEADING}>Income &amp; Expenditure · {report.term.name}, {report.term.sessionName}</h2>
          <p className="text-sm font-semibold">{periodText(report.window)}</p>
        </div>
        <TermPicker terms={report.terms} value={report.term.id} onChange={setTermId} />
      </section>

      {fees.source !== 'fees' && (
        <p role="status" className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          {fees.source === 'template'
            ? 'This term\'s fees are kept in the Fee Template, so fee figures come from it.'
            : `No fees have been published for ${report.term.name} yet. Publish them in Fees & Billing to see what is expected and collected.`}
        </p>
      )}
      {!report.window.datedStart && (
        <p role="status" className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">This term has no start date in Academic Sessions, so spending is counted from the first day of this month.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fees collected" value={naira(fees.collected)} note={fees.expected ? `${fees.collectionRate}% of ${naira(fees.expected)} expected` : 'No fees expected yet'} tone={GOOD} />
        <Stat label="Spending" value={naira(spending.total)} note={`${spending.count} expense${spending.count === 1 ? '' : 's'} recorded this term`} tone={BAD} />
        <Stat label={report.net >= 0 ? 'Surplus' : 'Shortfall'} value={naira(Math.abs(report.net))} note="Fees collected − spending" tone={report.net >= 0 ? GOOD : BAD} />
        <Stat label="Fees still owed" value={naira(fees.outstanding)} note={`${fees.partPaid + fees.unpaid} student${fees.partPaid + fees.unpaid === 1 ? '' : 's'} owing`} />
      </div>

      <section className={CARD}>
        <h3 className={HEADING}>Income against spending</h3>
        <div className="mt-3 space-y-3">
          {[['Fees collected', fees.collected, 'bg-[#1a5c38]'], ['Spending', spending.total, 'bg-[#9f1239]']].map(([label, value, bar]) => (
            <div key={label}>
              <p className="text-sm font-bold">{label} · {naira(value)}</p>
              <div className="mt-1 h-6 overflow-hidden rounded-full bg-white dark:bg-slate-800"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round((value / max) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h3 className={HEADING}>Where the expected fees come from</h3>
          <Table align={['', 'right']} columns={['Item', 'Amount']} rows={[
            ['Term fees billed', naira(fees.termFees)],
            ...(fees.broughtForward ? [['Owed from earlier terms', naira(fees.broughtForward)]] : []),
            ...(fees.otherCharges ? [['Other charges', naira(fees.otherCharges)]] : []),
            ...(fees.discounts ? [['Less discounts and scholarships', `−${naira(fees.discounts)}`]] : []),
            ['Expected this term', naira(fees.expected)],
            ['Collected', naira(fees.collected)],
            ['Still owed', naira(fees.outstanding)],
          ]} />
        </section>
        <section className={CARD}>
          <h3 className={HEADING}>Spending by category</h3>
          {spending.byCategory.length
            ? <Table align={['', 'right', 'right']} columns={['Category', 'Amount', 'Share']} rows={spending.byCategory.map(row => [row.category, naira(row.amount), `${row.share}%`])} />
            : <p className="mt-2 text-sm font-semibold">No expenses are dated inside this term. Record them under Expenditure.</p>}
        </section>
      </div>

      <section className={CARD}>
        <h3 className={HEADING}>Term summary</h3>
        <Table align={['', 'right', 'right', 'right']} columns={['', `${report.term.name}`, previous ? `${previous.term.name} (${previous.term.sessionName})` : 'Previous term', 'Change']} rows={[
          ['Fees expected', naira(fees.expected), previous?.fees.source === 'fees' ? naira(previous.fees.expected) : '—', previous?.fees.source === 'fees' ? change(fees.expected, previous.fees.expected) : '—'],
          ['Fees collected', naira(fees.collected), previous?.fees.source === 'fees' ? naira(previous.fees.collected) : '—', previous?.fees.source === 'fees' ? change(fees.collected, previous.fees.collected) : '—'],
          ['Spending', naira(spending.total), previous ? naira(previous.spending.total) : '—', previous ? change(spending.total, previous.spending.total) : '—'],
          ['Surplus / shortfall', naira(report.net), previous?.fees.source === 'fees' ? naira(previous.net) : '—', ''],
        ]} />
        {previous && previous.fees.source !== 'fees' && <p className="mt-2 text-xs font-semibold">{previous.term.name}'s fees were kept in the earlier Fee Template, so only its spending is compared.</p>}
        {payroll.entries > 0 && <p className="mt-2 text-xs font-semibold">Payroll prepared for these months: {naira(payroll.gross)} before deductions ({naira(payroll.net)} paid to staff). Shown for reference; it is not added to spending unless salaries were also recorded as an expense.</p>}
      </section>
    </div>
  );
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** The report as a printable page (print it, or save it as PDF from the print dialog). */
export function reportToHtml(report) {
  const body = (report.sections || []).map(section => [
    `<h2>${escapeHtml(section.heading)}</h2>`,
    ...(section.paragraphs || []).map(text => `<p>${escapeHtml(text)}</p>`),
    section.table ? `<table><thead><tr>${section.table.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '',
    section.bullets?.length ? `<ul>${section.bullets.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>` : '',
  ].join('')).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>
    body{font-family:Georgia,'Times New Roman',serif;color:#111;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.55}
    h1{font-size:24px;margin:0;color:#800000} .meta{color:#333;font-size:13px;margin:4px 0 24px}
    h2{font-size:17px;margin:26px 0 8px;color:#800000;border-bottom:1px solid #c9a96e;padding-bottom:4px}
    table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px} th,td{border:1px solid #bbb;padding:6px 8px;text-align:left} th{background:#f3ead8}
    td:not(:first-child),th:not(:first-child){text-align:right} li{margin:4px 0}
  </style></head><body><h1>${escapeHtml(report.title)}</h1><p class="meta">${escapeHtml([report.schoolName, report.period, `Prepared ${new Date(report.generatedAt || Date.now()).toLocaleString('en-GB')}`].filter(Boolean).join(' · '))}</p>${body}</body></html>`;
}

/** The finance report, written out as a document: what each figure is, where it comes from and what it means. */
export function FinanceReport() {
  const [termId, setTermId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function write(nextTermId = termId) {
    setLoading(true); setError('');
    try {
      const result = await runFinanceAI(nextTermId);
      setReport(result.analysis || null);
    } catch (err) { setError(err.message || 'Could not write the report.'); } finally { setLoading(false); }
  }
  useEffect(() => { write(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function print() {
    const popup = window.open('', '_blank', 'width=900,height=960');
    if (!popup) { setError('Allow pop-ups for this site to print the report.'); return; }
    popup.document.write(reportToHtml(report));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} flex flex-wrap items-center gap-3`}>
        <div className="flex-1">
          <h2 className={HEADING}>Finance report</h2>
          <p className="text-sm">A written explanation of the term's finances: fees, who owes, spending, and what to do next.</p>
        </div>
        {report && <TermPicker terms={report.terms} value={report.term?.id} onChange={value => { setTermId(value); write(value); }} />}
        <button type="button" className={OUTLINE} disabled={loading} onClick={() => write()}>{loading ? 'Writing…' : 'Write again'}</button>
        <button type="button" className={BTN} disabled={!report || loading} onClick={print}>Print / Save as PDF</button>
      </section>
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {loading && !report && <section className={CARD}><p role="status">Writing the report…</p></section>}
      {report && (
        <article aria-label={report.title} className={`rounded-3xl border border-[#c9a96e]/40 bg-white p-6 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 md:p-10 ${loading ? 'opacity-60' : ''}`}>
          <header className="border-b-2 border-[#c9a96e] pb-4">
            <h1 className="font-serif text-2xl font-black text-[#800000] dark:text-[#e3c98b]">{report.title}</h1>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {[report.schoolName, report.period, `Prepared ${new Date(report.generatedAt || Date.now()).toLocaleString('en-GB')}`].filter(Boolean).join(' · ')}
              {report.generatedBy === 'ai' ? ' · Overview and recommendations written by Ndovera AI from these figures' : ''}
            </p>
          </header>
          {(report.sections || []).map(section => (
            <section key={section.heading} className="mt-6">
              <h2 className="border-b border-[#c9a96e]/60 pb-1 font-serif text-lg font-black text-[#800000] dark:text-[#e3c98b]">{section.heading}</h2>
              {(section.paragraphs || []).map((text, index) => <p key={index} className="mt-2 font-serif leading-relaxed">{text}</p>)}
              {section.table && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-300 dark:border-slate-600">{section.table.columns.map((column, index) => <th key={`${column}-${index}`} className={`p-2 text-xs font-bold uppercase text-slate-700 dark:text-slate-300 ${index ? 'text-right' : 'text-left'}`}>{column}</th>)}</tr></thead>
                    <tbody>{section.table.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-200 last:border-0 dark:border-slate-700">{row.map((cell, index) => <td key={index} className={`p-2 ${index ? 'text-right' : 'font-semibold'}`}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {section.bullets?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-6 font-serif">{section.bullets.map((text, index) => <li key={index}>{text}</li>)}</ul>}
            </section>
          ))}
        </article>
      )}
    </div>
  );
}

/**
 * Fee Template for the current term when its fees are set in Fees & Billing:
 * the class fee table and every student's account, read from the same place.
 * A term still run on the earlier Fee Template shows that board (`legacy`).
 * `onEdit(termId)` opens Fee Setup for that term.
 */
export function TermFeeTemplate({ onEdit, legacy }) {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  useEffect(() => {
    getFeesOverview().then(result => {
      setOverview(result);
      if (result.configured) return getFeeReports().then(setReports);
      return null;
    }).catch(err => setError(err.message || 'Could not load the fees.'));
  }, []);
  const students = useMemo(() => (reports?.students || []).filter(student => !q || `${student.studentName} ${student.className}`.toLowerCase().includes(q.toLowerCase())), [reports, q]);

  if (error) return <section className={CARD}><p role="alert" className="font-semibold">{error}</p></section>;
  if (!overview || (overview.configured && !reports)) return <section className={CARD}><p role="status">Loading the fee template…</p></section>;
  const next = overview.nextTerm;
  const nextCard = next && (
    <section className={`${CARD} flex flex-wrap items-center gap-3`}>
      <p className="flex-1 text-sm font-semibold">
        <span className="font-black">{next.name}, {next.sessionName}</span>{next.startDate ? ` starts ${formatDay(next.startDate)}. ` : ' has been created. '}
        {next.published ? 'Its fees are published; student accounts are created when it opens.' : next.configured || next.hasDraft ? 'Its fees are saved but not published yet.' : 'You can set its fees now, before it opens.'}
      </p>
      {overview.canEditFees && <button type="button" className={BTN} onClick={() => onEdit?.(next.id)}>{next.published ? `Edit ${next.name} fees` : `Set ${next.name} fees`}</button>}
    </section>
  );

  // This term's fees are not in Fees & Billing: the earlier Fee Template is where they live.
  if (!overview.configured) return <div className="space-y-4">{nextCard}{legacy}</div>;
  if (showLegacy) {
    return (
      <div className="space-y-4">
        <button type="button" className={OUTLINE} onClick={() => setShowLegacy(false)}>← Back to {reports.term.name} fees</button>
        {legacy}
      </div>
    );
  }
  const table = reports.feeTable;
  return (
    <div className="space-y-4">
      <section className={`${CARD} flex flex-wrap items-center gap-3`}>
        <div className="flex-1">
          <h2 className={HEADING}>Fee Template · {reports.term.name}, {reports.term.sessionName}</h2>
          <p className="text-sm">The current term's fees, as published in Fees &amp; Billing. {overview.locked ? 'Every student\'s account uses them.' : 'Not published yet: nobody is billed until they are.'}</p>
        </div>
        {overview.canEditFees && <button type="button" className={BTN} onClick={() => onEdit?.(reports.term.id)}>Edit {reports.term.name} fees</button>}
        {legacy && <button type="button" className={OUTLINE} onClick={() => setShowLegacy(true)}>Earlier Fee Template</button>}
      </section>
      {nextCard}
      <section className={CARD}>
        <h3 className={HEADING}>Class fees</h3>
        {table.feeMode === 'student' && <p className="mt-1 text-sm font-semibold">Fees are set for each student this term; the class amounts are only starting amounts.</p>}
        <Table
          align={['', ...table.columns.map(() => 'right'), 'right']}
          columns={['Class', ...table.columns, 'Total']}
          rows={table.rows.map(row => [row.className, ...table.columns.map(column => (row.amounts[column] ? naira(row.amounts[column]) : '—')), naira(table.columns.reduce((sum, column) => sum + (Number(row.amounts[column]) || 0), 0))])}
        />
      </section>
      <section className={CARD}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className={`${HEADING} flex-1`}>Students ({students.length})</h3>
          <input aria-label="Search students" value={q} onChange={event => setQ(event.target.value)} placeholder="Search by name or class" className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <Table
          align={['', '', 'right', 'right', 'right', 'right', 'right']}
          columns={['Student', 'Class', 'Term fee', 'Owed from earlier', 'Total payable', 'Paid', 'Balance']}
          rows={students.map(student => [student.studentName, student.className || '—', naira(student.termFee), naira(student.outstanding), naira(student.totalPayable), naira(student.paid), naira(student.balance)])}
        />
      </section>
    </div>
  );
}

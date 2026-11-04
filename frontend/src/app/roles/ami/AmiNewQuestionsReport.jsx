import React, { useState } from 'react';
import { getNewQuestionsReport } from '../../../features/showcase/showcaseApi';

// New questions per subject. It loads only when asked for, so opening the page costs nothing.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white disabled:opacity-60';
const HEAD = 'border-b border-slate-300 px-2 py-2 text-left text-xs font-black text-slate-900 dark:border-white/20 dark:text-white';
const CELL = 'border-b border-slate-200 px-2 py-2 text-sm text-slate-800 dark:border-white/10 dark:text-slate-100';
const PERIODS = [[1, 'Last 24 hours'], [7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];

export default function AmiNewQuestionsReport() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const show = () => {
    setBusy(true);
    setNotice('');
    getNewQuestionsReport(days).then(setReport).catch(error => setNotice(error.message)).finally(() => setBusy(false));
  };
  const sum = name => (report ? report.subjects.reduce((total, item) => total + item[name], 0) : 0);
  return (
    <section className={`${CARD} space-y-3`} aria-label="New questions by subject">
      <h2 className="text-lg font-black text-slate-900 dark:text-white">New questions by subject</h2>
      <p className={BODY}>Every question added to the bank in the period: written by Ndovera AI, imported, or from teachers.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Period
          <select className={FIELD} value={days} onChange={event => setDays(Number(event.target.value))}>
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy} className={PRIMARY} onClick={show}>{busy ? 'Loading…' : 'Show report'}</button>
      </div>
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      {report && !report.subjects.length ? <p className={BODY}>No new questions in this period.</p> : null}
      {report && report.subjects.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{['Subject', 'New', 'Checked', 'Waiting for a check', 'For exams'].map(name => <th key={name} scope="col" className={HEAD}>{name}</th>)}</tr></thead>
            <tbody>
              {report.subjects.map(item => (
                <tr key={item.key || item.name}>
                  <th scope="row" className={`${CELL} text-left font-bold`}>{item.name}</th>
                  <td className={CELL}>{item.total.toLocaleString()}</td>
                  <td className={CELL}>{item.checked.toLocaleString()}</td>
                  <td className={CELL}>{item.waiting.toLocaleString()}</td>
                  <td className={CELL}>{item.forExams.toLocaleString()}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${CELL} text-left font-black`}>Total</th>
                {['total', 'checked', 'waiting', 'forExams'].map(name => <td key={name} className={`${CELL} font-black`}>{sum(name).toLocaleString()}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {report && report.capped ? <p className={BODY}>This counts the first 50,000 new questions in the period only. Choose a shorter period for an exact figure.</p> : null}
    </section>
  );
}

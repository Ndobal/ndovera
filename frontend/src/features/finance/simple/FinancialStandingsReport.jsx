import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getStandings, getStandingsReport, listStandingsReports, postStandings, saveStandingsSettings } from './simpleFeesApi';

// Financial Standings Report for the Owner and HoS: expected income, received, still to be
// paid, every family still owing and how much, and the fee reminders sent. Print or save as
// PDF, download for Word, post it to the Owner and HoS, and switch on fortnightly reminders.

const naira = value => `₦${(Number(value) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/50';
const BUTTON = 'rounded-2xl px-4 py-2 text-sm font-bold';

function ReportPaper({ report, paperRef }) {
  const t = report.totals;
  return (
    <article ref={paperRef} className="rounded-2xl border border-[#d4d4d8] bg-white p-5 text-[#0f172a] sm:p-8" aria-label="Financial standings report">
      <header className="border-b-2 border-[#800000] pb-3 text-center">
        <h1 style={{ margin: 0, color: '#800000', fontSize: 24, fontWeight: 900 }}>{report.schoolName}</h1>
        <p style={{ margin: '4px 0 0', fontWeight: 700 }}>Financial Standings Report — {report.termLabel}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>Period: {report.from || 'start of term'} to {report.to} · Prepared {String(report.generatedAt || '').slice(0, 10)}</p>
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 14 }}>
        <tbody>
          {[
            ['Expected income (all fees billed this term)', naira(t.expected), '#0f172a'],
            ['Income received', `${naira(t.received)} (${t.collectionRate}% collected)`, '#15803d'],
            ['Income still to be paid', naira(t.outstanding), '#b91c1c'],
            ['Families still owing', `${t.familiesOwing} (${t.studentsOwing} of ${t.students} students)`, '#0f172a'],
            ...(t.credit > 0 ? [['Paid in advance (credit held)', naira(t.credit), '#1d4ed8']] : []),
          ].map(([label, value, color]) => (
            <tr key={label}>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px' }}>{label}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontWeight: 800, color }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ color: '#800000', fontSize: 16, margin: '18px 0 6px' }}>Fee reminders to parents</h2>
      <p style={{ background: '#eff6ff', padding: 10, borderRadius: 8, fontSize: 13, margin: 0 }}>{report.reminders.statement}</p>

      <h2 style={{ color: '#800000', fontSize: 16, margin: '18px 0 6px' }}>Families still owing</h2>
      {report.familiesOwing.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: 6, width: 32 }}>#</th>
              <th style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'left' }}>Family</th>
              <th style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'left' }}>Children (class): balance</th>
              <th style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'right' }}>Owes</th>
            </tr>
          </thead>
          <tbody>
            {report.familiesOwing.map((family, index) => (
              <tr key={`${family.familyId}-${family.familyName}`}>
                <td style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 6, fontWeight: 700 }}>{family.familyName}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 6 }}>{family.children.map(child => <div key={child.studentName}>{child.studentName} ({child.className}): {naira(child.balance)}</div>)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'right', fontWeight: 800, color: '#b91c1c' }}>{naira(family.owes)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'right', fontWeight: 800 }}>Total still to be paid</td>
              <td style={{ border: '1px solid #cbd5e1', padding: 6, textAlign: 'right', fontWeight: 900, color: '#b91c1c' }}>{naira(t.outstanding)}</td>
            </tr>
          </tbody>
        </table>
      ) : <p style={{ fontSize: 13 }}>Every family has paid in full.</p>}

      <p style={{ marginTop: 24, fontSize: 12, color: '#475569' }}>Prepared on Ndovera from the school's fee records. Signed: ____________________ (Accounts) &nbsp; ____________________ (Head of School)</p>
    </article>
  );
}

export default function FinancialStandingsReport() {
  const { role = 'owner' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('id') || '';
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [kept, setKept] = useState(null);
  const [history, setHistory] = useState({ reports: [], autoReminders: false });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const paperRef = useRef(null);
  const canSet = ['owner', 'hos'].includes(role);

  const loadHistory = useCallback(() => listStandingsReports().then(setHistory).catch(() => null), []);
  const loadLive = useCallback(() => {
    setError('');
    getStandings(range).then(data => setReport(data.report)).catch(err => setError(err.message || 'Could not prepare the report.'));
  }, [range]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { if (!openId) loadLive(); }, [openId, loadLive]);
  useEffect(() => {
    if (!openId) { setKept(null); return; }
    getStandingsReport(openId).then(setKept).catch(err => setError(err.message || 'Could not open the report.'));
  }, [openId]);

  const shown = kept?.report || report;

  function downloadWord() {
    if (!paperRef.current || !shown) return;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Financial Standings Report</title></head><body style="font-family:Arial">${paperRef.current.outerHTML}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Financial-standings-${shown.termLabel.replace(/[^A-Za-z0-9]+/g, '-')}-${shown.to}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function post() {
    setBusy('post'); setNotice(''); setError('');
    try {
      const result = await postStandings(range);
      setNotice(`Posted to the Owner and Head of School${result.posted?.emailed ? ` (emailed to ${result.posted.emailed})` : ''}. It is kept below.`);
      await loadHistory();
    } catch (err) { setError(err.message || 'Could not post the report.'); } finally { setBusy(''); }
  }

  async function toggleFortnightly(on) {
    setBusy('auto'); setError('');
    try {
      await saveStandingsSettings({ autoReminders: on });
      setHistory(current => ({ ...current, autoReminders: on }));
      setNotice(on ? 'Every two weeks Ndovera emails a polite reminder (with your bank details) to every family still owing, then posts this report to the Owner and HoS.' : 'Fortnightly reminders are off.');
      if (!openId) loadLive();
    } catch (err) { setError(err.message || 'Could not save.'); } finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <style>{'@media print { body * { visibility: hidden !important; } [aria-label="Financial standings report"], [aria-label="Financial standings report"] * { visibility: visible !important; } [aria-label="Financial standings report"] { position: absolute; left: 0; top: 0; width: 100%; border: none !important; } }'}</style>
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Finance</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Financial Standings Report</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Expected income, what has come in, what is still owed, every family owing and how much, and the reminders sent to parents.</p>
        {kept ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Kept report · {kept.title} · posted {String(kept.at).slice(0, 10)} by {kept.by}</span>
            <button type="button" className={`${BUTTON} border border-[#c9a96e]/50 bg-white text-[#191970]`} onClick={() => setSearchParams({})}>← Today's figures</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-[#800020]">From <input type="date" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} className="ml-1 rounded-xl border border-[#c9a96e]/50 px-2 py-1.5 text-sm text-[#191970]" /></label>
            <label className="text-xs font-bold text-[#800020]">To <input type="date" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} className="ml-1 rounded-xl border border-[#c9a96e]/50 px-2 py-1.5 text-sm text-[#191970]" /></label>
            <span className="text-xs text-slate-500">Empty: from the start of the term to today.</span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!shown} className={`${BUTTON} bg-[#800000] text-white disabled:opacity-50`} onClick={() => window.print()}>Print / Save as PDF</button>
          <button type="button" disabled={!shown} className={`${BUTTON} bg-[#1d4ed8] text-white disabled:opacity-50`} onClick={downloadWord}>Download for Word</button>
          {!kept ? <button type="button" disabled={!shown || Boolean(busy)} className={`${BUTTON} bg-[#1a5c38] text-white disabled:opacity-50`} onClick={post}>{busy === 'post' ? 'Posting…' : 'Post to Owner & HoS'}</button> : null}
        </div>
        {canSet ? (
          <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#191970] dark:text-slate-200">
            <input type="checkbox" className="mt-1" checked={Boolean(history.autoReminders)} disabled={Boolean(busy)} onChange={event => toggleFortnightly(event.target.checked)} />
            <span>Remind owing families every two weeks
              <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">Ndovera emails each family still owing (polite wording, balance and your bank details), then posts this report to the Owner and HoS.{history.lastAutoRunAt ? ` Last round: ${String(history.lastAutoRunAt).slice(0, 10)}.` : ''} WhatsApp reminders are still sent from Student Accounts on your phone and are counted here.</span>
            </span>
          </label>
        ) : null}
        {notice ? <p role="status" className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{notice}</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p> : null}
      </section>

      {shown ? <ReportPaper report={shown} paperRef={paperRef} /> : !error ? <p className="text-sm text-slate-600">Preparing the report…</p> : null}

      <section className={CARD} aria-label="Posted reports">
        <h2 className="text-base font-black text-[#800000] dark:text-white">Posted reports</h2>
        {history.reports.length ? (
          <ul className="mt-2 divide-y divide-[#c9a96e]/25">
            {history.reports.map(item => (
              <li key={item.id}>
                <button type="button" onClick={() => setSearchParams({ id: item.id })} className="flex w-full flex-wrap items-center gap-2 py-2 text-left text-sm text-[#191970] hover:underline dark:text-slate-200">
                  <span className="flex-1 font-semibold">{item.title}</span>
                  <span className="text-xs text-slate-500">{item.automatic ? 'Fortnightly · ' : ''}{String(item.at).slice(0, 10)} · {item.by}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">None yet. Post today's report, or switch on fortnightly reminders.</p>}
      </section>
    </div>
  );
}

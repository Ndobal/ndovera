import React, { useCallback, useEffect, useState } from 'react';
import { ArchivesTab, AuditTab, ClaimsTab } from '../FinanceCenter';
import { ReceiptDialog, downloadDesignedReceipts, printDesignedReceipts, receiptsShareText, toDesignedReceipt, whatsappLink } from '../FinanceShared';
import { buildReceiptShareMessage } from '../../school/components/FeeReceiptDialog';
import FeeSetup from './FeeSetup';
import { ExcursionsCard, FeeGroupsCard, NewStudentsCard } from './ExtraFees';
import StudentAccounts, { RecordPaymentDialog, StatusChip } from './StudentAccounts';
import {
  ACCOUNT_STATUS, EDIT_MODES, billNewStudents, getFeeReports, getFeeSettings, getFeesOverview, getReceipts, listTermPayments, naira, saveFeeSettings,
} from './simpleFeesApi';
import { getFinanceContext } from '../financeApi';

// Fees & Billing, the simple way: a term's fees in under two minutes, then
// everyday work — balances, payments, receipts — with the accounting detail
// kept underneath. Advanced tools live under "More".

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4] hover:bg-[#154a2e]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const BIG = 'rounded-2xl bg-white px-4 py-4 text-left text-base font-black text-[#800000] shadow-sm hover:ring-2 hover:ring-[#800020]/30';
const TH = 'p-2 text-left text-xs font-bold uppercase text-[#800020]';
// Search and filter bars stay in view while a long list scrolls (below the Finance tab bar).
const STICKY_BAR = 'sticky top-14 z-30 shadow-md dark:bg-slate-900';

function Dashboard({ overview, go, onSetup, onPay, onChanged }) {
  if (overview.noTerm) {
    return <section className={CARD}><p className="font-bold text-[#191970] dark:text-white">No term is open. Open a session and term in Academic Sessions, then set up its fees here.</p></section>;
  }
  if (!overview.configured) {
    const last = overview.reuse?.[0];
    return (
      <section className="space-y-4 rounded-3xl border-2 border-[#1a5c38] bg-[#e8f5ee] p-6 text-[#191970]">
        <div>
          <h2 className="text-2xl font-black text-[#1a5c38]">Set up {overview.term.name} fees</h2>
          <p className="mt-1 text-sm">You haven't set fees for this term.{last ? ` Reuse ${last.sessionName} ${last.termName}'s fees exactly — class fees and students who pay differently — then change what changed and choose whether to carry or write off earlier debts.` : ''}</p>
        </div>
        {overview.canEditFees ? (
          <div className="flex flex-wrap gap-3">
            {overview.hasDraft && <button type="button" className={`${PRIMARY} text-base`} onClick={() => onSetup(null)}>Continue your draft</button>}
            {last &&<button type="button" className={`${PRIMARY} text-base`} onClick={() => onSetup({ type: 'reuse', termId: last.termId })}>Reuse {last.sessionName} {last.termName} Fees <span className="ml-1 rounded-full bg-white/20 px-2 text-xs">Recommended</span></button>}
            <button type="button" className={SECONDARY} onClick={() => onSetup({ type: 'new' })}>Start New</button>
            <button type="button" className={SECONDARY} onClick={() => onSetup({ type: 'template' })}>Use Saved Template</button>
            {overview.reuse?.slice(1, 4).map(option => <button key={option.termId} type="button" className={SECONDARY} onClick={() => onSetup({ type: 'reuse', termId: option.termId })}>Reuse {option.sessionName} {option.termName}</button>)}
          </div>
        ) : <p className="text-sm font-semibold">Ask the person who manages fees to set them up — you don't have permission to change fees.</p>}
      </section>
    );
  }
  const cards = [['Expected', naira(overview.cards.expected)], ['Collected', naira(overview.cards.collected)], ['Outstanding', naira(overview.cards.outstanding)], ['Collection Rate', `${overview.cards.collectionRate}%`]];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#800020]">{label}</p><p className="mt-1 text-3xl font-black text-[#191970]">{value}</p></div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" className={BIG} onClick={() => onSetup(null)}>Set Up / Edit Fees<span className="block text-xs font-semibold text-[#191970]">{overview.hasDraft ? 'Draft changes not published' : overview.locked ? 'Published — edit any time' : 'Review and publish the fees'}</span></button>
        <button type="button" className={BIG} disabled={!overview.canRecordPayments} onClick={onPay}>Record Payment<span className="block text-xs font-semibold text-[#191970]">Receipt issued automatically</span></button>
        <button type="button" className={BIG} onClick={() => go('students')}>Student Accounts<span className="block text-xs font-semibold text-[#191970]">{overview.counts.owing} owing of {overview.counts.students}</span></button>
        <button type="button" className={BIG} onClick={() => go('reports')}>Reports<span className="block text-xs font-semibold text-[#191970]">By class, owing list</span></button>
      </div>
      {(overview.hasDraft || !overview.locked) && overview.canEditFees && (
        <section className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p className="font-bold">{overview.hasDraft ? `You have ${overview.term.name} fee changes saved as a draft.` : `${overview.term.name} fees are not published yet.`}</p>
          <p className="text-sm">Publishing makes them official and creates or updates every student's account. Drafts change nobody's account.</p>
          <button type="button" className={`${PRIMARY} mt-2`} onClick={() => onSetup(null)}>Review & publish</button>
        </section>
      )}
      {overview.counts.autoBilled > 0 && (
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#1a5c38]">{overview.counts.autoBilled} new student{overview.counts.autoBilled === 1 ? '' : 's'} joined since the fees were published; their fee account{overview.counts.autoBilled === 1 ? ' was' : 's were'} created automatically at their fees.</p>
      )}
      {overview.locked && overview.counts.noFees > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p className="flex-1 font-bold">{overview.counts.noFees} student{overview.counts.noFees === 1 ? ' has' : 's have'} no fees entered (no class, or nothing set for them), so no fee account yet. Once they have fees, their account is created automatically.</p>
          <button type="button" className={SECONDARY} onClick={() => go('students', { status: 'not_billed' })}>See who</button>
        </section>
      )}
      {overview.counts.unbilled > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-sky-300 bg-sky-50 p-4 text-sky-950">
          <p className="flex-1 font-bold">{overview.counts.unbilled} student(s) joined after the fees were published and have no fee account yet. Their accounts are created when the Owner, Head of School or Accountant opens Fees.</p>
          <button type="button" className={PRIMARY} onClick={async () => { const result = await billNewStudents([]); onChanged(`${result.students} account(s) created at their class fees.${result.noFees?.length ? ` No fees set for: ${result.noFees.join(', ')}.` : ''}`); }}>Create their accounts</button>
          <button type="button" className={SECONDARY} onClick={() => go('students', { status: 'not_billed' })}>Review first</button>
        </section>
      )}
      {overview.counts.classMoves > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-sky-300 bg-sky-50 p-4 text-sky-950">
          <p className="flex-1 font-bold">{overview.counts.classMoves} student(s) changed class this term. Decide whether their fees change.</p>
          <button type="button" className={SECONDARY} onClick={() => go('students')}>Open Student Accounts</button>
        </section>
      )}
    </div>
  );
}

function Payments() {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { const timer = setTimeout(() => listTermPayments({ q }).then(setData).catch(() => setData({ payments: [], byMethod: {}, total: 0 })), 200); return () => clearTimeout(timer); }, [q]);
  const withReceipt = (data?.payments || []).filter(payment => payment.receiptNo);
  const allChosen = withReceipt.length > 0 && withReceipt.every(payment => selected.has(payment.id));
  const toggle = id => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  /** Fetch the chosen receipts (the school's designed receipt), then print, download or share them all. */
  async function issue(action) {
    // Opened in the click itself: a window opened after the fetch is stopped by pop-up blockers.
    const printWindow = action === 'print' ? window.open('', '_blank', 'width=1000,height=960') : null;
    if (action === 'print' && !printWindow) { setError('Allow pop-ups for this site to print the receipts.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const ids = withReceipt.filter(payment => selected.has(payment.id)).map(payment => payment.id);
      const result = await getReceipts(ids);
      if (action === 'print') await printDesignedReceipts(result.receipts, result.schoolName, {}, printWindow);
      else if (action === 'download') {
        const saved = await downloadDesignedReceipts(result.receipts, result.schoolName, {}, `${result.schoolName || 'receipts'}_receipts`);
        setNotice(saved.mode === 'folder' ? `Saved ${saved.count} receipts into ${saved.folderName}.` : `Downloaded ${saved.count} receipts as ${saved.folderName}.zip.`);
      } else setBulk(result);
    } catch (err) {
      printWindow?.close();
      if (err?.name !== 'AbortError') setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} ${STICKY_BAR} flex flex-wrap items-center gap-3`}>
        <input aria-label="Search payments" className="max-w-xs flex-1 rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm" placeholder="Student, receipt or reference…" value={q} onChange={event => setQ(event.target.value)} />
        {data && <p className="text-sm font-bold text-[#191970] dark:text-white">This term: {naira(data.total)} · {Object.entries(data.byMethod).map(([method, amount]) => `${method} ${naira(amount)}`).join(' · ')}</p>}
      </section>
      {withReceipt.length > 0 && (
        <section className={`${CARD} flex flex-wrap items-center gap-2`}>
          <p className="flex-1 text-sm font-bold text-[#191970] dark:text-white">{selected.size ? `${selected.size} receipt${selected.size === 1 ? '' : 's'} selected` : 'Tick payments to issue their receipts together — or open one receipt to share it.'}</p>
          <button type="button" className={SECONDARY} disabled={busy || !selected.size} onClick={() => issue('print')}>Print selected</button>
          <button type="button" className={SECONDARY} disabled={busy || !selected.size} onClick={() => issue('download')}>Download selected</button>
          <button type="button" className={PRIMARY} disabled={busy || !selected.size} onClick={() => issue('share')}>Share selected</button>
          {notice && <p role="status" className="w-full text-sm font-semibold text-[#1a5c38]">{notice}</p>}
          {error && <p role="alert" className="w-full text-sm font-semibold text-rose-700">{error}</p>}
        </section>
      )}
      <section className={CARD}>
        {!data ? <p role="status">Loading…</p> : !data.payments.length ? <p className="text-sm">No payments yet this term.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm text-[#191970] dark:text-slate-200">
            <thead><tr>
              <th className={`${TH} w-8`}><input type="checkbox" aria-label="Select all receipts" checked={allChosen} onChange={() => setSelected(allChosen ? new Set() : new Set(withReceipt.map(payment => payment.id)))} /></th>
              <th className={`${TH} w-10 text-right`}>S/N</th><th className={TH}>Date</th><th className={TH}>Student</th><th className={`${TH} text-right`}>Amount</th><th className={TH}>Method</th><th className={TH}>Receipt</th><th className={TH}>By</th>
            </tr></thead>
            <tbody>{data.payments.map((payment, index) => (
              <tr key={payment.id} className="border-t border-[#c9a96e]/30">
                <td className="p-2">{payment.receiptNo ? <input type="checkbox" aria-label={`Select receipt ${payment.receiptNo}`} checked={selected.has(payment.id)} onChange={() => toggle(payment.id)} /> : null}</td>
                <td className="p-2 text-right tabular-nums">{index + 1}</td>
                <td className="p-2">{payment.date}</td><td className="p-2 font-semibold">{payment.studentName}</td>
                <td className={`p-2 text-right font-bold ${payment.status !== 'confirmed' ? 'text-rose-700 line-through' : ''}`}>{naira(payment.amount)}</td>
                <td className="p-2">{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</td>
                <td className="p-2">{payment.receiptNo ? <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={async () => {
                  const { getAccount } = await import('./simpleFeesApi');
                  const account = await getAccount(payment.studentId);
                  setReceipt(account.receipts.find(item => item.paymentId === payment.id) || null);
                }}>{payment.receiptNo}</button> : payment.status}</td>
                <td className="p-2">{payment.recordedBy}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
      {bulk && (
        <div className="fixed inset-0 z-[45] flex items-center justify-center bg-[#191970]/60 p-4" role="dialog" aria-modal="true" aria-label="Share receipts">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-[#191970] shadow-2xl">
            <h2 className="text-xl font-black text-[#800000]">{bulk.receipts.length} receipt{bulk.receipts.length === 1 ? '' : 's'}</h2>
            <p className="mt-1 text-sm">Send each family their own receipt, or all of them in one message. Each message carries the receipt's verification link.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={`${PRIMARY} !bg-[#25D366]`} href={whatsappLink(receiptsShareText(bulk.receipts, bulk.schoolName))} target="_blank" rel="noopener noreferrer">All in one WhatsApp message</a>
            </div>
            <ul className="mt-4 space-y-2">
              {bulk.receipts.map(item => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex-1"><b>{item.receiptNo}</b> · {item.snapshot?.studentName} · {naira(item.snapshot?.amountPaid)}</span>
                  <button type="button" className="rounded-xl border border-[#c9a96e]/50 px-3 py-1 text-xs font-bold text-[#800020]" onClick={() => setReceipt(item)}>View</button>
                  <a className="rounded-xl bg-[#25D366] px-3 py-1 text-xs font-bold text-white" href={whatsappLink(buildReceiptShareMessage(toDesignedReceipt(item, bulk.schoolName)))} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={SECONDARY} onClick={() => printDesignedReceipts(bulk.receipts, bulk.schoolName)}>Print all</button>
              <button type="button" className={SECONDARY} onClick={() => downloadDesignedReceipts(bulk.receipts, bulk.schoolName, {}, `${bulk.schoolName || 'receipts'}_receipts`).catch(() => {})}>Download all</button>
              <button type="button" className={PRIMARY} onClick={() => setBulk(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** Print one report table on its own page (the browser's print, or Save as PDF). */
function printReport(title, subtitle, header, rows, footer) {
  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) return;
  const cells = (row, tag) => row.map((cell, index) => `<${tag}${index > 0 && typeof cell === 'number' ? ' style="text-align:right"' : ''}>${escapeHtml(typeof cell === 'number' && index > 0 ? cell.toLocaleString() : cell)}</${tag}>`).join('');
  win.document.write(`<html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#191970;padding:24px}h1{color:#800000;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{color:#800020;text-transform:uppercase;font-size:11px}tfoot td{font-weight:bold;border-top:2px solid #191970}</style></head><body>
    <h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>
    <table><thead><tr>${cells(header, 'th')}</tr></thead><tbody>${rows.map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody>${footer ? `<tfoot><tr>${cells(footer, 'td')}</tr></tfoot>` : ''}</table>
    <script>window.onload = () => window.print()</script></body></html>`);
  win.document.close();
}

const sum = (list, key) => list.reduce((total, row) => total + (Number(row[key]) || 0), 0);
const rate = (collected, expected) => (expected ? Math.round((collected / expected) * 100) : 0);

/** Download CSV and Print for one report. */
function ReportActions({ file, title, subtitle, header, rows, footer }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={SECONDARY} onClick={() => downloadCsv(file, [header, ...rows, ...(footer ? [footer] : [])])}>Download CSV</button>
      <button type="button" className={SECONDARY} onClick={() => printReport(title, subtitle, header, rows, footer)}>Print</button>
    </div>
  );
}

const REPORT_TABS = [
  ['summary', 'Class summary'],
  ['fees', 'Class fees'],
  ['class', 'Class by class'],
  ['owing', 'Students owing'],
  ['items', 'By fee item'],
];

/** Reports, each on its own tab, so any one can be read, printed or downloaded per class. */
function Reports({ term }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('ndovera:feeReportTab') || 'summary'; } catch { return 'summary'; } });
  const [classPick, setClassPick] = useState('');
  const [owingClass, setOwingClass] = useState('');
  useEffect(() => { getFeeReports().then(setData).catch(() => setData({ byClass: [], byItem: [], owing: [], students: [], feeTable: { columns: [], rows: [] } })); }, []);
  const pick = key => { setTab(key); try { localStorage.setItem('ndovera:feeReportTab', key); } catch {} };
  if (!data) return <p role="status">Loading…</p>;
  const label = `${term?.sessionName || ''} · ${term?.name || ''}`;
  const students = data.students || [];
  const classNames = [...new Set(students.map(student => student.className).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const chosenClass = classPick && classNames.includes(classPick) ? classPick : classNames[0] || '';
  const TABLE = 'w-full min-w-[600px] text-sm text-[#191970] dark:text-slate-200';
  const FOOT = 'border-t-2 border-[#191970] font-black';

  let body = null;
  if (tab === 'summary') {
    const rows = data.byClass;
    const header = ['Class', 'Students', 'Owing', 'Expected', 'Collected', 'Outstanding', 'Rate %'];
    const lines = rows.map(row => [row.className, row.students, row.owing, row.expected, row.collected, row.outstanding, rate(row.collected, row.expected)]);
    const total = ['All classes', sum(rows, 'students'), sum(rows, 'owing'), sum(rows, 'expected'), sum(rows, 'collected'), sum(rows, 'outstanding'), rate(sum(rows, 'collected'), sum(rows, 'expected'))];
    body = (
      <section className={CARD}>
        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="flex-1 font-black text-[#800000] dark:text-white">Fees by class — summary</h3>
          <ReportActions file={`fees-class-summary-${term?.name || ''}.csv`} title="Fees by class" subtitle={label} header={header} rows={lines} footer={total} /></div>
        <div className="overflow-x-auto"><table className={TABLE}>
          <thead><tr><th className={TH}>Class</th><th className={TH}>Students</th><th className={TH}>Owing</th><th className={`${TH} text-right`}>Expected</th><th className={`${TH} text-right`}>Collected</th><th className={`${TH} text-right`}>Outstanding</th><th className={TH}>Rate</th></tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.className} className="border-t border-[#c9a96e]/30">
              <td className="p-2 font-semibold"><button type="button" className="underline decoration-dotted" title="See this class's students" onClick={() => { setClassPick(row.className); pick('class'); }}>{row.className}</button></td>
              <td className="p-2">{row.students}</td><td className="p-2">{row.owing}</td><td className="p-2 text-right">{naira(row.expected)}</td><td className="p-2 text-right">{naira(row.collected)}</td><td className="p-2 text-right font-bold">{naira(row.outstanding)}</td><td className="p-2">{rate(row.collected, row.expected)}%</td>
            </tr>
          ))}</tbody>
          {rows.length > 1 && <tfoot><tr className={FOOT}><td className="p-2">All classes</td><td className="p-2">{total[1]}</td><td className="p-2">{total[2]}</td><td className="p-2 text-right">{naira(total[3])}</td><td className="p-2 text-right">{naira(total[4])}</td><td className="p-2 text-right">{naira(total[5])}</td><td className="p-2">{total[6]}%</td></tr></tfoot>}
        </table></div>
      </section>
    );
  } else if (tab === 'fees') {
    const table = data.feeTable || { columns: [], rows: [] };
    const rows = table.rows.filter(row => Object.keys(row.amounts || {}).length);
    const header = ['Class', ...table.columns, 'Total'];
    const lines = rows.map(row => [row.className, ...table.columns.map(column => Number(row.amounts?.[column]) || 0), table.columns.reduce((total, column) => total + (Number(row.amounts?.[column]) || 0), 0)]);
    body = (
      <section className={CARD}>
        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="flex-1 font-black text-[#800000] dark:text-white">What each class pays</h3>
          {lines.length > 0 && <ReportActions file={`class-fees-${term?.name || ''}.csv`} title="Class fees" subtitle={label} header={header} rows={lines} />}</div>
        {table.feeMode === 'student' && <p className="mb-2 text-sm font-semibold text-[#191970] dark:text-slate-300">This term's fees are set for each student. The amounts below are the class starting amounts; see Class by class for what each student pays.</p>}
        {!lines.length ? <p className="text-sm">No class fees are set for this term.</p> : (
          <div className="overflow-x-auto"><table className={TABLE}>
            <thead><tr>{header.map((name, index) => <th key={name} className={`${TH} ${index ? 'text-right' : ''}`}>{name}</th>)}</tr></thead>
            <tbody>{lines.map(line => <tr key={line[0]} className="border-t border-[#c9a96e]/30">{line.map((cell, index) => <td key={index} className={`p-2 ${index ? 'text-right' : 'font-semibold'} ${index === line.length - 1 ? 'font-black' : ''}`}>{index ? (cell ? naira(cell) : '—') : cell}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </section>
    );
  } else if (tab === 'class') {
    const list = students.filter(student => student.className === chosenClass).sort((a, b) => a.studentName.localeCompare(b.studentName));
    const header = ['S/N', 'Student', 'Term Fee', 'Outstanding', 'Total Payable', 'Paid', 'Balance', 'Status'];
    const lines = list.map((row, index) => [index + 1, row.studentName, row.termFee, row.outstanding, row.totalPayable, row.paid, row.balance, ACCOUNT_STATUS[row.status]?.label || row.status]);
    const total = ['', `${list.length} students`, sum(list, 'termFee'), sum(list, 'outstanding'), sum(list, 'totalPayable'), sum(list, 'paid'), sum(list, 'balance'), ''];
    body = (
      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-black text-[#800000] dark:text-white">Class</h3>
          <select aria-label="Class" className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" value={chosenClass} onChange={event => setClassPick(event.target.value)}>
            {classNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <span className="flex-1" />
          {list.length > 0 && <ReportActions file={`fees-${chosenClass}-${term?.name || ''}.csv`} title={`${chosenClass} fees`} subtitle={label} header={header} rows={lines} footer={total} />}
        </div>
        {list.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            {[['Expected', naira(total[4])], ['Collected', naira(total[5])], ['Outstanding', naira(list.reduce((t, row) => t + Math.max(Number(row.balance) || 0, 0), 0))], ['Rate', `${rate(total[5], total[4])}%`]].map(([name, value]) => (
              <div key={name} className="rounded-2xl bg-white p-3"><p className="text-xs font-bold uppercase text-[#800020]">{name}</p><p className="text-xl font-black text-[#191970]">{value}</p></div>
            ))}
          </div>
        )}
        {!list.length ? <p className="text-sm">No students in this class.</p> : (
          <div className="overflow-x-auto"><table className={TABLE}>
            <thead><tr><th className={`${TH} w-10 text-right`}>S/N</th><th className={TH}>Student</th><th className={`${TH} text-right`}>Term Fee</th><th className={`${TH} text-right`}>Outstanding</th><th className={`${TH} text-right`}>Payable</th><th className={`${TH} text-right`}>Paid</th><th className={`${TH} text-right`}>Balance</th><th className={TH}>Status</th></tr></thead>
            <tbody>{list.map((row, index) => <tr key={row.studentId} className="border-t border-[#c9a96e]/30"><td className="p-2 text-right tabular-nums">{index + 1}</td><td className="p-2 font-semibold">{row.studentName}</td><td className="p-2 text-right">{naira(row.termFee)}</td><td className="p-2 text-right">{row.outstanding ? naira(row.outstanding) : '—'}</td><td className="p-2 text-right">{naira(row.totalPayable)}</td><td className="p-2 text-right">{naira(row.paid)}</td><td className="p-2 text-right font-black">{naira(row.balance)}</td><td className="p-2"><StatusChip status={row.status} /></td></tr>)}</tbody>
            <tfoot><tr className={FOOT}><td className="p-2" /><td className="p-2">{total[1]}</td><td className="p-2 text-right">{naira(total[2])}</td><td className="p-2 text-right">{naira(total[3])}</td><td className="p-2 text-right">{naira(total[4])}</td><td className="p-2 text-right">{naira(total[5])}</td><td className="p-2 text-right">{naira(total[6])}</td><td /></tr></tfoot>
          </table></div>
        )}
      </section>
    );
  } else if (tab === 'owing') {
    const owingClasses = [...new Set(data.owing.map(row => row.className).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const list = data.owing.filter(row => !owingClass || row.className === owingClass);
    const header = ['S/N', 'Student', 'Class', 'Total Payable', 'Paid', 'Balance'];
    const lines = list.map((row, index) => [index + 1, row.studentName, row.className, row.totalPayable, row.paid, row.balance]);
    const total = ['', `${list.length} students`, '', sum(list, 'totalPayable'), sum(list, 'paid'), sum(list, 'balance')];
    body = (
      <section className={CARD}>
        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="flex-1 font-black text-[#800000] dark:text-white">Students owing ({list.length})</h3>
          <select aria-label="Owing in class" className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" value={owingClass} onChange={event => setOwingClass(event.target.value)}>
            <option value="">All classes</option>{owingClasses.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <ReportActions file={`fees-owing-${owingClass || 'all'}-${term?.name || ''}.csv`} title={`Students owing${owingClass ? ` — ${owingClass}` : ''}`} subtitle={label} header={header} rows={lines} footer={total} /></div>
        <div className="overflow-x-auto"><table className={TABLE}>
          <thead><tr><th className={`${TH} w-10 text-right`}>S/N</th><th className={TH}>Student</th><th className={TH}>Class</th><th className={`${TH} text-right`}>Payable</th><th className={`${TH} text-right`}>Paid</th><th className={`${TH} text-right`}>Balance</th><th className={TH}>Status</th></tr></thead>
          <tbody>{list.map((row, index) => <tr key={row.studentId} className="border-t border-[#c9a96e]/30"><td className="p-2 text-right tabular-nums">{index + 1}</td><td className="p-2 font-semibold">{row.studentName}</td><td className="p-2">{row.className}</td><td className="p-2 text-right">{naira(row.totalPayable)}</td><td className="p-2 text-right">{naira(row.paid)}</td><td className="p-2 text-right font-black">{naira(row.balance)}</td><td className="p-2"><StatusChip status={row.status} /></td></tr>)}</tbody>
          {list.length > 1 && <tfoot><tr className={FOOT}><td className="p-2" /><td className="p-2">{total[1]}</td><td /><td className="p-2 text-right">{naira(total[3])}</td><td className="p-2 text-right">{naira(total[4])}</td><td className="p-2 text-right">{naira(total[5])}</td><td /></tr></tfoot>}
        </table></div>
      </section>
    );
  } else {
    const rows = data.byItem || [];
    const header = ['Fee item', 'Expected', 'Collected', 'Outstanding'];
    const lines = rows.map(row => [row.feeItem, row.expected, row.collected, row.outstanding]);
    body = (
      <section className={CARD}>
        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="flex-1 font-black text-[#800000] dark:text-white">By fee item</h3>
          {lines.length > 0 && <ReportActions file={`fees-by-item-${term?.name || ''}.csv`} title="Fees by item" subtitle={label} header={header} rows={lines} />}</div>
        {!rows.length ? <p className="text-sm">No fee items billed yet this term.</p> : (
          <div className="overflow-x-auto"><table className={TABLE}>
            <thead><tr><th className={TH}>Fee item</th><th className={`${TH} text-right`}>Expected</th><th className={`${TH} text-right`}>Collected</th><th className={`${TH} text-right`}>Outstanding</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.feeItem} className="border-t border-[#c9a96e]/30"><td className="p-2 font-semibold">{row.feeItem}</td><td className="p-2 text-right">{naira(row.expected)}</td><td className="p-2 text-right">{naira(row.collected)}</td><td className="p-2 text-right font-bold">{naira(row.outstanding)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 border-b-2 border-[#800020]/30" role="tablist" aria-label="Reports">
        {REPORT_TABS.map(([key, name]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => pick(key)}
            className={`-mb-0.5 rounded-t-2xl px-4 py-2 text-sm font-black ${tab === key ? 'border-2 border-b-0 border-[#800020]/30 bg-[#b5e3f4] text-[#800000] dark:bg-slate-900 dark:text-white' : 'text-[#800020] hover:bg-white/60'}`}>{name}</button>
        ))}
      </div>
      {body}
    </div>
  );
}

function FeeSettings() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { getFeeSettings().then(setData).catch(err => setNotice(err.message)); }, []);
  if (!data) return <p role="status">{notice || 'Loading…'}</p>;
  return (
    <section className={`${CARD} space-y-3`}>
      <h3 className="text-lg font-black text-[#800000] dark:text-white">Who can change fees?</h3>
      <p className="text-sm text-[#191970] dark:text-slate-300">This controls changes to the official fee amounts (setting, editing, locking). Recording payments, receipts and balances are not affected. The Owner always keeps full authority.</p>
      <div className="space-y-2">
        {EDIT_MODES.map(([key, label, who]) => (
          <label key={key} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${data.settings.feeEditMode === key ? 'bg-white ring-2 ring-[#1a5c38]' : 'bg-white/60'} ${data.canChange ? 'cursor-pointer' : ''}`}>
            <input type="radio" name="fee-edit-mode" disabled={!data.canChange} checked={data.settings.feeEditMode === key} onChange={async () => {
              try { const result = await saveFeeSettings(key); setData({ ...data, settings: result.settings }); setNotice('Saved.'); } catch (err) { setNotice(err.message); }
            }} />
            <span className="flex-1 font-bold text-[#191970]">{label}</span><span className="text-sm text-[#191970]">{who}</span>
          </label>
        ))}
      </div>
      {!data.canChange && <p className="text-sm font-semibold text-[#191970] dark:text-slate-300">Only the Owner can change this.</p>}
      {notice && <p role="status" className="text-sm font-semibold text-[#1a5c38]">{notice}</p>}
    </section>
  );
}

const NAV = [['dashboard', 'Dashboard'], ['students', 'Students'], ['setup', 'Fee Setup'], ['payments', 'Payments'], ['reports', 'Reports']];
const MORE = [['claims', 'Claims'], ['archives', 'Archives'], ['audit', 'Audit Log'], ['settings', 'Settings']];

/** The next term, once it is created in Academic Sessions: its fees can be set and published before it opens. */
export function NextTermCard({ nextTerm, canEdit, onSetup }) {
  if (!nextTerm) return null;
  const state = nextTerm.published
    ? 'Fees published. Every student\'s account is created at these fees when the term opens.'
    : nextTerm.hasDraft || nextTerm.configured ? 'Fees saved but not published yet.' : 'No fees set yet. You can set them now, before the term opens.';
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-[#191970]/30 bg-white p-4 text-[#191970] dark:border-white/20 dark:bg-slate-900 dark:text-slate-200">
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-[#c9a96e]">Next term</p>
        <p className="font-black text-[#191970] dark:text-white">{nextTerm.sessionName} · {nextTerm.name}{nextTerm.startDate ? ` — starts ${new Date(`${nextTerm.startDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}</p>
        <p className="text-sm">{state}</p>
      </div>
      {canEdit && <button type="button" className={PRIMARY} onClick={() => onSetup(nextTerm.id)}>{nextTerm.published ? `Edit ${nextTerm.name} fees` : `Set ${nextTerm.name} fees in advance`}</button>}
    </section>
  );
}

export default function SimpleFees({ initialSetupTermId = '' }) {
  const [overview, setOverview] = useState(null);
  const [context, setContext] = useState(null);
  const [view, setView] = useState(initialSetupTermId ? 'setup' : 'dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const [setupSource, setSetupSource] = useState(null);
  // Fee Setup opens on the current term unless another one (next term) was chosen.
  const [setupTermId, setSetupTermId] = useState(initialSetupTermId);
  // "Record payment" from a student's file arrives as ?pay=<studentId>&name=<name> and opens the payment for them.
  const [paying, setPaying] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const studentId = params.get('pay');
      return studentId ? { student: { studentId, studentName: params.get('name') || '' } } : null;
    } catch { return null; }
  });
  const [receipt, setReceipt] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(() => getFeesOverview().then(setOverview).catch(err => setError(err.message)), []);
  useEffect(() => { refresh(); getFinanceContext().then(setContext).catch(() => setContext({ classes: [], sessions: [], canRecordPayments: false })); }, [refresh]);

  if (error) return <p role="alert" className="p-4 font-semibold text-rose-700">{error}</p>;
  if (!overview || !context) return <p role="status" className="p-4">Loading Fees & Billing…</p>;
  const go = next => { setView(next); setMoreOpen(false); setNotice(''); };
  const term = overview.term;

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-[#191970] px-5 py-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9a96e]">Fees & Billing</p>
        <h1 className="text-2xl font-black">{term ? `${term.sessionName} · ${term.name}` : 'No term open'}</h1>
      </header>
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Fees and billing">
        {NAV.map(([key, label]) => <button key={key} type="button" onClick={() => { if (key === 'setup') { setSetupSource(null); setSetupTermId(''); } go(key); }} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${view === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#800020]'}`}>{label}</button>)}
        <div className="relative">
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(open => !open)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${MORE.some(([key]) => key === view) ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#800020]'}`}>More ▾</button>
          {moreOpen && (
            <div className="absolute left-0 z-20 mt-1 w-44 rounded-2xl border border-[#c9a96e]/40 bg-white p-1 shadow-lg">
              {MORE.map(([key, label]) => <button key={key} type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#800020] hover:bg-[#fff6e0]" onClick={() => go(key)}>{label}</button>)}
            </div>
          )}
        </div>
      </nav>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#1a5c38]">{notice}</p>}

      {view === 'dashboard' && <Dashboard overview={overview} go={go} onSetup={source => { setSetupSource(source); setSetupTermId(''); setView('setup'); }} onPay={() => setPaying({})} onChanged={message => { setNotice(message); refresh(); }} />}
      {view === 'dashboard' && <NextTermCard nextTerm={overview.nextTerm} canEdit={overview.canEditFees} onSetup={termId => { setSetupSource(null); setSetupTermId(termId); setView('setup'); }} />}
      {view === 'dashboard' && term && <NewStudentsCard onChanged={refresh} />}
      {view === 'dashboard' && term && <ExcursionsCard onChanged={refresh} />}
      {view === 'dashboard' && term && <FeeGroupsCard onChanged={refresh} />}
      {view === 'setup' && <FeeSetup key={`${setupTermId || term?.id}-${setupSource?.type || ''}-${setupSource?.termId || ''}`} initialTermId={setupTermId || term?.id} initialSource={setupSource} canEdit={overview.canEditFees} onSaved={refresh} />}
      {view === 'students' && <StudentAccounts classes={context.classes || []} onChanged={refresh} />}
      {view === 'payments' && <Payments />}
      {view === 'reports' && <Reports term={term} />}
      {view === 'claims' && <ClaimsTab onPay={claim => setPaying({ claim, student: { studentId: claim.studentId, studentName: claim.studentName } })} />}
      {view === 'archives' && <ArchivesTab context={context} initialFilters={{}} />}
      {view === 'audit' && <AuditTab />}
      {view === 'settings' && <FeeSettings />}

      {paying && (
        <RecordPaymentDialog
          student={paying.student} claim={paying.claim} presetAmount={paying.claim?.amount}
          onClose={() => setPaying(null)}
          onDone={result => { setPaying(null); setNotice(`Payment recorded. Receipt ${result.receipt?.receiptNo || ''}.${result.resolvedClaims?.length ? ' The claim is resolved.' : ''}`); setReceipt(result.receipt ? { ...result.receipt, status: 'valid' } : null); refresh(); }}
        />
      )}
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

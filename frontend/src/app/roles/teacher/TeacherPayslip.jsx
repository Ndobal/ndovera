import React, { useEffect, useRef, useState } from 'react';
import { getMyBankDetails, getMyPayslip, getWebsiteSections, saveMyBankDetails } from '../../../features/school/services/schoolApi';
import { currentUserKey, getItem, setItem } from '../../../shared/offline/offlineStore';
import { isRetryable } from '../../../shared/offline/outbox';

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function extractContactInfo(sections = []) {
  const contactSection = (sections || []).find(section => String(section?.section_key || '') === 'contact');
  const metadata = parseMetadata(contactSection?.metadata);
  return {
    address: String(metadata.address || '').trim(),
    phone: String(metadata.phone || '').trim(),
    email: String(metadata.email || '').trim(),
  };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function threeDigitsToWords(n) {
  let str = '';
  if (n >= 100) { str += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n >= 20) { str += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) str += `${ONES[n]} `;
  return str.trim();
}
function numberToWords(value) {
  let n = Math.floor(Number(value || 0));
  if (n === 0) return 'Zero Naira Only';
  const parts = [];
  const scales = [['Billion', 1e9], ['Million', 1e6], ['Thousand', 1e3]];
  for (const [name, factor] of scales) {
    if (n >= factor) { parts.push(`${threeDigitsToWords(Math.floor(n / factor))} ${name}`); n %= factor; }
  }
  if (n > 0) parts.push(threeDigitsToWords(n));
  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Naira Only`;
}

function Row({ label, value, strong, accent }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-sm ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? 'text-[#191970]' : 'text-slate-600'}>{label}</span>
      <span className={accent || 'text-[#191970]'}>₦{Number(value || 0).toLocaleString()}</span>
    </div>
  );
}

/**
 * The staff member's own salary account. What is saved here goes on every payslip
 * of theirs not yet released, and on the school's payroll notes to the bank.
 */
function SalaryAccountCard() {
  const [details, setDetails] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const field = 'mt-1 w-full rounded-xl border border-[#7cc4e8] bg-white px-3 py-2 text-sm text-[#191970] dark:border-slate-600 dark:bg-slate-900 dark:text-white';

  useEffect(() => {
    let active = true;
    getMyBankDetails()
      .then(result => {
        if (!active) return;
        const saved = result?.details || {};
        setDetails({ bankName: saved.bankName || '', accountName: saved.accountName || '', accountNumber: saved.accountNumber || '' });
        if (!saved.accountNumber) setOpen(true);
      })
      .catch(() => null);
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const result = await saveMyBankDetails(details);
      setDetails(result.details);
      setMessage('Saved. Your salary will be paid into this account.');
      setOpen(false);
    } catch (error) {
      setMessage(error.message || 'Could not save your account details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#7cc4e8]/50 bg-white p-4 shadow print:hidden dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-[#191970] dark:text-white">My salary account</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {details.accountNumber ? `${details.bankName} · ${details.accountName} · ${details.accountNumber}` : 'Enter the account your salary should be paid into.'}
          </p>
        </div>
        {!open ? <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-[#1a5c38] px-3 py-1.5 text-sm font-bold text-[#1a5c38] dark:border-emerald-300 dark:text-emerald-200">{details.accountNumber ? 'Change' : 'Add account'}</button> : null}
      </div>
      {open ? (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-[#191970] dark:text-white">Bank name
            <input className={field} value={details.bankName} onChange={event => setDetails(current => ({ ...current, bankName: event.target.value }))} placeholder="e.g. Access Bank" required />
          </label>
          <label className="text-xs font-bold text-[#191970] dark:text-white">Account name
            <input className={field} value={details.accountName} onChange={event => setDetails(current => ({ ...current, accountName: event.target.value }))} required />
          </label>
          <label className="text-xs font-bold text-[#191970] dark:text-white">Account number
            <input className={field} value={details.accountNumber} inputMode="numeric" maxLength={13} onChange={event => setDetails(current => ({ ...current, accountNumber: event.target.value.replace(/[^\d ]/g, '') }))} placeholder="10 digits" required />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white disabled:opacity-70">{saving ? 'Saving…' : 'Save account'}</button>
            {details.accountNumber ? <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button> : null}
          </div>
        </form>
      ) : null}
      {message ? <p role="status" className="mt-2 text-sm font-semibold text-[#191970] dark:text-white">{message}</p> : null}
    </section>
  );
}

async function downloadPayslipPdf(element, fileName) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const width = pdf.internal.pageSize.getWidth() - 20;
  const height = Math.min((canvas.height * width) / canvas.width, pdf.internal.pageSize.getHeight() - 20);
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, width, height, undefined, 'FAST');
  pdf.save(fileName);
}

function periodLabel(period) {
  const [year, month] = String(period || '').split('-').map(Number);
  if (!year || !month) return period || '';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function TeacherPayslip({ auth }) {
  const [payslip, setPayslip] = useState(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [contactInfo, setContactInfo] = useState({ address: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Every month whose payslip has been released, newest first; the newest opens first.
  const [available, setAvailable] = useState([]);
  const [period, setPeriod] = useState('');
  const [offline, setOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef(null);
  const month = periodLabel(period) || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Payslips already opened stay readable on this device without a connection.
    const cacheKey = `payslip:${currentUserKey()}:${period || 'latest'}`;
    Promise.all([getMyPayslip(period), getWebsiteSections().catch(() => ({ sections: [] }))])
      .then(result => { setItem(cacheKey, result).catch(() => null); setOffline(false); return result; })
      .catch(async error => {
        const cached = isRetryable(error) ? await getItem(cacheKey) : null;
        if (!cached) throw error;
        if (active) setOffline(true);
        return cached;
      })
      .then(([data, sectionsResult]) => {
        if (!active) return;
        setAvailable(Array.isArray(data?.available) ? data.available : []);
        if (data?.period && !period) setPeriod(data.period);
        if (data && data.success && data.payslip === null) {
          setPendingMessage(data.message || 'Your payslip has not been released yet.');
          setPayslip(null);
        } else {
          setPendingMessage('');
          setPayslip(data?.payslip || (data && data.gross !== undefined ? data : null));
        }
        setContactInfo(extractContactInfo(sectionsResult?.sections || []));
      })
      .catch(err => { if (active) setError(err.message || 'Could not load your payslip.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const shell = 'p-4 sm:p-8 max-w-3xl mx-auto';
  const picker = available.length > 0 && (
    <label className="flex items-center gap-2 text-sm font-bold text-[#191970] print:hidden dark:text-white">
      Month
      <select className="rounded-xl border border-[#7cc4e8] bg-white px-3 py-2 text-sm text-[#191970]" value={period} onChange={event => setPeriod(event.target.value)}>
        {!available.some(item => item.period === period) && period ? <option value={period}>{periodLabel(period)}</option> : null}
        {available.map(item => <option key={item.period} value={item.period}>{periodLabel(item.period)}</option>)}
      </select>
    </label>
  );
  if (loading) return <div className={shell}><div className="rounded-2xl bg-white p-6 shadow"><p className="text-[#191970]">Loading payslip…</p></div></div>;
  if (error) return <div className={shell}><div className="rounded-2xl bg-white p-6 shadow"><p className="text-rose-700 text-sm">{error}</p></div></div>;
  if (pendingMessage) return (
    <div className={`${shell} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-[#191970] dark:text-white">My Payslip <span className="text-base font-medium text-slate-600 dark:text-slate-300">· {month}</span></h1>
        {picker}
      </div>
      <div className="rounded-2xl bg-white p-6 shadow"><p className="text-sm font-semibold text-[#191970]">{pendingMessage}</p>
        {available.length > 0 && <p className="mt-2 text-sm text-slate-600">Released payslips are in the Month list above.</p>}
      </div>
      <SalaryAccountCard />
    </div>
  );

  const p = payslip || {};
  const gross = p.gross || 0;
  const deductions = p.deductions || 0;
  const net = p.net ?? (gross - deductions);
  const earnings = Array.isArray(p.earnings) && p.earnings.length ? p.earnings : [{ label: 'Basic Salary', amount: gross }];
  const deductionBreakdown = Array.isArray(p.deductionBreakdown) && p.deductionBreakdown.length
    ? p.deductionBreakdown
    : [{ label: 'Total Deductions', amount: deductions }];
  const branding = p.branding && typeof p.branding === 'object' ? p.branding : {};
  const schoolName = branding.schoolName || p.schoolName || 'School';
  const logoUrl = branding.logoUrl || p.logoUrl || '';
  const tagline = branding.tagline || p.tagline || '';
  const website = branding.website || p.website || '';
  const schoolInitials = schoolName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'ND';
  const staffName = p.name || auth?.user?.name || '—';

  return (
    <div className={`${shell} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-[#191970] dark:text-white">My Payslip <span className="text-base font-medium text-slate-600 dark:text-slate-300">· {month}</span></h1>
        {picker}
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            disabled={downloading}
            onClick={async () => {
              if (!sheetRef.current) return;
              setDownloading(true);
              try { await downloadPayslipPdf(sheetRef.current, `payslip-${p.period || period || 'month'}.pdf`); } catch { window.print(); } finally { setDownloading(false); }
            }}
            className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-[#154a2e] disabled:opacity-70"
          >
            {downloading ? 'Preparing…' : '⬇️ Download PDF'}
          </button>
          <button onClick={() => window.print()} className="rounded-xl bg-[#2447d8] px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-[#1b34a8]">🖨️ Print</button>
        </div>
      </div>
      {offline ? <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 print:hidden">No connection — this is the copy saved on this device.</p> : null}

      {/* Payslip sheet */}
      <div ref={sheetRef} id="payslip-print" className="overflow-hidden rounded-2xl border border-[#7cc4e8]/50 bg-white shadow-[0_10px_40px_rgba(20,33,91,0.12)]">
        {/* Header band */}
        <div className="relative flex items-center gap-4 bg-[#1b34a8] bg-gradient-to-r from-[#2447d8] to-[#1b34a8] px-5 py-4 text-white">
          {logoUrl ? (
            <img src={logoUrl} alt={`${schoolName} logo`} className="h-16 w-16 rounded-2xl border border-white/30 bg-white/90 object-contain p-1.5" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-xl font-black">{schoolInitials}</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black">{schoolName}</h2>
            {tagline ? <p className="truncate text-xs text-blue-100">{tagline}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-blue-100">
              {contactInfo.address ? <span>{contactInfo.address}</span> : null}
              {contactInfo.phone ? <span>{contactInfo.phone}</span> : null}
              {contactInfo.email ? <span>{contactInfo.email}</span> : null}
              {website ? <span className="break-all">{website}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-100">Payslip</p>
            <p className="text-sm font-bold">{periodLabel(p.period) || month}</p>
          </div>
        </div>

        <div className="p-5">
          {/* Employee details */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#7cc4e8]/50 sm:grid-cols-4">
            {[
              ['Employee', staffName],
              ['Staff ID', p.displayId || p.staffId || '—'],
              ['Designation', p.role || auth?.user?.role || 'Teacher'],
              ['Pay Period', periodLabel(p.period) || month],
            ].map(([k, v], i) => (
              <div key={k} className={`p-3 ${i % 2 === 0 ? 'bg-[#cfecf7]/40' : 'bg-white'} border-b border-[#7cc4e8]/40`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#2447d8]">{k}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-[#191970]">{v}</p>
              </div>
            ))}
          </div>

          {/* Earnings & Deductions */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-[#7cc4e8]/50">
              <div className="bg-[#1a5c38] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">Earnings</div>
              <div className="divide-y divide-[#7cc4e8]/30">
                {earnings.map((e, i) => <Row key={e.key || e.label || i} label={e.label} value={e.amount} />)}
              </div>
              <div className="border-t-2 border-[#1a5c38]/30 bg-emerald-50"><Row label="Gross Pay" value={gross} strong accent="text-[#191970]" /></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[#7cc4e8]/50">
              <div className="bg-[#9f1239] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">Deductions</div>
              <div className="divide-y divide-[#7cc4e8]/30">
                {deductionBreakdown.map((d, i) => <Row key={d.key || d.label || i} label={d.label} value={d.amount} />)}
              </div>
              <div className="border-t-2 border-rose-500/30 bg-rose-50"><Row label="Total Deductions" value={deductions} strong accent="text-rose-700" /></div>
            </div>
          </div>

          {/* Net pay */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[#cfecf7] to-[#ade1f4] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#2447d8]">Net Pay</p>
              <p className="text-[11px] text-slate-600">{numberToWords(net)}</p>
            </div>
            <p className="text-3xl font-black text-[#191970]">₦{Number(net).toLocaleString()}</p>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            {['Employee Signature', 'Authorised Signatory'].map(label => (
              <div key={label} className="text-center">
                <div className="mx-auto h-px w-4/5 bg-slate-400" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-dashed border-[#7cc4e8]/50 pt-3 text-center text-[11px] text-slate-500">
            This is a computer-generated payslip from {schoolName}. Keep it for your records.
          </p>
        </div>
      </div>
      <SalaryAccountCard />
    </div>
  );
}

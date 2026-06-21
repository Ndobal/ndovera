import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { getTenantPwaInfo } from '../../../shared/hooks/useTenantPwaManifest';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatPaymentType(value) {
  const normalized = String(value || 'cash').replace(/-/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildVerificationLabel(url) {
  if (!url) return '';
  return url.length > 60 ? `${url.slice(0, 57)}...` : url;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function threeDigits(n) {
  let s = '';
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) s += `${ONES[n]} `;
  return s.trim();
}
function amountInWords(value) {
  let n = Math.floor(Number(value || 0));
  if (n === 0) return 'Zero Naira Only';
  const parts = [];
  for (const [name, factor] of [['Billion', 1e9], ['Million', 1e6], ['Thousand', 1e3]]) {
    if (n >= factor) { parts.push(`${threeDigits(Math.floor(n / factor))} ${name}`); n %= factor; }
  }
  if (n > 0) parts.push(threeDigits(n));
  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Naira Only`;
}

function LineItem({ label, value, accent, strong, last }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-2.5 ${last ? '' : 'border-b border-[#7cc4e8]/40'} ${strong ? 'bg-[#cfecf7]/50' : ''}`}>
      <span className={`text-sm ${strong ? 'font-bold text-[#191970]' : 'text-slate-600 dark:text-slate-300'}`}>{label}</span>
      <span className={`text-sm font-black ${accent || 'text-[#191970] dark:text-white'}`}>{value}</span>
    </div>
  );
}

export default function FeeReceiptPrintCard({ receipt, printId = 'fee-receipt-print', title = 'Official Fees Receipt', subtitle = 'Verification-ready payment receipt.' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const tenantBranding = useMemo(() => getTenantPwaInfo(), []);

  useEffect(() => {
    let cancelled = false;
    if (!receipt?.verificationUrl) { setQrDataUrl(''); return undefined; }
    QRCode.toDataURL(receipt.verificationUrl, { margin: 1, width: 176, color: { dark: '#191970', light: '#ffffff' } })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [receipt?.verificationUrl]);

  if (!receipt) return null;

  const schoolName = receipt.schoolName || tenantBranding?.schoolName || 'NDOVERA School';
  const schoolLogoUrl = receipt.schoolLogoUrl || tenantBranding?.logoUrl || '';
  const studentIdLabel = receipt.studentDisplayId || receipt.studentId || 'Not assigned';
  const amountPaid = receipt.amount || receipt.amountPaid || 0;
  const contactLine = [tenantBranding?.address, tenantBranding?.phone, tenantBranding?.email].filter(Boolean).join('  •  ');

  return (
    <div id={printId} className="relative w-full overflow-hidden rounded-2xl border-2 border-[#2447d8]/30 bg-white text-[#191970] shadow-[0_18px_44px_rgba(20,33,91,0.14)] dark:border-white/10 dark:bg-slate-900 dark:text-white">
      {/* Decorative top ribbon */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#2447d8] via-[#5b8def] to-[#2447d8]" />

      {/* Header */}
      <div className="flex flex-col items-center gap-2 border-b border-[#7cc4e8]/40 px-6 py-5 text-center">
        {schoolLogoUrl ? (
          <img src={schoolLogoUrl} alt={`${schoolName} logo`} className="h-16 w-16 rounded-2xl border border-[#7cc4e8]/40 bg-white object-contain p-1.5" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2447d8] text-xl font-black text-white">{schoolName.charAt(0)}</div>
        )}
        <h2 className="text-2xl font-black tracking-tight text-[#191970] dark:text-white">{schoolName}</h2>
        {contactLine ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{contactLine}</p> : null}
        <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#2447d8] px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">{title}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      {/* Receipt meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#7cc4e8]/40 bg-[#cfecf7]/30 px-6 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#2447d8]">Receipt No.</p>
          <p className="font-mono text-sm font-black text-[#191970] dark:text-white">{receipt.receiptNo || '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#2447d8]">Date</p>
          <p className="text-sm font-bold text-[#191970] dark:text-white">{formatDateTime(receipt.recordedAt || receipt.date)}</p>
        </div>
      </div>

      <div className="relative px-6 py-5">
        {/* PAID stamp */}
        <div className="pointer-events-none absolute right-6 top-3 -rotate-12 select-none rounded-lg border-2 border-emerald-500/70 px-3 py-1 text-base font-black uppercase tracking-[0.3em] text-emerald-600/80">
          Paid
        </div>

        {/* Received from */}
        <p className="text-xs font-bold uppercase tracking-wide text-[#2447d8]">Received with thanks from</p>
        <h3 className="mt-1 text-lg font-black text-[#191970] dark:text-white">{receipt.studentName || receipt.name || 'Student'}</h3>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span><b className="text-[#191970] dark:text-white">ID:</b> {studentIdLabel}</span>
          <span><b className="text-[#191970] dark:text-white">Class:</b> {receipt.className || 'Not assigned'}</span>
          <span><b className="text-[#191970] dark:text-white">Term:</b> {receipt.termName || 'Current term'}</span>
          <span><b className="text-[#191970] dark:text-white">Session:</b> {receipt.sessionName || 'Current session'}</span>
        </div>

        {/* Itemised summary */}
        <div className="mt-4 overflow-hidden rounded-xl border border-[#7cc4e8]/50">
          <div className="flex items-center justify-between bg-[#2447d8] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
            <span>Description</span><span>Amount</span>
          </div>
          <LineItem label="Expected Fees" value={formatNaira(receipt.feeAmount || receipt.expected)} />
          <LineItem label="Amount Paid (this receipt)" value={formatNaira(amountPaid)} strong accent="text-emerald-700 dark:text-emerald-400" />
          <LineItem label="Total Paid To Date" value={formatNaira(receipt.amountPaidAfter || receipt.amountPaid)} />
          <LineItem label="Balance After Payment" value={formatNaira(receipt.balanceAfter || receipt.balance)} accent="text-rose-700 dark:text-rose-400" last />
        </div>

        <p className="mt-3 rounded-lg bg-[#cfecf7]/40 px-3 py-2 text-xs italic text-[#191970] dark:bg-white/5 dark:text-slate-200">
          Amount in words: <b>{amountInWords(amountPaid)}</b>
        </p>

        {/* Payment details + QR */}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <p><b className="text-[#191970] dark:text-white">Payment method:</b> {formatPaymentType(receipt.paymentType)}</p>
            <p><b className="text-[#191970] dark:text-white">Reference:</b> {receipt.paymentReference || receipt.reference || 'School office entry'}</p>
            <p><b className="text-[#191970] dark:text-white">Recorded by:</b> {receipt.recordedBy || 'School finance office'}</p>
            <p><b className="text-[#191970] dark:text-white">Status:</b> {receipt.statusAfter || receipt.status || 'Recorded'}</p>
            {receipt.reissuedFromReceiptNo ? <p><b className="text-[#191970] dark:text-white">Reissued from:</b> {receipt.reissuedFromReceiptNo}</p> : null}
            <div className="mt-6 inline-block">
              <div className="h-px w-44 bg-slate-400" />
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cashier / Bursar Signature</p>
            </div>
          </div>
          {qrDataUrl ? (
            <div className="rounded-xl border border-[#7cc4e8]/40 bg-white p-3 text-center dark:bg-slate-800">
              <img src={qrDataUrl} alt="Receipt verification QR code" className="mx-auto h-28 w-28" />
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#2447d8]">Scan to verify</p>
              <p className="mt-0.5 break-all text-[9px] text-slate-400">{buildVerificationLabel(receipt.verificationUrl)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <p className="border-t border-dashed border-[#7cc4e8]/50 px-6 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
        This receipt reflects a recorded school fee payment and should be retained for verification. Thank you.
      </p>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#2447d8] via-[#5b8def] to-[#2447d8]" />
    </div>
  );
}

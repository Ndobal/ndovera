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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#c9a96e]/30 bg-[#fff8f0] px-4 py-3 dark:border-[#bf00ff]/25 dark:bg-black/25">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{label}</span>
      <span className="text-right text-sm font-bold text-[#191970] dark:text-white">{value || 'Not available'}</span>
    </div>
  );
}

export default function FeeReceiptPrintCard({ receipt, printId = 'fee-receipt-print', title = 'Official School Fees Receipt', subtitle = 'Verification-ready payment receipt.' }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const tenantBranding = useMemo(() => getTenantPwaInfo(), []);

  useEffect(() => {
    let cancelled = false;

    if (!receipt?.verificationUrl) {
      setQrDataUrl('');
      return undefined;
    }

    QRCode.toDataURL(receipt.verificationUrl, {
      margin: 1,
      width: 176,
      color: { dark: '#800000', light: '#f5deb3' },
    }).then(url => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [receipt?.verificationUrl]);

  if (!receipt) return null;

  const schoolName = receipt.schoolName || tenantBranding?.schoolName || 'NDOVERA School';
  const studentIdLabel = receipt.studentDisplayId || receipt.studentId || 'Not assigned';

  return (
    <div id={printId} className="w-full rounded-[32px] border border-[#c9a96e]/40 bg-[#f5deb3] p-4 sm:p-6 text-[#191970] shadow-[0_18px_42px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/88 dark:text-[#39ff14]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">{schoolName}</p>
          <h3 className="mt-2 text-2xl font-black text-[#800000] dark:text-white">{title}</h3>
          <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#800020]/20 bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:border-[#bf00ff]/30 dark:bg-black/25 dark:text-[#bf00ff]">
            {receipt.statusAfter || receipt.status || 'Recorded'}
          </span>
          <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
            {receipt.receiptNo}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          <DetailRow label="Receipt number" value={receipt.receiptNo} />
          <DetailRow label="Date issued" value={formatDateTime(receipt.recordedAt || receipt.date)} />
          <DetailRow label="Student" value={receipt.studentName || receipt.name} />
          <DetailRow label="Student ID" value={studentIdLabel} />
          <DetailRow label="Class" value={receipt.className || 'Not assigned'} />
          <DetailRow label="Payment method" value={formatPaymentType(receipt.paymentType)} />
          <DetailRow label="Reference" value={receipt.paymentReference || receipt.reference || 'School office entry'} />
          <DetailRow label="Recorded by" value={receipt.recordedBy || 'School finance office'} />
        </div>

        <div className="rounded-3xl border border-[#c9a96e]/35 bg-[#fff8f0] p-5 dark:border-[#bf00ff]/25 dark:bg-black/25">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Payment Summary</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4 border-b border-[#c9a96e]/30 pb-3 dark:border-[#bf00ff]/20">
              <span className="text-sm font-semibold">Expected Fees</span>
              <span className="text-lg font-black text-[#800000] dark:text-white">{formatNaira(receipt.feeAmount || receipt.expected)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#c9a96e]/30 pb-3 dark:border-[#bf00ff]/20">
              <span className="text-sm font-semibold">Amount Paid</span>
              <span className="text-lg font-black text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(receipt.amount || receipt.amountPaid)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[#c9a96e]/30 pb-3 dark:border-[#bf00ff]/20">
              <span className="text-sm font-semibold">Total Paid To Date</span>
              <span className="text-lg font-black">{formatNaira(receipt.amountPaidAfter || receipt.amountPaid)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">Balance After Payment</span>
              <span className="text-lg font-black text-[#800000] dark:text-[#ff6bff]">{formatNaira(receipt.balanceAfter || receipt.balance)}</span>
            </div>
          </div>

          {qrDataUrl ? (
            <div className="mt-6 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-center dark:border-[#bf00ff]/20 dark:bg-black/25">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Receipt verification</p>
              <img src={qrDataUrl} alt="Receipt verification QR code" className="mx-auto mt-3 h-36 w-36 rounded-2xl border border-[#c9a96e]/30 bg-white p-2" />
              <p className="mt-3 text-xs font-semibold text-[#191970] dark:text-[#39ff14]">Scan to verify online</p>
              <p className="mt-2 break-all text-[11px] text-[#800020] dark:text-[#bf00ff]">{buildVerificationLabel(receipt.verificationUrl)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-[#800020]/25 bg-white/55 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/30 dark:bg-black/25 dark:text-[#bf00ff]">
        This receipt reflects a recorded school fee payment and should be retained for school record verification.
      </div>
    </div>
  );
}
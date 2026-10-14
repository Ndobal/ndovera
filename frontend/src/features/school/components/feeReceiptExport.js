// The school's designed fee receipt as a standalone document, and saving many at
// once. Shared by the Term Fees board and Fees & Billing so every receipt a school
// issues looks the same, whichever screen issued it.
import JSZip from 'jszip';
import QRCode from 'qrcode';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}
export function isInternalUserId(value) {
  return /^user_\d{10,}_[a-z0-9]+$/i.test(String(value || '').trim());
}

export function getReadableStudentId(displayId, fallbackId = '') {
  const normalizedDisplayId = String(displayId || '').trim();
  if (normalizedDisplayId) {
    return normalizedDisplayId;
  }

  const normalizedFallback = String(fallbackId || '').trim();
  if (!normalizedFallback || isInternalUserId(normalizedFallback)) {
    return 'Not assigned';
  }

  return normalizedFallback;
}

export function formatReceiptDateTime(value) {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function formatReceiptPaymentType(value) {
  const normalized = String(value || 'cash').replace(/-/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function escapeReceiptHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeReceiptFilePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '_')
    .slice(0, 80);
}

export async function buildReceiptExportDocument(receipt, fallbackBranding = {}) {
  const schoolName = receipt.schoolName || fallbackBranding.schoolName || 'NDOVERA School';
  const schoolLogoUrl = receipt.schoolLogoUrl || fallbackBranding.logoUrl || '';
  const studentIdLabel = getReadableStudentId(receipt.studentDisplayId, receipt.studentId);
  const qrDataUrl = receipt.verificationUrl
    ? await QRCode.toDataURL(receipt.verificationUrl, {
        margin: 1,
        width: 176,
        color: { dark: '#800000', light: '#b5e3f4' },
      }).catch(() => '')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeReceiptHtml(receipt.receiptNo || 'School Fee Receipt')}</title>
  <style>
    body { margin: 0; padding: 32px; background: #b5e3f4; color: #191970; font-family: 'Segoe UI', sans-serif; }
    .card { max-width: 960px; margin: 0 auto; background: rgba(255,255,255,0.55); border: 1px solid rgba(128,0,32,0.15); border-radius: 28px; padding: 28px; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; gap: 16px; align-items: flex-start; }
    .logo { width: 88px; height: 88px; object-fit: contain; border-radius: 24px; background: white; border: 1px solid rgba(128,0,0,0.15); padding: 8px; }
    .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #800020; }
    h1 { margin: 10px 0 0; color: #800000; font-size: 28px; }
    .subtitle { margin-top: 10px; font-size: 14px; }
    .pill { display: inline-block; margin-left: 8px; padding: 8px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
    .pill-status { border: 1px solid rgba(128,0,32,0.2); background: rgba(255,255,255,0.75); color: #800020; }
    .pill-number { background: #1a5c38; color: #b5e3f4; }
    .grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px; margin-top: 24px; }
    .details { display: grid; gap: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border-radius: 18px; background: rgba(255,248,240,0.85); border: 1px solid rgba(201,169,110,0.25); }
    .label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #800020; }
    .value { font-size: 14px; font-weight: 700; text-align: right; }
    .summary { border-radius: 22px; background: rgba(255,248,240,0.85); border: 1px solid rgba(201,169,110,0.25); padding: 20px; }
    .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 0 0 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(201,169,110,0.3); }
    .summary-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
    .summary-value { font-size: 22px; font-weight: 800; }
    .green { color: #1a5c38; }
    .red { color: #800000; }
    .verification { margin-top: 20px; border-radius: 18px; background: rgba(240,208,144,0.75); border: 1px solid rgba(201,169,110,0.25); padding: 16px; text-align: center; }
    .qr { width: 144px; height: 144px; object-fit: contain; background: white; border-radius: 18px; padding: 8px; border: 1px solid rgba(201,169,110,0.3); }
    .footer { margin-top: 24px; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,0.55); border: 1px dashed rgba(128,0,32,0.25); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #800020; }
    @media print { body { padding: 0; } .card { border: 0; background: transparent; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        ${schoolLogoUrl ? `<img class="logo" src="${escapeReceiptHtml(schoolLogoUrl)}" alt="${escapeReceiptHtml(schoolName)} logo" />` : ''}
        <div>
          <div class="eyebrow">${escapeReceiptHtml(schoolName)}</div>
          <h1>Official School Fees Receipt</h1>
          <div class="subtitle">Verification-ready payment receipt.</div>
        </div>
      </div>
      <div>
        <span class="pill pill-status">${escapeReceiptHtml(receipt.statusAfter || receipt.status || 'Recorded')}</span>
        <span class="pill pill-number">${escapeReceiptHtml(receipt.receiptNo || 'Receipt')}</span>
      </div>
    </div>
    <div class="grid">
      <div class="details">
        <div class="row"><span class="label">Receipt number</span><span class="value">${escapeReceiptHtml(receipt.receiptNo || '')}</span></div>
        <div class="row"><span class="label">Date issued</span><span class="value">${escapeReceiptHtml(formatReceiptDateTime(receipt.recordedAt || receipt.date))}</span></div>
        <div class="row"><span class="label">Student</span><span class="value">${escapeReceiptHtml(receipt.studentName || receipt.name || '')}</span></div>
        <div class="row"><span class="label">Student ID</span><span class="value">${escapeReceiptHtml(studentIdLabel)}</span></div>
        <div class="row"><span class="label">Class</span><span class="value">${escapeReceiptHtml(receipt.className || 'Not assigned')}</span></div>
        <div class="row"><span class="label">Session</span><span class="value">${escapeReceiptHtml(receipt.sessionName || 'Current session')}</span></div>
        <div class="row"><span class="label">Term</span><span class="value">${escapeReceiptHtml(receipt.termName || 'Current term')}</span></div>
        <div class="row"><span class="label">Payment method</span><span class="value">${escapeReceiptHtml(formatReceiptPaymentType(receipt.paymentType))}</span></div>
        <div class="row"><span class="label">Reference</span><span class="value">${escapeReceiptHtml(receipt.paymentReference || receipt.reference || 'School office entry')}</span></div>
        <div class="row"><span class="label">Receipt type</span><span class="value">${escapeReceiptHtml(receipt.receiptKind || 'issued')}</span></div>
        ${receipt.reissuedFromReceiptNo ? `<div class="row"><span class="label">Reissued from</span><span class="value">${escapeReceiptHtml(receipt.reissuedFromReceiptNo)}</span></div>` : ''}
      </div>
      <div class="summary">
        <div class="eyebrow">Payment Summary</div>
        <div style="margin-top: 16px;">
          <div class="summary-row"><span>Expected Fees</span><span class="summary-value red">${escapeReceiptHtml(formatNaira(receipt.feeAmount || receipt.expected))}</span></div>
          <div class="summary-row"><span>Amount Paid</span><span class="summary-value green">${escapeReceiptHtml(formatNaira(receipt.amount || receipt.amountPaid))}</span></div>
          <div class="summary-row"><span>Total Paid To Date</span><span class="summary-value">${escapeReceiptHtml(formatNaira(receipt.amountPaidAfter || receipt.amountPaid))}</span></div>
          <div class="summary-row"><span>Balance After Payment</span><span class="summary-value red">${escapeReceiptHtml(formatNaira(receipt.balanceAfter || receipt.balance))}</span></div>
        </div>
        ${qrDataUrl ? `<div class="verification"><div class="eyebrow">Receipt verification</div><img class="qr" src="${qrDataUrl}" alt="Receipt verification QR code" /><div style="margin-top: 12px; font-size: 12px; font-weight: 700;">Scan to verify online</div><div style="margin-top: 8px; font-size: 11px; color: #800020; word-break: break-all;">${escapeReceiptHtml(receipt.verificationUrl || '')}</div></div>` : ''}
      </div>
    </div>
    <div class="footer">This receipt reflects a recorded school fee payment and should be retained for school record verification.</div>
  </div>
</body>
</html>`;
}

/**
 * Save receipts as one file each: into a folder the user picks (where the browser
 * allows it), otherwise as a zip download. Returns how they were saved.
 */
export async function saveReceiptDocuments(receipts, branding = {}, folderLabel = 'school_receipts') {
  const folderName = sanitizeReceiptFilePart(folderLabel) || 'school_receipts';
  const documents = await Promise.all(receipts.map(async receipt => ({
    name: `${sanitizeReceiptFilePart(receipt.studentName || receipt.studentDisplayId || receipt.studentId || 'student') || 'student'}_${sanitizeReceiptFilePart(receipt.receiptNo || 'receipt') || 'receipt'}.html`,
    content: await buildReceiptExportDocument(receipt, branding || {}),
  })));

  if (typeof window.showDirectoryPicker === 'function') {
    const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const receiptsDirectory = await rootHandle.getDirectoryHandle(folderName, { create: true });
    for (const documentFile of documents) {
      const fileHandle = await receiptsDirectory.getFileHandle(documentFile.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(documentFile.content);
      await writable.close();
    }
    return { count: documents.length, folderName, mode: 'folder' };
  }

  const zip = new JSZip();
  const directory = zip.folder(folderName);
  documents.forEach(documentFile => directory.file(documentFile.name, documentFile.content));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${folderName}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
  return { count: documents.length, folderName, mode: 'zip' };
}
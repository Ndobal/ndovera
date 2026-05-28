import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const OUTLINE_BTN = 'rounded-2xl border border-[#800020]/30 bg-white/60 px-5 py-2.5 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/25 dark:bg-[#1a001d]/80 dark:text-[#bf00ff]';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function sanitizeFileName(value) {
  return String(value || 'bank-note')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bank-note';
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

async function createPdfBlob(element) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const imageData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imageHeight;
  let position = 0;

  pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imageHeight;
    pdf.addPage();
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

function openPrintWindow(markup) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    return false;
  }

  const stylesheetMarkup = Array.from(window.document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('');

  printWindow.document.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>Payroll Bank Note</title>
        ${stylesheetMarkup}
        <style>
          body { margin: 0; padding: 24px; background: #ffffff; color: #111827; }
          .print-root { max-width: 1100px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="print-root">${markup}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
  return true;
}

export default function PayrollBankNotePanel({
  rows,
  loading,
  monthLabel,
  branding,
  contactInfo,
  noteText,
  onNoteChange,
  canEdit,
  canExport,
  currentUser,
  showToast,
  onSaveNote,
  savingNote,
  preparedByName,
  preparedByRole,
  savedAt,
  isReferenceView,
  onReturnToCurrent,
}) {
  const previewRef = useRef(null);
  const [exportBusy, setExportBusy] = useState('');

  const fileName = useMemo(() => {
    const schoolName = sanitizeFileName(branding?.schoolName || 'school');
    return `${schoolName}-payroll-notes-${sanitizeFileName(monthLabel)}.pdf`;
  }, [branding?.schoolName, monthLabel]);

  const totalNetPay = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row?.net ?? row?.computedNet ?? 0), 0),
    [rows],
  );

  const signerName = String(preparedByName || currentUser?.name || currentUser?.fullName || currentUser?.email || 'Authorized Officer').trim();
  const signerRole = String(preparedByRole || currentUser?.role || currentUser?.primaryRole || '').trim();
  const signatureDate = savedAt ? new Date(savedAt).toLocaleString() : new Date().toLocaleString();

  async function handlePdfAction(mode) {
    if (!previewRef.current) {
      showToast('Payroll note preview is not ready yet.');
      return;
    }

    if (!canExport) {
      showToast('Submit payroll before exporting payroll notes for this month.');
      return;
    }

    setExportBusy(mode);

    try {
      const blob = await createPdfBlob(previewRef.current);

      if (mode === 'download') {
        downloadBlob(blob, fileName);
        showToast('Bank note downloaded as PDF.');
        return;
      }

      const shareFile = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          title: `${branding?.schoolName || 'School'} payroll notes`,
          text: `Payroll notes for ${monthLabel}`,
          files: [shareFile],
        });
        showToast('Payroll notes shared.');
      } else {
        downloadBlob(blob, fileName);
        showToast('PDF sharing is not available here. The file was downloaded instead.');
      }
    } catch (error) {
      showToast(error.message || 'Could not export payroll notes PDF.');
    } finally {
      setExportBusy('');
    }
  }

  function handlePrint() {
    if (!previewRef.current) {
      showToast('Payroll note preview is not ready yet.');
      return;
    }

    if (!canExport) {
      showToast('Submit payroll before printing payroll notes for this month.');
      return;
    }

    const opened = openPrintWindow(previewRef.current.outerHTML);
    if (!opened) {
      showToast('Allow popups to print the payroll notes.');
    }
  }

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#800000] dark:text-[#0000ff]">Payroll Notes</h3>
            <p className="mt-2 max-w-3xl text-sm text-[#191970] dark:text-[#39ff14]">
              Prepare an A4 payroll note with staff names, saved account details, net pay, school letterhead, and the signature of the person who prepared the month&apos;s payroll.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={BADGE}>{monthLabel}</span>
            <span className={BADGE}>{rows.length} staff rows</span>
            {savedAt ? <span className={BADGE}>Saved {new Date(savedAt).toLocaleString()}</span> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
            Payroll Notes
            <textarea
              value={noteText}
              disabled={!canEdit}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={6}
              placeholder="Enter the payroll note that should appear above the signature block."
              className={`${INPUT} mt-2 min-h-[148px] resize-y`}
            />
          </label>

          <div className={`${INNER} space-y-4`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Prepared By</p>
              <p className="mt-2 text-lg font-bold text-[#191970] dark:text-white">{signerName}</p>
              <p className="mt-1 text-sm capitalize text-[#800020] dark:text-[#bf00ff]">{signerRole || 'Authorized signatory'}</p>
              <p className="mt-1 text-xs text-[#191970] dark:text-[#39ff14]">{savedAt ? `Saved on ${signatureDate}` : `Will be signed on save as ${signatureDate}`}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Export tools</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {canEdit ? (
                  <button onClick={onSaveNote} type="button" disabled={savingNote} className={BTN}>
                    {savingNote ? 'Saving...' : 'Save Notes'}
                  </button>
                ) : null}
                <button onClick={handlePrint} type="button" disabled={!canExport} className={BTN}>Print</button>
                <button onClick={() => handlePdfAction('download')} type="button" disabled={exportBusy !== '' || !canExport} className={BTN}>
                  {exportBusy === 'download' ? 'Preparing PDF...' : 'Download PDF'}
                </button>
                <button onClick={() => handlePdfAction('share')} type="button" disabled={exportBusy !== '' || !canExport} className={OUTLINE_BTN}>
                  {exportBusy === 'share' ? 'Preparing Share...' : 'Share PDF'}
                </button>
                {isReferenceView && onReturnToCurrent ? (
                  <button onClick={onReturnToCurrent} type="button" className={OUTLINE_BTN}>Back To Current Month</button>
                ) : null}
              </div>
              {!canExport ? <p className="mt-3 text-xs text-[#191970] dark:text-[#39ff14]">Submit payroll before saving, printing, or sharing payroll notes for this month.</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-lg font-bold text-[#800000] dark:text-[#0000ff]">Payroll Notes Preview</h4>
            <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">This is the exact layout used for print, download, and share.</p>
          </div>
          <span className={BADGE}>Prepared for {monthLabel}</span>
        </div>

        <div ref={previewRef} className="rounded-[32px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={`${branding?.schoolName || 'School'} logo`} className="h-20 w-20 rounded-3xl border border-slate-200 bg-white object-cover p-2" />
              ) : null}
              <div>
                <h2 className="text-2xl font-bold text-[#800000]">{branding?.schoolName || 'School Payroll Office'}</h2>
                <p className="mt-2 text-sm text-slate-700">Monthly Payroll Notes</p>
                {contactInfo?.address ? <p className="mt-2 text-sm text-slate-600">{contactInfo.address}</p> : null}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {contactInfo?.phone ? <span>{contactInfo.phone}</span> : null}
                  {contactInfo?.email ? <span>{contactInfo.email}</span> : null}
                  {branding?.website ? <span>{branding.website}</span> : null}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f5deb3] px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020]">Period</p>
              <p className="mt-2 text-lg font-bold text-[#800000]">{monthLabel}</p>
              <p className="mt-2 text-xs text-slate-600">Generated {signatureDate}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020]">Instruction</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {noteText || `Please process payroll for ${monthLabel} as listed below and confirm each successful credit.`}
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#800020] text-[#f5deb3]">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">S/N</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Staff Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Role</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Bank Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Account Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Account No.</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`bank-note-preview-${row.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border-t border-slate-200 px-3 py-3 align-top">{index + 1}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top font-semibold text-slate-800">{row.name}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top capitalize">{row.role || 'staff'}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top">{row.bankName || 'Pending update'}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top">{row.accountName || 'Pending update'}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top">{row.accountNumber || 'Pending update'}</td>
                    <td className="border-t border-slate-200 px-3 py-3 align-top font-bold text-[#1a5c38]">{formatNaira(row.net ?? row.computedNet ?? 0)}</td>
                  </tr>
                ))}
                <tr className="bg-[#f5deb3]">
                  <td colSpan={6} className="border-t border-slate-200 px-3 py-3 text-right text-sm font-bold text-[#800000]">Total Net Pay</td>
                  <td className="border-t border-slate-200 px-3 py-3 text-sm font-bold text-[#1a5c38]">{formatNaira(totalNetPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020]">Prepared By</p>
              <p className="mt-4 text-4xl text-[#800000]" style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}>{signerName}</p>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-800">{signerRole || 'Authorized signatory'}</p>
              <p className="mt-1 text-xs text-slate-500">Digitally signed on {signatureDate}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020]">Payroll Summary</p>
              <p className="mt-3 text-sm text-slate-700">Please process the payroll entries above and credit each staff account with the listed net amount for the month.</p>
              <p className="mt-3 text-sm text-slate-700">Any row marked pending should be updated in the account details tab before the final note is shared or printed.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
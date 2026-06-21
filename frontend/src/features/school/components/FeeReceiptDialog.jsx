import React, { useEffect } from 'react';
import FeeReceiptPrintCard from './FeeReceiptPrintCard';

const ACTION_BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const WHATSAPP_BTN = 'rounded-2xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5b]';
const CLOSE_BTN = 'rounded-2xl border border-[#800020]/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]';

function naira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function digitsOnlyPhone(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  let digits = raw.replace(/\+/g, '');
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`; // Nigeria default
  return digits;
}

function buildReceiptShareMessage(receipt) {
  const lines = [
    `${receipt.schoolName || 'School'} — Fee ${receipt.receiptKind === 'invoice' ? 'Invoice' : 'Receipt'} ${receipt.receiptNo || ''}`.trim(),
    `Student: ${receipt.studentName || receipt.name || ''}${receipt.className ? ` (${receipt.className})` : ''}`,
    [receipt.sessionName, receipt.termName].filter(Boolean).join(' • '),
    `Amount: ${naira(receipt.amount || receipt.amountPaid)}`,
    `Total Paid To Date: ${naira(receipt.amountPaidAfter ?? receipt.amountPaid)}`,
    `Balance: ${naira(receipt.balanceAfter ?? receipt.balance)}`,
    receipt.verificationUrl ? `Verify: ${receipt.verificationUrl}` : '',
    'Thank you.',
  ].filter(Boolean);
  return lines.join('\n');
}

function shareReceiptOnWhatsApp(receipt) {
  if (!receipt) return;
  const phone = digitsOnlyPhone(receipt.parentPhone || receipt.payerPhone || receipt.phone);
  const text = encodeURIComponent(buildReceiptShareMessage(receipt));
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function FeeReceiptDialog({
  receipt = null,
  isOpen = false,
  onClose = () => {},
  printId = 'fee-receipt-print',
  title = 'Official School Fees Receipt',
  subtitle = 'Verification-ready payment receipt.',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 p-3 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="flex w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[32px] border border-[#c9a96e]/40 bg-[#fff4df] shadow-[0_20px_50px_rgba(0,0,0,0.28)] dark:border-[#bf00ff]/35 dark:bg-[#2a001f]/92"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#c9a96e]/35 px-4 py-3 sm:px-5 dark:border-[#bf00ff]/25">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Receipt Viewer</p>
            </div>
            <button type="button" onClick={onClose} className={CLOSE_BTN}>Close</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">
            <FeeReceiptPrintCard
              receipt={receipt}
              printId={printId}
              title={title}
              subtitle={subtitle}
            />
          </div>

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[#c9a96e]/35 bg-[#fff4df]/95 px-4 py-3 backdrop-blur sm:px-5 dark:border-[#bf00ff]/25 dark:bg-[#2a001f]/95">
            <button type="button" onClick={() => shareReceiptOnWhatsApp(receipt)} className={WHATSAPP_BTN}>Share on WhatsApp</button>
            <button type="button" onClick={() => window.print()} className={ACTION_BTN}>Print Receipt</button>
            <button type="button" onClick={onClose} className={CLOSE_BTN}>Close Receipt</button>
          </div>
        </div>
      </div>
    </div>
  );
}
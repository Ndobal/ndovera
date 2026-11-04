import React, { useEffect, useState } from 'react';
import FeeReceiptPrintCard from './FeeReceiptPrintCard';
import { receiptImage, saveFile, sendReceiptImage } from './receiptImage';
import { emailMyReceipt, emailReceiptToParents } from '../../communications/schoolEmailApi';
import { askConfirm } from '../../../shared/components/AppDialog';

const ACTION_BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const WHATSAPP_BTN = 'rounded-2xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-[#06301a] transition-colors hover:bg-[#1ebe5b]';
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

export function buildReceiptShareMessage(receipt) {
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

function whatsAppUrl(receipt) {
  const phone = digitsOnlyPhone(receipt.parentPhone || receipt.payerPhone || receipt.phone);
  const text = encodeURIComponent(buildReceiptShareMessage(receipt));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

function shareReceiptOnWhatsApp(receipt) {
  if (!receipt) return;
  window.open(whatsAppUrl(receipt), '_blank', 'noopener,noreferrer');
}

const currentRole = () => {
  try {
    return String(localStorage.getItem('selectedRole') || JSON.parse(localStorage.getItem('authUser') || '{}').role || '').toLowerCase();
  } catch { return ''; }
};

/** Email the receipt: a parent to themselves, the school to the child's parents. Sending it twice is asked about. */
async function emailReceipt(receiptNo, isParent) {
  if (isParent) return `Sent to ${(await emailMyReceipt(receiptNo)).sentTo.join(', ')}.`;
  try {
    return `Sent to ${(await emailReceiptToParents(receiptNo)).sentTo.join(', ')}.`;
  } catch (error) {
    if (!error.data?.alreadySent) throw error;
    if (!await askConfirm(`This receipt was already emailed to ${error.data.sentTo}. Send it again?`)) return '';
    return `Sent again to ${(await emailReceiptToParents(receiptNo, true)).sentTo.join(', ')}.`;
  }
}

export default function FeeReceiptDialog({
  receipt = null,
  isOpen = false,
  onClose = () => {},
  printId = 'fee-receipt-print',
  title = 'Official School Fees Receipt',
  subtitle = 'Verification-ready payment receipt.',
}) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const role = currentRole();
  const canEmail = Boolean(receipt?.receiptNo) && receipt?.receiptKind !== 'preview' && ['parent', 'owner', 'hos', 'accountant', 'admin'].includes(role);

  async function sendImage() {
    setBusy('image'); setStatus(null);
    try {
      const how = await sendReceiptImage(printId, receipt.receiptNo, buildReceiptShareMessage(receipt));
      if (how === 'copied') setStatus({ text: 'Receipt picture copied. Open the chat, paste it (Ctrl+V), then send.', link: whatsAppUrl(receipt) });
      if (how === 'saved') setStatus({ text: 'Receipt picture saved. Open the chat and attach it.', link: whatsAppUrl(receipt) });
    } catch (error) { setStatus({ text: error.message }); } finally { setBusy(''); }
  }
  async function downloadImage() {
    setBusy('save'); setStatus(null);
    try { saveFile(await receiptImage(printId, receipt.receiptNo)); } catch (error) { setStatus({ text: error.message }); } finally { setBusy(''); }
  }
  async function sendEmail() {
    setBusy('email'); setStatus(null);
    try {
      const text = await emailReceipt(receipt.receiptNo, role === 'parent');
      if (text) setStatus({ text });
    } catch (error) { setStatus({ text: error.message }); } finally { setBusy(''); }
  }

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

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[#c9a96e]/35 bg-[#fff4df]/95 px-4 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:px-5 dark:border-[#bf00ff]/25 dark:bg-[#2a001f]/95">
            {status ? (
              <p role="status" className="w-full text-sm font-semibold text-[#191970]">
                {status.text}{status.link ? <> <a href={status.link} target="_blank" rel="noreferrer noopener" className="font-black underline">Open WhatsApp</a></> : null}
              </p>
            ) : null}
            <button type="button" disabled={Boolean(busy)} onClick={sendImage} className={`${WHATSAPP_BTN} disabled:opacity-60`}>{busy === 'image' ? 'Preparing…' : 'WhatsApp picture'}</button>
            <button type="button" onClick={() => shareReceiptOnWhatsApp(receipt)} className={WHATSAPP_BTN}>WhatsApp text</button>
            {canEmail ? <button type="button" disabled={Boolean(busy)} onClick={sendEmail} className={`${ACTION_BTN} disabled:opacity-60`}>{busy === 'email' ? 'Sending…' : role === 'parent' ? 'Email it to me' : 'Email to parent'}</button> : null}
            <button type="button" disabled={Boolean(busy)} onClick={downloadImage} className={`${ACTION_BTN} disabled:opacity-60`}>{busy === 'save' ? 'Saving…' : 'Save picture'}</button>
            <button type="button" onClick={() => window.print()} className={ACTION_BTN}>Print Receipt</button>
            <button type="button" onClick={onClose} className={CLOSE_BTN}>Close Receipt</button>
          </div>
        </div>
      </div>
    </div>
  );
}
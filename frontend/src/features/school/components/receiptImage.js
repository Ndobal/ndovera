// The receipt as a picture for WhatsApp. A WhatsApp link can carry words but never a file, in the app or on
// the web. So: a phone hands the picture to WhatsApp through the share sheet; a computer puts it on the
// clipboard to paste into WhatsApp Web; failing that, it is saved to attach by hand.

export async function receiptImage(elementId, receiptNo = 'receipt') {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('The receipt could not be found on this page.');
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  const blob = await new Promise(resolve => { canvas.toBlob(resolve, 'image/png'); });
  if (!blob) throw new Error('The receipt picture could not be made.');
  return new File([blob], `${String(receiptNo).replace(/[^a-zA-Z0-9-]/g, '_')}.png`, { type: 'image/png' });
}

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

export function saveFile(file) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

/**
 * Sends the picture the best way this device allows. Resolves to how:
 * 'shared' (share sheet), 'cancelled', 'copied' (paste it), or 'saved' (attach it).
 */
export async function sendReceiptImage(elementId, receiptNo, text) {
  const file = await receiptImage(elementId, receiptNo);
  if (isPhone() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  if (navigator.clipboard?.write && typeof window.ClipboardItem === 'function') {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ [file.type]: file })]);
      return 'copied';
    } catch { /* not allowed here: save it instead */ }
  }
  saveFile(file);
  return 'saved';
}

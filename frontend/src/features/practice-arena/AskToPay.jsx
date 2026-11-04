import React, { useState } from 'react';
import { createPayLink } from './practiceApi';

// Makes a payment link for this pass, to send to someone who will pay for it.

export default function AskToPay({ payload, disabled = false, className = '' }) {
  const [link, setLink] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await createPayLink(payload);
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent || '')) {
        await navigator.share({ text: result.message }).catch(() => null);
      }
      setLink(result);
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };

  return (
    <div className={className}>
      <button type="button" disabled={disabled || busy} onClick={make} className="w-full rounded-2xl border-2 border-slate-400 bg-white py-2 text-sm font-black text-slate-900 disabled:opacity-50 dark:border-white/30 dark:bg-slate-800 dark:text-white">{busy ? 'Making link…' : 'Ask someone to pay'}</button>
      {message ? <p role="alert" className="mt-1 text-xs font-bold text-rose-800 dark:text-rose-300">{message}</p> : null}
      {link ? (
        <div className="mt-2 space-y-1">
          <input readOnly aria-label="Payment link" value={link.url} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white" />
          <a href={`https://wa.me/?text=${encodeURIComponent(link.message)}`} target="_blank" rel="noreferrer noopener" className="inline-block rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-black text-[#06301a]">Send on WhatsApp</a>
        </div>
      ) : null}
    </div>
  );
}

import React, { useState } from 'react';

// "Pay by bank transfer" beside any Ndovera payment button. `start` opens the same checkout by bank and gives its page.

export default function BankTransferPay({ start, disabled = false, className = '' }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true); setMessage('');
    try {
      const url = await start();
      if (url) window.location.assign(url);
    } catch (err) { setMessage(err.message); setBusy(false); }
  };
  return (
    <div className={className}>
      <button type="button" disabled={disabled || busy} onClick={open} className="w-full text-sm font-bold text-slate-900 underline disabled:opacity-50 dark:text-white">{busy ? 'Opening…' : 'Pay by bank transfer instead'}</button>
      {message ? <p role="alert" className="mt-1 text-xs font-bold text-rose-800 dark:text-rose-300">{message}</p> : null}
    </div>
  );
}

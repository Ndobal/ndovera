import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Ndovera's own confirm and alert dialogs, centred on the screen, in place of the browser's
// window.confirm / window.alert / window.prompt boxes (which sit at the top and cannot be styled).
//
//   if (!(await askConfirm('Delete this question?'))) return;
//   await showAlert('Saved.');
//   const reason = await askText('Why?', 'default');   // the text, or null if cancelled
//
// <AppDialogHost /> is mounted once in the app. Where it is not mounted (some tests, a page
// rendered on its own), the browser's own box is used, so nothing ever hangs.

let host = null;
const queue = [];

function open(entry) {
  return new Promise(resolve => {
    if (!host) {
      if (entry.kind === 'alert') { window.alert(entry.message); resolve(true); return; }
      resolve(entry.kind === 'prompt' ? window.prompt(entry.message, entry.defaultValue) : window.confirm(entry.message));
      return;
    }
    queue.push({ ...entry, resolve });
    host();
  });
}

/** Ask the user to confirm. Resolves true for OK, false for Cancel / Escape. */
export function askConfirm(message, options = {}) {
  return open({ kind: 'confirm', message: String(message ?? ''), ...options });
}

/** Ask for a short text. Resolves with the text (possibly empty), or null if cancelled. */
export function askText(message, defaultValue = '', options = {}) {
  return open({ kind: 'prompt', message: String(message ?? ''), defaultValue: defaultValue == null ? '' : String(defaultValue), ...options });
}

/** Tell the user something; resolves when they press OK. */
export function showAlert(message, options = {}) {
  return open({ kind: 'alert', message: String(message ?? ''), ...options });
}

const DANGER = /\b(delete|remove|discard|throw away|lock|deactivate|clear|reset|write off|cancel this)\b/i;

export function AppDialogHost() {
  const [, setVersion] = useState(0);
  const [text, setText] = useState('');
  const okRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    host = () => setVersion(value => value + 1);
    if (queue.length) host();
    return () => { host = null; };
  }, []);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    if (current.kind === 'prompt') {
      setText(current.defaultValue || '');
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    } else okRef.current?.focus();
  }, [current]);

  if (!current) return null;
  const close = value => {
    queue.shift();
    current.resolve(value);
    setVersion(version => version + 1);
  };
  const isAlert = current.kind === 'alert';
  const isPrompt = current.kind === 'prompt';
  const cancelValue = isAlert ? true : isPrompt ? null : false;
  const danger = !isAlert && !isPrompt && (current.danger ?? DANGER.test(current.message));
  const title = current.title || (isAlert ? 'Notice' : isPrompt ? 'Please enter' : 'Please confirm');
  const confirm = () => close(isPrompt ? text : true);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#191970]/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) close(cancelValue); }}
      onKeyDown={event => { if (event.key === 'Escape') close(cancelValue); }}
    >
      <div role={isAlert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
        className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-white text-[#191970] shadow-[0_24px_60px_rgba(25,25,112,0.35)] dark:bg-slate-900 dark:text-slate-100">
        <div className={`h-1.5 ${danger ? 'bg-[#800020]' : 'bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]'}`} />
        <div className="p-5">
          <h2 id="app-dialog-title" className="text-lg font-black text-[#800000] dark:text-amber-200">{title}</h2>
          <p id="app-dialog-message" className="mt-2 whitespace-pre-line text-sm leading-6">{current.message}</p>
          {isPrompt ? (
            <input ref={inputRef} value={text} onChange={event => setText(event.target.value)} aria-label={current.message}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } }}
              className="mt-3 w-full rounded-xl border border-[#c9a96e]/60 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38]/40 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {!isAlert ? (
              <button type="button" onClick={() => close(cancelValue)} className="rounded-2xl border border-[#c9a96e]/60 bg-white px-5 py-2.5 text-sm font-bold text-[#191970] hover:bg-[#fff8ef] dark:bg-slate-800 dark:text-slate-100">
                {current.cancelLabel || 'Cancel'}
              </button>
            ) : null}
            <button ref={okRef} type="button" onClick={confirm}
              className={`rounded-2xl px-5 py-2.5 text-sm font-black ${danger ? 'bg-[#800020] text-[#b5e3f4] hover:bg-[#670019]' : 'bg-[#1a5c38] text-white hover:bg-[#154a2e]'}`}>
              {current.okLabel || (isAlert || isPrompt ? 'OK' : danger ? 'Yes, continue' : 'Continue')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiBase } from '../../../config/apiBase';
import { askConfirm, askText } from '../../../shared/components/AppDialog';

// Ami: reset every student's practice XP (and so their level) after the practice bank is
// rebalanced. Everyone's XP is backed up first; the last reset can be undone from here.

async function call(path, method = 'GET', body) {
  const token = getStoredAuth()?.token || localStorage.getItem('token');
  const response = await fetch(`${getApiBase()}${path}`, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

const when = value => new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function XpResetCard() {
  const [resets, setResets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(() => call('/api/ami/practice/xp-resets').then(data => setResets(data.resets || [])).catch(() => setResets([])), []);
  useEffect(() => { load(); }, [load]);

  const reset = async () => {
    const typed = await askText('This sets every student\'s practice XP and level back to zero, in every school. Streaks, badges and quiz history are kept, and XP is backed up so this can be undone. Type RESET XP to continue.', '');
    if (String(typed || '').trim() !== 'RESET XP') { if (typed) setMessage({ tone: 'error', text: 'Not reset: type RESET XP exactly.' }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const result = await call('/api/ami/practice/reset-xp', 'POST', { confirm: 'RESET XP' });
      setMessage({ tone: 'ok', text: `XP reset for ${result.students} student${result.students === 1 ? '' : 's'}.` });
      await load();
    } catch (err) { setMessage({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  };

  const undo = async item => {
    if (!await askConfirm(`Undo the XP reset of ${when(item.resetAt)}? Each of the ${item.students} students gets back the XP they had, plus anything earned since.`)) return;
    setBusy(true);
    try {
      await call(`/api/ami/practice/xp-resets/${encodeURIComponent(item.id)}/restore`, 'POST');
      setMessage({ tone: 'ok', text: 'Reset undone.' });
      await load();
    } catch (err) { setMessage({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  };

  const last = resets.find(item => !item.restoredAt && !item.tenantId);
  return (
    <section className="space-y-2 rounded-[2rem] border border-[#c9a96e]/40 bg-white p-5 text-[#191970] dark:border-white/15 dark:bg-slate-900 dark:text-slate-200" aria-label="Reset practice XP">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:text-[#c9a96e]">Practice XP</p>
      <p className="font-bold text-[#191970] dark:text-white">Reset every student's XP</p>
      <p className="text-sm">Use after rebalancing subjects and questions, so everyone starts level. XP is backed up first.</p>
      {last ? <p className="text-sm">Last reset: {when(last.resetAt)} by {last.resetBy} ({last.students} students).</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={reset} className="rounded-2xl bg-[#800020] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Working…' : 'Reset all XP'}</button>
        {last ? <button type="button" disabled={busy} onClick={() => undo(last)} className="rounded-2xl border border-[#c9a96e]/60 px-4 py-2 text-sm font-bold text-[#191970] disabled:opacity-50 dark:text-slate-100">Undo last reset</button> : null}
      </div>
      {message ? <p role="status" className={`text-sm font-semibold ${message.tone === 'ok' ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-rose-800 dark:text-rose-200'}`}>{message.text}</p> : null}
    </section>
  );
}

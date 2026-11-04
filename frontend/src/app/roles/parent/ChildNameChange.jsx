import React, { useState } from 'react';
import { changeChildName, getChildNameChange } from '../../../features/school/services/schoolApi';

// A parent may correct their child's name once. The child's sign-in email does not change.

const BOX = 'mt-3 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const LINK = 'mt-3 text-xs font-bold text-slate-800 underline dark:text-white';

export default function ChildNameChange({ student, onChanged }) {
  // Asked only when the parent opens this, so the page costs no extra reads.
  const [state, setState] = useState('closed');
  const [name, setName] = useState(student.name || '');
  const [message, setMessage] = useState('');

  const open = async () => {
    setState('checking');
    setMessage('');
    try {
      const result = await getChildNameChange(student.id);
      setState(result.change ? 'used' : 'open');
    } catch (error) {
      setMessage(error.message);
      setState('closed');
    }
  };
  const save = async event => {
    event.preventDefault();
    const typed = name.trim();
    if (!typed || typed === String(student.name || '').trim()) { setState('closed'); return; }
    setState('saving');
    setMessage('');
    try {
      await changeChildName(student.id, typed);
      onChanged(typed);
      setState('used');
      setMessage('Saved. The name now shows everywhere, and the sign-in email stays the same.');
    } catch (error) {
      setMessage(error.message);
      setState('open');
    }
  };

  if (state === 'closed' || state === 'checking') {
    return (
      <div>
        <button type="button" disabled={state === 'checking'} onClick={open} className={LINK}>Correct this name</button>
        {message ? <p role="status" className="mt-1 text-xs font-semibold text-slate-800 dark:text-white">{message}</p> : null}
      </div>
    );
  }
  if (state === 'used') {
    return <p role="status" className={BOX}>{message || 'This name has already been changed from a parent account, and that can be done only once. Please ask the school if it needs to change again.'}</p>;
  }
  return (
    <form onSubmit={save} className={BOX}>
      <label className="block text-xs font-bold">Correct name
        <input className={FIELD} value={name} maxLength={160} onChange={event => setName(event.target.value)} />
      </label>
      <p className="mt-2 text-xs font-semibold">You can do this only once for each child, so check the spelling. The sign-in email stays the same unless the school changes it.</p>
      {message ? <p role="status" className="mt-2 text-xs font-bold">{message}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={state === 'saving'} className={PRIMARY}>Save the name</button>
        <button type="button" onClick={() => setState('closed')} className={SECONDARY}>Cancel</button>
      </div>
    </form>
  );
}

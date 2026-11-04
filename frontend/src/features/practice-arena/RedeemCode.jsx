import React, { useState } from 'react';
import { redeemPassCode } from './practiceApi';

// Type a one-time code for a free pass. If the pass needs a choice (a subject, or JAMB's three),
// the worker says so without using the code, and the choice appears here.

const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';

export default function RedeemCode({ subjects = [], studentId = '', onDone }) {
  const [code, setCode] = useState('');
  const [needs, setNeeds] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [jamb, setJamb] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await redeemPassCode({ code, ...(studentId ? { studentId } : {}), ...(needs === 'subject' ? { subjectKey } : {}), ...(needs === 'jamb' ? { jambSubjects: jamb } : {}) });
      setCode('');
      setNeeds('');
      setMessage(result.message);
      if (onDone) await onDone();
    } catch (error) {
      if (error.data?.needs) setNeeds(error.data.needs);
      setMessage(error.message);
    } finally { setBusy(false); }
  };
  const ready = code.trim() && (needs !== 'subject' || subjectKey) && (needs !== 'jamb' || jamb.length === 3);

  return (
    <form onSubmit={send} className="space-y-2" aria-label="Use a pass code">
      <label className="block text-sm font-bold text-slate-900 dark:text-white">Have a code for a free pass?
        <input className={`${FIELD} mt-1 uppercase`} value={code} autoComplete="off" onChange={event => setCode(event.target.value)} placeholder="Type your code" />
      </label>
      {needs === 'subject' ? (
        <select aria-label="Subject for this pass" className={FIELD} value={subjectKey} onChange={event => setSubjectKey(event.target.value)}>
          <option value="">Choose the subject…</option>
          {subjects.map(subject => <option key={subject.key} value={subject.key}>{subject.name}</option>)}
        </select>
      ) : null}
      {needs === 'jamb' ? (
        <fieldset><legend className="text-xs font-bold text-slate-700 dark:text-slate-200">Your 3 JAMB subjects (Use of English is included)</legend>
          {subjects.filter(subject => subject.key !== 'english').map(subject => (
            <label key={subject.key} className="mr-3 inline-flex items-center gap-1 text-sm text-slate-800 dark:text-slate-100">
              <input type="checkbox" checked={jamb.includes(subject.key)} onChange={() => setJamb(current => (current.includes(subject.key) ? current.filter(key => key !== subject.key) : current.length < 3 ? [...current, subject.key] : current))} />{subject.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button type="submit" disabled={busy || !ready} className="rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? 'Checking…' : 'Use code'}</button>
      {message ? <p role="status" className="text-sm font-semibold text-slate-800 dark:text-slate-100">{message}</p> : null}
    </form>
  );
}

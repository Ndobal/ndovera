import React, { useState } from 'react';
import { saveBuilderFocus, saveBuilderSettings } from '../../../features/showcase/showcaseApi';

// Pause the night job, or point it at one exam or class level. A focus changes what is written first, not how much:
// the same nightly limit applies.

const BOX = 'mt-3 space-y-3 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white';
const TEXT = 'text-sm text-slate-800 dark:text-slate-100';
const LABEL = 'block text-xs font-bold text-slate-800 dark:text-slate-100';
const FIELD = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white disabled:opacity-60';
const STOP = 'rounded-xl bg-rose-800 px-3 py-2 text-sm font-black text-white disabled:opacity-60';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-black text-slate-800 disabled:opacity-60 dark:border-white/30 dark:bg-slate-800 dark:text-white';

export default function AmiBuilderControls({ settings, focusProgress, examChoices = [], levelChoices = [], onChanged }) {
  const [target, setTarget] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const run = (action, done) => {
    setBusy(true);
    setNotice('');
    action().then(result => { setNotice(done(result)); onChanged(); }).catch(error => setNotice(error.message)).finally(() => setBusy(false));
  };
  const paused = Boolean(settings.paused);
  const focus = settings.focus;
  const setPaused = next => run(() => saveBuilderSettings({ paused: next }), () => (next ? 'The night job is paused.' : 'The night job will run again tonight.'));
  const startFocus = event => {
    event.preventDefault();
    const [kind, value] = target.split(':');
    const body = { subject, ...(kind === 'exam' ? { exam: value } : { rank: Number(value) }) };
    run(() => saveBuilderFocus(body), result => `Focus set: ${result.marked.toLocaleString()} topics move to the front of the queue.`);
  };
  const clearFocus = () => run(() => saveBuilderFocus({ clear: true }), () => 'Focus removed. Everything takes turns again.');
  return (
    <div className={BOX} aria-label="Night job controls" role="group">
      <div className="flex flex-wrap items-center gap-3">
        <p className={`${TEXT} font-black`}>{paused ? 'Paused: nothing is written or checked at night.' : 'Running: the night job works within its nightly limit.'}</p>
        <button type="button" disabled={busy} className={paused ? PRIMARY : STOP} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause the night job'}</button>
      </div>
      {focus ? (
        <div className="space-y-2">
          <p className={`${TEXT} font-black`}>Focused on {focus.label}</p>
          {focusProgress ? <p className={TEXT}>{focusProgress.items.toLocaleString()} topics in the focus are still waiting: {focusProgress.made.toLocaleString()} of {focusProgress.target.toLocaleString()} questions written.</p> : null}
          <p className={TEXT}>When these are finished it looks for more, and goes back to taking turns if there are none.</p>
          <button type="button" disabled={busy} className={SECONDARY} onClick={clearFocus}>Remove the focus</button>
        </div>
      ) : (
        <form onSubmit={startFocus} className="space-y-2" aria-label="Focus the night job">
          <p className={TEXT}>Choose an exam or class to write for first. Everything else waits. New questions are written on Sunday and Wednesday nights, or when you press Run one step now.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={LABEL}>Focus on
              <select className={FIELD} value={target} onChange={event => setTarget(event.target.value)}>
                <option value="">Choose…</option>
                <optgroup label="Exams">{examChoices.map(item => <option key={item.key} value={`exam:${item.key}`}>{item.label}</option>)}</optgroup>
                <optgroup label="Classes">{levelChoices.map(item => <option key={item.rank} value={`rank:${item.rank}`}>{item.label}</option>)}</optgroup>
              </select>
            </label>
            <label className={LABEL}>Only this subject (optional)
              <input className={FIELD} value={subject} onChange={event => setSubject(event.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={busy || !target} className={PRIMARY}>Start the focus</button>
        </form>
      )}
      {notice ? <p role="status" className={`${TEXT} font-semibold`}>{notice}</p> : null}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { getClassLevels, saveClassLevels } from '../services/schoolApi';

const SELECT = 'w-full rounded-2xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38]/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100';
const SECTION_NAMES = { nursery: 'Nursery / Early Years', primary: 'Primary', junior: 'Junior Secondary', senior: 'Senior Secondary' };

/**
 * Which standard level each class is. Schools name classes their own way ("GRADE 1" can be
 * Primary 2, "RECEPTION" Nursery 1); Ndovera uses the level for the curriculum, AI materials
 * and practice questions.
 */
export default function ClassLevelsBoard() {
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = () => getClassLevels()
    .then(result => { setData(result); setChoice(Object.fromEntries((result.classes || []).map(item => [item.id, item.level || '']))); })
    .catch(e => setError(e.message || 'Could not load the classes.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const levels = useMemo(() => data?.levels || [], [data]);
  const labelOf = key => levels.find(level => level.key === key)?.label || 'Not recognised';
  const changed = (data?.classes || []).filter(item => (choice[item.id] || '') !== (item.level || ''));

  async function save() {
    setBusy(true); setNotice(''); setError('');
    try {
      await saveClassLevels(Object.fromEntries(changed.map(item => [item.id, choice[item.id] || ''])));
      setNotice('Class levels saved. Score sheet sections, curriculum, AI materials and practice now use them.');
      await load();
    } catch (e) {
      setError(e.message || 'Could not save the class levels.');
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="text-sm text-slate-600 dark:text-slate-300">Loading classes…</p>;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-[#800020] dark:text-slate-100">Class levels</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Tell Ndovera which standard level each of your classes is, for example GRADE 1 = Primary 2 or RECEPTION = Nursery 1.
          The curriculum, Ndovera AI materials and practice questions follow the level you choose. A class not set here is read from its name.
        </p>
      </div>
      {error ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-100">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">{notice}</p> : null}
      <div className="divide-y divide-[#c9a96e]/30 overflow-hidden rounded-2xl border border-[#c9a96e]/40 bg-white/70 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/40">
        {(data?.classes || []).map(item => (
          <div key={item.id} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_16rem]">
            <div>
              <p className="font-semibold text-[#191970] dark:text-slate-100">{[item.name, item.arm].filter(Boolean).join(' ')}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{item.chosen ? 'Set by your school' : `Read from the name: ${labelOf(item.guess)}`}</p>
            </div>
            <select aria-label={`Level of ${item.name}`} className={SELECT} value={choice[item.id] || ''} onChange={event => setChoice(current => ({ ...current, [item.id]: event.target.value }))}>
              <option value="">Read from the name</option>
              {Object.entries(SECTION_NAMES).map(([section, name]) => (
                <optgroup key={section} label={name}>
                  {levels.filter(level => level.section === section).map(level => <option key={level.key} value={level.key}>{level.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
        {!(data?.classes || []).length ? <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">No classes yet. Add them under Classes first.</p> : null}
      </div>
      <button type="button" disabled={busy || !changed.length} onClick={save}
        className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">
        {busy ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'Saved'}
      </button>
    </div>
  );
}

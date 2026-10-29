import React, { useCallback, useEffect, useState } from 'react';
import { addExcursion, addExcursionClasses, getExcursions, getFeeGroups, getNewStudentFees, naira, saveFeeGroup, saveNewStudentFees, setFeeGroupMembers } from './simpleFeesApi';
import { askConfirm, askText } from '../../../shared/components/AppDialog';

// Two dashboard cards beside the term's fees:
//   New students — each student who joined this term can pay their own amounts instead of
//   their class's (blank = the class's amount). Saved amounts are applied at once, billed or not.
//   Excursions — one fee for every student in the chosen classes, this term or next.

const SECTION = 'space-y-3 rounded-3xl border-2 border-[#191970]/30 bg-white p-4 text-[#191970] dark:border-white/20 dark:bg-slate-900 dark:text-slate-200';
const KICKER = 'text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-[#c9a96e]';
const TITLE = 'font-black text-[#191970] dark:text-white';
const INPUT = 'w-28 rounded-xl border border-[#c9a96e]/50 bg-white px-2 py-1.5 text-sm text-[#191970] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] hover:bg-[#154a2e] disabled:opacity-50';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-4 py-2 text-sm font-bold text-[#800020] disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100';
const TH = 'p-2 text-left text-xs font-bold uppercase text-[#800020] dark:text-[#c9a96e]';

export function NewStudentsCard({ onChanged }) {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(() => getNewStudentFees().then(result => { setData(result); setEdits({}); }).catch(() => setData(null)), []);
  useEffect(() => { load(); }, [load]);
  if (!data || !data.students?.length) return null;

  const value = (student, column) => {
    const edited = edits[student.studentId]?.[column];
    if (edited !== undefined) return edited;
    return column in (student.ownAmounts || {}) ? String(student.ownAmounts[column]) : '';
  };
  const total = student => data.columns.reduce((sum, column) => {
    const typed = value(student, column);
    return sum + (typed === '' ? Number(student.classAmounts?.[column] || 0) : Number(typed) || 0);
  }, 0);
  const changed = Object.keys(edits);
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const students = changed.map(studentId => {
        const student = data.students.find(item => item.studentId === studentId);
        return { studentId, amounts: Object.fromEntries(data.columns.map(column => [column, value(student, column)])) };
      });
      await saveNewStudentFees({ students });
      setMessage({ tone: 'ok', text: `Saved fees for ${students.length} new student${students.length === 1 ? '' : 's'}.` });
      await load();
      onChanged?.();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };

  return (
    <section className={SECTION} aria-label="New students">
      <div>
        <p className={KICKER}>New students · {data.term.name}</p>
        <p className={TITLE}>{data.students.length} student{data.students.length === 1 ? '' : 's'} joined this term</p>
        <p className="text-sm">Type a new student's own amount for any item; a blank cell keeps their class's amount. This applies to {data.term.name} only.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead><tr className="border-b border-[#c9a96e]/40 dark:border-white/10"><th className={TH}>Student</th><th className={TH}>Class</th>{data.columns.map(column => <th key={column} className={TH}>{column}</th>)}<th className={`${TH} text-right`}>Total</th></tr></thead>
          <tbody>
            {data.students.map(student => (
              <tr key={student.studentId} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                <td className="p-2 font-semibold">{student.name}</td>
                <td className="p-2">{student.className}</td>
                {data.columns.map(column => (
                  <td key={column} className="p-2">
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      disabled={!data.canEdit}
                      aria-label={`${student.name}: ${column}`}
                      placeholder={student.classAmounts?.[column] ? naira(student.classAmounts[column]) : '—'}
                      value={value(student, column)}
                      onChange={event => setEdits(current => ({ ...current, [student.studentId]: { ...(current[student.studentId] || {}), [column]: event.target.value.replace(/[^\d.]/g, '') } }))}
                    />
                  </td>
                ))}
                <td className="p-2 text-right font-bold">{naira(total(student))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p role="status" className={`text-sm font-semibold ${message.tone === 'ok' ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-rose-800 dark:text-rose-200'}`}>{message.text}</p> : null}
      {data.canEdit ? <button type="button" className={PRIMARY} disabled={busy || !changed.length} onClick={save}>{busy ? 'Saving…' : `Save new students' fees${changed.length ? ` (${changed.length})` : ''}`}</button> : null}
    </section>
  );
}

export function ExcursionsCard({ onChanged }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', term: 'current', classIds: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(() => getExcursions().then(setData).catch(() => setData(null)), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const toggleClass = classId => setForm(current => ({ ...current, classIds: current.classIds.includes(classId) ? current.classIds.filter(item => item !== classId) : [...current.classIds, classId] }));
  const submit = async () => {
    const termName = data.terms.find(item => item.key === form.term)?.name || '';
    if (!await askConfirm(`Add "${form.title}" (${naira(form.amount)}) for every student in ${form.classIds.length} class${form.classIds.length === 1 ? '' : 'es'}, in ${termName}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await addExcursion({ title: form.title, amount: Number(form.amount), term: form.term, classIds: form.classIds });
      setMessage({ tone: 'ok', text: `Added for ${result.students} student${result.students === 1 ? '' : 's'} in ${result.termName}.` });
      setForm({ title: '', amount: '', term: form.term, classIds: [] });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  };
  const addClasses = async excursion => {
    const missing = data.classes.filter(klass => !excursion.classIds.includes(klass.id));
    const pick = missing.filter(klass => form.classIds.includes(klass.id));
    if (!pick.length) { setMessage({ tone: 'error', text: 'Tick the classes to add in the form above first.' }); setOpen(true); return; }
    try {
      const result = await addExcursionClasses(excursion.id, pick.map(klass => klass.id));
      setMessage({ tone: 'ok', text: `${excursion.title}: added for ${result.students} more student${result.students === 1 ? '' : 's'}.` });
      await load();
      onChanged?.();
    } catch (err) { setMessage({ tone: 'error', text: err.message }); }
  };
  const ready = form.title.trim() && Number(form.amount) > 0 && form.classIds.length;

  return (
    <section className={SECTION} aria-label="Excursions">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={KICKER}>Excursions</p>
          <p className={TITLE}>One fee for whole classes</p>
          <p className="text-sm">Choose the classes going: every student in them gets the excursion fee, this term (added to their account now) or next term (in next term's fees).</p>
        </div>
        {data.canEdit ? <button type="button" className={open ? SECONDARY : PRIMARY} onClick={() => setOpen(value => !value)}>{open ? 'Close' : '+ New excursion'}</button> : null}
      </div>
      {open ? (
        <div className="space-y-3 rounded-2xl border border-[#c9a96e]/40 p-3 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            <input className={`${INPUT} w-56`} placeholder="Excursion name" aria-label="Excursion name" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />
            <input className={INPUT} placeholder="Fee" inputMode="decimal" aria-label="Excursion fee" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value.replace(/[^\d.]/g, '') }))} />
            <select className={`${INPUT} w-auto`} aria-label="Which term" value={form.term} onChange={event => setForm(current => ({ ...current, term: event.target.value }))}>
              {data.terms.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Classes going">
            {data.classes.map(klass => (
              <label key={klass.id} className="flex items-center gap-1.5 rounded-xl border border-[#c9a96e]/40 px-2.5 py-1 text-sm dark:border-white/15">
                <input type="checkbox" checked={form.classIds.includes(klass.id)} onChange={() => toggleClass(klass.id)} />
                {klass.name}
              </label>
            ))}
          </div>
          <button type="button" className={PRIMARY} disabled={busy || !ready} onClick={submit}>{busy ? 'Adding…' : 'Add excursion fee'}</button>
        </div>
      ) : null}
      {message ? <p role="status" className={`text-sm font-semibold ${message.tone === 'ok' ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-rose-800 dark:text-rose-200'}`}>{message.text}</p> : null}
      {data.excursions.length ? (
        <ul className="divide-y divide-[#c9a96e]/30 dark:divide-white/10">
          {data.excursions.map(excursion => (
            <li key={excursion.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1"><strong className="text-[#191970] dark:text-white">{excursion.title}</strong> · {naira(excursion.amount)} · {excursion.termName} · {excursion.students} student{excursion.students === 1 ? '' : 's'} · {excursion.classes.join(', ')}</span>
              {data.canEdit && open ? <button type="button" className="text-xs font-bold text-[#800020] underline dark:text-[#c9a96e]" onClick={() => addClasses(excursion)}>Add ticked classes</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm">No excursions yet.</p>}
    </section>
  );
}

const SECTION_LABELS = { nursery: 'Nursery', primary: 'Primary', secondary: 'Secondary' };

/**
 * Fee groups (staff children, scholarship…): one rate per section. From next term each member
 * is billed their class fee and the difference is given as a discount, so everyone sees the
 * class fee, the discount and what is due. An individual fee for a student wins over a group.
 */
export function FeeGroupsCard({ onChanged }) {
  const [data, setData] = useState(null);
  const [rates, setRates] = useState({});
  const [names, setNames] = useState({});
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(() => getFeeGroups().then(result => {
    setData(result);
    setRates(Object.fromEntries(result.groups.map(group => [group.id, Object.fromEntries(Object.entries(group.rates || {}).map(([key, value]) => [key, String(value)]))])));
    setNames(Object.fromEntries(result.groups.map(group => [group.id, group.name])));
  }).catch(() => setData(null)), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const run = async (action, text) => {
    setBusy(true); setMessage(null);
    try { await action(); setMessage({ tone: 'ok', text }); await load(); onChanged?.(); } catch (err) { setMessage({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  };
  const saveGroup = group => run(() => saveFeeGroup({ id: group.id, name: names[group.id], rates: rates[group.id] || {} }), `${names[group.id]} saved. The rates apply from ${data.fromTerm}.`);
  const addGroup = async () => {
    const name = await askText('Name of the new group (for example "Teachers’ children"):', '');
    if (name && name.trim()) run(() => saveFeeGroup({ name: name.trim(), rates: {} }), `${name.trim()} added. Set its rates and add students.`);
  };
  const term = search.trim().toLowerCase();
  const found = term.length >= 2 ? data.students.filter(student => `${student.name} ${student.className}`.toLowerCase().includes(term)).slice(0, 12) : [];

  return (
    <section className={SECTION} aria-label="Fee groups">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={KICKER}>Fee groups · from {data.fromTerm}</p>
          <p className={TITLE}>Staff children, scholarship students and other groups</p>
          <p className="text-sm">Each group pays one amount per section. Members are billed their class fee and get the difference as a discount, so they see the class fee, the discount and what is due. A fee typed for one student wins over their group. Club fees and excursions are added on top.</p>
        </div>
        {data.canEdit ? <button type="button" className={SECONDARY} disabled={busy} onClick={addGroup}>+ New group</button> : null}
      </div>
      {message ? <p role="status" className={`text-sm font-semibold ${message.tone === 'ok' ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-rose-800 dark:text-rose-200'}`}>{message.text}</p> : null}
      {data.groups.map(group => {
        const members = data.students.filter(student => student.groupId === group.id);
        return (
          <div key={group.id} className="space-y-2 rounded-2xl border border-[#c9a96e]/40 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-bold text-[#800020] dark:text-[#c9a96e]">Group
                <input className={`${INPUT} mt-1 block w-44`} aria-label="Group name" disabled={!data.canEdit} value={names[group.id] || ''} onChange={event => setNames(current => ({ ...current, [group.id]: event.target.value }))} />
              </label>
              {data.sections.map(section => (
                <label key={section} className="text-xs font-bold text-[#800020] dark:text-[#c9a96e]">{SECTION_LABELS[section]}
                  <input className={`${INPUT} mt-1 block`} inputMode="decimal" placeholder="Class fee" aria-label={`${group.name}: ${SECTION_LABELS[section]} rate`} disabled={!data.canEdit}
                    value={rates[group.id]?.[section] ?? ''} onChange={event => setRates(current => ({ ...current, [group.id]: { ...(current[group.id] || {}), [section]: event.target.value.replace(/[^\d.]/g, '') } }))} />
                </label>
              ))}
              {data.canEdit ? <button type="button" className={PRIMARY} disabled={busy} onClick={() => saveGroup(group)}>Save</button> : null}
              {data.canEdit ? <button type="button" className={SECONDARY} disabled={busy} onClick={() => { setAdding(adding === group.id ? '' : group.id); setSearch(''); }}>{adding === group.id ? 'Done' : 'Add students'}</button> : null}
            </div>
            <p className="text-xs">A blank section pays the normal class fee.</p>
            {adding === group.id ? (
              <div className="space-y-1">
                <input className={`${INPUT} w-64`} placeholder="Type a student's name" aria-label={`Find a student for ${group.name}`} value={search} onChange={event => setSearch(event.target.value)} />
                {found.map(student => (
                  <div key={student.studentId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{student.name} · {student.className}{student.section ? '' : ' (class section not recognised)'}{student.groupId && student.groupId !== group.id ? ` · in ${data.groups.find(item => item.id === student.groupId)?.name || 'another group'}` : ''}</span>
                    {student.groupId === group.id ? <span className="text-xs font-bold text-[#1a5c38] dark:text-emerald-300">In this group</span>
                      : <button type="button" className="text-xs font-bold text-[#800020] underline dark:text-[#c9a96e]" disabled={busy} onClick={() => run(() => setFeeGroupMembers(group.id, [student.studentId]), `${student.name} added to ${group.name}.`)}>Add</button>}
                  </div>
                ))}
              </div>
            ) : null}
            <ul className="flex flex-wrap gap-1.5" aria-label={`${group.name} members`}>
              {members.map(student => (
                <li key={student.studentId} className="flex items-center gap-1 rounded-full border border-[#c9a96e]/50 px-2.5 py-0.5 text-xs">
                  {student.name} <span>· {student.className}</span>
                  {data.canEdit ? <button type="button" aria-label={`Remove ${student.name}`} className="font-black text-[#800020] dark:text-rose-300" disabled={busy} onClick={() => run(() => setFeeGroupMembers('', [student.studentId]), `${student.name} removed from ${group.name}.`)}>×</button> : null}
                </li>
              ))}
              {!members.length ? <li className="text-xs">No students yet.</li> : null}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

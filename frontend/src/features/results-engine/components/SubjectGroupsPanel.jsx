import React, { useEffect, useMemo, useState } from 'react';
import { getSubjectGroups, saveSubjectGroupChoice } from '../../school/services/schoolApi';
import { askConfirm } from '../../../shared/components/AppDialog';

// Combined subjects: a subject taught to students from several classes (Fashion Design and
// Garment Making, Computer Hardware and GSM Repairs…) is scored on one sheet by its teacher,
// and handed in once for all of them. Ndovera groups them by band — Nursery, Primary, JSS 1–3,
// SS 1–3 — so JSS and SS each have their own group and teachers. The school can switch a group
// off, choose its classes, or make its own groups (e.g. "SS 1–2 only").

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900';
const BTN = 'rounded-xl px-3 py-1.5 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#191970] text-white hover:bg-[#12124f]`;
const SECONDARY = `${BTN} border border-slate-300 bg-white text-[#191970] hover:bg-slate-50 dark:border-white/15 dark:bg-slate-800 dark:text-white`;

function NewGroup({ subjects, onSaved, onCancel }) {
  const [subjectKey, setSubjectKey] = useState('');
  const [name, setName] = useState('');
  const [classIds, setClassIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const subject = subjects.find(item => item.subjectKey === subjectKey);
  async function save() {
    setBusy(true); setError('');
    try {
      await saveSubjectGroupChoice({ custom: true, subjectKey, name: name.trim() || subject?.name, classIds });
      onSaved(`${name.trim() || subject?.name} is now one group.`);
    } catch (err) { setError(err.message || 'Could not save.'); } finally { setBusy(false); }
  }
  return (
    <div className={`${CARD} space-y-3 ring-2 ring-[#191970]/20`}>
      <p className="text-sm font-black text-[#0b1f3a] dark:text-white">New combined group</p>
      <label className="block text-xs font-bold uppercase text-slate-500">Subject
        <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white" value={subjectKey} onChange={event => { setSubjectKey(event.target.value); setClassIds([]); }}>
          <option value="">Choose a subject taught in two or more classes…</option>
          {subjects.map(item => <option key={item.subjectKey} value={item.subjectKey}>{item.name}</option>)}
        </select>
      </label>
      {subject ? (
        <>
          <label className="block text-xs font-bold uppercase text-slate-500">Group name
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white" value={name} onChange={event => setName(event.target.value)} placeholder={`${subject.name} (e.g. SS 1–2)`} />
          </label>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Classes in this group</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {subject.classes.map(item => {
                const on = classIds.includes(item.id);
                return <button key={item.id} type="button" aria-pressed={on} onClick={() => setClassIds(on ? classIds.filter(id => id !== item.id) : [...classIds, item.id])} className={`rounded-full border px-3 py-1 text-sm font-bold ${on ? 'border-[#191970] bg-[#191970] text-white' : 'border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{on ? '✓ ' : ''}{item.name}</button>;
              })}
            </div>
          </div>
        </>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={PRIMARY} disabled={busy || !subject || classIds.length < 2} onClick={save}>{busy ? 'Saving…' : 'Create group'}</button>
        <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function SubjectGroupsPanel() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  async function load() {
    const next = await getSubjectGroups();
    setData({ groups: next?.groups || [], subjects: next?.subjects || [], canManage: Boolean(next?.canManage) });
    setDrafts({});
  }
  useEffect(() => { load().catch(err => { setData({ groups: [], subjects: [], canManage: false }); setError(err.message || 'Could not load combined subjects.'); }); }, []);

  async function save(group, enabled, classIds) {
    setBusy(group.id); setError(''); setMessage('');
    try {
      if (group.custom) await saveSubjectGroupChoice({ custom: true, id: group.id, subjectKey: group.subjectKey, name: group.name, classIds, enabled });
      else await saveSubjectGroupChoice({ section: group.section, subjectKey: group.subjectKey, enabled, classIds });
      setMessage(`${group.name} (${group.label}): ${enabled ? 'combined' : 'kept separate in each class'}.`);
      await load();
    } catch (err) { setError(err.message || 'Could not save.'); } finally { setBusy(''); }
  }

  async function remove(group) {
    if (!(await askConfirm(`Delete the group "${group.name}"? Its classes go back to their usual group.`))) return;
    setBusy(group.id);
    try { await saveSubjectGroupChoice({ delete: true, id: group.id }); setMessage(`Deleted ${group.name}.`); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.groups || []).filter(group => !text || `${group.name} ${group.label}`.toLowerCase().includes(text));
  }, [data, query]);
  const chosen = group => drafts[group.id] || group.classIds;
  const toggle = (group, classId) => {
    const current = chosen(group);
    setDrafts(all => ({ ...all, [group.id]: current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId] }));
  };

  return (
    <section className="space-y-4" aria-label="Combined subjects">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-[#0b1f3a] dark:text-white">Combined subjects</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">One score sheet, and one hand-in, for a subject taught to students from several classes. Groups are by band (JSS 1–3, SS 1–3…), each with its own teachers. Scores still go to each student's own class result.</p>
        </div>
        <input type="search" aria-label="Search combined subjects" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} className="w-48 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white" />
        {data?.canManage ? <button type="button" className={PRIMARY} onClick={() => setCreating(true)}>+ New group</button> : null}
      </div>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {creating ? <NewGroup subjects={data?.subjects || []} onCancel={() => setCreating(false)} onSaved={async text => { setCreating(false); setMessage(text); await load(); }} /> : null}
      {!data ? <p role="status" className="text-sm text-slate-500">Loading…</p> : !groups.length ? (
        <p className={`${CARD} text-sm text-slate-600`}>{query ? 'Nothing matches.' : 'No subject is taught in two or more classes of the same band yet.'}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map(group => {
            const selected = chosen(group);
            const changed = Boolean(drafts[group.id]);
            return (
              <article key={group.id} className={`${CARD} space-y-3`}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[#0b1f3a] dark:text-white">{group.name}</p>
                    <p className="text-xs text-slate-500">{group.custom ? 'Your group' : group.label}{group.special ? ' · trade subject' : ''}{group.teachers?.length ? ` · ${group.teachers.join(', ')}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${group.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{group.enabled ? '✓ Combined' : 'Separate'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.classes.map(item => {
                    const on = selected.includes(item.id);
                    return (
                      <button key={item.id} type="button" disabled={!data.canManage} aria-pressed={on} onClick={() => toggle(group, item.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${on ? 'border-[#191970] bg-[#191970]/10 text-[#191970] dark:text-indigo-200' : 'border-slate-200 text-slate-500'}`}>{on ? '✓ ' : ''}{item.name}</button>
                    );
                  })}
                </div>
                {data.canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {group.enabled ? (
                      <>
                        {changed ? <button type="button" className={PRIMARY} disabled={Boolean(busy) || selected.length < 2} onClick={() => save(group, true, selected)}>Save classes</button> : null}
                        <button type="button" className={SECONDARY} disabled={Boolean(busy)} onClick={() => save(group, false, group.classIds)}>Do not combine</button>
                      </>
                    ) : (
                      <button type="button" className={PRIMARY} disabled={Boolean(busy) || selected.length < 2} onClick={() => save(group, true, selected)}>Combine these classes</button>
                    )}
                    {group.custom ? <button type="button" className={`${BTN} text-rose-700`} disabled={Boolean(busy)} onClick={() => remove(group)}>Delete group</button> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

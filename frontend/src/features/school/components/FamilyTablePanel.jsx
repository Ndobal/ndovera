import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getFamilies, saveFamilies } from '../services/schoolApi';

// Every student with their parents beside them. Type a parent's name, phone number and email
// (email is optional: a parent without one signs in with their phone number), add new
// students at the top, then save. Only rows that were changed are sent.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/30';
const INPUT = 'w-full min-w-[7rem] rounded-xl border border-[#c9a96e]/40 bg-white px-2.5 py-1.5 text-sm text-[#191970] outline-none focus:border-[#800020] dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100';
const TH = 'px-2 py-2 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-300';
const PAGE = 50;
const EMPTY_PARENT = { id: '', name: '', phone: '', email: '', hasEmail: false };

// 2348031234567 → 0803 123 4567, the way schools write numbers.
function showPhone(phone) {
  const digits = String(phone || '');
  if (/^234\d{10}$/.test(digits)) return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return digits;
}

function toRow(student) {
  const parents = [0, 1].map(index => {
    const parent = (student.parents || [])[index];
    return parent
      ? { id: parent.id, name: parent.name || '', phone: showPhone(parent.phone), email: parent.email || '', hasEmail: Boolean(parent.email), off: parent.off }
      : { ...EMPTY_PARENT };
  });
  return { key: student.id, studentId: student.id, name: student.name, displayId: student.displayId, className: student.className, classId: student.classId, parents, original: JSON.stringify(parents) };
}

let newKey = 0;

export default function FamilyTablePanel() {
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [newRows, setNewRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFamilies();
      setRows((data?.students || []).map(toRow));
      setClasses(data?.classes || []);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the family table.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [search, classFilter, onlyMissing]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => {
      if (classFilter && row.classId !== classFilter) return false;
      if (onlyMissing && row.parents.some(parent => parent.id)) return false;
      if (!term) return true;
      const haystack = [row.name, row.displayId, row.className, ...row.parents.flatMap(parent => [parent.name, parent.phone, parent.email])].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, classFilter, onlyMissing]);

  const pageRows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const changed = rows.filter(row => JSON.stringify(row.parents) !== row.original);
  const pendingNew = newRows.filter(row => row.name.trim() || row.parents.some(parent => parent.name || parent.phone || parent.email));
  const unsaved = changed.length + pendingNew.length;

  function editParent(key, index, field, value, isNew = false) {
    const update = list => list.map(row => (row.key !== key ? row : {
      ...row,
      parents: row.parents.map((parent, at) => (at === index ? { ...parent, [field]: value } : parent)),
    }));
    if (isNew) setNewRows(update); else setRows(update);
  }

  function addStudent() {
    newKey += 1;
    setNewRows(current => [{ key: `new-${newKey}`, name: '', classId: classFilter || '', parents: [{ ...EMPTY_PARENT }, { ...EMPTY_PARENT }] }, ...current]);
  }

  async function save() {
    const payload = [
      ...pendingNew.map(row => ({ key: row.key, student: { name: row.name.trim(), classId: row.classId }, parents: row.parents })),
      ...changed.map(row => ({ key: row.key, studentId: row.studentId, parents: row.parents })),
    ].map(row => ({ ...row, parents: row.parents.map(({ id, name, phone, email }) => ({ id, name: name.trim(), phone: phone.trim(), email: email.trim() })) }));
    if (!payload.length) return;
    setSaving(true);
    setError('');
    setNotice('');
    const errors = {};
    let saved = 0;
    try {
      for (let start = 0; start < payload.length; start += 100) {
        const result = await saveFamilies({ rows: payload.slice(start, start + 100) });
        for (const item of result?.results || []) {
          if (item.ok) saved += 1; else errors[item.key] = item.error;
        }
      }
    } catch (saveError) {
      setError(saveError?.message || 'Could not save. Nothing after the first problem was sent.');
    }
    setRowErrors(errors);
    // Keep only the new students that did not save, so their details are not lost.
    setNewRows(current => current.filter(row => errors[row.key]));
    await load();
    // Edits that failed are put back on top of the fresh data so they can be corrected.
    setRows(current => current.map(row => {
      const failed = changed.find(item => item.key === row.key && errors[row.key]);
      return failed ? { ...row, parents: failed.parents } : row;
    }));
    setSaving(false);
    const failedCount = Object.keys(errors).length;
    setNotice(`Saved ${saved} row${saved === 1 ? '' : 's'}.${failedCount ? ` ${failedCount} need${failedCount === 1 ? 's' : ''} fixing — see the red notes.` : ''}`);
  }

  function parentCells(row, isNew) {
    return row.parents.map((parent, index) => (
      <td key={index} className="px-2 py-2 align-top">
        <div className="grid gap-1.5">
          <input className={INPUT} value={parent.name} placeholder={`Parent ${index + 1} name`} aria-label={`${row.name || 'New student'}: parent ${index + 1} name`} onChange={event => editParent(row.key, index, 'name', event.target.value, isNew)} />
          <input className={INPUT} value={parent.phone} inputMode="tel" placeholder="Phone (0803 123 4567)" aria-label={`${row.name || 'New student'}: parent ${index + 1} phone`} onChange={event => editParent(row.key, index, 'phone', event.target.value, isNew)} />
          {parent.hasEmail ? (
            <p className="truncate px-1 text-xs text-[#4a5578] dark:text-slate-300" title={parent.email}>{parent.email}</p>
          ) : (
            <input className={INPUT} value={parent.email} type="email" placeholder="Email (optional)" aria-label={`${row.name || 'New student'}: parent ${index + 1} email`} onChange={event => editParent(row.key, index, 'email', event.target.value, isNew)} />
          )}
          {parent.off ? <p className="px-1 text-xs font-semibold text-[#800020] dark:text-amber-300">Turned off</p> : null}
        </div>
      </td>
    ));
  }

  function errorRow(key) {
    return rowErrors[key] ? (
      <tr><td colSpan={6} className="px-2 pb-2 text-sm font-semibold text-rose-800 dark:text-rose-200">{rowErrors[key]}</td></tr>
    ) : null;
  }

  if (loading && !rows.length) return <div className={CARD}><p className="text-[#800020] dark:text-slate-300">Loading the family table...</p></div>;

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#800000] dark:text-slate-100">Family table</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#191970] dark:text-slate-300">
              Type each parent's name and phone number beside their child, then save. Email is optional: a parent without one signs in with their phone number and the password <strong>abcABC@123</strong>, and is asked to change it.
              A parent already at the school (a brother's or sister's parent) is found by their phone or email, not added twice.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addStudent} className="rounded-2xl border border-[#1a5c38]/60 px-4 py-2 text-sm font-semibold text-[#1a5c38] dark:border-emerald-300/50 dark:text-emerald-200">+ New student</button>
            <button type="button" onClick={save} disabled={saving || unsaved === 0} className="rounded-2xl bg-[#800020] px-5 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">
              {saving ? 'Saving...' : `Save changes${unsaved ? ` (${unsaved})` : ''}`}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, phones, emails" className={`${INPUT} max-w-xs`} aria-label="Search the family table" />
          <select value={classFilter} onChange={event => setClassFilter(event.target.value)} className={`${INPUT} max-w-[12rem]`} aria-label="Class">
            <option value="">All classes</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#191970] dark:text-slate-300">
            <input type="checkbox" checked={onlyMissing} onChange={event => setOnlyMissing(event.target.checked)} />
            Only students with no parent
          </label>
          <span className="ml-auto text-sm text-[#191970] dark:text-slate-300">{shown.length} student{shown.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error}</div> : null}

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full min-w-[56rem] border-collapse">
          <thead>
            <tr className="border-b border-[#c9a96e]/40 dark:border-white/10">
              <th className={`${TH} w-10`}>S/N</th>
              <th className={TH}>Student</th>
              <th className={TH}>Class</th>
              <th className={TH}>Parent 1</th>
              <th className={TH}>Parent 2</th>
              <th className={`${TH} w-16`}><span className="sr-only">Status</span></th>
            </tr>
          </thead>
          <tbody>
            {newRows.map(row => (
              <React.Fragment key={row.key}>
                <tr className="border-b border-[#c9a96e]/20 bg-[#efd4a0]/40 dark:border-white/5 dark:bg-slate-800/50">
                  <td className="px-2 py-2 align-top text-xs font-bold text-[#1a5c38] dark:text-emerald-300">New</td>
                  <td className="px-2 py-2 align-top">
                    <input className={INPUT} value={row.name} placeholder="Student's full name" aria-label="New student name" onChange={event => setNewRows(current => current.map(item => (item.key === row.key ? { ...item, name: event.target.value } : item)))} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select className={INPUT} value={row.classId} aria-label="New student class" onChange={event => setNewRows(current => current.map(item => (item.key === row.key ? { ...item, classId: event.target.value } : item)))}>
                      <option value="">Choose class</option>
                      {classes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </td>
                  {parentCells(row, true)}
                  <td className="px-2 py-2 align-top">
                    <button type="button" onClick={() => setNewRows(current => current.filter(item => item.key !== row.key))} className="text-xs font-bold text-[#800020] dark:text-rose-300">Remove</button>
                  </td>
                </tr>
                {errorRow(row.key)}
              </React.Fragment>
            ))}
            {pageRows.map((row, index) => {
              const edited = JSON.stringify(row.parents) !== row.original;
              return (
                <React.Fragment key={row.key}>
                  <tr className="border-b border-[#c9a96e]/20 dark:border-white/5">
                    <td className="px-2 py-2 align-top text-sm text-[#191970] dark:text-slate-300">{page * PAGE + index + 1}</td>
                    <td className="px-2 py-2 align-top">
                      <p className="font-semibold text-[#191970] dark:text-slate-100">{row.name}</p>
                      {row.displayId ? <p className="text-xs text-[#4a5578] dark:text-slate-300">{row.displayId}</p> : null}
                    </td>
                    <td className="px-2 py-2 align-top text-sm text-[#191970] dark:text-slate-200">{row.className || '—'}</td>
                    {parentCells(row, false)}
                    <td className="px-2 py-2 align-top text-xs font-bold">
                      {edited ? <span className="text-[#800020] dark:text-amber-300">Unsaved</span> : null}
                    </td>
                  </tr>
                  {errorRow(row.key)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {!pageRows.length && !newRows.length ? <p className="mt-3 text-sm text-[#800020] dark:text-slate-300">No students match.</p> : null}
        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)} className="rounded-2xl border border-[#c9a96e]/50 px-4 py-1.5 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/20 dark:text-slate-100">Previous</button>
            <span className="text-sm text-[#191970] dark:text-slate-300">Page {page + 1} of {pages}</span>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(value => value + 1)} className="rounded-2xl border border-[#c9a96e]/50 px-4 py-1.5 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/20 dark:text-slate-100">Next</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getClasses, getSubjects, getPeople, getTimetable, saveTimetable } from '../services/schoolApi';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors disabled:opacity-60';
const OUTLINE = 'rounded-2xl border border-[#800020]/30 bg-white/70 px-4 py-2 text-sm font-semibold text-[#800020] hover:bg-white';
const CELL_SELECT = 'w-full rounded-lg border border-[#c9a96e]/40 bg-white/85 px-1.5 py-1 text-xs text-[#191970] outline-none focus:border-[#800020]';
const TIME_INPUT = 'rounded-lg border border-[#c9a96e]/40 bg-white/85 px-1.5 py-1 text-xs text-[#191970] w-[88px]';

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
];

const TEACHING_EXCLUDED_ROLES = new Set(['student', 'parent', 'ami', 'owner']);

let uidCounter = 0;
const nextUid = () => `p_${Date.now()}_${(uidCounter += 1)}`;

function defaultPeriods() {
  return [
    { uid: nextUid(), startTime: '08:00', endTime: '08:45', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '08:45', endTime: '09:30', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '09:30', endTime: '10:15', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '10:15', endTime: '10:30', isBreak: true, label: 'Short Break' },
    { uid: nextUid(), startTime: '10:30', endTime: '11:15', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '11:15', endTime: '12:00', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '12:00', endTime: '12:45', isBreak: true, label: 'Lunch' },
    { uid: nextUid(), startTime: '12:45', endTime: '13:30', isBreak: false, label: '' },
    { uid: nextUid(), startTime: '13:30', endTime: '14:15', isBreak: false, label: '' },
  ];
}

export default function TimetableBoard() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classId, setClassId] = useState('');
  const [periods, setPeriods] = useState(defaultPeriods);
  const [cells, setCells] = useState({});
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    Promise.all([getClasses(), getSubjects(), getPeople()])
      .then(([c, s, p]) => {
        const classList = c?.classes || [];
        setClasses(classList);
        setSubjects(s?.subjects || []);
        setTeachers((p?.people || []).filter(u => !TEACHING_EXCLUDED_ROLES.has(String(u.role || '').toLowerCase())));
        if (classList.length && !classId) setClassId(classList[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGrid = useCallback((targetClassId) => {
    if (!targetClassId) return;
    setLoadingGrid(true);
    getTimetable({ classId: targetClassId })
      .then(data => {
        setCanManage(data?.canManage !== false);
        const ents = data?.entries || [];
        if (!ents.length) { setPeriods(defaultPeriods()); setCells({}); return; }
        const byPeriod = new Map();
        ents.forEach(e => { if (!byPeriod.has(e.periodIndex)) byPeriod.set(e.periodIndex, { startTime: e.startTime, endTime: e.endTime, isBreak: e.isBreak, label: e.label }); });
        const sortedIdx = Array.from(byPeriod.keys()).sort((a, b) => a - b);
        const idxToUid = {};
        const newPeriods = sortedIdx.map(idx => { const uid = nextUid(); idxToUid[idx] = uid; const base = byPeriod.get(idx); return { uid, startTime: base.startTime || '', endTime: base.endTime || '', isBreak: Boolean(base.isBreak), label: base.label || '' }; });
        const newCells = {};
        ents.forEach(e => { if (e.isBreak) return; const uid = idxToUid[e.periodIndex]; if (uid && e.subjectName) newCells[`${uid}_${e.dayOfWeek}`] = { subjectId: e.subjectId, subjectName: e.subjectName, teacherId: e.teacherId, teacherName: e.teacherName }; });
        setPeriods(newPeriods);
        setCells(newCells);
      })
      .catch(() => { setPeriods(defaultPeriods()); setCells({}); })
      .finally(() => setLoadingGrid(false));
  }, []);

  useEffect(() => { if (classId) loadGrid(classId); }, [classId, loadGrid]);

  const classSubjects = useMemo(
    () => subjects.filter(s => !s.classId || s.classId === classId),
    [subjects, classId],
  );

  function updatePeriod(uid, field, value) {
    setPeriods(prev => prev.map(p => (p.uid === uid ? { ...p, [field]: value } : p)));
  }
  function toggleBreak(uid) {
    setPeriods(prev => prev.map(p => (p.uid === uid ? { ...p, isBreak: !p.isBreak } : p)));
  }
  function addPeriod() {
    const last = periods[periods.length - 1];
    setPeriods(prev => [...prev, { uid: nextUid(), startTime: last?.endTime || '14:15', endTime: '', isBreak: false, label: '' }]);
  }
  function removePeriod(uid) {
    setPeriods(prev => prev.filter(p => p.uid !== uid));
    setCells(prev => {
      const next = {};
      Object.entries(prev).forEach(([key, value]) => { if (!key.startsWith(`${uid}_`)) next[key] = value; });
      return next;
    });
  }
  function setCellSubject(uid, day, subjectId) {
    const subject = classSubjects.find(s => String(s.id) === String(subjectId));
    setCells(prev => ({ ...prev, [`${uid}_${day}`]: { ...(prev[`${uid}_${day}`] || {}), subjectId, subjectName: subject?.name || '' } }));
  }
  function setCellTeacher(uid, day, teacherId) {
    const teacher = teachers.find(t => String(t.id) === String(teacherId));
    setCells(prev => ({ ...prev, [`${uid}_${day}`]: { ...(prev[`${uid}_${day}`] || {}), teacherId, teacherName: teacher?.name || '' } }));
  }

  async function handleSave() {
    if (!classId) { showToast('Select a class first.'); return; }
    setSaving(true);
    const entries = [];
    periods.forEach((p, periodIndex) => {
      if (!p.startTime) return;
      if (p.isBreak) {
        DAYS.forEach(d => entries.push({ dayOfWeek: d.n, periodIndex, startTime: p.startTime, endTime: p.endTime, isBreak: true, label: p.label || 'Break' }));
        return;
      }
      DAYS.forEach(d => {
        const cell = cells[`${p.uid}_${d.n}`];
        if (cell?.subjectName) {
          entries.push({ dayOfWeek: d.n, periodIndex, startTime: p.startTime, endTime: p.endTime, subjectId: cell.subjectId, subjectName: cell.subjectName, teacherId: cell.teacherId, teacherName: cell.teacherName });
        }
      });
    });
    try {
      await saveTimetable({ classId, entries });
      showToast('Timetable saved.');
    } catch (e) { showToast(e.message || 'Could not save timetable.'); } finally { setSaving(false); }
  }

  if (loading) return <div className={CARD}><p className="text-[#800020] text-sm">Loading timetable…</p></div>;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#800000]">Class Timetable</h2>
            <p className="text-sm text-[#191970] mt-1">Build the weekly period schedule per class — assign a subject and teacher to each period.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase text-[#800020]">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 bg-white/85 p-2 text-[#191970] text-sm">
              {classes.length === 0 ? <option value="">No classes</option> : null}
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.arm ? ` ${c.arm}` : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!classId ? <div className={CARD}><p className="text-[#800020] text-sm">Create a class first to build its timetable.</p></div> : (
        <div className={CARD}>
          {loadingGrid ? <p className="text-[#800020] text-sm">Loading class timetable…</p> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 880 }}>
                  <thead>
                    <tr>
                      <th className="border border-[#c9a96e]/40 bg-[#800020] text-[#f5deb3] p-2 text-left text-xs uppercase">Period</th>
                      {DAYS.map(d => <th key={d.n} className="border border-[#c9a96e]/40 bg-[#800020] text-[#f5deb3] p-2 text-left text-xs uppercase">{d.label}</th>)}
                      {canManage ? <th className="border border-[#c9a96e]/40 bg-[#800020] text-[#f5deb3] p-2 w-10"></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => (
                      <tr key={p.uid} className={p.isBreak ? 'bg-[#f7e3b8]' : 'bg-white/30'}>
                        <td className="border border-[#c9a96e]/30 p-2 align-top">
                          {canManage ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <input type="time" value={p.startTime} onChange={e => updatePeriod(p.uid, 'startTime', e.target.value)} className={TIME_INPUT} />
                                <input type="time" value={p.endTime} onChange={e => updatePeriod(p.uid, 'endTime', e.target.value)} className={TIME_INPUT} />
                              </div>
                              <label className="flex items-center gap-1 text-[10px] text-[#800020]"><input type="checkbox" checked={p.isBreak} onChange={() => toggleBreak(p.uid)} /> Break</label>
                              {p.isBreak ? <input value={p.label} onChange={e => updatePeriod(p.uid, 'label', e.target.value)} placeholder="Break label" className={CELL_SELECT} /> : null}
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-[#191970] text-xs">{p.startTime}{p.endTime ? `–${p.endTime}` : ''}</p>
                              {p.isBreak ? <p className="text-[10px] text-[#800020]">{p.label || 'Break'}</p> : null}
                            </div>
                          )}
                        </td>
                        {p.isBreak ? (
                          <td colSpan={DAYS.length} className="border border-[#c9a96e]/30 p-2 text-center text-xs font-semibold text-[#800020] uppercase tracking-wide">{p.label || 'Break'}</td>
                        ) : (
                          DAYS.map(d => {
                            const cell = cells[`${p.uid}_${d.n}`] || {};
                            return (
                              <td key={d.n} className="border border-[#c9a96e]/30 p-1 align-top">
                                {canManage ? (
                                  <div className="space-y-1">
                                    <select value={cell.subjectId || ''} onChange={e => setCellSubject(p.uid, d.n, e.target.value)} className={CELL_SELECT}>
                                      <option value="">—</option>
                                      {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    {cell.subjectName ? (
                                      <select value={cell.teacherId || ''} onChange={e => setCellTeacher(p.uid, d.n, e.target.value)} className={CELL_SELECT}>
                                        <option value="">Teacher…</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                      </select>
                                    ) : null}
                                  </div>
                                ) : (
                                  cell.subjectName ? (
                                    <div>
                                      <p className="font-semibold text-[#191970] text-xs">{cell.subjectName}</p>
                                      {cell.teacherName ? <p className="text-[10px] text-[#800020]">{cell.teacherName}</p> : null}
                                    </div>
                                  ) : <span className="text-[#c9a96e] text-xs">—</span>
                                )}
                              </td>
                            );
                          })
                        )}
                        {canManage ? (
                          <td className="border border-[#c9a96e]/30 p-1 text-center align-top">
                            <button onClick={() => removePeriod(p.uid)} title="Remove period" className="text-red-700 font-bold text-lg leading-none">−</button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canManage ? (
                <div className="flex flex-wrap gap-3 mt-4">
                  <button onClick={addPeriod} className={OUTLINE}>+ Add Period</button>
                  <button onClick={handleSave} disabled={saving} className={BTN}>{saving ? 'Saving…' : 'Save Timetable'}</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

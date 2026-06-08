import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getClasses, getSubjects, getPeople, getTimetable, saveTimetable } from '../services/schoolApi';
import {
  SECTION_DEFAULTS,
  SECTION_ORDER,
  TIMETABLE_DAYS,
  buildSectionPeriods,
  countTeachingPeriods,
  generateSchoolTimetables,
  inferSectionType,
  shouldDefaultDaily,
  weeklyCapacity,
} from './timetableEngine';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors disabled:opacity-60';
const OUTLINE = 'rounded-2xl border border-[#800020]/30 bg-white/70 px-4 py-2 text-sm font-semibold text-[#800020] hover:bg-white';
const SELECT = 'w-full rounded-lg border border-[#c9a96e]/40 bg-white/85 px-1.5 py-1 text-xs text-[#191970] outline-none focus:border-[#800020]';
const TIME_INPUT = 'rounded-lg border border-[#c9a96e]/40 bg-white/85 px-2 py-1 text-xs text-[#191970] w-[84px]';
const NUM_INPUT = 'w-16 rounded-lg border border-[#c9a96e]/40 bg-white/85 px-2 py-1 text-xs text-[#191970]';

const TEACHING_EXCLUDED_ROLES = new Set(['student', 'parent', 'ami', 'owner']);

function classLabel(cls) {
  return `${cls.name || cls.id}${cls.arm ? ` ${cls.arm}` : ''}`;
}

export default function TimetableBoard() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sectionConfigs, setSectionConfigs] = useState(() => JSON.parse(JSON.stringify(SECTION_DEFAULTS)));
  const [sectionOverrides, setSectionOverrides] = useState({});
  const [plans, setPlans] = useState({});
  const [gridByClass, setGridByClass] = useState({});
  const [selectedClassId, setSelectedClassId] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingOne, setSavingOne] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message) { setToast(message); window.setTimeout(() => setToast(''), 3200); }

  const teacherName = useCallback((teacherId) => {
    const teacher = teachers.find(person => String(person.id) === String(teacherId));
    return teacher?.name || '';
  }, [teachers]);

  const sectionTypeOf = useCallback((cls) => sectionOverrides[cls.id] || inferSectionType(classLabel(cls)), [sectionOverrides]);

  const periodsByType = useMemo(() => {
    const result = {};
    SECTION_ORDER.forEach(type => { result[type] = buildSectionPeriods(sectionConfigs[type]); });
    return result;
  }, [sectionConfigs]);

  useEffect(() => {
    Promise.all([getClasses(), getSubjects(), getPeople()])
      .then(([classData, subjectData, peopleData]) => {
        const classList = classData?.classes || [];
        const subjectList = subjectData?.subjects || [];
        const teacherList = (peopleData?.people || []).filter(person => !TEACHING_EXCLUDED_ROLES.has(String(person.role || '').toLowerCase()));
        setClasses(classList);
        setSubjects(subjectList);
        setTeachers(teacherList);
        const nameById = new Map(teacherList.map(person => [String(person.id), person.name]));
        const seeded = {};
        classList.forEach(cls => {
          const classSubjects = subjectList.filter(subject => !subject.classId || String(subject.classId) === String(cls.id));
          seeded[cls.id] = {
            subjects: classSubjects.map(subject => {
              const daily = shouldDefaultDaily(subject.name);
              return {
                subjectId: String(subject.id),
                subjectName: subject.name || 'Subject',
                teacherId: String(subject.teacherId || ''),
                teacherName: subject.teacherName || nameById.get(String(subject.teacherId)) || '',
                periodsPerWeek: daily ? TIMETABLE_DAYS.length : 3,
                daily,
              };
            }),
          };
        });
        setPlans(seeded);
        if (classList.length) setSelectedClassId(classList[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load a class's saved grid the first time it is viewed (before any generation).
  useEffect(() => {
    if (!selectedClassId || gridByClass[selectedClassId]) return;
    let ignore = false;
    getTimetable({ classId: selectedClassId })
      .then(data => {
        if (ignore) return;
        setCanManage(data?.canManage !== false);
        setGridByClass(current => ({ ...current, [selectedClassId]: data?.entries || [] }));
      })
      .catch(() => { if (!ignore) setGridByClass(current => ({ ...current, [selectedClassId]: [] })); });
    return () => { ignore = true; };
  }, [selectedClassId, gridByClass]);

  const selectedClass = useMemo(() => classes.find(cls => String(cls.id) === String(selectedClassId)) || null, [classes, selectedClassId]);
  const selectedType = selectedClass ? sectionTypeOf(selectedClass) : 'secondary';
  const selectedPeriods = useMemo(() => periodsByType[selectedType] || [], [periodsByType, selectedType]);
  const selectedPlan = plans[selectedClassId] || { subjects: [] };
  const selectedEntries = useMemo(() => gridByClass[selectedClassId] || [], [gridByClass, selectedClassId]);
  const planDemand = selectedPlan.subjects.reduce((sum, subject) => sum + Math.max(0, Number(subject.periodsPerWeek) || 0), 0);
  const capacity = weeklyCapacity(selectedPeriods);

  // ── Section settings ──
  function updateSection(type, field, value) {
    setSectionConfigs(current => ({ ...current, [type]: { ...current[type], [field]: value } }));
  }

  // ── Plan editing ──
  function updatePlanSubject(classId, index, patch) {
    setPlans(current => {
      const plan = current[classId] || { subjects: [] };
      const subjects = plan.subjects.map((subject, idx) => (idx === index ? { ...subject, ...patch } : subject));
      return { ...current, [classId]: { ...plan, subjects } };
    });
  }
  function removePlanSubject(classId, index) {
    setPlans(current => {
      const plan = current[classId] || { subjects: [] };
      return { ...current, [classId]: { ...plan, subjects: plan.subjects.filter((_, idx) => idx !== index) } };
    });
  }
  function addPlanSubject(classId) {
    const available = subjects.filter(subject => !subject.classId || String(subject.classId) === String(classId));
    const first = available[0];
    setPlans(current => {
      const plan = current[classId] || { subjects: [] };
      return {
        ...current,
        [classId]: {
          ...plan,
          subjects: [...plan.subjects, {
            subjectId: String(first?.id || ''),
            subjectName: first?.name || 'New subject',
            teacherId: String(first?.teacherId || ''),
            teacherName: teacherName(first?.teacherId),
            periodsPerWeek: 3,
            daily: false,
          }],
        },
      };
    });
  }

  // ── Generation ──
  function handleGenerate() {
    if (!classes.length) { showToast('Add classes first.'); return; }
    setGenerating(true);
    try {
      const sectionTypeByClassId = {};
      classes.forEach(cls => { sectionTypeByClassId[cls.id] = sectionTypeOf(cls); });
      const classInputs = classes.map(cls => ({ id: cls.id, name: classLabel(cls), label: classLabel(cls) }));
      const { byClass, conflicts: nextConflicts } = generateSchoolTimetables({
        classes: classInputs,
        plans,
        periodsByType,
        sectionTypeByClassId,
      });
      setGridByClass(byClass);
      setConflicts(nextConflicts);
      showToast(nextConflicts.length
        ? `Generated with ${nextConflicts.length} unplaced period(s) — review below.`
        : 'Clash-free timetable generated for every class.');
    } catch (error) {
      showToast(error.message || 'Could not generate the timetable.');
    } finally {
      setGenerating(false);
    }
  }

  async function persistClass(classId) {
    const entries = gridByClass[classId] || [];
    await saveTimetable({ classId, entries });
  }

  async function handleSaveAll() {
    const classIds = Object.keys(gridByClass).filter(classId => (gridByClass[classId] || []).length);
    if (!classIds.length) { showToast('Generate the timetable first.'); return; }
    setSavingAll(true);
    let saved = 0;
    try {
      for (const classId of classIds) {
        // eslint-disable-next-line no-await-in-loop
        await persistClass(classId);
        saved += 1;
      }
      showToast(`Saved timetables for ${saved} class${saved === 1 ? '' : 'es'}.`);
    } catch (error) {
      showToast(error.message || `Saved ${saved}, then hit an error.`);
    } finally {
      setSavingAll(false);
    }
  }

  async function handleSaveOne() {
    if (!selectedClassId) return;
    setSavingOne(true);
    try {
      await persistClass(selectedClassId);
      showToast(`Saved ${selectedClass ? classLabel(selectedClass) : 'class'} timetable.`);
    } catch (error) {
      showToast(error.message || 'Could not save this class.');
    } finally {
      setSavingOne(false);
    }
  }

  // ── Manual cell edits on the flipped grid ──
  function setCell(day, periodIndex, slot, patch) {
    setGridByClass(current => {
      const entries = (current[selectedClassId] || []).filter(entry => !(Number(entry.dayOfWeek) === day && Number(entry.periodIndex) === periodIndex && !entry.isBreak));
      const existing = (current[selectedClassId] || []).find(entry => Number(entry.dayOfWeek) === day && Number(entry.periodIndex) === periodIndex && !entry.isBreak) || {};
      const next = {
        dayOfWeek: day,
        periodIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectId: existing.subjectId || '',
        subjectName: existing.subjectName || '',
        teacherId: existing.teacherId || '',
        teacherName: existing.teacherName || '',
        ...patch,
      };
      if (!next.subjectName) {
        return { ...current, [selectedClassId]: entries };
      }
      return { ...current, [selectedClassId]: [...entries, next] };
    });
  }

  const classSubjectsForSelected = useMemo(
    () => subjects.filter(subject => !subject.classId || String(subject.classId) === String(selectedClassId)),
    [subjects, selectedClassId],
  );

  const displayGrid = useMemo(() => {
    // Columns come from the section template so empty teaching slots still show; cells from entries.
    const columns = selectedPeriods.map((period, periodIndex) => ({ ...period, periodIndex }));
    const cellLookup = new Map();
    selectedEntries.forEach(entry => {
      if (entry.isBreak) return;
      cellLookup.set(`${entry.dayOfWeek}:${entry.periodIndex}`, entry);
    });
    return { columns, cellLookup };
  }, [selectedPeriods, selectedEntries]);

  if (loading) return <div className={CARD}><p className="text-[#800020] text-sm">Loading timetable…</p></div>;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}

      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#800000]">School Timetable</h2>
            <p className="text-sm text-[#191970] mt-1 max-w-2xl">
              Pick each class's subjects and periods per week, then auto-build a clash-free timetable for the whole
              school at once — no teacher is ever booked in two classes at the same time. Maths and English run daily by default.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setSettingsOpen(open => !open)} className={OUTLINE}>{settingsOpen ? 'Hide period times' : 'Period times'}</button>
              <button onClick={handleGenerate} disabled={generating} className={BTN}>{generating ? 'Generating…' : 'Auto-generate (clash-free)'}</button>
              <button onClick={handleSaveAll} disabled={savingAll} className={BTN}>{savingAll ? 'Saving…' : 'Save all classes'}</button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Section period-time settings */}
      {canManage && settingsOpen ? (
        <div className={CARD}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#800020] mb-3">Period Times Per Section</h3>
          <p className="text-xs text-[#191970] mb-4">Nursery ends 1pm, Grade 2pm and Secondary 3pm by default — adjust the start, period length and end time to suit your school.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {SECTION_ORDER.map(type => {
              const config = sectionConfigs[type];
              const periods = periodsByType[type];
              return (
                <div key={type} className={INNER}>
                  <p className="font-bold text-[#800000] text-sm">{config.label}</p>
                  <div className="mt-3 space-y-2 text-xs text-[#191970]">
                    <label className="flex items-center justify-between gap-2">Start
                      <input type="time" value={config.startTime} onChange={event => updateSection(type, 'startTime', event.target.value)} className={TIME_INPUT} />
                    </label>
                    <label className="flex items-center justify-between gap-2">End
                      <input type="time" value={config.endTime} onChange={event => updateSection(type, 'endTime', event.target.value)} className={TIME_INPUT} />
                    </label>
                    <label className="flex items-center justify-between gap-2">Period mins
                      <input type="number" min={20} max={90} value={config.periodMinutes} onChange={event => updateSection(type, 'periodMinutes', Number(event.target.value) || 40)} className={NUM_INPUT} />
                    </label>
                    <p className="text-[11px] text-[#800020] pt-1">{countTeachingPeriods(periods)} teaching periods/day • {weeklyCapacity(periods)} slots/week</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!classes.length ? (
        <div className={CARD}><p className="text-[#800020] text-sm">Create classes first to build the timetable.</p></div>
      ) : (
        <>
          {/* Class selector */}
          <div className={CARD}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold uppercase text-[#800020]">Class</label>
              <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="rounded-xl border border-[#c9a96e]/40 bg-white/85 p-2 text-[#191970] text-sm">
                {classes.map(cls => <option key={cls.id} value={cls.id}>{classLabel(cls)}</option>)}
              </select>
              {selectedClass ? (
                <label className="ml-2 text-xs font-semibold uppercase text-[#800020]">Section
                  <select
                    value={selectedType}
                    onChange={event => setSectionOverrides(current => ({ ...current, [selectedClassId]: event.target.value }))}
                    className="ml-2 rounded-xl border border-[#c9a96e]/40 bg-white/85 p-2 text-[#191970] text-xs"
                  >
                    {SECTION_ORDER.map(type => <option key={type} value={type}>{SECTION_DEFAULTS[type].label}</option>)}
                  </select>
                </label>
              ) : null}
              <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${planDemand > capacity ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-[#1a5c38]/12 text-[#1a5c38] border border-[#1a5c38]/25'}`}>
                {planDemand} / {capacity} weekly periods used
              </span>
            </div>
          </div>

          {/* Subjects & periods per week */}
          {canManage ? (
            <div className={CARD}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#800020]">Subjects &amp; Periods Per Week — {selectedClass ? classLabel(selectedClass) : ''}</h3>
                <button onClick={() => addPlanSubject(selectedClassId)} className={OUTLINE}>+ Add subject</button>
              </div>
              {selectedPlan.subjects.length === 0 ? (
                <p className="text-xs text-[#800020]">No subjects yet. Assign subjects to this class, or add them above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 640 }}>
                    <thead>
                      <tr className="text-left text-[#800020]">
                        <th className="p-2">Subject</th>
                        <th className="p-2">Teacher</th>
                        <th className="p-2">Periods/week</th>
                        <th className="p-2">Every day</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlan.subjects.map((subject, index) => (
                        <tr key={`${subject.subjectId}_${index}`} className="bg-white/40">
                          <td className="p-2">
                            <select
                              value={subject.subjectId}
                              onChange={event => {
                                const picked = classSubjectsForSelected.find(item => String(item.id) === event.target.value);
                                updatePlanSubject(selectedClassId, index, {
                                  subjectId: event.target.value,
                                  subjectName: picked?.name || subject.subjectName,
                                  teacherId: String(picked?.teacherId || subject.teacherId || ''),
                                  teacherName: picked?.teacherName || teacherName(picked?.teacherId) || subject.teacherName,
                                });
                              }}
                              className={SELECT}
                            >
                              {classSubjectsForSelected.length === 0 ? <option value={subject.subjectId}>{subject.subjectName}</option> : null}
                              {classSubjectsForSelected.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <select value={subject.teacherId} onChange={event => updatePlanSubject(selectedClassId, index, { teacherId: event.target.value, teacherName: teacherName(event.target.value) })} className={SELECT}>
                              <option value="">Unassigned</option>
                              {teachers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <input type="number" min={0} max={capacity} value={subject.periodsPerWeek} onChange={event => updatePlanSubject(selectedClassId, index, { periodsPerWeek: Math.max(0, Number(event.target.value) || 0) })} className={NUM_INPUT} />
                          </td>
                          <td className="p-2">
                            <input type="checkbox" checked={Boolean(subject.daily)} onChange={event => updatePlanSubject(selectedClassId, index, { daily: event.target.checked, periodsPerWeek: event.target.checked ? Math.max(subject.periodsPerWeek, TIMETABLE_DAYS.length) : subject.periodsPerWeek })} />
                          </td>
                          <td className="p-2 text-right">
                            <button onClick={() => removePlanSubject(selectedClassId, index)} className="text-red-700 font-bold">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {planDemand > capacity ? (
                <p className="mt-3 text-xs font-semibold text-red-700">This class needs {planDemand} periods but the week only has {capacity}. Reduce some subjects or extend the day in “Period times”.</p>
              ) : null}
            </div>
          ) : null}

          {/* Conflicts */}
          {conflicts.length ? (
            <div className={`${CARD} border-amber-300/60`}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-2">Could not place {conflicts.length} period(s)</h3>
              <ul className="text-xs text-[#191970] space-y-1 list-disc pl-5 max-h-40 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <li key={index}>{conflict.className}: {conflict.subjectName}{conflict.teacherName ? ` (${conflict.teacherName})` : ''} — {conflict.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Flipped grid: time across the top, days down the left */}
          <div className={CARD}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#800020]">{selectedClass ? classLabel(selectedClass) : ''} Timetable</h3>
              {canManage ? <button onClick={handleSaveOne} disabled={savingOne} className={BTN}>{savingOne ? 'Saving…' : 'Save this class'}</button> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th className="border border-[#c9a96e]/40 bg-[#800020] text-[#f5deb3] p-2 text-left sticky left-0 z-10">Day</th>
                    {displayGrid.columns.map(column => (
                      <th key={column.periodIndex} className={`border border-[#c9a96e]/40 p-2 text-center ${column.isBreak ? 'bg-[#a86b1f] text-[#fff3df]' : 'bg-[#800020] text-[#f5deb3]'}`}>
                        <div>{column.startTime}</div>
                        <div className="opacity-80">{column.endTime}</div>
                        {column.isBreak ? <div className="text-[10px] mt-0.5">{column.label}</div> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIMETABLE_DAYS.map(day => (
                    <tr key={day.n}>
                      <td className="border border-[#c9a96e]/30 bg-[#f0d090] p-2 font-bold text-[#800000] sticky left-0 z-10">{day.short}</td>
                      {displayGrid.columns.map(column => {
                        if (column.isBreak) {
                          return <td key={column.periodIndex} className="border border-[#c9a96e]/30 bg-[#f7e3b8] p-1 text-center text-[10px] font-semibold text-[#800020] uppercase">{column.label}</td>;
                        }
                        const cell = displayGrid.cellLookup.get(`${day.n}:${column.periodIndex}`) || {};
                        if (!canManage) {
                          return (
                            <td key={column.periodIndex} className="border border-[#c9a96e]/30 p-1 align-top bg-white/30 text-center">
                              {cell.subjectName ? (
                                <div>
                                  <p className="font-semibold text-[#191970]">{cell.subjectName}</p>
                                  {cell.teacherName ? <p className="text-[10px] text-[#800020]">{cell.teacherName}</p> : null}
                                </div>
                              ) : <span className="text-[#c9a96e]">—</span>}
                            </td>
                          );
                        }
                        return (
                          <td key={column.periodIndex} className="border border-[#c9a96e]/30 p-1 align-top bg-white/30">
                            <select
                              value={cell.subjectId || ''}
                              onChange={event => {
                                const picked = classSubjectsForSelected.find(item => String(item.id) === event.target.value);
                                setCell(day.n, column.periodIndex, column, {
                                  subjectId: event.target.value,
                                  subjectName: picked?.name || '',
                                  teacherId: String(picked?.teacherId || ''),
                                  teacherName: picked?.teacherName || teacherName(picked?.teacherId) || '',
                                });
                              }}
                              className={SELECT}
                            >
                              <option value="">—</option>
                              {classSubjectsForSelected.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            {cell.subjectName ? (
                              <select value={cell.teacherId || ''} onChange={event => setCell(day.n, column.periodIndex, column, { teacherId: event.target.value, teacherName: teacherName(event.target.value) })} className={`${SELECT} mt-1`}>
                                <option value="">Teacher…</option>
                                {teachers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                              </select>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

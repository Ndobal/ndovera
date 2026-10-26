import React, { useEffect, useRef, useState } from 'react';
import { getAssignedClasses } from '../../classroom/classroomService';
import { getSubjectGroups } from '../../school/services/schoolApi';
import {
  changeExamPeriod,
  getTeacherScoreSheet,
  getTeacherScoreSheetWithCache,
  queueTeacherSave,
  publishPracticeResults,
  reopenTeacherResults,
  resetPracticeSheet,
  saveTeacherProfiles,
  saveTeacherScoreSheet,
} from '../service/resultEngineService';
import { findScoreEntryProblems, recomputeTeacherSheet } from '../utils/resultEngineTransforms';
import BroadsheetTable from './BroadsheetTable';
import SubjectRankings from './SubjectRankings';
import TeacherResultStudentCard from './TeacherResultStudentCard';
import ResultPreviewPanel from './ResultPreviewPanel';
import ResultOverrideLog from './ResultOverrideLog';
import ClassHandInPanel from './ClassHandInPanel';
import CombinedSubjectSheet from './CombinedSubjectSheet';
import ScoreSheetTips, { tipsSeen } from './ScoreSheetTips';
import {
  RESULT_BODY,
  RESULT_BUTTON,
  RESULT_HEADING,
  RESULT_INNER_SURFACE,
  RESULT_LABEL,
  RESULT_SECONDARY_BUTTON,
  RESULT_SURFACE,
  RESULT_INPUT,
  getBatchTone,
} from './resultSheetTheme';
import { askConfirm } from '../../../shared/components/AppDialog';
import { isRetryable } from '../../../shared/offline/outbox';

function readStoredClassId() {
  return window.localStorage.getItem('teacherClassroomId') || window.localStorage.getItem('classroomId') || '';
}

const EXAM_STATUS_LABELS = {
  none: 'Exams not activated',
  active: 'Exams active',
  ended: 'Exams ended',
};

function describeSaveReport(report) {
  if (!report) return 'Saved.';
  const parts = [report.savedRows ? `${report.savedRows} score row${report.savedRows === 1 ? '' : 's'} saved` : 'No scores changed'];
  if (report.overrides) parts.push(`${report.overrides} override${report.overrides === 1 ? '' : 's'} logged`);
  return `${parts.join(', ')}.`;
}

function describeLockedRows(report) {
  const locked = report?.locked || [];
  if (!locked.length) return '';
  const subjects = Array.from(new Set(locked.map(row => row.subjectName).filter(Boolean)));
  const reasons = new Set(locked.map(row => row.reason));
  const why = reasons.has('handed_in') ? 'the class has been handed in. Ask the HoS to reopen it if it needs correcting'
    : [...reasons].every(reason => ['submitted', 'section_approved', 'approved'].includes(reason))
      ? 'those scores have been submitted. Ask the class teacher to return them, or the HoS if they were approved'
      : 'a higher override holds them. Ask the class teacher or HoS';
  return `${locked.length} row${locked.length === 1 ? ' was' : 's were'} not changed${subjects.length ? ` (${subjects.join(', ')})` : ''}: ${why}.`;
}

// A student is done when every subject they take has a saved score.
const studentDone = student => student.rows.length > 0 && student.rows.every(row => !row.missing);

/**
 * `fixedClassId` opens one class's sheet (HOS / Owner / ICT from Academics → a class):
 * no class picker, and the teacher's own remembered class is left alone. Without it,
 * a teacher picks from the classes assigned to them, or a combined subject they teach.
 */
export default function TeacherCAScoreSheet({ dashboardLabel = 'Teacher Dashboard', fixedClassId = '', fixedClassName = '' }) {
  const [assignedClasses, setAssignedClasses] = useState(fixedClassId ? [{ id: fixedClassId, name: fixedClassName || 'This class' }] : []);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const storedClassIdRef = useRef(fixedClassId || readStoredClassId());
  const [classId, setClassId] = useState(storedClassIdRef.current);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('sheet');
  // 'live' is the real term; 'practice' is the class's training sheet on the same engine.
  const [mode, setMode] = useState('live');
  const [practiceNotice, setPracticeNotice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  // The student on screen; one past the last student is the hand-in step.
  const [studentIndex, setStudentIndex] = useState(0);
  const [previewStudentId, setPreviewStudentId] = useState('');
  const [showTips, setShowTips] = useState(() => !tipsSeen());
  // Offline: the sheet is the copy kept on this device; saves wait in the outbox.
  const [offline, setOffline] = useState(null);
  // Students with unsaved changes, and the rows typed into (so a typed zero is kept).
  const dirtyRef = useRef(new Set());
  const touchedRef = useRef(new Set());
  const editsRef = useRef(new Map());
  const savingRef = useRef(false);
  const [editTick, setEditTick] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssigned() {
      if (fixedClassId) return;
      try {
        const [data, groupData] = await Promise.all([getAssignedClasses(), getSubjectGroups().catch(() => ({ groups: [] }))]);
        if (cancelled) return;
        const classes = data?.classes || [];
        setAssignedClasses(classes);
        setGroups((groupData?.groups || []).filter(group => group.enabled));
        const preferredClassId = storedClassIdRef.current;
        const initialClassId = classes.some(item => item.id === preferredClassId) ? preferredClassId : (classes[0]?.id || '');
        setClassId(initialClassId);
        if (!initialClassId) setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Unable to load assigned classes for result entry.');
          setLoading(false);
        }
      }
    }

    loadAssigned();
    return () => {
      cancelled = true;
    };
  }, [fixedClassId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSheet() {
      if (!classId || groupId) return;
      setLoading(true);
      setError('');
      dirtyRef.current = new Set();
      touchedRef.current = new Set();
      setStudentIndex(0);
      try {
        const loaded = await getTeacherScoreSheetWithCache({ classId, mode: mode === 'practice' ? 'practice' : undefined });
        if (cancelled) return;
        setSheet(loaded.sheet);
        setOffline(loaded.offline ? { savedAt: loaded.savedAt } : null);
        if (!fixedClassId) {
          window.localStorage.setItem('teacherClassroomId', classId);
          window.localStorage.setItem('classroomId', classId);
        }
      } catch (loadError) {
        if (cancelled) return;
        // Practice closed while it was open (exams activated): fall back to the real sheet.
        if (mode === 'practice' && loadError?.data?.practiceLocked) {
          setPracticeNotice(loadError.message);
          setMode('live');
          return;
        }
        setError(loadError.message || 'Unable to load this CA score sheet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSheet();
    return () => {
      cancelled = true;
    };
  }, [classId, fixedClassId, mode, groupId]);

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMessage('');
    setError('');
    setPracticeNotice('');
    setActiveTab('sheet');
    setMode(nextMode);
  }

  function pickSheet(value) {
    setMessage('');
    setError('');
    if (value.startsWith('group:')) { setGroupId(value.slice(6)); return; }
    setGroupId('');
    setClassId(value);
  }

  function updateStudent(studentId, change) {
    dirtyRef.current.add(studentId);
    editsRef.current.set(studentId, (editsRef.current.get(studentId) || 0) + 1);
    setEditTick(tick => tick + 1);
    setSheet(current => current ? recomputeTeacherSheet({
      ...current,
      students: current.students.map(student => student.id !== studentId ? student : change(student)),
    }) : current);
  }

  function handleScoreChange(studentId, subjectId, field, value) {
    touchedRef.current.add(`${studentId}::${subjectId}`);
    // The box keeps exactly what was typed (a score above the maximum is shown in red, not cut down).
    updateStudent(studentId, student => ({ ...student, rows: student.rows.map(row => row.subjectId !== subjectId ? row : ({ ...row, typed: { ...(row.typed || {}), [field]: value }, [field]: Number(value || 0) })) }));
  }

  function handleCaComponentChange(studentId, subjectId, componentKey, value) {
    touchedRef.current.add(`${studentId}::${subjectId}`);
    updateStudent(studentId, student => ({
      ...student,
      rows: student.rows.map(row => row.subjectId !== subjectId ? row : ({ ...row, typed: { ...(row.typed || {}), [componentKey]: value }, caComponents: { ...(row.caComponents || {}), [componentKey]: Number(value || 0) } })),
    }));
  }

  function handleProfileFieldChange(studentId, field, value) {
    updateStudent(studentId, student => ({ ...student, profile: { ...student.profile, [field]: value } }));
  }

  /** Report-card extras (height, weight, attendance…) and page-2 answers. */
  function handleProfileExtraChange(studentId, key, value, page2 = false) {
    updateStudent(studentId, student => {
      const extra = student.profile?.extra || {};
      const next = page2 ? { ...extra, page2: { ...(extra.page2 || {}), [key]: value } } : { ...extra, [key]: value };
      return { ...student, profile: { ...student.profile, extra: next } };
    });
  }

  function handleProfileMapChange(studentId, group, key, value) {
    updateStudent(studentId, student => ({ ...student, profile: { ...student.profile, [group]: { ...(student.profile?.[group] || {}), [key]: Number(value || 0) } } }));
  }

  /**
   * Saves every student with unsaved changes. Returns false when the save failed. A student
   * with a score out of range is not saved (their boxes keep what was typed) until it is fixed.
   * `auto` is the quiet save a few seconds after typing stops.
   */
  async function saveDirty({ announce = false, auto = false } = {}) {
    if (!sheet || savingRef.current) return !savingRef.current;
    const blocked = new Set(findScoreEntryProblems(sheet).map(problem => problem.studentId));
    const pending = [...dirtyRef.current].filter(id => !blocked.has(id));
    const blockedNote = blocked.size ? 'Scores shown in red are above the maximum (or not valid), so they were not saved. Correct them and they save by themselves.' : '';
    if (!pending.length) {
      if (blockedNote && !auto) setError(blockedNote);
      else if (announce) setMessage('Nothing new to save.');
      return true;
    }
    // Typing that goes on while this save is on its way is kept, and saved next.
    const versions = new Map(pending.map(id => [id, editsRef.current.get(id) || 0]));
    const settled = () => pending.filter(id => (editsRef.current.get(id) || 0) === versions.get(id));
    savingRef.current = true;
    setSaving(true);
    if (!auto) {
      setError('');
      setMessage('');
    }
    try {
      const studentById = new Map(sheet.students.map(student => [student.id, student]));
      const profileIds = pending.filter(id => !sheet.published && (!sheet.submitted || studentById.get(id)?.late));
      if (sheet.permissions?.canManageProfiles && profileIds.length && !sheet.submitted) {
        await saveTeacherProfiles(sheet, { studentIds: profileIds, reload: false });
      }
      const next = await saveTeacherScoreSheet(sheet, { reason: overrideReason, studentIds: pending, touched: touchedRef.current });
      const done = settled();
      done.forEach(id => dirtyRef.current.delete(id));
      touchedRef.current = new Set([...touchedRef.current].filter(key => !done.includes(key.split('::')[0])));
      // Students still being edited (or held back for a score in red) keep what is on screen.
      setSheet(current => {
        const keep = new Map((current?.students || []).filter(student => dirtyRef.current.has(student.id)).map(student => [student.id, student]));
        return keep.size ? recomputeTeacherSheet({ ...next, students: next.students.map(student => keep.get(student.id) || student) }) : next;
      });
      setDraftSavedAt(new Date());
      if (announce || next.lastSave?.overrides) setMessage(describeSaveReport(next.lastSave));
      const lockedMessage = describeLockedRows(next.lastSave);
      if (lockedMessage) setError(lockedMessage);
      else if (blockedNote && !auto) setError(blockedNote);
      if (next.lastSave?.overrides) setOverrideReason('');
      setRefreshKey(key => key + 1);
      setOffline(null);
      return true;
    } catch (saveError) {
      // No connection: keep the scores on this device and send them when it is back.
      if (isRetryable(saveError)) {
        try {
          await queueTeacherSave(sheet, { reason: overrideReason, studentIds: pending, touched: touchedRef.current, profiles: Boolean(sheet.permissions?.canManageProfiles && !sheet.submitted) });
          settled().forEach(id => dirtyRef.current.delete(id));
          setOffline(current => current || { savedAt: new Date().toISOString() });
          setMessage('Saved on this device. The scores are sent to Ndovera by themselves when you are back online.');
          return true;
        } catch { /* fall through to the error */ }
      }
      setError(saveError.message || 'Unable to save these scores.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
      // Typing during the save: save that too, a moment from now.
      if (dirtyRef.current.size) setEditTick(tick => tick + 1);
    }
  }

  // Scores save themselves as a draft a moment after typing stops; handing in is still a separate step.
  useEffect(() => {
    if (!editTick || !sheet || sheet.published) return undefined;
    const timer = setTimeout(() => { saveDirty({ auto: true }); }, 2500);
    return () => clearTimeout(timer);
  }, [editTick]); // eslint-disable-line react-hooks/exhaustive-deps

  async function goTo(index) {
    if (saving) return;
    if (await saveDirty()) setStudentIndex(index);
  }

  async function reopenBatch() {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setSheet(await reopenTeacherResults(sheet));
      setMessage('Reopened as a draft.');
    } catch (reopenError) {
      setError(reopenError.message || 'Unable to reopen this result batch.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, successMessage, failureMessage) {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (successMessage) setMessage(successMessage);
      setRefreshKey(key => key + 1);
    } catch (actionError) {
      setError(actionError.message || failureMessage);
    } finally {
      setSaving(false);
    }
  }

  function publishPractice() {
    return runAction(async () => {
      setSheet(await publishPracticeResults(sheet));
      setActiveTab('preview');
    }, 'Practice results "published". This is what each student would now see — nothing was sent to anyone.', 'Unable to publish the practice results.');
  }

  async function resetPractice() {
    if (typeof window !== 'undefined' && !await askConfirm('Clear every practice score and remark for this class and start again?')) return;
    runAction(async () => setSheet(await resetPracticeSheet(sheet)), 'Practice sheet cleared.', 'Unable to reset the practice sheet.');
  }

  async function updateExamPeriod(action) {
    const label = sheet?.currentPeriod ? `${sheet.currentPeriod.termName} ${sheet.currentPeriod.sessionName}`.trim() : 'this term';
    const prompt = action === 'activate'
      ? `Activate exams for ${label}? Practice results close for every class in the school and all practice scores are cleared. Practice comes back after exams end and results are published.`
      : `End the exam period for ${label}? Practice results return once this term's results are published.`;
    if (typeof window !== 'undefined' && !await askConfirm(prompt)) return;
    runAction(async () => {
      await changeExamPeriod(action);
      if (mode === 'practice' && action === 'activate') {
        setMode('live');
        return;
      }
      setSheet(await getTeacherScoreSheet({ classId, mode: mode === 'practice' ? 'practice' : undefined }));
    }, action === 'activate' ? 'Exams activated. Practice results are now closed school-wide.' : 'Exam period ended.', 'Unable to change the exam period.');
  }

  async function previewStudent(studentId) {
    if (!await saveDirty()) return;
    setPreviewStudentId(studentId);
    setActiveTab('preview');
  }

  const entryProblems = sheet ? findScoreEntryProblems(sheet) : [];
  const isPractice = sheet?.mode === 'practice';
  const practicePublished = isPractice && sheet?.published;
  const examStatus = sheet?.examPeriod?.status || 'none';
  const practiceAvailable = sheet?.practice?.available !== false;
  const canOverride = Number(sheet?.permissions?.overrideRank || 0) > 0;
  const visibleStudents = sheet?.students?.filter(student => sheet.permissions?.canManageProfiles || student.rows.length > 0) || [];
  const finishIndex = visibleStudents.length;
  const currentIndex = Math.min(studentIndex, finishIndex);
  const currentStudent = visibleStudents[currentIndex] || null;
  const doneCount = visibleStudents.filter(studentDone).length;
  const statusLabel = sheet?.published ? 'Published' : sheet?.submitted ? 'Handed in' : 'Draft';

  const picker = (
    <select value={groupId ? `group:${groupId}` : classId} onChange={event => pickSheet(event.target.value)} className={`${RESULT_INPUT} min-w-[220px]`} aria-label="Class or combined subject">
      {assignedClasses.map(item => (
        <option key={item.id} value={item.id}>{item.className || item.name || item.id}</option>
      ))}
      {groups.length > 0 && (
        <optgroup label="Combined subjects">
          {groups.map(group => <option key={group.id} value={`group:${group.id}`}>{group.name} — {group.classes.filter(item => group.classIds.includes(item.id)).map(item => item.name).join(', ')}</option>)}
        </optgroup>
      )}
    </select>
  );

  if (groupId) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <section className={`${RESULT_SURFACE} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2447d8] text-white">📊</span>
            <div className="min-w-0">
              <h1 className={`text-lg font-black leading-tight ${RESULT_HEADING}`}>CA Score Sheet</h1>
              <p className={`truncate text-xs ${RESULT_BODY}`}>{dashboardLabel} · combined subject</p>
            </div>
          </div>
          {picker}
        </section>
        <CombinedSubjectSheet key={groupId} groupId={groupId} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <section className={`${RESULT_SURFACE} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2447d8] text-white">📊</span>
          <div className="min-w-0">
            <h1 className={`text-lg font-black leading-tight ${RESULT_HEADING}`}>CA Score Sheet</h1>
            <p className={`truncate text-xs ${RESULT_BODY}`}>
              {dashboardLabel}{sheet?.period ? ` • ${sheet.period.termName || ''}${sheet.period.sessionName && !isPractice ? ` ${sheet.period.sessionName}` : ''}` : ''}
            </p>
          </div>
          {sheet && (
            <span className={`hidden items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] sm:inline-flex ${getBatchTone(sheet.published ? 'published' : sheet.submitted ? 'submitted' : 'draft')}`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-[#7cc4e8]/60 bg-white/70 p-1 dark:border-white/10 dark:bg-slate-900/40" role="group" aria-label="Score sheet mode">
            <button
              type="button"
              onClick={() => switchMode('live')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${mode === 'live' ? 'bg-[#2447d8] text-white' : 'text-[#2447d8] dark:text-slate-200'}`}
            >
              Live results
            </button>
            <button
              type="button"
              onClick={() => switchMode('practice')}
              disabled={mode !== 'practice' && !practiceAvailable}
              title={!practiceAvailable ? (sheet?.practice?.reason || 'Practice is closed during exams.') : 'Learn the full results flow on the real engine. Nothing reaches students.'}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'practice' ? 'bg-[#b45309] text-white' : 'text-[#b45309] dark:text-amber-300'}`}
            >
              Practice
            </button>
          </div>
          {picker}
          {sheet && !sheet.published && (
            <button type="button" onClick={() => saveDirty({ announce: true })} disabled={saving || !sheet?.configurationReady} className={RESULT_SECONDARY_BUTTON}>
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
          )}
          {sheet && !sheet.published && draftSavedAt && (
            <span role="status" className={`text-xs font-semibold ${RESULT_BODY}`}>Draft saved {draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          {sheet && !sheet.submitted && !sheet.published && (
            <button type="button" onClick={() => { setActiveTab('sheet'); goTo(finishIndex); }} disabled={saving} className={RESULT_BUTTON}>
              {sheet.permissions?.canHandIn ? 'Hand in' : 'Submit'}
            </button>
          )}
          {(sheet?.submitted || practicePublished) && (sheet.permissions?.canHandIn || sheet.permissions?.canManageProfiles) && (
            <button type="button" onClick={reopenBatch} disabled={saving} className={RESULT_SECONDARY_BUTTON}>Reopen draft</button>
          )}
          {isPractice && sheet?.submitted && sheet?.permissions?.canPublish && (
            <button type="button" onClick={publishPractice} disabled={saving} className={RESULT_BUTTON}>Publish (practice)</button>
          )}
        </div>
      </section>

      {canOverride && sheet && !sheet.submitted && !sheet.published && (
        <section className={`${RESULT_SURFACE} flex flex-wrap items-center gap-3 px-5 py-3`}>
          <label htmlFor="result-override-reason" className={`micro-label ${RESULT_LABEL}`}>Reason for overrides</label>
          <input
            id="result-override-reason"
            type="text"
            value={overrideReason}
            maxLength={500}
            onChange={event => setOverrideReason(event.target.value)}
            placeholder="Optional — saved in the override log when you change another teacher's scores"
            className={`${RESULT_INPUT} min-w-[240px] flex-1`}
          />
        </section>
      )}

      {practiceNotice && (
        <section className={`${RESULT_SURFACE} p-5 text-sm text-[#92400e] dark:text-amber-200 border-amber-300/50 bg-amber-50 dark:bg-amber-500/10`}>
          <p className="font-bold">Practice is closed</p>
          <p className="mt-1">{practiceNotice}</p>
        </section>
      )}

      {isPractice && (
        <section className={`${RESULT_SURFACE} flex flex-wrap items-start justify-between gap-3 p-5 border-amber-400/60 bg-amber-50 dark:bg-amber-500/10`}>
          <div className="min-w-0 text-sm text-[#92400e] dark:text-amber-200">
            <p className="font-black uppercase tracking-wide">Practice mode</p>
            <p className="mt-1">
              This sheet runs on the real result engine — scores, grades, positions and the student view all compute exactly as they will for real — but nothing here is ever sent to students or parents.
              Practice closes when the HoS activates exams, and returns once exams end and results are published.
            </p>
            {sheet?.practice?.sampleRoster && (
              <p className="mt-2 font-semibold">This class has no students or subjects yet, so sample learners and subjects are used.</p>
            )}
          </div>
          {sheet?.permissions?.canManageProfiles && (
            <button type="button" onClick={resetPractice} disabled={saving} className={RESULT_SECONDARY_BUTTON}>Reset practice</button>
          )}
        </section>
      )}

      {sheet && (sheet.permissions?.canManageExamPeriod || examStatus !== 'none') && (
        <section className={`${RESULT_SURFACE} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
          <div className="min-w-0">
            <p className={`micro-label ${RESULT_LABEL}`}>Exam period · {sheet.currentPeriod ? `${sheet.currentPeriod.termName} ${sheet.currentPeriod.sessionName}` : 'Current term'}</p>
            <p className={`mt-1 text-sm font-semibold ${RESULT_HEADING}`}>
              {EXAM_STATUS_LABELS[examStatus] || examStatus}
              {!practiceAvailable && <span className={`ml-2 font-normal ${RESULT_BODY}`}>— practice results are closed</span>}
            </p>
          </div>
          {sheet.permissions?.canManageExamPeriod && (
            examStatus === 'active' ? (
              <button type="button" onClick={() => updateExamPeriod('end')} disabled={saving} className={RESULT_SECONDARY_BUTTON}>End exam period</button>
            ) : (
              <button type="button" onClick={() => updateExamPeriod('activate')} disabled={saving} className={RESULT_BUTTON}>Activate exams</button>
            )
          )}
        </section>
      )}

      {offline && (
        <section role="status" className={`${RESULT_SURFACE} flex flex-wrap items-center gap-2 border-amber-300/60 bg-amber-50 px-5 py-3 text-sm text-amber-950`}>
          <span className="font-black">📴 Working offline.</span>
          <span>This is the copy kept on this device{offline.savedAt ? ` (from ${new Date(offline.savedAt).toLocaleString()})` : ''}. Keep entering scores: they are saved here and sent to Ndovera by themselves when you are back online.</span>
        </section>
      )}
      {error && <section role="alert" className={`${RESULT_SURFACE} p-5 text-sm text-[#800020] dark:text-[#ffffff] border-rose-300/30 bg-rose-200/65 dark:bg-[#800000]/70`}>{error}</section>}
      {message && <section role="status" className={`${RESULT_SURFACE} p-5 text-sm text-[#1a5c38] dark:text-[#00ffff] border-emerald-300/30 bg-emerald-100/70 dark:bg-[#800000]/70`}>{message}</section>}

      {sheet && !sheet.configurationReady && (
        <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#39ff14] border-amber-300/30 bg-[#ade1f4] dark:bg-[#800000]/70`}>
          {sheet.configurationError || 'Result settings are incomplete. Owner, HoS, or ICT must configure template, grading, and affective scales before CA entry can be saved.'}
        </section>
      )}

      {loading && <section className={`${RESULT_SURFACE} p-6 ${RESULT_BODY}`}>Loading CA score sheet...</section>}

      {!loading && !sheet && (
        <section className={`${RESULT_SURFACE} p-6`}>
          <p className={`micro-label ${RESULT_LABEL}`}>No assigned class</p>
          <p className={`mt-2 text-sm ${RESULT_BODY}`}>This user does not have any assigned result class yet.</p>
        </section>
      )}

      {sheet && (
        <div className={`${RESULT_SURFACE} flex flex-wrap gap-2 p-1.5`} role="tablist">
          {[
            { key: 'sheet', label: 'Score Sheet', icon: '📝' },
            { key: 'rankings', label: 'Rankings', icon: '🥇' },
            { key: 'broadsheet', label: 'Broadsheet Ranking', icon: '🏆' },
            { key: 'preview', label: 'Student View', icon: '👁️' },
            { key: 'log', label: 'Override Log', icon: '🧾' },
            { key: 'tips', label: 'Tips', icon: '💡' },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={async () => { if (activeTab === 'sheet' && t.key !== 'sheet' && !await saveDirty()) return; setActiveTab(t.key); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === t.key ? 'bg-[#2447d8] text-white shadow-lg shadow-[#2447d8]/25' : 'text-[#2447d8] hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10'}`}
            >
              <span>{t.icon}</span><span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {sheet && activeTab === 'sheet' && (
        <>
          {showTips && <ScoreSheetTips sheet={sheet} onClose={() => setShowTips(false)} />}

          {visibleStudents.length === 0 ? (
            <section className={`${RESULT_SURFACE} p-5`}>
              <div className={`${RESULT_INNER_SURFACE} border-dashed p-5 text-center`}>
                <p className={`micro-label ${RESULT_LABEL}`}>No live result sheet</p>
                <p className={`mt-2 text-sm ${RESULT_BODY}`}>Student score rows will appear here after a real class roster and assessments are synced.</p>
              </div>
            </section>
          ) : (
            <section className={`${RESULT_SURFACE} space-y-4 p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`micro-label ${RESULT_LABEL}`}>Students · {doneCount} of {visibleStudents.length} complete</p>
                {sheet.scheduledHandInAt && !sheet.submitted && <p className={`text-xs ${RESULT_BODY}`}>Hand-in scheduled for {new Date(sheet.scheduledHandInAt).toLocaleString()}</p>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Students">
                {visibleStudents.map((student, index) => {
                  const done = studentDone(student);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      role="tab"
                      aria-selected={index === currentIndex}
                      onClick={() => goTo(index)}
                      className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${index === currentIndex ? 'border-[#2447d8] bg-[#2447d8] text-white' : done ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-[#7cc4e8]/60 bg-white text-[#191970] dark:bg-slate-900 dark:text-slate-200'}`}
                    >
                      {done ? '✓ ' : ''}{student.name}{student.late ? ' · new' : ''}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="tab"
                  aria-selected={currentIndex === finishIndex}
                  onClick={() => goTo(finishIndex)}
                  className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold ${currentIndex === finishIndex ? 'border-[#2447d8] bg-[#2447d8] text-white' : 'border-[#2447d8]/40 bg-white text-[#2447d8] dark:bg-slate-900'}`}
                >
                  🏁 {sheet.permissions?.canHandIn ? 'Hand in' : 'Submit'}
                </button>
              </div>

              {currentStudent ? (
                <>
                  {currentStudent.late && <p className="rounded-xl bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-900">New to the class since the hand-in: enter their scores, then hand them in from the last step.</p>}
                  <TeacherResultStudentCard
                    key={currentStudent.id}
                    index={currentIndex}
                    student={currentStudent}
                    settings={sheet.settings}
                    permissions={sheet.permissions}
                    profileLocked={sheet.published || sheet.submitted}
                    onCaComponentChange={handleCaComponentChange}
                    onScoreChange={handleScoreChange}
                    onProfileFieldChange={handleProfileFieldChange}
                    onProfileMapChange={handleProfileMapChange}
                    reportCard={sheet.reportCard}
                    autoDetails={sheet.reportDetails?.[currentStudent.id] || {}}
                    onProfileExtraChange={handleProfileExtraChange}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving || currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>← Previous</button>
                    <span className={`text-xs ${RESULT_BODY}`}>Student {currentIndex + 1} of {visibleStudents.length}</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving} onClick={() => previewStudent(currentStudent.id)}>Preview result</button>
                      {!sheet.published && <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving} onClick={() => saveDirty({ announce: true })}>{saving ? 'Saving…' : 'Save as draft'}</button>}
                      <button type="button" className={RESULT_BUTTON} disabled={saving} onClick={() => goTo(currentIndex + 1)}>
                        {saving ? 'Saving…' : currentIndex === finishIndex - 1 ? 'Next: hand in →' : 'Next →'}
                      </button>
                    </div>
                  </div>
                </>
              ) : entryProblems.length ? (
                <div role="alert" className="space-y-2 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100">
                  <p className="font-bold">These scores are not allowed, so the sheet cannot be {sheet.permissions?.canHandIn ? 'handed in' : 'submitted'} yet. Correct them first:</p>
                  <ul className="space-y-1">
                    {entryProblems.map(problem => (
                      <li key={`${problem.studentId}-${problem.subjectName}-${problem.label}`}>
                        <button type="button" className="text-left font-semibold underline" onClick={() => setStudentIndex(Math.max(0, visibleStudents.findIndex(student => student.id === problem.studentId)))}>
                          {problem.studentName} · {problem.subjectName} · {problem.label}: {problem.value}
                        </button> — {problem.problem}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ClassHandInPanel sheet={sheet} onSheet={next => { setSheet(next); setRefreshKey(key => key + 1); }} onSaveDraft={() => saveDirty({ announce: true })} saving={saving} />
              )}
            </section>
          )}
        </>
      )}

      {sheet && activeTab === 'rankings' && <SubjectRankings classId={sheet.classId || classId} refreshKey={refreshKey} />}

      {sheet && activeTab === 'broadsheet' && (
        <BroadsheetTable rows={sheet.broadsheet} title="Broadsheet Ranking (Live Preview)" />
      )}

      {sheet && activeTab === 'preview' && <ResultPreviewPanel sheet={sheet} refreshKey={refreshKey} initialStudentId={previewStudentId} />}

      {sheet && activeTab === 'log' && <ResultOverrideLog sheet={sheet} refreshKey={refreshKey} />}

      {sheet && activeTab === 'tips' && <ScoreSheetTips sheet={sheet} all />}
    </div>
  );
}

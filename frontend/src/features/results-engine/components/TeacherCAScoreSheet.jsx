import React, { useEffect, useRef, useState } from 'react';
import { getAssignedClasses } from '../../classroom/classroomService';
import {
  changeExamPeriod,
  getTeacherScoreSheet,
  publishPracticeResults,
  reopenTeacherResults,
  resetPracticeSheet,
  saveTeacherProfiles,
  saveTeacherScoreSheet,
  submitTeacherResults,
} from '../service/resultEngineService';
import { normalizeCaComponentDefinitions, recomputeTeacherSheet, resolveResultScoreModel } from '../utils/resultEngineTransforms';
import BroadsheetTable from './BroadsheetTable';
import TeacherResultStudentCard from './TeacherResultStudentCard';
import ResultPreviewPanel from './ResultPreviewPanel';
import ResultOverrideLog from './ResultOverrideLog';
import CaHandInPanel from './CaHandInPanel';
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
  getWorkflowTone,
} from './resultSheetTheme';

function readStoredClassId() {
  return window.localStorage.getItem('teacherClassroomId') || window.localStorage.getItem('classroomId') || '';
}

const EXAM_STATUS_LABELS = {
  none: 'Exams not activated',
  active: 'Exams active',
  ended: 'Exams ended',
};

function describeSaveReport(report) {
  if (!report) return 'CA score rows saved.';
  const parts = [report.savedRows ? `${report.savedRows} score row${report.savedRows === 1 ? '' : 's'} saved` : 'No scores changed'];
  if (report.overrides) parts.push(`${report.overrides} override${report.overrides === 1 ? '' : 's'} logged`);
  return `${parts.join(', ')}.`;
}

function describeLockedRows(report) {
  const locked = report?.locked || [];
  if (!locked.length) return '';
  const subjects = Array.from(new Set(locked.map(row => row.subjectName).filter(Boolean)));
  const caLocked = locked.filter(row => ['submitted', 'section_approved', 'approved'].includes(row.reason)).length;
  const why = caLocked === locked.length
    ? 'that C.A. has been handed in. Ask your section head or the HoS to return it if it needs correcting'
    : caLocked ? 'some C.A. has been handed in and some rows are held by a higher override. Ask the section head or HoS'
      : `a higher override holds ${locked.length === 1 ? 'it' : 'them'}. Ask the class teacher or HoS`;
  return `${locked.length} row${locked.length === 1 ? ' was' : 's were'} not changed${subjects.length ? ` (${subjects.join(', ')})` : ''}: ${why}.`;
}

function buildWorkflowSteps(sheet) {
  const isSubmitted = Boolean(sheet?.submitted);
  const isPublished = Boolean(sheet?.published);

  return [
    {
      id: 'entry',
      label: 'Teacher Entry',
      helper: 'Enter CA components and exam scores per subject.',
      state: isSubmitted || isPublished ? 'done' : 'active',
    },
    {
      id: 'review',
      label: 'Internal Review',
      helper: 'Class review, profile fields, and remarks are completed here.',
      state: isPublished ? 'done' : isSubmitted ? 'active' : 'pending',
    },
    {
      id: 'approval',
      label: 'HoS Approval',
      helper: 'Published batches are the approved release state.',
      state: isPublished ? 'done' : 'pending',
    },
  ];
}

/**
 * `fixedClassId` opens one class's sheet (HOS / Owner from Academics → a class): no class
 * picker, and the teacher's own remembered class is left alone. Without it, a teacher
 * picks from the classes assigned to them, as before.
 */
export default function TeacherCAScoreSheet({ dashboardLabel = 'Teacher Dashboard', fixedClassId = '', fixedClassName = '' }) {
  const [assignedClasses, setAssignedClasses] = useState(fixedClassId ? [{ id: fixedClassId, name: fixedClassName || 'This class' }] : []);
  const storedClassIdRef = useRef(fixedClassId || readStoredClassId());
  const [classId, setClassId] = useState(storedClassIdRef.current);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('sheet');
  const [workflowOpen, setWorkflowOpen] = useState(false);
  // 'live' is the real term; 'practice' is the class's training sheet on the same engine.
  const [mode, setMode] = useState('live');
  const [practiceNotice, setPracticeNotice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAssigned() {
      if (fixedClassId) return;
      try {
        const data = await getAssignedClasses();
        if (cancelled) return;
        const classes = data?.classes || [];
        setAssignedClasses(classes);
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
      if (!classId) return;
      setLoading(true);
      setError('');
      try {
        const nextSheet = await getTeacherScoreSheet({ classId, mode: mode === 'practice' ? 'practice' : undefined });
        if (cancelled) return;
        setSheet(nextSheet);
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
  }, [classId, fixedClassId, mode]);

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMessage('');
    setError('');
    setPracticeNotice('');
    setActiveTab('sheet');
    setMode(nextMode);
  }

  function handleScoreChange(studentId, subjectId, field, value) {
    setSheet(current => {
      if (!current) return current;
      return recomputeTeacherSheet({
        ...current,
        students: current.students.map(student => student.id !== studentId ? student : ({
          ...student,
          rows: student.rows.map(row => row.subjectId !== subjectId ? row : ({
            ...row,
            [field]: Number(value || 0),
          })),
        })),
      });
    });
  }

  function handleCaComponentChange(studentId, subjectId, componentKey, value) {
    setSheet(current => {
      if (!current) return current;
      return recomputeTeacherSheet({
        ...current,
        students: current.students.map(student => student.id !== studentId ? student : ({
          ...student,
          rows: student.rows.map(row => row.subjectId !== subjectId ? row : ({
            ...row,
            caComponents: {
              ...(row.caComponents || {}),
              [componentKey]: Number(value || 0),
            },
          })),
        })),
      });
    });
  }

  function handleProfileFieldChange(studentId, field, value) {
    setSheet(current => {
      if (!current) return current;
      return recomputeTeacherSheet({
        ...current,
        students: current.students.map(student => student.id !== studentId ? student : ({
          ...student,
          profile: { ...student.profile, [field]: value },
        })),
      });
    });
  }

  function handleProfileMapChange(studentId, group, key, value) {
    setSheet(current => {
      if (!current) return current;
      return recomputeTeacherSheet({
        ...current,
        students: current.students.map(student => student.id !== studentId ? student : ({
          ...student,
          profile: {
            ...student.profile,
            [group]: { ...(student.profile?.[group] || {}), [key]: Number(value || 0) },
          },
        })),
      });
    });
  }

  async function persistScores() {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const next = await saveTeacherScoreSheet(sheet, { reason: overrideReason });
      setSheet(next);
      setMessage(describeSaveReport(next.lastSave));
      const lockedMessage = describeLockedRows(next.lastSave);
      if (lockedMessage) setError(lockedMessage);
      if (next.lastSave?.overrides) setOverrideReason('');
      setRefreshKey(key => key + 1);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save CA scores.');
    } finally {
      setSaving(false);
    }
  }

  async function persistProfiles() {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setSheet(await saveTeacherProfiles(sheet));
      setMessage('Attendance, affective areas, and remarks saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save result profile fields.');
    } finally {
      setSaving(false);
    }
  }

  async function submitBatch() {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setSheet(await submitTeacherResults(sheet));
      setMessage('Result batch submitted for HoS review.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit this result batch.');
    } finally {
      setSaving(false);
    }
  }

  async function reopenBatch() {
    if (!sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setSheet(await reopenTeacherResults(sheet));
      setMessage('Result batch reopened as draft.');
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

  function resetPractice() {
    if (typeof window !== 'undefined' && !window.confirm('Clear every practice score and remark for this class and start again?')) return;
    runAction(async () => setSheet(await resetPracticeSheet(sheet)), 'Practice sheet cleared.', 'Unable to reset the practice sheet.');
  }

  function updateExamPeriod(action) {
    const label = sheet?.currentPeriod ? `${sheet.currentPeriod.termName} ${sheet.currentPeriod.sessionName}`.trim() : 'this term';
    const prompt = action === 'activate'
      ? `Activate exams for ${label}? Practice results close for every class in the school and all practice scores are cleared. Practice comes back after exams end and results are published.`
      : `End the exam period for ${label}? Practice results return once this term's results are published.`;
    if (typeof window !== 'undefined' && !window.confirm(prompt)) return;
    runAction(async () => {
      await changeExamPeriod(action);
      if (mode === 'practice' && action === 'activate') {
        setMode('live');
        return;
      }
      setSheet(await getTeacherScoreSheet({ classId, mode: mode === 'practice' ? 'practice' : undefined }));
    }, action === 'activate' ? 'Exams activated. Practice results are now closed school-wide.' : 'Exam period ended.', 'Unable to change the exam period.');
  }

  const isPractice = sheet?.mode === 'practice';
  const practicePublished = isPractice && sheet?.published;
  const examStatus = sheet?.examPeriod?.status || 'none';
  const practiceAvailable = sheet?.practice?.available !== false;
  const canOverride = Number(sheet?.permissions?.overrideRank || 0) > 0;
  const visibleStudents = sheet?.students?.filter(student => sheet.permissions?.canManageProfiles || student.rows.length > 0) || [];
  const workflowSteps = buildWorkflowSteps(sheet);
  const totalRows = visibleStudents.reduce((sum, student) => sum + student.rows.length, 0);
  const caComponentDefinitions = normalizeCaComponentDefinitions(sheet?.settings);
  const scoreModel = resolveResultScoreModel(sheet?.settings);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className={`${RESULT_SURFACE} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2447d8] text-white">📊</span>
          <div className="min-w-0">
            <h1 className={`text-lg font-black leading-tight ${RESULT_HEADING}`}>CA Score Sheet</h1>
            <p className={`truncate text-xs ${RESULT_BODY}`}>
              {dashboardLabel}{sheet?.period ? ` • ${sheet.period.termName || ''}${sheet.period.sessionName && !isPractice ? ` ${sheet.period.sessionName}` : ''}` : ''}
            </p>
          </div>
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
          <select value={classId} onChange={event => setClassId(event.target.value)} className={`${RESULT_INPUT} min-w-[220px]`}>
            {assignedClasses.map(item => (
              <option key={item.id} value={item.id}>{item.className || item.name || item.id}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={persistScores}
            disabled={saving || !sheet?.configurationReady}
            className={RESULT_BUTTON}
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
          {sheet?.permissions?.canManageProfiles && (
            <button
              type="button"
              onClick={persistProfiles}
              disabled={saving || !sheet?.configurationReady}
              className={RESULT_BUTTON}
            >
              Save Profiles
            </button>
          )}
          {sheet?.submitted || practicePublished ? (
            <button type="button" onClick={reopenBatch} disabled={saving} className={RESULT_SECONDARY_BUTTON}>Reopen Draft</button>
          ) : (
            sheet?.permissions?.canSubmit && <button type="button" onClick={submitBatch} disabled={saving || !sheet?.configurationReady} className={RESULT_BUTTON}>Submit to HoS</button>
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

      {error && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#ffffff] border-rose-300/30 bg-rose-200/65 dark:bg-[#800000]/70`}>{error}</section>}
      {message && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#1a5c38] dark:text-[#00ffff] border-emerald-300/30 bg-emerald-100/70 dark:bg-[#800000]/70`}>{message}</section>}

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
        <div className={`${RESULT_SURFACE} flex flex-wrap gap-2 p-1.5`}>
          {[
            { key: 'sheet', label: 'Score Sheet', icon: '📝' },
            { key: 'broadsheet', label: 'Broadsheet Ranking', icon: '🏆' },
            { key: 'preview', label: 'Student View', icon: '👁️' },
            { key: 'log', label: 'Override Log', icon: '🧾' },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === t.key ? 'bg-[#2447d8] text-white shadow-lg shadow-[#2447d8]/25' : 'text-[#2447d8] hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10'}`}
            >
              <span>{t.icon}</span><span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {sheet && activeTab === 'sheet' && (
        <>
        <section className={`${RESULT_SURFACE} p-6 space-y-6`}>
          {/* Live Sheet Summary — compact card with animated icons */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7cc4e8]/40 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-slate-800/50">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2447d8]/10 text-base text-[#2447d8] motion-safe:animate-pulse">📡</span>
              <div className="min-w-0">
                <p className={`micro-label ${RESULT_LABEL}`}>Live Sheet Summary</p>
                <p className={`truncate text-sm font-semibold ${RESULT_HEADING}`}>
                  {sheet.classroom?.className || 'Assigned class'} · {sheet.period?.termName || 'Term'}{sheet.period?.sessionName ? ` ${sheet.period.sessionName}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getBatchTone(sheet.published ? 'published' : sheet.submitted ? 'submitted' : 'draft')}`}>
                <span className="motion-safe:animate-bounce">{sheet.published ? '✅' : sheet.submitted ? '📤' : '✏️'}</span>
                {sheet.published ? 'Published' : sheet.submitted ? 'Submitted' : 'Draft'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getBatchTone(sheet.configurationReady ? 'published' : 'draft')}`}>
                <span className="inline-block motion-safe:animate-spin" style={{ animationDuration: '4s' }}>{sheet.configurationReady ? '⚙️' : '⚠️'}</span>
                {sheet.configurationReady ? 'Configured' : 'Setup'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Learners</p>
              <p className={`mt-2 text-3xl font-black ${RESULT_HEADING}`}>{visibleStudents.length}</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Students with active score rows on this batch.</p>
            </article>
            <article className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Subject Rows</p>
              <p className={`mt-2 text-3xl font-black ${RESULT_HEADING}`}>{totalRows}</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Every row is clamped to CA {scoreModel.caMaxScore}, exam {scoreModel.examMaxScore}, total {scoreModel.totalMaxScore}.</p>
            </article>
            <article className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>CA Grid</p>
              <p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{caComponentDefinitions.length || 0} Columns</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Configured CA components roll up into the live CA total shown here.</p>
            </article>
            <article className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Release Rule</p>
              <p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>HoS Publish</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Only published batches flow to student and parent result views.</p>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Sheet Layout</p>
              <p className={`mt-2 text-sm ${RESULT_BODY}`}>
                NDOVERA expects a CA spreadsheet flow with subject rows, CA components rolled into a CA total, exam score, total, review, and release state. This live sheet presents the final CA total per subject while preserving the result-engine approval workflow.
              </p>
              {caComponentDefinitions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {caComponentDefinitions.map(component => (
                    <span key={component.key} className={`rounded-full border border-[#c9a96e]/45 bg-[#ade1f4] px-3 py-1 text-xs font-semibold ${RESULT_LABEL} dark:border-[#bf00ff]/35 dark:bg-black/20`}>
                      {component.label} ({component.maxScore})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <button type="button" onClick={() => setWorkflowOpen(open => !open)} className="flex w-full items-center justify-between gap-2" aria-expanded={workflowOpen}>
                <p className={`micro-label ${RESULT_LABEL}`}>Workflow</p>
                <span className={`text-lg leading-none text-[#2447d8] transition-transform duration-200 ${workflowOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {workflowOpen && (
                <div className="mt-3 grid gap-2">
                  {workflowSteps.map(step => (
                    <div key={step.id} className={`rounded-2xl border px-3 py-3 ${getWorkflowTone(step.state)}`}>
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="mt-1 text-xs opacity-90">{step.helper}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <CaHandInPanel sheet={sheet} onSheet={setSheet} />

          <div className="space-y-4">
          {visibleStudents.map((student, index) => (
            <TeacherResultStudentCard
              key={student.id}
              index={index}
              student={student}
              settings={sheet.settings}
              permissions={sheet.permissions}
              onCaComponentChange={handleCaComponentChange}
              onScoreChange={handleScoreChange}
              onProfileFieldChange={handleProfileFieldChange}
              onProfileMapChange={handleProfileMapChange}
            />
          ))}
          {visibleStudents.length === 0 && (
            <div className={`${RESULT_INNER_SURFACE} border-dashed p-5 text-center`}>
              <p className={`micro-label ${RESULT_LABEL}`}>No live result sheet</p>
              <p className={`mt-2 text-sm ${RESULT_BODY}`}>Student score rows will appear here after a real class roster and assessments are synced.</p>
            </div>
          )}
          </div>
        </section>
        </>
      )}

      {sheet && activeTab === 'broadsheet' && (
        <BroadsheetTable rows={sheet.broadsheet} title="Broadsheet Ranking (Live Preview)" />
      )}

      {sheet && activeTab === 'preview' && <ResultPreviewPanel sheet={sheet} refreshKey={refreshKey} />}

      {sheet && activeTab === 'log' && <ResultOverrideLog sheet={sheet} refreshKey={refreshKey} />}
    </div>
  );
}

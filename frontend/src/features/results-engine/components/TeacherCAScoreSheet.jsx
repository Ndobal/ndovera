import React, { useEffect, useRef, useState } from 'react';
import { getAssignedClasses } from '../../classroom/classroomService';
import {
  getTeacherScoreSheet,
  reopenTeacherResults,
  saveTeacherProfiles,
  saveTeacherScoreSheet,
  submitTeacherResults,
} from '../service/resultEngineService';
import { normalizeCaComponentDefinitions, recomputeTeacherSheet } from '../utils/resultEngineTransforms';
import BroadsheetTable from './BroadsheetTable';
import TeacherResultStudentCard from './TeacherResultStudentCard';
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

export default function TeacherCAScoreSheet({ dashboardLabel = 'Teacher Dashboard' }) {
  const [assignedClasses, setAssignedClasses] = useState([]);
  const storedClassIdRef = useRef(readStoredClassId());
  const [classId, setClassId] = useState(storedClassIdRef.current);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAssigned() {
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSheet() {
      if (!classId) return;
      setLoading(true);
      setError('');
      try {
        const nextSheet = await getTeacherScoreSheet({ classId });
        if (cancelled) return;
        setSheet(nextSheet);
        window.localStorage.setItem('teacherClassroomId', classId);
        window.localStorage.setItem('classroomId', classId);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load this CA score sheet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSheet();
    return () => {
      cancelled = true;
    };
  }, [classId]);

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
      setSheet(await saveTeacherScoreSheet(sheet));
      setMessage('CA score rows saved.');
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

  const visibleStudents = sheet?.students?.filter(student => sheet.permissions?.canManageProfiles || student.rows.length > 0) || [];
  const workflowSteps = buildWorkflowSteps(sheet);
  const totalRows = visibleStudents.reduce((sum, student) => sum + student.rows.length, 0);
  const caComponentDefinitions = normalizeCaComponentDefinitions(sheet?.settings);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className={`${RESULT_SURFACE} p-6 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>{dashboardLabel}</p>
          <h1 className={`text-3xl command-title mt-2 ${RESULT_HEADING}`}>CA Score Sheet</h1>
          <p className={`mt-2 max-w-3xl text-sm ${RESULT_BODY}`}>
            NDOVERA source of truth for continuous assessment, exam entry, attendance-linked profiles, and approval workflow.
            {sheet?.period ? ` ${sheet.period.termName || ''}${sheet.period.sessionName ? ` • ${sheet.period.sessionName}` : ''}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {sheet?.submitted ? (
            <button type="button" onClick={reopenBatch} disabled={saving} className={RESULT_SECONDARY_BUTTON}>Reopen Draft</button>
          ) : (
            sheet?.permissions?.canSubmit && <button type="button" onClick={submitBatch} disabled={saving || !sheet?.configurationReady} className={RESULT_BUTTON}>Submit to HoS</button>
          )}
        </div>
      </section>

      {error && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#ffffff] border-rose-300/30 bg-rose-200/65 dark:bg-[#800000]/70`}>{error}</section>}
      {message && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#1a5c38] dark:text-[#00ffff] border-emerald-300/30 bg-emerald-100/70 dark:bg-[#800000]/70`}>{message}</section>}

      {sheet && !sheet.configurationReady && (
        <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#39ff14] border-amber-300/30 bg-[#f0d090] dark:bg-[#800000]/70`}>
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
        <>
        <section className={`${RESULT_SURFACE} p-6 space-y-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className={`micro-label ${RESULT_LABEL}`}>Live Sheet Summary</p>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBatchTone(sheet.published ? 'published' : sheet.submitted ? 'submitted' : 'draft')}`}>
                  {sheet.published ? 'Published' : sheet.submitted ? 'Submitted' : 'Draft'}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBatchTone(sheet.configurationReady ? 'published' : 'draft')}`}>
                  {sheet.configurationReady ? 'Configured' : 'Configuration Needed'}
                </span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{sheet.classroom?.className || 'Assigned class'}</p>
              <p className={`text-xs ${RESULT_BODY}`}>{sheet.period?.termName || 'Term'}{sheet.period?.sessionName ? ` • ${sheet.period.sessionName}` : ''}</p>
              {sheet.publishedAt && <p className={`text-xs ${RESULT_BODY}`}>Published: {new Date(sheet.publishedAt).toLocaleString()}</p>}
              <p className={`text-xs ${RESULT_BODY}`}>Approver: {sheet.hosApprovedBy || (sheet.hosApproved ? 'HoS / Owner' : 'Pending')}</p>
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
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Every row is clamped to CA 40, exam 60, total 100.</p>
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
                    <span key={component.key} className={`rounded-full border border-[#c9a96e]/45 bg-[#f0d090] px-3 py-1 text-xs font-semibold ${RESULT_LABEL} dark:border-[#bf00ff]/35 dark:bg-black/20`}>
                      {component.label} ({component.maxScore})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Workflow</p>
              <div className="mt-3 grid gap-2">
                {workflowSteps.map(step => (
                  <div key={step.id} className={`rounded-2xl border px-3 py-3 ${getWorkflowTone(step.state)}`}>
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="mt-1 text-xs opacity-90">{step.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

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

      {sheet && <BroadsheetTable rows={sheet.broadsheet} title="Broadsheet Ranking (Live Preview)" />}
    </div>
  );
}

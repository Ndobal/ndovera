import React, { useEffect, useRef, useState } from 'react';
import { getAssignedClasses } from '../../classroom/classroomService';
import {
  getTeacherScoreSheet,
  reopenTeacherResults,
  saveTeacherProfiles,
  saveTeacherScoreSheet,
  submitTeacherResults,
} from '../service/resultEngineService';
import { recomputeTeacherSheet } from '../utils/resultEngineTransforms';
import BroadsheetTable from './BroadsheetTable';
import TeacherResultStudentCard from './TeacherResultStudentCard';

function readStoredClassId() {
  return window.localStorage.getItem('teacherClassroomId') || window.localStorage.getItem('classroomId') || '';
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="micro-label neon-subtle">{dashboardLabel}</p>
          <h1 className="text-3xl command-title neon-title">CA Score Sheet</h1>
          <p className="text-slate-300 mt-1">Single source of truth for result computation{sheet?.period ? ` • ${sheet.period.termName || ''} ${sheet.period.sessionName ? `• ${sheet.period.sessionName}` : ''}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={classId} onChange={event => setClassId(event.target.value)} className="rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100 min-w-[220px]">
            {assignedClasses.map(item => (
              <option key={item.id} value={item.id}>{item.className || item.name || item.id}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={persistScores}
            disabled={saving || !sheet?.configurationReady}
            className="px-4 py-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
          {sheet?.permissions?.canManageProfiles && (
            <button
              type="button"
              onClick={persistProfiles}
              disabled={saving || !sheet?.configurationReady}
              className="px-4 py-2 rounded-2xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-100 text-sm disabled:opacity-50"
            >
              Save Profiles
            </button>
          )}
          {sheet?.submitted ? (
            <button type="button" onClick={reopenBatch} disabled={saving} className="px-4 py-2 rounded-2xl border border-amber-300/30 bg-amber-500/20 text-amber-100 text-sm disabled:opacity-50">Reopen Draft</button>
          ) : (
            sheet?.permissions?.canSubmit && <button type="button" onClick={submitBatch} disabled={saving || !sheet?.configurationReady} className="px-4 py-2 rounded-2xl border border-indigo-300/30 bg-indigo-500/20 text-indigo-100 text-sm disabled:opacity-50">Submit to HoS</button>
          )}
        </div>
      </section>

      {error && <section className="glass-surface rounded-3xl p-6 text-sm text-rose-100 border border-rose-300/30 bg-rose-500/20">{error}</section>}
      {message && <section className="glass-surface rounded-3xl p-6 text-sm text-emerald-100 border border-emerald-300/30 bg-emerald-500/20">{message}</section>}

      {sheet && !sheet.configurationReady && (
        <section className="glass-surface rounded-3xl p-6 text-sm text-amber-100 border border-amber-300/30 bg-amber-500/20">
          {sheet.configurationError || 'Result settings are incomplete. Owner, HoS, or ICT must configure template, grading, and affective scales before CA entry can be saved.'}
        </section>
      )}

      {loading && <section className="glass-surface rounded-3xl p-6 text-slate-200">Loading CA score sheet...</section>}

      {!loading && !sheet && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="micro-label accent-amber">No assigned class</p>
          <p className="mt-2 text-slate-300">This user does not have any assigned result class yet.</p>
        </section>
      )}

      {sheet && (
        <section className="glass-surface rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="micro-label accent-indigo">Result State: {sheet.published ? 'Published' : sheet.submitted ? 'Submitted' : 'Draft'}</p>
          <div className="text-right">
            {sheet.publishedAt && <p className="text-xs text-slate-300">Published: {new Date(sheet.publishedAt).toLocaleString()}</p>}
            <p className="text-xs text-slate-300 mt-1">Approver: {sheet.hosApprovedBy || (sheet.hosApproved ? 'HoS / Owner' : 'Pending')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {visibleStudents.map(student => (
            <TeacherResultStudentCard
              key={student.id}
              student={student}
              settings={sheet.settings}
              permissions={sheet.permissions}
              onScoreChange={handleScoreChange}
              onProfileFieldChange={handleProfileFieldChange}
              onProfileMapChange={handleProfileMapChange}
            />
          ))}
          {visibleStudents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center bg-slate-900/20">
              <p className="micro-label accent-amber">No live result sheet</p>
              <p className="mt-2 text-sm text-slate-300">Student score rows will appear here after a real class roster and assessments are synced.</p>
            </div>
          )}
        </div>
      </section>
      )}

      {sheet && <BroadsheetTable rows={sheet.broadsheet} title="Broadsheet Ranking (Live Preview)" />}
    </div>
  );
}

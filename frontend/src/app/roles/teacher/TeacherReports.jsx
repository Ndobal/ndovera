import React, { useEffect, useState } from 'react';
import TeacherSectionShell from './TeacherSectionShell';
import { getAssignedClasses, getAssignments, getAttendance, getLiveSessions, getMaterials } from '../../../features/classroom/classroomService';
import ErrorPanel from '../../../shared/components/ErrorPanel';

function buildClassLabel(classroom) {
  return [classroom?.name, classroom?.arm].filter(Boolean).join(' ').trim() || classroom?.title || 'Class';
}

export default function TeacherReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState({ classes: [], summary: null });

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setError('');

      try {
        const response = await getAssignedClasses();
        if (!active) return;

        const assignedClasses = Array.isArray(response?.classes) ? response.classes : [];
        const classReports = await Promise.all(
          assignedClasses.map(async classroom => {
            const [assignmentsResponse, materialsResponse, attendanceResponse, liveResponse] = await Promise.all([
              getAssignments(classroom.id).catch(() => ({})),
              getMaterials(classroom.id).catch(() => ({})),
              getAttendance(classroom.id).catch(() => ({})),
              getLiveSessions(classroom.id).catch(() => ({})),
            ]);

            const assignments = Array.isArray(assignmentsResponse?.assignments) ? assignmentsResponse.assignments : [];
            const materials = Array.isArray(materialsResponse?.materials) ? materialsResponse.materials : [];
            const attendance = Array.isArray(attendanceResponse?.attendance) ? attendanceResponse.attendance : [];
            const liveSessions = Array.isArray(liveResponse?.sessions)
              ? liveResponse.sessions
              : Array.isArray(liveResponse?.liveSessions)
                ? liveResponse.liveSessions
                : [];
            const presentCount = attendance.filter(entry => String(entry?.status || '').toLowerCase() === 'present').length;
            const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

            return {
              id: classroom.id,
              label: buildClassLabel(classroom),
              assignments: assignments.length,
              materials: materials.length,
              liveSessions: liveSessions.length,
              attendanceMarked: attendance.length,
              attendanceRate,
            };
          })
        );

        if (!active) return;

        const totals = classReports.reduce((accumulator, classroom) => ({
          classes: accumulator.classes + 1,
          assignments: accumulator.assignments + classroom.assignments,
          materials: accumulator.materials + classroom.materials,
          liveSessions: accumulator.liveSessions + classroom.liveSessions,
          attendanceMarked: accumulator.attendanceMarked + classroom.attendanceMarked,
          attendanceRateSum: accumulator.attendanceRateSum + classroom.attendanceRate,
        }), {
          classes: 0,
          assignments: 0,
          materials: 0,
          liveSessions: 0,
          attendanceMarked: 0,
          attendanceRateSum: 0,
        });

        setReport({
          classes: classReports,
          summary: {
            ...totals,
            averageAttendanceRate: classReports.length ? Math.round(totals.attendanceRateSum / classReports.length) : 0,
          },
        });
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Could not load teacher reports.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReports();
    return () => {
      active = false;
    };
  }, []);

  const summary = report.summary || {
    classes: 0,
    assignments: 0,
    materials: 0,
    liveSessions: 0,
    attendanceMarked: 0,
    averageAttendanceRate: 0,
  };

  return (
    <TeacherSectionShell title="Reports & Analytics" subtitle="Live classroom, material, assignment, and attendance signals across your assigned classes.">
      {error && <ErrorPanel title="Teacher reports" message={error} onClose={() => setError('')} />}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/20 p-6 text-slate-300">Loading your live reports...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-3xl border border-white/10 bg-slate-900/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Assigned Classes</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.classes}</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Assignments</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.assignments}</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Published Materials</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.materials}</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live Sessions</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.liveSessions}</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Avg Attendance</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{summary.averageAttendanceRate}%</p>
            </article>
          </div>

          <section className="rounded-3xl border border-white/10 bg-slate-900/20 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Class Breakdown</h2>
                <p className="text-sm text-slate-400">Use this to spot classes that need intervention, reteach time, or more learning content.</p>
              </div>
              <button onClick={() => window.print()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10">Export / Print</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {report.classes.map(classroom => (
                <article key={classroom.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{classroom.label}</h3>
                      <p className="text-sm text-slate-400">Attendance marked: {classroom.attendanceMarked}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">{classroom.attendanceRate}% attendance</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Assignments</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{classroom.assignments}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Materials</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{classroom.materials}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Live</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{classroom.liveSessions}</p>
                    </div>
                  </div>
                </article>
              ))}

              {!report.classes.length && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
                  No assigned classes were found for this teacher yet.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </TeacherSectionShell>
  );
}
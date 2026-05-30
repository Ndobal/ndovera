import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentSectionShell from '../student/StudentSectionShell';
import { getLearningStudents, getLiveSessions, getPosts } from '../../../features/classroom/classroomService';
import { getParentResult } from '../../../features/results-engine/service/resultEngineService';
import {
  getExams,
  getFeeReceipts,
  getFeesLedger,
  getStudentAttendance,
} from '../../../features/school/services/schoolApi';
import PTAAttendanceEngine from '../../../features/pta-attendance/PTAAttendanceEngine';
import {
  readActiveParentChildId,
  resolveActiveParentChildId,
  writeActiveParentChildId,
} from './parentChildSelection';

const CARD = 'rounded-3xl border border-white/10 bg-slate-900/30 p-5';
const METRIC_CARD = 'glass-surface rounded-3xl p-5';

function normalizeArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function formatDateTime(value, fallback = 'Not scheduled') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function formatDate(value, fallback = 'Not set') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
}

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function normalizeAttendanceRate(records = []) {
  if (!records.length) return 0;
  const positiveStatuses = records.filter(record => {
    const status = String(record?.status || '').trim().toLowerCase();
    return status === 'present' || status === 'late';
  }).length;
  return Math.round((positiveStatuses / records.length) * 100);
}

function useParentLearners() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentIdState] = useState(() => readActiveParentChildId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    getLearningStudents()
      .then(response => {
        if (cancelled) return;
        const nextStudents = Array.isArray(response?.students) ? response.students : [];
        setStudents(nextStudents);
        setSelectedStudentIdState(currentStudentId => resolveActiveParentChildId(nextStudents, currentStudentId));
      })
      .catch(loadError => {
        if (cancelled) return;
        setStudents([]);
        setError(loadError instanceof Error ? loadError.message : 'Could not load linked children.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!students.length) return;
    const nextStudentId = resolveActiveParentChildId(students, selectedStudentId);
    if (nextStudentId && nextStudentId !== selectedStudentId) {
      setSelectedStudentIdState(nextStudentId);
    }
  }, [selectedStudentId, students]);

  const setSelectedStudentId = (studentId) => {
    const nextStudentId = String(studentId || '').trim();
    writeActiveParentChildId(nextStudentId);
    setSelectedStudentIdState(nextStudentId);
  };

  const selectedStudent = students.find(student => String(student?.id || '') === selectedStudentId) || students[0] || null;

  return {
    students,
    selectedStudent,
    selectedStudentId: selectedStudent ? String(selectedStudent.id || '') : String(selectedStudentId || ''),
    setSelectedStudentId,
    loading,
    error,
  };
}

function ParentLearnerPicker({
  students = [],
  selectedStudentId = '',
  onSelectStudent = () => {},
  loading = false,
  error = '',
  title = 'Active Child',
  subtitle = 'The selected child follows you across parent learning pages.',
}) {
  return (
    <section className="glass-surface rounded-3xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="micro-label neon-subtle">{title}</p>
          <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        </div>
        {students.length ? (
          <select
            value={selectedStudentId}
            onChange={event => onSelectStudent(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white"
          >
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.name}{student.className ? ` • ${student.className}` : ''}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-300">Loading linked learners...</p> : null}
      {!loading && !students.length ? <p className="text-sm text-amber-200">No linked child record is available yet.</p> : null}
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}

export function ParentOverviewPage() {
  const { students, selectedStudent, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();
  const [summary, setSummary] = useState({
    ledger: [],
    receipts: [],
    result: null,
    attendanceByStudentId: {},
    loading: true,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;

    if (!students.length) {
      setSummary(current => ({ ...current, ledger: [], receipts: [], result: null, attendanceByStudentId: {}, loading: false, error: '' }));
      return () => {
        cancelled = true;
      };
    }

    setSummary(current => ({ ...current, loading: true, error: '' }));

    Promise.all([
      getFeesLedger().catch(() => ({ ledger: [] })),
      getFeeReceipts().catch(() => ({ receipts: [] })),
      getParentResult(selectedStudentId || '').catch(() => null),
      Promise.all(
        students.map(async student => {
          const attendanceResult = await getStudentAttendance({ studentId: student.id, limit: 30 }).catch(() => ({ records: [] }));
          return [String(student.id || ''), normalizeArray(attendanceResult, ['records', 'attendance'])];
        }),
      ),
    ])
      .then(([ledgerResult, receiptResult, resultSummary, attendanceEntries]) => {
        if (cancelled) return;
        setSummary({
          ledger: normalizeArray(ledgerResult, ['ledger']),
          receipts: normalizeArray(receiptResult, ['receipts']),
          result: resultSummary,
          attendanceByStudentId: Object.fromEntries(attendanceEntries),
          loading: false,
          error: '',
        });
      })
      .catch(loadError => {
        if (cancelled) return;
        setSummary({
          ledger: [],
          receipts: [],
          result: null,
          attendanceByStudentId: {},
          loading: false,
          error: loadError instanceof Error ? loadError.message : 'Could not load parent analytics.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, students]);

  const ledgerByStudentId = useMemo(() => new Map(summary.ledger.map(entry => [String(entry?.studentId || entry?.id || ''), entry])), [summary.ledger]);
  const resultCountByStudentId = useMemo(() => {
    const counts = new Map();
    (summary.result?.publications || []).forEach(publication => {
      const studentId = String(publication?.studentId || publication?.student_id || summary.result?.activeStudentId || '').trim();
      if (!studentId) return;
      counts.set(studentId, Number(counts.get(studentId) || 0) + 1);
    });
    return counts;
  }, [summary.result]);

  const attendanceAverage = useMemo(() => {
    const rates = students
      .map(student => normalizeAttendanceRate(summary.attendanceByStudentId[String(student.id || '')] || []))
      .filter(rate => rate > 0);
    if (!rates.length) return 0;
    return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
  }, [students, summary.attendanceByStudentId]);

  const totalBalance = useMemo(() => students.reduce((sum, student) => sum + Number(ledgerByStudentId.get(String(student.id || ''))?.balance || 0), 0), [ledgerByStudentId, students]);

  const metrics = [
    { label: 'Linked Children', value: students.length },
    { label: 'Average Attendance', value: `${attendanceAverage}%` },
    { label: 'Open Balance', value: formatNaira(totalBalance) },
    { label: 'Receipts This Term', value: summary.receipts.length },
  ];

  return (
    <StudentSectionShell
      title="Overview"
      subtitle="Track linked children, classroom visibility, attendance, fees, results, and performance from one parent analytics page."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Overview"
    >
      <div className="space-y-6">
        <ParentLearnerPicker
          students={students}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          loading={loading}
          error={error}
          title="Parent Analytics"
          subtitle="Your active child is used across attendance, materials, assignments, results, and fees so parent work stays simple."
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => (
            <article key={metric.label} className={METRIC_CARD}>
              <p className="micro-label neon-subtle">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-100">{metric.value}</p>
            </article>
          ))}
        </section>

        {summary.error ? <section className="glass-surface rounded-3xl p-5 text-sm text-rose-200">{summary.error}</section> : null}
        {summary.loading ? <section className="glass-surface rounded-3xl p-5 text-sm text-slate-300">Loading parent analytics...</section> : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <article className={CARD}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="micro-label neon-subtle">Active Child Performance</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">{selectedStudent?.name || 'No active child'}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedStudent?.className || 'No class assigned yet'}</p>
              </div>
              {selectedStudent ? <span className="glass-chip rounded-full px-3 py-1 micro-label accent-emerald">{selectedStudent.displayId || 'Learner'}</span> : null}
            </div>

            {selectedStudent ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="micro-label accent-indigo">Attendance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{normalizeAttendanceRate(summary.attendanceByStudentId[String(selectedStudent.id || '')] || [])}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="micro-label accent-amber">Published Results</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{Number(resultCountByStudentId.get(String(selectedStudent.id || '')) || 0)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="micro-label accent-rose">Outstanding Fees</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNaira(ledgerByStudentId.get(String(selectedStudent.id || ''))?.balance || 0)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="micro-label accent-emerald">Recent Receipt</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {formatDate(
                      (summary.receipts || []).find(receipt => String(receipt?.studentId || '') === String(selectedStudent.id || ''))?.recordedAt,
                      'No receipt yet',
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-amber-200">No linked child record is available yet.</p>
            )}
          </article>

          <article className={CARD}>
            <p className="micro-label neon-subtle">Quick Parent Actions</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'View Materials', to: '/roles/parent/materials' },
                { label: 'Check Assignments', to: '/roles/parent/assignments' },
                { label: 'Open Results', to: '/roles/parent/results' },
                { label: 'Review Fees', to: '/roles/parent/fees' },
                { label: 'Open Messaging', to: '/roles/parent/messaging' },
                { label: 'Read Newsroom', to: '/roles/parent/newsroom' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/25 p-4">
              <p className="micro-label accent-indigo">Performance Has Moved Here</p>
              <p className="mt-2 text-sm text-slate-300">
                Academic performance now sits inside Overview, alongside attendance, fees, and result publication activity for each linked child.
              </p>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map(student => {
            const attendanceRate = normalizeAttendanceRate(summary.attendanceByStudentId[String(student.id || '')] || []);
            const ledgerEntry = ledgerByStudentId.get(String(student.id || '')) || {};
            return (
              <article key={student.id} className={CARD}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{student.name}</h3>
                    <p className="mt-1 text-sm text-slate-300">{student.className || 'Class pending'}{student.displayId ? ` • ${student.displayId}` : ''}</p>
                  </div>
                  {String(student.id || '') === String(selectedStudentId || '') ? <span className="glass-chip rounded-full px-3 py-1 micro-label accent-emerald">Active</span> : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">Attendance: <strong>{attendanceRate}%</strong></div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">Balance: <strong>{formatNaira(ledgerEntry.balance || 0)}</strong></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedStudentId(student.id)} className="rounded-2xl bg-emerald-500/30 px-4 py-2 text-sm font-semibold text-white">
                    Use This Child
                  </button>
                  <Link to="/roles/parent/results" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">Results</Link>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentChildrenPage() {
  const { students, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();

  return (
    <StudentSectionShell
      title="Children"
      subtitle="Switch between linked children quickly and carry that active learner across the parent dashboard."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Children"
    >
      <div className="space-y-6">
        <ParentLearnerPicker
          students={students}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          loading={loading}
          error={error}
          title="Easy Child Switcher"
          subtitle="Tap a child card or the switcher once. The same child becomes active in materials, assignments, attendance, results, and fees."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map(student => (
            <article key={student.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{student.name}</h2>
                  <p className="mt-1 text-sm text-slate-300">{student.className || 'Class pending'}{student.displayId ? ` • ${student.displayId}` : ''}</p>
                </div>
                {String(student.id || '') === String(selectedStudentId || '') ? <span className="glass-chip rounded-full px-3 py-1 micro-label accent-emerald">Active Child</span> : null}
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  { label: 'Materials', to: '/roles/parent/materials' },
                  { label: 'Assignments', to: '/roles/parent/assignments' },
                  { label: 'Attendance', to: '/roles/parent/attendance' },
                  { label: 'Results', to: '/roles/parent/results' },
                ].map(link => (
                  <Link key={link.to} to={link.to} className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm font-semibold text-slate-100">
                    {link.label}
                  </Link>
                ))}
              </div>
              <button type="button" onClick={() => setSelectedStudentId(student.id)} className="mt-4 rounded-2xl bg-emerald-500/30 px-4 py-3 text-sm font-semibold text-white">
                Set As Active Child
              </button>
            </article>
          ))}

          {!loading && !students.length ? (
            <article className="rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-6 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
              No linked child has been assigned to this parent account yet.
            </article>
          ) : null}
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentClassroomPage() {
  const { students, selectedStudent, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();
  const [classroomState, setClassroomState] = useState({ posts: [], liveSessions: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    if (!selectedStudent?.classId) {
      setClassroomState({ posts: [], liveSessions: [], loading: false, error: '' });
      return () => {
        cancelled = true;
      };
    }

    setClassroomState(current => ({ ...current, loading: true, error: '' }));

    Promise.all([
      getPosts(selectedStudent.classId).catch(() => ({ posts: [] })),
      getLiveSessions(selectedStudent.classId).catch(() => ({ sessions: [] })),
    ])
      .then(([postsResult, liveResult]) => {
        if (cancelled) return;
        setClassroomState({
          posts: normalizeArray(postsResult, ['posts', 'stream', 'items']),
          liveSessions: normalizeArray(liveResult, ['sessions', 'liveSessions']),
          loading: false,
          error: '',
        });
      })
      .catch(loadError => {
        if (cancelled) return;
        setClassroomState({ posts: [], liveSessions: [], loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load the class view.' });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.classId]);

  return (
    <StudentSectionShell
      title="Classroom"
      subtitle="View-only classroom updates for the active child, including stream posts and live session notices."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Classroom"
    >
      <div className="space-y-6">
        <ParentLearnerPicker students={students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} loading={loading} error={error} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Class</p><p className="mt-3 text-2xl font-semibold text-slate-100">{selectedStudent?.className || 'Not assigned'}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Stream Posts</p><p className="mt-3 text-2xl font-semibold text-slate-100">{classroomState.posts.length}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Live Sessions</p><p className="mt-3 text-2xl font-semibold text-slate-100">{classroomState.liveSessions.length}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Access</p><p className="mt-3 text-2xl font-semibold text-slate-100">View Only</p></article>
        </section>

        {classroomState.error ? <section className="glass-surface rounded-3xl p-5 text-sm text-rose-200">{classroomState.error}</section> : null}
        {classroomState.loading ? <section className="glass-surface rounded-3xl p-5 text-sm text-slate-300">Loading classroom visibility...</section> : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <article className={CARD}>
            <h2 className="text-2xl font-semibold text-slate-100">Class Stream</h2>
            <p className="mt-2 text-sm text-slate-300">Teacher posts and class notices for the active child only.</p>
            <div className="mt-4 space-y-3">
              {classroomState.posts.slice(0, 8).map(post => (
                <article key={post.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-sm font-semibold text-slate-100">{post.title || post.authorName || 'Class update'}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300 whitespace-pre-wrap">{post.content || post.body || 'No text supplied.'}</p>
                  <p className="mt-3 text-xs text-slate-400">{formatDateTime(post.createdAt || post.created_at || post.updatedAt || post.updated_at, 'Recent')}</p>
                </article>
              ))}
              {!classroomState.loading && classroomState.posts.length === 0 ? <p className="text-sm text-slate-300">No classroom posts are visible yet.</p> : null}
            </div>
          </article>

          <article className={CARD}>
            <h2 className="text-2xl font-semibold text-slate-100">Live Notices</h2>
            <p className="mt-2 text-sm text-slate-300">Upcoming and recent live lessons linked to the active child class.</p>
            <div className="mt-4 space-y-3">
              {classroomState.liveSessions.slice(0, 8).map(session => (
                <article key={session.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{session.topic || session.subjectName || 'Live session'}</p>
                      <p className="mt-1 text-xs text-slate-400">{session.subjectName || 'General subject'} • {session.status || 'scheduled'}</p>
                    </div>
                    <span className="glass-chip rounded-full px-3 py-1 micro-label accent-indigo">{session.mode || 'Live'}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">Starts {formatDateTime(session.startedAt || session.startAt || session.createdAt, 'To be announced')}</p>
                </article>
              ))}
              {!classroomState.loading && classroomState.liveSessions.length === 0 ? <p className="text-sm text-slate-300">No live sessions are scheduled yet.</p> : null}
            </div>
          </article>
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentAttendancePage() {
  const { students, selectedStudent, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();
  const [attendanceState, setAttendanceState] = useState({ records: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    if (!selectedStudent?.id) {
      setAttendanceState({ records: [], loading: false, error: '' });
      return () => {
        cancelled = true;
      };
    }

    setAttendanceState(current => ({ ...current, loading: true, error: '' }));

    getStudentAttendance({ studentId: selectedStudent.id, limit: 60 })
      .then(response => {
        if (cancelled) return;
        setAttendanceState({ records: normalizeArray(response, ['records', 'attendance']), loading: false, error: '' });
      })
      .catch(loadError => {
        if (cancelled) return;
        setAttendanceState({ records: [], loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load attendance.' });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.id]);

  const presentCount = attendanceState.records.filter(record => String(record?.status || '').toLowerCase() === 'present').length;
  const lateCount = attendanceState.records.filter(record => String(record?.status || '').toLowerCase() === 'late').length;
  const absentCount = attendanceState.records.filter(record => String(record?.status || '').toLowerCase() === 'absent').length;

  return (
    <StudentSectionShell
      title="Attendance"
      subtitle="Daily attendance for the active child, with recent present, late, and absent trends."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Attendance"
    >
      <div className="space-y-6">
        <ParentLearnerPicker students={students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} loading={loading} error={error} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Records</p><p className="mt-3 text-3xl font-semibold text-slate-100">{attendanceState.records.length}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Present</p><p className="mt-3 text-3xl font-semibold text-slate-100">{presentCount}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Late</p><p className="mt-3 text-3xl font-semibold text-slate-100">{lateCount}</p></article>
          <article className={METRIC_CARD}><p className="micro-label neon-subtle">Absent</p><p className="mt-3 text-3xl font-semibold text-slate-100">{absentCount}</p></article>
        </section>

        {attendanceState.error ? <section className="glass-surface rounded-3xl p-5 text-sm text-rose-200">{attendanceState.error}</section> : null}
        {attendanceState.loading ? <section className="glass-surface rounded-3xl p-5 text-sm text-slate-300">Loading attendance...</section> : null}

        <section className={CARD}>
          <h2 className="text-2xl font-semibold text-slate-100">Recent Attendance</h2>
          <div className="mt-4 space-y-3">
            {attendanceState.records.slice(0, 20).map(record => (
              <article key={record.id || `${record.date}-${record.status}`} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{formatDate(record.date, 'Date not recorded')}</p>
                    <p className="mt-1 text-xs text-slate-400">{selectedStudent?.name || 'Learner'}</p>
                  </div>
                  <span className="glass-chip rounded-full px-3 py-1 micro-label accent-emerald">{record.status || 'Unknown'}</span>
                </div>
                {record.reason ? <p className="mt-3 text-sm text-slate-300">{record.reason}</p> : null}
              </article>
            ))}
            {!attendanceState.loading && attendanceState.records.length === 0 ? <p className="text-sm text-slate-300">No attendance record is available for the active child yet.</p> : null}
          </div>
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentLivePage() {
  const { students, selectedStudent, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();
  const [liveState, setLiveState] = useState({ sessions: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    if (!selectedStudent?.classId) {
      setLiveState({ sessions: [], loading: false, error: '' });
      return () => {
        cancelled = true;
      };
    }

    setLiveState(current => ({ ...current, loading: true, error: '' }));

    getLiveSessions(selectedStudent.classId)
      .then(response => {
        if (cancelled) return;
        setLiveState({ sessions: normalizeArray(response, ['sessions', 'liveSessions']), loading: false, error: '' });
      })
      .catch(loadError => {
        if (cancelled) return;
        setLiveState({ sessions: [], loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load live sessions.' });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.classId]);

  return (
    <StudentSectionShell
      title="Live"
      subtitle="View-only live class timetable and session status for the active child."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Live"
    >
      <div className="space-y-6">
        <ParentLearnerPicker students={students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} loading={loading} error={error} />
        {liveState.error ? <section className="glass-surface rounded-3xl p-5 text-sm text-rose-200">{liveState.error}</section> : null}
        {liveState.loading ? <section className="glass-surface rounded-3xl p-5 text-sm text-slate-300">Loading live schedule...</section> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liveState.sessions.map(session => (
            <article key={session.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{session.topic || session.subjectName || 'Live class'}</h2>
                  <p className="mt-1 text-sm text-slate-300">{session.subjectName || 'General subject'}</p>
                </div>
                <span className="glass-chip rounded-full px-3 py-1 micro-label accent-indigo">{session.status || 'scheduled'}</span>
              </div>
              <p className="mt-4 text-sm text-slate-300">Starts {formatDateTime(session.startedAt || session.startAt || session.createdAt, 'To be announced')}</p>
              {session.createdByName ? <p className="mt-2 text-xs text-slate-400">By {session.createdByName}</p> : null}
            </article>
          ))}

          {!liveState.loading && liveState.sessions.length === 0 ? (
            <article className="rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-6 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
              No live class timetable is available for the active child yet.
            </article>
          ) : null}
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentExamSchedulePage() {
  const { students, selectedStudentId, setSelectedStudentId, loading, error } = useParentLearners();
  const [examState, setExamState] = useState({ exams: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    setExamState(current => ({ ...current, loading: true, error: '' }));

    getExams()
      .then(response => {
        if (cancelled) return;
        setExamState({ exams: normalizeArray(response, ['exams']), loading: false, error: '' });
      })
      .catch(loadError => {
        if (cancelled) return;
        setExamState({ exams: [], loading: false, error: loadError instanceof Error ? loadError.message : 'Could not load exam timetable.' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudentSectionShell
      title="Exams"
      subtitle="View-only exam timetable for school assessments linked to your child account."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Exams"
    >
      <div className="space-y-6">
        <ParentLearnerPicker students={students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} loading={loading} error={error} />
        {examState.error ? <section className="glass-surface rounded-3xl p-5 text-sm text-rose-200">{examState.error}</section> : null}
        {examState.loading ? <section className="glass-surface rounded-3xl p-5 text-sm text-slate-300">Loading exam timetable...</section> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {examState.exams.map(exam => (
            <article key={exam.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{exam.title || 'Exam'}</h2>
                  <p className="mt-1 text-sm text-slate-300">{exam.mode || 'CBT'} • {exam.window || 'Schedule to be announced'}</p>
                </div>
                <span className="glass-chip rounded-full px-3 py-1 micro-label accent-amber">{Array.isArray(exam.questions) ? exam.questions.length : Number(exam.questionCount || 0)} questions</span>
              </div>
              <p className="mt-4 text-sm text-slate-300">Created {formatDateTime(exam.createdAt || exam.updatedAt, 'Recently')}</p>
            </article>
          ))}

          {!examState.loading && examState.exams.length === 0 ? (
            <article className="rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-6 text-sm text-slate-300 md:col-span-2 xl:col-span-3">
              No exam timetable has been published yet.
            </article>
          ) : null}
        </section>
      </div>
    </StudentSectionShell>
  );
}

export function ParentPtaPage() {
  return (
    <StudentSectionShell
      title="PTA Attendance"
      subtitle="Review PTA meeting participation and check-in records from the parent account."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent PTA"
    >
      <PTAAttendanceEngine userRole="parent" />
    </StudentSectionShell>
  );
}
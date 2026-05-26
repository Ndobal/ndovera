import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getAssignments, getLearningStudents, getMaterials } from './classroomService';

const SHELL_CONFIG = {
  assignments: {
    title: 'Assignments',
    subtitle: 'Review teacher-created tasks for each linked child without switching into the student account.',
    watermarkText: 'Parent Assignments',
    emptyTitle: 'No live assignments',
    emptyCopy: 'Assignments will appear here once teachers publish them for your linked child.',
  },
  practice: {
    title: 'Practice',
    subtitle: 'Monitor practice-ready work and revision materials for each linked child from one parent view.',
    watermarkText: 'Parent Practice',
    emptyTitle: 'No practice yet',
    emptyCopy: 'Practice-ready work will appear once teachers publish assignments or class materials.',
  },
};

function formatDueDate(value) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatAssignmentType(format) {
  const normalized = String(format || '').toLowerCase();
  if (normalized === 'mcq') return 'MCQ';
  if (normalized === 'shortanswer') return 'Short Answer';
  if (normalized === 'fillgaps') return 'Fill In The Blanks';
  if (normalized === 'crossmatching') return 'Cross Matching';
  if (normalized === 'essay') return 'Essay';
  if (normalized === 'comprehension') return 'Comprehension';
  if (normalized === 'longanswer') return 'Long Answer';
  if (normalized === 'mixed') return 'Mixed Format';
  return 'Assignment';
}

function toTimestamp(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getSubjectName(item) {
  return String(item?.subjectName || item?.metadata?.subjectName || 'General Subject').trim() || 'General Subject';
}

export default function ParentLearningBoard({ mode = 'assignments' }) {
  const config = SHELL_CONFIG[mode] || SHELL_CONFIG.assignments;
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedStudent = students.find(student => student.id === selectedStudentId) || students[0] || null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getLearningStudents()
      .then(response => {
        if (cancelled) return;
        const nextStudents = Array.isArray(response?.students) ? response.students : [];
        setStudents(nextStudents);
        setSelectedStudentId(currentStudentId => (
          nextStudents.some(student => student.id === currentStudentId)
            ? currentStudentId
            : String(nextStudents[0]?.id || '')
        ));
      })
      .catch(err => {
        if (!cancelled) {
          setStudents([]);
          setError(err instanceof Error ? err.message : 'Could not load your linked children.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStudent?.classId) {
      setAssignments([]);
      setMaterials([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      getAssignments(selectedStudent.classId)
        .then(response => (Array.isArray(response?.assignments) ? response.assignments : [])),
      mode === 'practice'
        ? getMaterials(selectedStudent.classId, { studentId: selectedStudent.id })
            .then(response => (Array.isArray(response?.materials) ? response.materials : []))
        : Promise.resolve([]),
    ])
      .then(([nextAssignments, nextMaterials]) => {
        if (cancelled) return;
        setAssignments(nextAssignments);
        setMaterials(nextMaterials);
      })
      .catch(err => {
        if (!cancelled) {
          setAssignments([]);
          setMaterials([]);
          setError(err instanceof Error ? err.message : `Could not load ${mode}.`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, selectedStudent?.classId, selectedStudent?.id]);

  const groupedSubjects = useMemo(() => {
    const subjectMap = new Map();

    assignments.forEach(assignment => {
      const subjectName = getSubjectName(assignment);
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subjectName,
          items: [],
          materialCount: 0,
          formats: new Set(),
        });
      }

      const entry = subjectMap.get(subjectName);
      entry.items.push(assignment);
      entry.formats.add(formatAssignmentType(assignment?.format));
    });

    materials.forEach(material => {
      const subjectName = getSubjectName(material);
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subjectName,
          items: [],
          materialCount: 0,
          formats: new Set(),
        });
      }

      subjectMap.get(subjectName).materialCount += 1;
    });

    return Array.from(subjectMap.values())
      .map(entry => {
        const items = entry.items.slice().sort((left, right) => {
          const leftTime = toTimestamp(left?.dueAt);
          const rightTime = toTimestamp(right?.dueAt);
          if (leftTime && rightTime && leftTime !== rightTime) {
            return leftTime - rightTime;
          }
          if (leftTime && !rightTime) return -1;
          if (!leftTime && rightTime) return 1;
          return String(left?.title || '').localeCompare(String(right?.title || ''));
        });

        return {
          subjectName: entry.subjectName,
          items,
          materialCount: entry.materialCount,
          formatSummary: Array.from(entry.formats).filter(Boolean).join(', ') || 'Assignment',
          nextDue: items[0]?.dueAt ? formatDueDate(items[0].dueAt) : 'No due date',
          latestTitle: items[0]?.title || 'No published task yet',
        };
      })
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName));
  }, [assignments, materials]);

  const metrics = useMemo(() => {
    const dueThisWeek = assignments.filter(assignment => {
      const timestamp = toTimestamp(assignment?.dueAt);
      if (!timestamp) return false;
      const now = Date.now();
      return timestamp >= now && timestamp <= now + (7 * 24 * 60 * 60 * 1000);
    }).length;

    if (mode === 'practice') {
      return [
        { label: 'Practice Subjects', value: groupedSubjects.length },
        { label: 'Assignments', value: assignments.length },
        { label: 'Materials', value: materials.length },
        { label: 'Due This Week', value: dueThisWeek },
      ];
    }

    return [
      { label: 'Subjects', value: groupedSubjects.length },
      { label: 'Assignments', value: assignments.length },
      { label: 'Due This Week', value: dueThisWeek },
      { label: 'Linked Child', value: selectedStudent ? 1 : 0 },
    ];
  }, [assignments, groupedSubjects.length, materials.length, mode, selectedStudent]);

  return (
    <StudentSectionShell
      title={config.title}
      subtitle={config.subtitle}
      dashboardLabel="Parent Dashboard"
      watermarkText={config.watermarkText}
    >
      <div className="space-y-6">
        <section className="glass-surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label neon-subtle">Linked Learner</p>
              <p className="mt-2 text-slate-100 font-semibold">
                {selectedStudent ? `${selectedStudent.name}${selectedStudent.className ? ` • ${selectedStudent.className}` : ''}` : 'No linked child yet'}
              </p>
            </div>
            <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
              {students.map(student => (
                <option key={student.id} value={student.id}>{student.name}{student.className ? ` • ${student.className}` : ''}</option>
              ))}
            </select>
          </div>

          {!loading && !students.length ? <p className="text-sm text-amber-200">No linked child was found for this parent view yet.</p> : null}
          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        </section>

        {selectedStudent ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => (
              <article key={metric.label} className="glass-surface rounded-3xl p-5">
                <p className="micro-label neon-subtle">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-100">{metric.value}</p>
              </article>
            ))}
          </section>
        ) : null}

        <section className="glass-surface rounded-3xl p-6 space-y-4">
          {loading ? <p className="text-sm text-slate-300">Loading {mode}...</p> : null}

          {!loading && groupedSubjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-6 text-center">
              <p className="micro-label accent-amber">{config.emptyTitle}</p>
              <p className="mt-2 text-sm text-slate-300">{config.emptyCopy}</p>
            </div>
          ) : null}

          {!loading && mode === 'assignments' ? (
            <div className="space-y-5">
              {groupedSubjects.map(group => (
                <section key={group.subjectName} className="rounded-3xl border border-white/10 bg-slate-900/30 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-100">{group.subjectName}</h2>
                      <p className="mt-1 text-sm text-slate-300">{group.formatSummary}</p>
                    </div>
                    <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{group.items.length} assignment{group.items.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.items.map(item => (
                      <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-100">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-300">Due {formatDueDate(item.dueAt)}</p>
                            {item.description ? <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{item.description}</p> : null}
                          </div>
                          <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{formatAssignmentType(item.format)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {!loading && mode === 'practice' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupedSubjects.map(group => (
                <article key={group.subjectName} className="rounded-3xl border border-white/10 bg-slate-900/30 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-100">{group.subjectName}</p>
                      <p className="mt-1 text-sm text-slate-300">Next due: {group.nextDue}</p>
                    </div>
                    <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{group.items.length} task{group.items.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                      <p className="micro-label accent-emerald">Materials</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">{group.materialCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                      <p className="micro-label accent-amber">Formats</p>
                      <p className="mt-2 text-sm font-semibold text-slate-100">{group.formatSummary}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4">
                    <p className="micro-label accent-indigo">Latest task</p>
                    <p className="mt-2 text-sm text-slate-100">{group.latestTitle}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </StudentSectionShell>
  );
}
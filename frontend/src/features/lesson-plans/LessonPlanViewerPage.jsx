import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getLearningStudents, getLessonPlans } from '../school/services/schoolApi';

function formatDateTime(value, fallback = 'Available now') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function LessonPlanViewerPage({
  dashboardLabel = 'Student Dashboard',
  title = 'Lesson Plans',
  subtitle = 'See the approved lesson plans prepared for your learning week.',
  watermarkText = 'Lesson Plans',
  emptyMessage = 'Approved lesson plans will appear here once released by your school.',
}) {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [lessonPlans, setLessonPlans] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
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
        const audience = response?.students || [];
        setStudents(audience);
        setSelectedStudentId(currentStudentId => (
          audience.some(student => student.id === currentStudentId)
            ? currentStudentId
            : String(audience[0]?.id || '')
        ));
      })
      .catch(err => {
        if (!cancelled) {
          setStudents([]);
          setError(err instanceof Error ? err.message : 'Could not load your learning audience.');
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
      setLessonPlans([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getLessonPlans({ classId: selectedStudent.classId, studentId: selectedStudent.id })
      .then(response => {
        if (cancelled) return;
        setLessonPlans(response?.lessonPlans || []);
      })
      .catch(err => {
        if (!cancelled) {
          setLessonPlans([]);
          setError(err instanceof Error ? err.message : 'Could not load lesson plans.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.classId, selectedStudent?.id]);

  const subjectOptions = useMemo(() => Array.from(new Set(lessonPlans.map(plan => String(plan.subjectName || '').trim()).filter(Boolean))), [lessonPlans]);
  const weekOptions = useMemo(() => Array.from(new Set(lessonPlans.map(plan => String(plan.weekLabel || '').trim()).filter(Boolean))), [lessonPlans]);

  const filteredPlans = useMemo(() => lessonPlans.filter(plan => {
    const matchesSubject = subjectFilter === 'all' || String(plan.subjectName || '') === subjectFilter;
    const matchesWeek = weekFilter === 'all' || String(plan.weekLabel || '') === weekFilter;
    return matchesSubject && matchesWeek;
  }), [lessonPlans, subjectFilter, weekFilter]);

  return (
    <StudentSectionShell title={title} subtitle={subtitle} dashboardLabel={dashboardLabel} watermarkText={watermarkText}>
      <div className="space-y-6">
        <section className="glass-surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label neon-subtle">Learning Audience</p>
              <p className="text-slate-100 font-semibold mt-2">{selectedStudent ? `${selectedStudent.name}${selectedStudent.className ? ` • ${selectedStudent.className}` : ''}` : 'No active learner yet'}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                {students.map(student => (
                  <option key={student.id} value={student.id}>{student.name}{student.className ? ` • ${student.className}` : ''}</option>
                ))}
              </select>
              <select value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                <option value="all">All subjects</option>
                {subjectOptions.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
              <select value={weekFilter} onChange={event => setWeekFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                <option value="all">All weeks</option>
                {weekOptions.map(week => (
                  <option key={week} value={week}>{week}</option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p className="text-sm text-slate-300">Loading lesson plans...</p>}
          {!loading && !students.length && <p className="text-sm text-amber-200">No linked learner was found for lesson plans yet.</p>}
          {error && <p className="text-sm text-rose-200">{error}</p>}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredPlans.map(plan => (
            <article key={plan.id} className="glass-surface rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-slate-100">{plan.title}</p>
                  <p className="text-sm text-slate-300 mt-2">{plan.subjectName || 'Subject'}{plan.weekLabel ? ` • ${plan.weekLabel}` : ''}</p>
                </div>
                <span className="glass-chip rounded-full px-3 py-1 text-xs font-semibold text-slate-100">{plan.topic || 'General topic'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
                <p><span className="text-slate-100">Release:</span> {formatDateTime(plan.releaseAt, 'Immediately')}</p>
                <p><span className="text-slate-100">Teacher:</span> {plan.teacherName || 'Class teacher'}</p>
                {plan.liveSessionLabel && <p><span className="text-slate-100">Linked live class:</span> {plan.liveSessionLabel}</p>}
                <p><span className="text-slate-100">Updated:</span> {formatDateTime(plan.updatedAt, 'Recently')}</p>
              </div>

              {plan.objectives && (
                <div>
                  <p className="text-sm font-semibold text-slate-100">Objectives</p>
                  <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{plan.objectives}</p>
                </div>
              )}

              {plan.activities && (
                <div>
                  <p className="text-sm font-semibold text-slate-100">Activities</p>
                  <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{plan.activities}</p>
                </div>
              )}

              {plan.assessment && (
                <div>
                  <p className="text-sm font-semibold text-slate-100">Assessment</p>
                  <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{plan.assessment}</p>
                </div>
              )}

              {plan.notes && (
                <div>
                  <p className="text-sm font-semibold text-slate-100">Notes</p>
                  <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}

              {(plan.resources || []).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-100">Linked resources</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {plan.resources.map(resource => (
                      resource.url ? (
                        <a key={`${plan.id}-${resource.id || resource.url}`} href={resource.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                          {resource.title || 'Open resource'}
                        </a>
                      ) : (
                        <span key={`${plan.id}-${resource.id || resource.title}`} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
                          {resource.title || 'Attached classroom note'}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}

          {!loading && !error && filteredPlans.length === 0 && (
            <article className="glass-surface rounded-3xl p-6 xl:col-span-2">
              <p className="micro-label accent-amber">No approved lesson plans</p>
              <p className="mt-3 text-sm text-slate-300">{emptyMessage}</p>
            </article>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}
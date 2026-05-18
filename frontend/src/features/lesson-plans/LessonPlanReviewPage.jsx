import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getLessonPlans, reviewLessonPlan } from '../school/services/schoolApi';

function formatDateTime(value, fallback = 'Recently') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function getStatusTone(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100';
    case 'returned':
      return 'bg-rose-500/15 border-rose-300/40 text-rose-100';
    case 'submitted':
      return 'bg-amber-500/20 border-amber-300/40 text-amber-50';
    default:
      return 'bg-slate-950/30 border-white/10 text-slate-100';
  }
}

export default function LessonPlanReviewPage({ dashboardLabel = 'HOD Dashboard' }) {
  const [lessonPlans, setLessonPlans] = useState([]);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeReviewId, setActiveReviewId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getLessonPlans()
      .then(response => {
        if (cancelled) return;
        setLessonPlans(response?.lessonPlans || []);
      })
      .catch(err => {
        if (!cancelled) {
          setLessonPlans([]);
          setError(err instanceof Error ? err.message : 'Could not load lesson plans for review.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPlans = useMemo(() => (
    lessonPlans.filter(plan => statusFilter === 'all' || String(plan.status || '').toLowerCase() === statusFilter)
  ), [lessonPlans, statusFilter]);

  async function handleReview(lessonPlanId, status) {
    setActiveReviewId(lessonPlanId);
    setError('');
    setMessage('');

    try {
      const response = await reviewLessonPlan(lessonPlanId, {
        status,
        reviewComment: comments[lessonPlanId] || '',
      });

      const reviewedPlan = response?.lessonPlan;
      setLessonPlans(current => current.map(plan => (
        plan.id === reviewedPlan?.id ? reviewedPlan : plan
      )));
      setMessage(status === 'approved' ? 'Lesson plan approved.' : 'Lesson plan returned to teacher.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete review action.');
    } finally {
      setActiveReviewId('');
    }
  }

  return (
    <StudentSectionShell
      title="Lesson Plan Review"
      subtitle="Review submitted lesson plans, approve the ready ones, and return the weak ones with comments."
      dashboardLabel={dashboardLabel}
      watermarkText="Lesson Plan Review"
    >
      <div className="space-y-6">
        <section className="glass-surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label neon-subtle">Review Queue</p>
              <p className="text-slate-100 font-semibold mt-2">Use one queue to approve or return plans with guidance.</p>
            </div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="returned">Returned</option>
              <option value="draft">Draft</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          {loading && <p className="text-sm text-slate-300">Loading lesson plan review queue...</p>}
          {error && <p className="text-sm text-rose-200">{error}</p>}
          {message && <p className="text-sm text-emerald-200">{message}</p>}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredPlans.map(plan => (
            <article key={plan.id} className="glass-surface rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-slate-100">{plan.title}</p>
                  <p className="text-sm text-slate-300 mt-2">{plan.className || 'Class'} • {plan.subjectName || 'Subject'}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusTone(plan.status)}`}>
                  {plan.status || 'draft'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
                <p><span className="text-slate-100">Teacher:</span> {plan.teacherName || 'Teacher'}</p>
                <p><span className="text-slate-100">Week:</span> {plan.weekLabel || 'Not set'}</p>
                <p><span className="text-slate-100">Topic:</span> {plan.topic || 'Not set'}</p>
                <p><span className="text-slate-100">Release:</span> {formatDateTime(plan.releaseAt, 'Immediately')}</p>
                <p><span className="text-slate-100">Submitted:</span> {formatDateTime(plan.submittedAt, 'Not submitted yet')}</p>
                <p><span className="text-slate-100">Updated:</span> {formatDateTime(plan.updatedAt)}</p>
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

              <textarea
                value={comments[plan.id] ?? plan.reviewComment ?? ''}
                onChange={event => setComments(current => ({ ...current, [plan.id]: event.target.value }))}
                rows={4}
                placeholder="Add approval notes or return comments"
                className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={activeReviewId === plan.id}
                  onClick={() => handleReview(plan.id, 'approved')}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
                >
                  {activeReviewId === plan.id ? 'Working...' : 'Approve'}
                </button>
                <button
                  type="button"
                  disabled={activeReviewId === plan.id}
                  onClick={() => handleReview(plan.id, 'returned')}
                  className="rounded-2xl border border-rose-300/30 px-4 py-3 text-sm font-semibold text-rose-100 disabled:opacity-60"
                >
                  Return For Changes
                </button>
              </div>
            </article>
          ))}

          {!loading && !filteredPlans.length && (
            <article className="glass-surface rounded-3xl p-6 xl:col-span-2">
              <p className="micro-label accent-amber">No lesson plans in this queue</p>
              <p className="mt-3 text-sm text-slate-300">Submitted plans will appear here when teachers send them for review.</p>
            </article>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}
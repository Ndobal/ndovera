import React, { useEffect, useState } from 'react';
import { getAssignments, submitAssignment, getMySubmission } from '../classroomService';

const CARD = 'relative rounded-2xl border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-[#800000]/20 p-4 shadow-sm';
const LABEL = 'text-xs font-bold uppercase tracking-[0.15em] text-[#800020]';
const TITLE = 'text-base font-bold text-[#800000]';
const BODY = 'text-sm font-semibold text-[#191970]';
const INPUT_CLS = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 dark:bg-slate-900 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-[#800020] font-semibold';
const BTN_PRIMARY = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60';
const BTN_SECONDARY = 'bg-[#f5deb3] border border-[#c9a96e]/40 text-[#800020] font-bold px-4 py-2 rounded-2xl text-sm hover:bg-[#efd4a0] transition-colors';

function typeLabel(type) {
  const map = { mcq: 'MCQ', true_false: 'True/False', short_answer: 'Short Answer', essay: 'Essay', fill_blank: 'Fill in Blank', assignment: 'Assignment' };
  return map[type] || (type || 'Task');
}

function SubmissionModal({ assignment, onClose, onSubmitted }) {
  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
  const [answers, setAnswers] = useState({});
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const payload = questions.length > 0
        ? { answers }
        : { answers: { response: textAnswer } };
      const res = await submitAssignment(assignment.id, payload);
      if (res?.success) {
        onSubmitted(assignment.id, res.submission);
        onClose();
      } else {
        setError(res?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-[#c9a96e]/40 bg-[#fff8f0] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className={LABEL}>Assignment</p>
            <h2 className="text-xl font-bold text-[#800000]">{assignment.title}</h2>
            {assignment.description && <p className="mt-1 text-sm font-semibold text-[#191970]">{assignment.description}</p>}
            {assignment.dueAt && <p className="mt-1 text-xs text-[#800020] font-semibold">Due: {new Date(assignment.dueAt).toLocaleString()}</p>}
          </div>
          <button type="button" onClick={onClose} className="ml-2 text-[#800020] font-bold text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.length === 0 ? (
            <div>
              <label className={LABEL}>Your Response</label>
              <textarea
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                rows={5}
                className={INPUT_CLS + ' mt-1'}
                placeholder="Type your answer or response here..."
                required
              />
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={q.id || i} className="rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 space-y-2">
                <p className="text-sm font-bold text-[#800020] uppercase tracking-wide">{typeLabel(q.type)} — Q{i + 1}</p>
                <p className="font-bold text-[#191970] text-sm">{q.prompt || q.text || q.question}</p>
                {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-48 rounded-xl object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                {q.type === 'mcq' && Array.isArray(q.options) && (
                  <div className="space-y-1.5 mt-1">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${answers[q.id || i] === opt ? 'border-[#1a5c38] bg-[#1a5c38]/10' : 'border-[#c9a96e]/30 bg-white/70'}`}>
                        <input type="radio" name={q.id || String(i)} checked={answers[q.id || i] === opt} onChange={() => setAnswers(a => ({ ...a, [q.id || i]: opt }))} className="accent-[#1a5c38]" />
                        <span className="text-sm font-semibold text-[#191970]">{String.fromCharCode(65 + oi)}. {opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'true_false' && (
                  <div className="flex gap-3 mt-1">
                    {['True', 'False'].map(opt => (
                      <label key={opt} className={`flex items-center gap-2 rounded-xl border px-4 py-2 cursor-pointer transition-colors ${answers[q.id || i] === opt ? 'border-[#1a5c38] bg-[#1a5c38]/10' : 'border-[#c9a96e]/30 bg-white/70'}`}>
                        <input type="radio" name={q.id || String(i)} checked={answers[q.id || i] === opt} onChange={() => setAnswers(a => ({ ...a, [q.id || i]: opt }))} className="accent-[#1a5c38]" />
                        <span className="font-bold text-[#191970]">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                  <input value={answers[q.id || i] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id || i]: e.target.value }))} className={INPUT_CLS + ' mt-1'} placeholder="Your answer..." />
                )}
                {q.type === 'essay' && (
                  <textarea value={answers[q.id || i] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id || i]: e.target.value }))} rows={3} className={INPUT_CLS + ' mt-1'} placeholder="Write your essay response..." />
                )}
              </div>
            ))
          )}
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
              {submitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssignmentsTab({ classId = '' }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAssignment, setOpenAssignment] = useState(null);
  // submissionMap: { [assignmentId]: { submittedAt, grade, feedback } }
  const [submissionMap, setSubmissionMap] = useState({});

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    getAssignments(classId)
      .then(d => {
        const list = d?.assignments || [];
        setAssignments(list);
        // Load my submission status for each assignment
        list.forEach(a => {
          getMySubmission(a.id)
            .then(r => {
              if (r?.submission) {
                setSubmissionMap(prev => ({ ...prev, [a.id]: r.submission }));
              }
            })
            .catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  function handleSubmitted(assignmentId, submission) {
    setSubmissionMap(prev => ({ ...prev, [assignmentId]: submission || { submittedAt: new Date().toISOString() } }));
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-center">
        <p className="text-sm font-bold text-[#191970]">Loading assignments...</p>
      </section>
    );
  }

  if (!classId) {
    return (
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-center">
        <p className={LABEL}>No Class Linked</p>
        <p className="mt-2 text-sm font-semibold text-[#191970]">Your account is not yet assigned to a class. Contact your school admin.</p>
      </section>
    );
  }

  if (assignments.length === 0) {
    return (
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-center">
        <p className={LABEL}>No Assignments Yet</p>
        <p className="mt-2 text-sm font-semibold text-[#191970]">Your teacher has not published any assignments yet. Check back later.</p>
      </section>
    );
  }

  return (
    <div className="space-y-3 p-1">
      {assignments.map(assignment => {
        const sub = submissionMap[assignment.id];
        const isSubmitted = !!sub;
        const isGraded = sub?.grade != null;

        return (
          <div key={assignment.id} className={CARD}>
            {/* Submitted badge */}
            {isSubmitted && (
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#1a5c38] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#f5deb3] shadow">
                ✓ Submitted
              </div>
            )}
            {/* Graded badge (overlays submitted badge) */}
            {isGraded && (
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#800020] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#f5deb3] shadow">
                ★ Graded
              </div>
            )}

            <div className="pr-24">
              <p className={LABEL + ' mb-1'}>{assignment.subjectName || 'Assignment'} · {assignment.format ? assignment.format.toUpperCase() : 'TASK'}</p>
              <h3 className={TITLE}>{assignment.title}</h3>
              {assignment.description && <p className={BODY + ' mt-1'}>{assignment.description}</p>}
              {assignment.dueAt && (
                <p className="mt-1 text-xs font-semibold text-[#800020]">Due: {new Date(assignment.dueAt).toLocaleString()}</p>
              )}
            </div>

            {/* Grade display if marked */}
            {isGraded && (
              <div className="mt-3 rounded-xl border border-[#c9a96e]/30 bg-[#f0d090] p-3">
                <p className="text-xs font-bold text-[#800020] uppercase tracking-wide mb-1">Your Result</p>
                <p className="text-2xl font-bold text-[#1a5c38]">{sub.grade}<span className="text-sm font-semibold text-[#191970] ml-1">/ 100</span></p>
                {sub.feedback && <p className="mt-1 text-sm font-semibold text-[#191970] italic">"{sub.feedback}"</p>}
              </div>
            )}

            {/* Submission timestamp */}
            {isSubmitted && !isGraded && (
              <div className="mt-3 rounded-xl border border-[#c9a96e]/30 bg-[#f0d090] p-3">
                <p className="text-xs font-semibold text-[#1a5c38]">
                  Submitted on {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—'}
                </p>
                <p className="text-xs font-semibold text-[#800020] mt-0.5">Awaiting teacher review...</p>
              </div>
            )}

            {/* Action */}
            {!isSubmitted && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setOpenAssignment(assignment)}
                  className={BTN_PRIMARY}
                >
                  Open &amp; Submit
                </button>
              </div>
            )}
          </div>
        );
      })}

      {openAssignment && (
        <SubmissionModal
          assignment={openAssignment}
          onClose={() => setOpenAssignment(null)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}

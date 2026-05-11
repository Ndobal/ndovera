import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getAssignments, submitAssignment } from '../../../features/classroom/classroomService';

function getCurrentClassId() {
  const storedAuth = getStoredAuth();
  return localStorage.getItem('classroomId') || storedAuth?.user?.classId || '';
}

function typeLabel(type) {
  switch (String(type || '').toLowerCase()) {
    case 'mcq': return 'MCQ';
    case 'shortanswer': return 'Short Answer';
    case 'fillgaps': return 'Fill In The Blanks';
    case 'crossmatching': return 'Cross Matching';
    case 'essay': return 'Essay';
    case 'comprehension': return 'Comprehension';
    case 'longanswer': return 'Long Answer';
    case 'mixed': return 'Mixed Format';
    default: return 'Assignment';
  }
}

function formatDueDate(value) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function summarizeQuestionTypes(questions) {
  const labels = Array.from(new Set((questions || []).map(question => typeLabel(question.type)).filter(Boolean)));
  return labels.length ? labels.join(', ') : 'General assignment';
}

function AssignmentQuestion({ question, value, onChange }) {
  return (
    <article className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-slate-100 font-semibold">{question.prompt || 'Question'}</p>
        <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{typeLabel(question.type)}</span>
      </div>

      {question.passage && (
        <div className="rounded-2xl border border-white/10 p-4 bg-slate-800/40">
          <p className="micro-label accent-amber mb-2">Passage</p>
          <p className="text-slate-200 whitespace-pre-wrap">{question.passage}</p>
        </div>
      )}

      {question.imageUrl && (
        <img src={question.imageUrl} alt="question" className="w-full max-h-72 object-contain rounded-2xl border border-white/10 bg-slate-800/30" />
      )}

      {question.type === 'mcq' && (
        <div className="space-y-2">
          {(question.options || []).map((option, index) => (
            <label key={`${question.id}-${index}`} className="flex gap-2 items-start text-slate-200 text-sm">
              <input
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(question.id, option)}
              />
              <span>{String.fromCharCode(65 + index)}. {option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'shortanswer' && (
        <input
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="w-full rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
          placeholder="Type your short answer"
        />
      )}

      {question.type === 'fillgaps' && (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="w-full min-h-[96px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
          placeholder="Fill in the blanks. If there are multiple blanks, separate each answer with a comma."
        />
      )}

      {question.type === 'crossmatching' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(question.pairs || []).map((pair, index) => (
              <div key={`${question.id}-pair-${index}`} className="rounded-xl border border-white/10 p-3 bg-slate-800/30 text-sm text-slate-200">
                <p><span className="font-semibold">{pair.left}</span> ↔ {pair.right}</p>
              </div>
            ))}
          </div>
          <textarea
            value={value || ''}
            onChange={(event) => onChange(question.id, event.target.value)}
            className="w-full min-h-[96px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
            placeholder="Type your matching answers, for example: 1-A, 2-B, 3-C"
          />
        </div>
      )}

      {(question.type === 'essay' || question.type === 'longanswer' || question.type === 'comprehension') && (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="w-full min-h-[140px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
          placeholder="Write your answer here"
        />
      )}
    </article>
  );
}

function AssignmentDetail({ assignment, onSubmissionSaved }) {
  const [answers, setAnswers] = useState(assignment?.mySubmission?.content?.answers || {});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setAnswers(assignment?.mySubmission?.content?.answers || {});
    setNotice('');
    setError('');
  }, [assignment]);

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const response = await submitAssignment(assignment.id, { answers });
      if (!response?.success) {
        throw new Error(response?.message || response?.error || 'Could not submit assignment.');
      }
      onSubmissionSaved(assignment.id, response.submission);
      setNotice('Assignment submitted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/roles/student/assignments" className="inline-block glass-chip rounded-full px-4 py-2 micro-label accent-indigo">Back to assignments</Link>

      <section className="glass-surface rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl command-title neon-title">{assignment.title}</h2>
            <p className="neon-subtle mt-2">{assignment.subjectName || 'Subject'} • Due {formatDueDate(assignment.dueAt)}</p>
          </div>
          <span className={`glass-chip px-3 py-1 rounded-full micro-label ${assignment.mySubmission ? 'accent-emerald' : 'accent-amber'}`}>
            {assignment.mySubmission ? 'Submitted' : 'Pending'}
          </span>
        </div>
        <p className="text-slate-300 mt-4">{assignment.description || 'No additional teacher instructions were added.'}</p>
        <p className="micro-label mt-3 accent-indigo">{summarizeQuestionTypes(assignment.questions)}</p>
        {assignment.mySubmission?.submittedAt && (
          <p className="micro-label mt-2 accent-emerald">Last submitted {formatDueDate(assignment.mySubmission.submittedAt)}</p>
        )}
      </section>

      {error && <section className="rounded-3xl border border-rose-400/30 p-4 bg-rose-500/10 text-rose-100">{error}</section>}
      {notice && <section className="rounded-3xl border border-emerald-300/30 p-4 bg-emerald-500/10 text-emerald-100">{notice}</section>}

      <section className="space-y-4">
        {(assignment.questions || []).map(question => (
          <AssignmentQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={handleAnswer}
          />
        ))}
      </section>

      <section className="glass-surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-200">Save your answers by submitting this assignment when you are done.</p>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white font-semibold disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : assignment.mySubmission ? 'Resubmit Assignment' : 'Submit Assignment'}
        </button>
      </section>
    </div>
  );
}

export default function StudentAssignments() {
  const { assignmentId } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const classId = getCurrentClassId();
    if (!classId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    getAssignments(classId)
      .then(response => {
        if (!response?.success) {
          throw new Error(response?.message || 'Could not load assignments.');
        }
        setAssignments(response.assignments || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load assignments.'))
      .finally(() => setLoading(false));
  }, []);

  const groupedAssignments = useMemo(() => {
    const groups = assignments.reduce((accumulator, assignment) => {
      const subjectName = assignment.subjectName || 'General Subject';
      if (!accumulator[subjectName]) accumulator[subjectName] = [];
      accumulator[subjectName].push(assignment);
      return accumulator;
    }, {});

    return Object.entries(groups).map(([subjectName, items]) => ({
      subjectName,
      items,
    }));
  }, [assignments]);

  const selectedAssignment = useMemo(
    () => assignments.find(item => item.id === assignmentId),
    [assignments, assignmentId]
  );

  const handleSubmissionSaved = (targetAssignmentId, submission) => {
    setAssignments(prev => prev.map(item => (
      item.id === targetAssignmentId
        ? { ...item, mySubmission: submission, studentStatus: 'Submitted' }
        : item
    )));
  };

  if (!loading && assignmentId && !selectedAssignment) {
    return <Navigate to="/roles/student/assignments" replace />;
  }

  return (
    <StudentSectionShell title="Assignments" subtitle="See every teacher-created assignment by subject and work on them live.">
      {loading && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="neon-subtle">Loading assignments…</p>
        </section>
      )}

      {!loading && error && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="text-rose-300">{error}</p>
        </section>
      )}

      {!loading && !error && assignmentId && selectedAssignment && (
        <AssignmentDetail assignment={selectedAssignment} onSubmissionSaved={handleSubmissionSaved} />
      )}

      {!loading && !error && !assignmentId && (
        <div className="space-y-6">
          {groupedAssignments.length === 0 && (
            <section className="glass-surface rounded-3xl p-6 text-center">
              <p className="micro-label accent-amber">No live assignments</p>
              <p className="mt-2 text-sm text-slate-300">Assignments will appear here once your teacher publishes them to your class subjects.</p>
            </section>
          )}

          {groupedAssignments.map(group => (
            <section key={group.subjectName} className="glass-surface rounded-3xl p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl command-title neon-title">{group.subjectName}</h2>
                <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{group.items.length} assignment{group.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="space-y-3">
                {group.items.map(item => (
                  <Link key={item.id} to={`/roles/student/assignments/${item.id}`} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 flex items-center justify-between gap-3 hover:bg-indigo-500/10 transition-colors">
                    <div>
                      <p className="text-slate-100 font-semibold">{item.title}</p>
                      <p className="neon-subtle text-sm">Due {formatDueDate(item.dueAt)}</p>
                      <p className="micro-label mt-2 accent-amber">{summarizeQuestionTypes(item.questions)}</p>
                    </div>
                    <span className={`glass-chip px-3 py-1 rounded-full micro-label ${item.mySubmission ? 'accent-emerald' : 'accent-amber'}`}>
                      {item.mySubmission ? 'Submitted' : 'Work on it'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </StudentSectionShell>
  );
}

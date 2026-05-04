import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import { assignments } from './studentLearningData';

function AssignmentQuestion({ question, value, onChange }) {
  return (
    <article className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-3">
      <p className="text-slate-100 font-semibold">{question.text}</p>

      {question.image && (
        <img src={question.image} alt="question" className="w-full h-48 object-cover rounded-2xl border border-white/10" />
      )}

      {question.type === 'multiple-choice' && (
        <div className="space-y-2">
          {question.options.map(option => (
            <label key={option} className="flex gap-2 items-start text-slate-200 text-sm">
              <input
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(question.id, option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'short-answer' && (
        <input
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="w-full rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
          placeholder="Type your short answer"
        />
      )}

      {question.type === 'essay' && (
        <textarea
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="w-full min-h-[120px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
          placeholder="Write your essay answer"
        />
      )}

      {question.type === 'matching' && (
        <div className="space-y-2">
          {question.pairs.map(pair => (
            <div key={pair.left} className="rounded-xl border border-white/10 p-3 bg-slate-800/30 text-sm text-slate-200">
              <p><span className="font-semibold">{pair.left}</span> → {pair.right}</p>
            </div>
          ))}
          <textarea
            value={value || ''}
            onChange={(event) => onChange(question.id, event.target.value)}
            className="w-full min-h-[80px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
            placeholder="Type your matching answers"
          />
        </div>
      )}
    </article>
  );
}

function AssignmentDetail({ assignment, oldItem }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(Boolean(oldItem));

  if (oldItem) {
    return (
      <div className="space-y-4">
        <Link to="/roles/student/assignments" className="inline-block glass-chip rounded-full px-4 py-2 micro-label accent-indigo">Back to assignments</Link>
        <section className="glass-surface rounded-3xl p-6">
          <h2 className="text-2xl command-title neon-title">{oldItem.title}</h2>
          <p className="neon-subtle mt-2">{oldItem.subject} • Submitted {oldItem.submittedOn}</p>
          <div className="mt-4 rounded-2xl border border-white/10 p-4 bg-slate-900/30">
            <p className="text-slate-100 font-semibold">Teacher Review</p>
            <p className="text-slate-300 mt-2">{oldItem.teacherReview}</p>
            <p className="micro-label mt-3 accent-emerald">Mark: {oldItem.mark}</p>
          </div>
        </section>
      </div>
    );
  }

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  return (
    <div className="space-y-4">
      <Link to="/roles/student/assignments" className="inline-block glass-chip rounded-full px-4 py-2 micro-label accent-indigo">Back to assignments</Link>

      <section className="glass-surface rounded-3xl p-6">
        <h2 className="text-2xl command-title neon-title">{assignment.title}</h2>
        <p className="neon-subtle mt-2">{assignment.subject} • {assignment.teacher} • Due {assignment.due}</p>
        <p className="text-slate-300 mt-4">{assignment.instructions}</p>
        <p className="micro-label mt-3 accent-amber">Teachers can upload this from subjects only.</p>
      </section>

      <section className="space-y-4">
        {assignment.questions.map(question => (
          <AssignmentQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={handleAnswer}
          />
        ))}
      </section>

      <section className="glass-surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-200">{submitted ? 'Assignment submitted successfully.' : 'Check your answers before submitting.'}</p>
        <button
          onClick={() => setSubmitted(true)}
          className="px-5 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white font-semibold"
        >
          {submitted ? 'Submitted' : 'Submit Assignment'}
        </button>
      </section>

      {submitted && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="text-slate-100 font-semibold">Teacher Review</p>
          <p className="text-slate-300 mt-2">Your teacher will review and post score here. Once marked, you will see comments and final mark.</p>
          <p className="micro-label mt-3 accent-indigo">Status: Submitted and waiting for review</p>
        </section>
      )}
    </div>
  );
}

export default function StudentAssignments() {
  const { assignmentId } = useParams();
  const [showOld, setShowOld] = useState(false);

  const selectedAssignment = useMemo(
    () => assignments.newAssignments.find(item => item.id === assignmentId),
    [assignmentId]
  );

  const selectedOldItem = useMemo(
    () => assignments.oldByWeek.flatMap(group => group.items).find(item => item.id === assignmentId),
    [assignmentId]
  );

  if (assignmentId && !selectedAssignment && !selectedOldItem) {
    return <Navigate to="/roles/student/assignments" replace />;
  }

  return (
    <StudentSectionShell title="Assignments" subtitle="Do your assignments, submit, and check teacher review and marks.">
      {assignmentId ? (
        <AssignmentDetail assignment={selectedAssignment} oldItem={selectedOldItem} />
      ) : (
        <div className="space-y-6">
          <section className="glass-surface rounded-3xl p-6">
            <h2 className="text-xl command-title neon-title mb-4">New Assignments</h2>
            <div className="space-y-3">
              {assignments.newAssignments.map(item => (
                <Link key={item.id} to={`/roles/student/assignments/${item.id}`} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 flex items-center justify-between gap-3 hover:bg-indigo-500/10 transition-colors">
                  <div>
                    <p className="text-slate-100 font-semibold">{item.title}</p>
                    <p className="neon-subtle text-sm">{item.subject} • Due {item.due}</p>
                  </div>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-amber">New</span>
                </Link>
              ))}
              {assignments.newAssignments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
                  <p className="micro-label accent-amber">No live assignments</p>
                  <p className="mt-2 text-sm text-slate-300">New assignments will appear here once teachers publish them.</p>
                </div>
              )}
            </div>
          </section>

          <section className="glass-surface rounded-3xl p-6">
            <button
              onClick={() => setShowOld(prev => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="text-xl command-title neon-title">Old Assignments (Weekly Scaffold)</h2>
              <span className="ml-2 text-lg">{showOld ? '▲' : '▼'}</span>
            </button>
            {showOld && (
            <div className="space-y-4 mt-4">
              {assignments.oldByWeek.map(group => (
                <div key={group.week} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                  <p className="micro-label accent-indigo mb-3">{group.week}</p>
                  <div className="space-y-3">
                    {group.items.map(item => (
                      <Link key={item.id} to={`/roles/student/assignments/${item.id}`} className="rounded-2xl border border-white/10 p-4 bg-slate-800/40 flex items-center justify-between gap-3 hover:bg-indigo-500/10 transition-colors">
                        <div>
                          <p className="text-slate-100 font-semibold">{item.title}</p>
                          <p className="neon-subtle text-sm">{item.subject} • {item.submittedOn}</p>
                        </div>
                        <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{item.mark}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {assignments.oldByWeek.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
                  <p className="micro-label accent-amber">No archived assignments</p>
                  <p className="mt-2 text-sm text-slate-300">Reviewed assignment history will appear here after live submissions are marked.</p>
                </div>
              )}
            </div>
            )}
          </section>
        </div>
      )}
    </StudentSectionShell>
  );
}

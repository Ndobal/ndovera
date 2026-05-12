import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

function questionScore(question) {
  const numericScore = Number(question?.score);
  return Number.isFinite(numericScore) && numericScore > 0 ? numericScore : 1;
}

function assignmentTotalScore(questions = []) {
  return questions.reduce((total, question) => total + questionScore(question), 0);
}

function hashText(value) {
  return String(value || '').split('').reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function buildShuffledMatchingChoices(question) {
  const pairs = Array.isArray(question?.pairs) ? question.pairs : [];
  const seed = hashText(question?.id || question?.prompt || 'matching');
  return [...pairs]
    .map((pair, index) => ({
      id: String(pair?.id || `pair-${index}`),
      label: String(pair?.right || '').trim(),
      sortKey: hashText(`${seed}-${pair?.id || index}-${pair?.right || ''}`),
    }))
    .sort((left, right) => left.sortKey - right.sortKey || left.label.localeCompare(right.label));
}

function normalizeMatchingAnswer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function CrossMatchingQuestion({ question, value, onChange }) {
  const containerRef = useRef(null);
  const leftRefs = useRef({});
  const rightRefs = useRef({});
  const [selectedLeftId, setSelectedLeftId] = useState('');
  const [lines, setLines] = useState([]);

  const pairs = useMemo(() => (
    Array.isArray(question?.pairs) ? question.pairs.map((pair, index) => ({
      id: String(pair?.id || `pair-${index}`),
      left: String(pair?.left || '').trim(),
      right: String(pair?.right || '').trim(),
    })) : []
  ), [question?.pairs]);

  const matchingChoices = useMemo(() => buildShuffledMatchingChoices(question), [question]);
  const matchingValue = useMemo(() => normalizeMatchingAnswer(value), [value]);

  useEffect(() => {
    if (selectedLeftId && !pairs.some(pair => pair.id === selectedLeftId)) {
      setSelectedLeftId('');
    }
  }, [pairs, selectedLeftId]);

  useLayoutEffect(() => {
    function updateLines() {
      const container = containerRef.current;
      if (!container) {
        setLines([]);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const nextLines = Object.entries(matchingValue).map(([leftId, rightId]) => {
        const leftElement = leftRefs.current[leftId];
        const rightElement = rightRefs.current[rightId];
        if (!leftElement || !rightElement) return null;

        const leftRect = leftElement.getBoundingClientRect();
        const rightRect = rightElement.getBoundingClientRect();
        return {
          key: `${leftId}-${rightId}`,
          x1: leftRect.right - containerRect.left,
          y1: leftRect.top + (leftRect.height / 2) - containerRect.top,
          x2: rightRect.left - containerRect.left,
          y2: rightRect.top + (rightRect.height / 2) - containerRect.top,
        };
      }).filter(Boolean);

      setLines(nextLines);
    }

    const frameId = window.requestAnimationFrame(updateLines);
    window.addEventListener('resize', updateLines);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateLines);
    };
  }, [matchingChoices, matchingValue, pairs]);

  const handleLeftSelect = leftId => {
    setSelectedLeftId(currentLeftId => currentLeftId === leftId ? '' : leftId);
  };

  const handleRightSelect = rightId => {
    if (!selectedLeftId) return;

    const nextValue = { ...matchingValue };
    Object.keys(nextValue).forEach(leftId => {
      if (nextValue[leftId] === rightId && leftId !== selectedLeftId) {
        delete nextValue[leftId];
      }
    });

    if (nextValue[selectedLeftId] === rightId) {
      delete nextValue[selectedLeftId];
    } else {
      nextValue[selectedLeftId] = rightId;
    }

    onChange(question.id, nextValue);
    setSelectedLeftId('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Select a left item, then click the matching item on the right. Click the same pair again to remove the line.</p>

      <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/20 p-4">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map(line => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#34d399"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="relative z-10 grid grid-cols-[minmax(0,1fr),minmax(0,1fr)] gap-4">
          <div className="space-y-3 pr-3">
            {pairs.map((pair, index) => {
              const isSelected = selectedLeftId === pair.id;
              const isMatched = Boolean(matchingValue[pair.id]);
              return (
                <button
                  key={pair.id}
                  type="button"
                  ref={element => {
                    if (element) leftRefs.current[pair.id] = element;
                  }}
                  onClick={() => handleLeftSelect(pair.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${isSelected ? 'border-emerald-300/60 bg-emerald-500/15' : isMatched ? 'border-indigo-300/40 bg-indigo-500/10' : 'border-white/10 bg-slate-900/30 hover:bg-slate-900/45'}`}
                >
                  <div className="flex items-start gap-3">
                    <input type="radio" checked={isSelected} readOnly className="mt-1 h-4 w-4 accent-emerald-400 pointer-events-none" />
                    <div>
                      <p className="micro-label accent-indigo">Item {index + 1}</p>
                      <p className="mt-1 text-sm text-slate-100">{pair.left || 'Left item'}</p>
                    </div>
                  </div>
                  {isMatched && <span className="micro-label accent-emerald">Matched</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 pl-3">
            {matchingChoices.map((choice, index) => {
              const isLinked = Object.values(matchingValue).includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  ref={element => {
                    if (element) rightRefs.current[choice.id] = element;
                  }}
                  onClick={() => handleRightSelect(choice.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${selectedLeftId ? 'border-emerald-300/50 bg-emerald-500/10 hover:bg-emerald-500/20' : isLinked ? 'border-indigo-300/40 bg-indigo-500/10' : 'border-white/10 bg-slate-900/30 hover:bg-slate-900/45'}`}
                >
                  <div>
                    <p className="micro-label accent-amber">Match {index + 1}</p>
                    <p className="mt-1 text-sm text-slate-100">{choice.label || 'Right item'}</p>
                  </div>
                  {isLinked && <span className="micro-label accent-indigo">Linked</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentQuestion({ question, value, onChange, index }) {
  return (
    <article className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="micro-label accent-amber">Question {index + 1}</p>
          <p className="mt-1 text-slate-100 font-semibold">{question.prompt || 'Question'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{typeLabel(question.type)}</span>
          <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{questionScore(question)} pt{questionScore(question) === 1 ? '' : 's'}</span>
        </div>
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
        <CrossMatchingQuestion question={question} value={value} onChange={onChange} />
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
        <p className="micro-label mt-2 accent-emerald">Total Score {assignmentTotalScore(assignment.questions)}</p>
        {assignment.mySubmission?.submittedAt && (
          <p className="micro-label mt-2 accent-emerald">Last submitted {formatDueDate(assignment.mySubmission.submittedAt)}</p>
        )}
      </section>

      {error && <section className="rounded-3xl border border-rose-400/30 p-4 bg-rose-500/10 text-rose-100">{error}</section>}
      {notice && <section className="rounded-3xl border border-emerald-300/30 p-4 bg-emerald-500/10 text-emerald-100">{notice}</section>}

      <section className="space-y-4">
        {(assignment.questions || []).map((question, index) => (
          <AssignmentQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={handleAnswer}
            index={index}
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
                      <p className="micro-label mt-2 accent-emerald">Total Score {assignmentTotalScore(item.questions)}</p>
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

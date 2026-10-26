import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import { submitAssignment } from '../../../features/classroom/classroomService';
import { clearAnswerDraft, loadStudentAssignments, readAnswerDraft, saveAnswerDraft } from '../../../features/classroom/studentTasks';
import RichContent from '../../../shared/rich/RichContent';
import { CountdownBar, useTimedAttempt } from '../../../features/classroom/assignments/TimedAttempt';
import { subscribeChanges } from '../../../shared/offline/changeWatcher';
import { subscribe as subscribeOutbox } from '../../../shared/offline/outbox';

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

/** Where the work stands for the student: todo, overdue, submitted or marked. */
function statusOf(item, now = Date.now()) {
  if (item.mySubmission && hasTeacherReview(item.mySubmission) && item.mySubmission.grade != null) return 'marked';
  if (item.mySubmission) return 'submitted';
  const due = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
  return Number.isFinite(due) && due < now ? 'overdue' : 'todo';
}

function dueHint(value, now = Date.now()) {
  const due = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(due)) return { text: 'No due date', tone: 'text-slate-300' };
  const hours = (due - now) / 3600000;
  if (hours < 0) return { text: `Was due ${new Date(due).toLocaleDateString()}`, tone: 'text-rose-300' };
  if (hours < 24) return { text: `Due in ${Math.max(1, Math.round(hours))} h`, tone: 'text-amber-300' };
  if (hours < 72) return { text: `Due in ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'}`, tone: 'text-amber-200' };
  return { text: `Due ${new Date(due).toLocaleDateString()}`, tone: 'text-slate-300' };
}

const STATUS_CHIP = {
  todo: ['To do', 'bg-amber-400/25 text-amber-100 border-amber-300/40'],
  overdue: ['Overdue', 'bg-rose-500/25 text-rose-100 border-rose-300/40'],
  submitted: ['Submitted', 'bg-emerald-500/25 text-emerald-100 border-emerald-300/40'],
  queued: ['Waiting to send', 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/25 dark:text-sky-100 dark:border-sky-300/40'],
  marked: ['Marked', 'bg-indigo-500/30 text-indigo-100 border-indigo-300/40'],
};

function isAnswered(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
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

function hasTeacherReview(submission) {
  if (!submission) return false;
  return submission.grade != null || String(submission.feedback || '').trim() !== '';
}

function normalizeDisplayGrade(value) {
  const numericGrade = Number(value);
  return Number.isFinite(numericGrade) ? numericGrade : value;
}

function hashText(value) {
  return String(value || '').split('').reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

const CARD_COLORS = [
  'from-indigo-500/30 to-indigo-700/15 border-indigo-400/40',
  'from-emerald-500/30 to-emerald-700/15 border-emerald-400/40',
  'from-amber-500/30 to-amber-700/15 border-amber-400/40',
  'from-rose-500/30 to-rose-700/15 border-rose-400/40',
  'from-cyan-500/30 to-cyan-700/15 border-cyan-400/40',
  'from-fuchsia-500/30 to-fuchsia-700/15 border-fuchsia-400/40',
];
function cardColor(seed) {
  return CARD_COLORS[hashText(seed) % CARD_COLORS.length];
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
    <article id={`q-${index + 1}`} className={`scroll-mt-24 rounded-2xl border p-4 space-y-3 ${isAnswered(value) ? 'border-emerald-300/25 bg-slate-900/40' : 'border-white/10 bg-slate-900/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="micro-label accent-amber">Question {index + 1}</p>
          <RichContent className="mt-1 text-slate-100 font-semibold ndv-rich-ondark" text={question.prompt || 'Question'} />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{typeLabel(question.type)}</span>
          <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{questionScore(question)} pt{questionScore(question) === 1 ? '' : 's'}</span>
        </div>
      </div>

      {question.passage && (
        <div className="rounded-2xl border border-white/10 p-4 bg-slate-800/40">
          <p className="micro-label accent-amber mb-2">Passage</p>
          <RichContent className="text-slate-200" text={question.passage} />
        </div>
      )}

      {question.imageUrl && (
        <img src={question.imageUrl} alt="question" className="w-full max-h-72 object-contain rounded-2xl border border-white/10 bg-slate-800/30" />
      )}

      {question.type === 'mcq' && (
        <div className="grid gap-2" role="radiogroup" aria-label={`Question ${index + 1} options`}>
          {(question.options || []).map((option, optionIndex) => {
            const chosen = value === option;
            return (
              <button key={`${question.id}-${optionIndex}`} type="button" role="radio" aria-checked={chosen} onClick={() => onChange(question.id, option)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] transition ${chosen ? 'border-emerald-300/70 bg-emerald-500/20 text-white' : 'border-white/10 bg-slate-900/40 text-slate-100 hover:border-indigo-300/50 hover:bg-indigo-500/10'}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black ${chosen ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-200'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                <span className="min-w-0 flex-1 pt-0.5"><RichContent inline text={option} /></span>
              </button>
            );
          })}
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
  const submissionAnswers = useMemo(() => assignment?.mySubmission?.content?.answers || {}, [assignment?.mySubmission?.content?.answers]);
  const [answers, setAnswers] = useState(submissionAnswers);
  const touched = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const reviewed = hasTeacherReview(assignment?.mySubmission);
  const answeredCount = (assignment?.questions || []).filter(question => isAnswered(answers[question.id])).length;
  const displayGrade = normalizeDisplayGrade(assignment?.mySubmission?.grade);

  // Answers typed on this device come back after a reload or a dropped connection. Only a new
  // assignment or a new hand-in resets them, never a background refresh of the list.
  useEffect(() => {
    let active = true;
    touched.current = false;
    setAnswers(submissionAnswers);
    setNotice('');
    setError('');
    readAnswerDraft(assignment.id).then(draft => {
      if (!active || touched.current || !draft) return;
      const sentAt = assignment?.mySubmission?.submittedAt || '';
      if (sentAt && sentAt >= draft.savedAt) return;
      setAnswers(draft.answers);
      setNotice('Your answers saved on this device are back. Carry on where you stopped.');
    }).catch(() => null);
    return () => { active = false; };
  }, [assignment?.id, assignment?.mySubmission?.submittedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!touched.current) return undefined;
    const timer = setTimeout(() => { saveAnswerDraft(assignment.id, answers).catch(() => null); }, 400);
    return () => clearTimeout(timer);
  }, [assignment.id, answers]);

  const handleAnswer = (questionId, value) => {
    touched.current = true;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const response = await submitAssignment(assignment.id, { answers });
      if (!response?.success) {
        throw new Error(response?.message || response?.error || 'Could not submit assignment.');
      }
      touched.current = false;
      await clearAnswerDraft(assignment.id).catch(() => null);
      onSubmissionSaved(assignment.id, response.submission);
      setNotice(response.queued ? response.message : 'Assignment submitted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit assignment.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  // A timed assessment starts its clock when opened, unless it has already been handed in.
  const latestSubmit = useRef(handleSubmit);
  latestSubmit.current = handleSubmit;
  const [retake, setRetake] = useState(false);
  useEffect(() => { setRetake(false); }, [assignment?.id, assignment?.mySubmission?.submittedAt]);
  const timedWork = Number(assignment?.metadata?.durationMinutes) > 0;
  const attempt = useTimedAttempt(assignment, { enabled: !assignment?.mySubmission || retake, onTimeUp: () => latestSubmit.current() });
  // Viewing a finished timed attempt never starts the clock; a new attempt is a deliberate choice.
  const locked = (attempt.timed && !attempt.ready) || (timedWork && Boolean(assignment?.mySubmission) && !retake);

  return (
    <div className="space-y-4">
      <CountdownBar attempt={attempt} onDark />
      <Link to="/roles/student/assignments" className="inline-block glass-chip rounded-full px-4 py-2 micro-label accent-indigo">Back to assignments</Link>

      <section className="glass-surface rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl command-title neon-title">{assignment.title}</h2>
            <p className="neon-subtle mt-2">{assignment.subjectName || 'Subject'} • Due {formatDueDate(assignment.dueAt)}</p>
          </div>
          <span className={`glass-chip px-3 py-1 rounded-full micro-label ${assignment.mySubmission ? 'accent-emerald' : 'accent-amber'}`}>
            {assignment.mySubmission?.queued ? 'Waiting to send' : assignment.mySubmission ? 'Submitted' : 'Pending'}
          </span>
        </div>
        <p className="text-slate-300 mt-4">{assignment.description || 'No additional teacher instructions were added.'}</p>
        <p className="micro-label mt-3 accent-indigo">{summarizeQuestionTypes(assignment.questions)}</p>
        <p className="micro-label mt-2 accent-emerald">Total Score {assignmentTotalScore(assignment.questions)}</p>
        {assignment.mySubmission?.submittedAt && (
          <p className="micro-label mt-2 accent-emerald">Last submitted {formatDueDate(assignment.mySubmission.submittedAt)}</p>
        )}
      </section>

      {assignment.mySubmission && reviewed && (
        <section className="glass-surface rounded-3xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="micro-label accent-emerald">Teacher Review</p>
              {assignment.mySubmission?.grade != null && (
                <h3 className="mt-2 text-2xl command-title neon-title">Score {displayGrade}/{assignmentTotalScore(assignment.questions)}</h3>
              )}
              {assignment.mySubmission?.gradedAt && (
                <p className="neon-subtle mt-2">Reviewed {formatDueDate(assignment.mySubmission.gradedAt)}</p>
              )}
            </div>
            <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">Reviewed</span>
          </div>

          {assignment.mySubmission?.feedback && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
              <p className="micro-label accent-amber">Teacher Remark</p>
              <p className="mt-2 text-slate-100 whitespace-pre-wrap">{assignment.mySubmission.feedback}</p>
            </div>
          )}
        </section>
      )}

      {assignment.mySubmission?.queued && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="micro-label accent-amber">{assignment.mySubmission.status === 'needs_review' ? 'Not accepted' : 'Waiting to send'}</p>
          <p className="mt-2 text-slate-200">{assignment.mySubmission.status === 'needs_review'
            ? `Ndovera did not accept this hand-in: ${assignment.mySubmission.error || 'please tell your teacher.'}`
            : 'Your answers are saved on this device and will be sent by themselves when the internet is back. They count from when you pressed submit.'}</p>
        </section>
      )}

      {assignment.mySubmission && !assignment.mySubmission.queued && !reviewed && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="micro-label accent-amber">Awaiting Review</p>
          <p className="mt-2 text-slate-200">Your work has been submitted. Your teacher's score and remark will appear here once the review is complete.</p>
        </section>
      )}

      {error && <section className="rounded-3xl border border-rose-400/30 p-4 bg-rose-500/10 text-rose-100">{error}</section>}
      {notice && <section className="rounded-3xl border border-emerald-300/30 p-4 bg-emerald-500/10 text-emerald-100">{notice}</section>}

      {!locked && (assignment.questions || []).length > 1 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Questions">
          {(assignment.questions || []).map((question, index) => (
            <a key={question.id} href={`#q-${index + 1}`} className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${isAnswered(answers[question.id]) ? 'bg-emerald-400/80 text-slate-950' : 'bg-white/10 text-slate-200'}`} aria-label={`Question ${index + 1}${isAnswered(answers[question.id]) ? ', answered' : ''}`}>{index + 1}</a>
          ))}
        </nav>
      )}

      {!locked && <section className="space-y-4">
        {(assignment.questions || []).map((question, index) => (
          <AssignmentQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={handleAnswer}
            index={index}
          />
        ))}
      </section>}

      <section className="glass-surface sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 shadow-2xl sm:p-5">
        <div className="min-w-[10rem] flex-1">
          <p className="text-sm font-bold text-slate-100">{answeredCount} of {(assignment.questions || []).length} answered</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={(assignment.questions || []).length} aria-valuenow={answeredCount} aria-label="Answered">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${(assignment.questions || []).length ? (answeredCount / assignment.questions.length) * 100 : 0}%` }} />
          </div>
        </div>
        {timedWork && assignment.mySubmission && !retake ? (
          <button onClick={() => setRetake(true)} className="px-5 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white font-semibold">Start another attempt</button>
        ) : <button
          onClick={handleSubmit}
          disabled={submitting || locked}
          className="px-5 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white font-semibold disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : assignment.mySubmission ? 'Resubmit Assignment' : 'Submit Assignment'}
        </button>}
      </section>
    </div>
  );
}

export default function StudentAssignments() {
  const { assignmentId } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedCopy, setSavedCopy] = useState('');

  useEffect(() => {
    let isActive = true;

    async function refreshAssignments(showSpinner = false) {
      if (showSpinner) {
        setLoading(true);
        setError('');
      }
      try {
        const result = await loadStudentAssignments();
        if (isActive) {
          setAssignments(result.assignments);
          setSavedCopy(result.offline ? result.savedAt || 'unknown' : '');
          setError('');
        }
      } catch (err) {
        if (isActive && showSpinner) {
          setError(err instanceof Error ? err.message : 'Could not load assignments.');
        }
      } finally {
        if (isActive && showSpinner) {
          setLoading(false);
        }
      }
    }

    refreshAssignments(true);

    const handleRefresh = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        refreshAssignments(false);
      }
    };

    // Re-read when something changed in the school (changeWatcher also checks when the page
    // comes back into view), instead of every 15 s and on every focus; and when a hand-in
    // waiting on this device has gone (or been refused), or the connection is back.
    const unsubscribe = subscribeChanges(kinds => { if (kinds.includes('tenant')) handleRefresh(); });
    const unsubscribeOutbox = subscribeOutbox(() => handleRefresh());
    window.addEventListener('online', handleRefresh);

    return () => {
      isActive = false;
      unsubscribe();
      unsubscribeOutbox();
      window.removeEventListener('online', handleRefresh);
    };
  }, []);

  const [filter, setFilter] = useState('todo');
  const [subject, setSubject] = useState('');
  const subjects = useMemo(() => [...new Set(assignments.map(item => item.subjectName || 'General Subject'))].sort((a, b) => a.localeCompare(b)), [assignments]);
  const counts = useMemo(() => assignments.reduce((acc, item) => { acc[statusOf(item)] += 1; return acc; }, { todo: 0, overdue: 0, submitted: 0, marked: 0 }), [assignments]);
  // To do first, soonest due first; then the rest, newest first.
  const shown = useMemo(() => assignments
    .filter(item => !subject || (item.subjectName || 'General Subject') === subject)
    .filter(item => { const status = statusOf(item); return filter === 'all' || (filter === 'todo' ? status === 'todo' || status === 'overdue' : status === filter); })
    .sort((a, b) => {
      const open = item => (['todo', 'overdue'].includes(statusOf(item)) ? 0 : 1);
      const dueOf = item => (item.dueAt ? new Date(item.dueAt).getTime() : Infinity);
      return open(a) - open(b) || (open(a) === 0 ? dueOf(a) - dueOf(b) : String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }), [assignments, filter, subject]);

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
    <StudentSectionShell title="Assignments" subtitle="What to do next, what you sent, and what your teachers marked.">
      {loading && (
        <section className="glass-surface rounded-3xl p-6">
          <p className="neon-subtle">Loading assignments…</p>
        </section>
      )}

      {!loading && savedCopy && (
        <section role="status" className="mb-4 rounded-3xl border border-sky-300 bg-sky-50 p-4 text-sm font-semibold text-sky-900 dark:border-sky-300/40 dark:bg-sky-500/15 dark:text-sky-100">
          No connection — showing the copy saved on this device{savedCopy !== 'unknown' ? ` (${new Date(savedCopy).toLocaleString()})` : ''}. You can still answer; what you submit is sent by itself when the internet is back.
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
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
            {[['todo', 'To do', counts.todo + counts.overdue, 'from-amber-500/30'], ['overdue', 'Overdue', counts.overdue, 'from-rose-500/30'], ['submitted', 'Submitted', counts.submitted, 'from-emerald-500/30'], ['marked', 'Marked', counts.marked, 'from-indigo-500/30']].map(([key, label, value, tone]) => (
              <button key={key} type="button" onClick={() => setFilter(key === 'overdue' ? 'todo' : key)} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tone} to-transparent p-4 text-left`}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{label}</p>
                <p className="mt-1 text-3xl font-black text-white">{value}</p>
              </button>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-2xl border border-white/10 bg-slate-900/40 p-1" role="tablist" aria-label="Show">
              {[['todo', 'To do'], ['submitted', 'Submitted'], ['marked', 'Marked'], ['all', 'All']].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filter === key ? 'bg-white text-slate-900' : 'text-slate-200'}`}>{label}</button>
              ))}
            </div>
            {subjects.length > 1 ? (
              <select aria-label="Subject" value={subject} onChange={event => setSubject(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-100">
                <option value="">All subjects</option>
                {subjects.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            ) : null}
          </div>

          {shown.length === 0 && (
            <section className="glass-surface rounded-3xl p-6 text-center">
              <p className="micro-label accent-amber">{assignments.length ? 'Nothing here' : 'No live assignments'}</p>
              <p className="mt-2 text-sm text-slate-300">{assignments.length ? (filter === 'todo' ? 'You are all caught up. 🎉' : 'Nothing matches this view yet.') : 'Assignments will appear here once your teacher publishes them to your class subjects.'}</p>
            </section>
          )}

          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map(item => {
              const total = assignmentTotalScore(item.questions);
              const status = statusOf(item);
              const [chipLabel, chipTone] = STATUS_CHIP[status];
              const due = dueHint(item.dueAt);
              return (
                <li key={item.id}>
                  <Link to={`/roles/student/assignments/${item.id}`} className={`flex h-full flex-col gap-2 rounded-2xl border bg-gradient-to-br p-4 transition hover:-translate-y-0.5 hover:shadow-xl ${cardColor(`${item.subjectName}-${item.id}`)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{item.subjectName || 'General Subject'}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${item.mySubmission?.queued ? STATUS_CHIP.queued[1] : chipTone}`}>{status === 'marked' ? `${normalizeDisplayGrade(item.mySubmission.grade)}/${total}` : item.mySubmission?.queued ? STATUS_CHIP.queued[0] : chipLabel}</span>
                    </div>
                    <p className="line-clamp-2 text-base font-black leading-snug text-white">{item.title}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${due.tone}`}>{item.mySubmission ? `Sent ${formatDueDate(item.mySubmission.submittedAt)}` : due.text}</span>
                      <span className="font-semibold text-white/70">{(item.questions || []).length} question{(item.questions || []).length === 1 ? '' : 's'} · {total} marks</span>
                    </div>
                    {status === 'todo' || status === 'overdue' ? <span className="self-start rounded-xl bg-white/90 px-3 py-1 text-xs font-black text-slate-900">Start →</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </StudentSectionShell>
  );
}

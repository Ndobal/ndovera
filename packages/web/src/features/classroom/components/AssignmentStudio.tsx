import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRightLeft, Bot, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, FileText, MessageCircleMore, MessagesSquare, Sparkles } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { assignmentBlueprints } from '../data/classroomExperience';
import {
  addAssignmentComment,
  addAssignmentPrivateMessage,
  createClassroomAssignment,
  saveAssignmentSubmission,
  explainQuestion,
  type ClassroomAssignment,
} from '../services/classroomApi';

export function ExplanationLoader({ question }: { question: any }) {
  const [explanation, setExplanation] = useState(question.explanation);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!explanation && question.options) {
      setLoading(true);
      explainQuestion(
        question.id,
        question.stem,
        question.options,
        question.answer
      ).then(res => {
        if (active) {
          setExplanation(res);
          question.explanation = res;
          setLoading(false);
        }
      });
    }
    return () => { active = false; };
  }, [question, explanation]);

  return (
    <div className="mt-4 rounded-xl bg-slate-800 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-400">
        <Sparkles size={16} />
        <span>AI Analysis</span>
      </div>
      {loading ? (
        <div className="text-sm text-slate-400 italic">Generating explanation...</div>
      ) : (
        <div className="text-sm text-slate-300">
          {explanation}
        </div>
      )}
    </div>
  );
}

type AssignmentStudioProps = {
  role: string;
};

type NextAssignmentPrompt = {
  nextAssignmentId: string | null;
  nextAssignmentTitle: string | null;
  submittedTitle: string;
};

export function AssignmentStudio({ role }: AssignmentStudioProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin';
  const { data, refetch, loading } = useData<ClassroomAssignment[]>('/api/classroom/assignments');
  const assignments = useMemo<ClassroomAssignment[]>(() => {
    if (!data?.length) return assignmentBlueprints as ClassroomAssignment[];
    const existingIds = new Set(data.map((assignment) => assignment.id));
    const previewAssignments = (assignmentBlueprints as ClassroomAssignment[]).filter((assignment) => !existingIds.has(assignment.id));
    return [...data, ...previewAssignments];
  }, [data]);
  const [newAssignment, setNewAssignment] = useState({ title: '', subject: '', className: '', due: '' });
  
  // Generation & Option Formatting Settings for Assignment
  const [optionFormat, setOptionFormat] = useState('A, B, C, D');
  const [markingMode, setMarkingMode] = useState('Automatically marked (Requires Review)');
  const [applyBlooms, setApplyBlooms] = useState(true);
  const [randomizeAnswers, setRandomizeAnswers] = useState(true);

  const [publicDrafts, setPublicDrafts] = useState<Record<string, string>>({});
  const [privateDrafts, setPrivateDrafts] = useState<Record<string, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<string, string>>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [studentPageAssignmentId, setStudentPageAssignmentId] = useState<string | null>(null);
  const [nextPrompt, setNextPrompt] = useState<NextAssignmentPrompt | null>(null);
  const [markedTermOpen, setMarkedTermOpen] = useState(true);
  const [markedWeekOpen, setMarkedWeekOpen] = useState<Record<string, boolean>>({});
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [infoCardsOpen, setInfoCardsOpen] = useState(false);

  useEffect(() => {
    const nextDrafts: Record<string, Record<string, string>> = {};
    assignments.forEach((assignment) => {
      nextDrafts[assignment.id] = assignment.submission?.answers || {};
    });
    setAnswerDrafts((current) => ({ ...nextDrafts, ...current }));
  }, [assignments]);

  useEffect(() => {
    if (!activeAssignmentId && assignments.length) {
      setActiveAssignmentId(assignments[0].id);
    }
  }, [assignments, activeAssignmentId]);

  useEffect(() => {
    if (teacherView) return;
    if (!assignments.length) return;
    if (!studentPageAssignmentId) return;
    const selectedStillExists = assignments.some((assignment) => assignment.id === studentPageAssignmentId);
    if (!selectedStillExists) {
      setStudentPageAssignmentId(null);
    }
  }, [assignments, activeAssignmentId, studentPageAssignmentId, teacherView]);

  const activeAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === activeAssignmentId) || assignments[0] || null,
    [activeAssignmentId, assignments],
  );
  const submittedAssignments = useMemo(
    () => (!teacherView ? assignments.filter((assignment) => assignment.submission?.status === 'Submitted') : []),
    [assignments, teacherView],
  );
  const visibleAssignments = useMemo(
    () => (!teacherView ? assignments.filter((assignment) => assignment.submission?.status !== 'Submitted') : assignments),
    [assignments, teacherView],
  );

  // Student cards reflect individual submission state instead of the generic teacher workflow label.
  const getAssignmentBadge = (assignment: ClassroomAssignment) => {
    if (teacherView) return assignment.status;
    return assignment.submission?.status || 'Not started';
  };

  // The next prompt should skip over already submitted work and guide the learner forward.
  const getNextPendingAssignment = (currentAssignmentId: string) => {
    const currentIndex = assignments.findIndex((assignment) => assignment.id === currentAssignmentId);
    const orderedAssignments = currentIndex >= 0
      ? [...assignments.slice(currentIndex + 1), ...assignments.slice(0, currentIndex)]
      : assignments;

    return orderedAssignments.find((assignment) => assignment.id !== currentAssignmentId && assignment.submission?.status !== 'Submitted') || null;
  };

  const openAssignmentPage = (assignmentId: string) => {
    setActiveAssignmentId(assignmentId);
    setNextPrompt(null);
    if (!teacherView) setStudentPageAssignmentId(assignmentId);
  };

  const closeAssignmentPage = () => {
    if (!teacherView) setStudentPageAssignmentId(null);
  };

  const submitAssignment = async () => {
    if (!newAssignment.title.trim()) return;
    setBusyKey('create_assignment');
    try {
      await createClassroomAssignment({
        title: newAssignment.title.trim(),
        subject: newAssignment.subject.trim() || 'General Studies',
        className: newAssignment.className.trim() || 'JSS 1 Gold',
        due: newAssignment.due.trim() || 'TBD',
      });
      setNewAssignment({ title: '', subject: '', className: '', due: '' });
      await refetch();
    } finally {
      setBusyKey(null);
    }
  };

  const postComment = async (assignmentId: string) => {
    const text = publicDrafts[assignmentId]?.trim();
    if (!text) return;
    setBusyKey(`public_${assignmentId}`);
    try {
      await addAssignmentComment(assignmentId, { text });
      setPublicDrafts((current) => ({ ...current, [assignmentId]: '' }));
      await refetch();
    } finally {
      setBusyKey(null);
    }
  };

  const postPrivateMessage = async (assignmentId: string) => {
    const text = privateDrafts[assignmentId]?.trim();
    if (!text) return;
    setBusyKey(`private_${assignmentId}`);
    try {
      await addAssignmentPrivateMessage(assignmentId, { text });
      setPrivateDrafts((current) => ({ ...current, [assignmentId]: '' }));
      await refetch();
    } finally {
      setBusyKey(null);
    }
  };

  const updateAnswer = (assignmentId: string, key: string, value: string) => {
    setAnswerDrafts((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] || {}),
        [key]: value,
      },
    }));
  };

  const saveSubmission = async (assignmentId: string, status: 'Draft' | 'Submitted') => {
    setBusyKey(`${status}_${assignmentId}`);
    try {
      await saveAssignmentSubmission(assignmentId, {
        answers: answerDrafts[assignmentId] || {},
        status,
      });
      await refetch();
      if (status === 'Submitted') {
        const nextAssignment = getNextPendingAssignment(assignmentId);
        const submittedAssignment = assignments.find((assignment) => assignment.id === assignmentId);
        setStudentPageAssignmentId(null);
        setNextPrompt({
          nextAssignmentId: nextAssignment?.id || null,
          nextAssignmentTitle: nextAssignment?.title || null,
          submittedTitle: submittedAssignment?.title || 'Assignment',
        });
      }
    } finally {
      setBusyKey(null);
    }
  };

  const openNextAssignment = () => {
    if (!nextPrompt?.nextAssignmentId) {
      setNextPrompt(null);
      return;
    }
    openAssignmentPage(nextPrompt.nextAssignmentId);
    setNextPrompt(null);
  };

  const activeStudentAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === studentPageAssignmentId) || null,
    [assignments, studentPageAssignmentId],
  );

  const getQuestionCount = (assignment: ClassroomAssignment) => assignment.sections.reduce((count, section) => {
    if (section.questions?.length) return count + section.questions.length;
    return count + 1;
  }, 0);

  const getAnsweredCount = (assignment: ClassroomAssignment) => {
    const draft = answerDrafts[assignment.id] || {};
    return assignment.sections.reduce((count, section) => {
      if (section.questions?.length) {
        return count + section.questions.filter((question) => Boolean(draft[`${section.title}_${question.no}`]?.trim())).length;
      }
      return count + (draft[section.title]?.trim() ? 1 : 0);
    }, 0);
  };

  const scrollToSection = (assignmentId: string, sectionTitle: string) => {
    const anchor = document.getElementById(`${assignmentId}_${sectionTitle}`.replace(/[^a-zA-Z0-9_-]/g, '_'));
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getSubjectBadgeClassName = (subject: string) => {
    if (subject === 'English Language') {
      return 'bg-white/88 text-black font-extrabold';
    }
    return 'bg-white/82 text-black font-extrabold';
  };

  const getWeekBucketLabel = (due: string) => {
    const value = due.toLowerCase();
    if (value.includes('today') || value.includes('tomorrow') || (!value.includes('next') && /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(value))) {
      return 'This Week';
    }
    if (value.includes('next')) return 'Next Week';
    return 'Later This Term';
  };

  const markedAssignmentsByWeek = useMemo(() => {
    return submittedAssignments.reduce<Record<string, ClassroomAssignment[]>>((groups, assignment) => {
      const bucket = getWeekBucketLabel(assignment.due);
      groups[bucket] = groups[bucket] || [];
      groups[bucket].push(assignment);
      return groups;
    }, {});
  }, [submittedAssignments]);

  const getAssignmentCardTone = (index: number) => {
    const tones = [
      {
        background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.34), rgba(59, 130, 246, 0.18)), radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 34%)',
        borderColor: 'rgba(125, 211, 252, 0.34)',
      },
      {
        background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.3), rgba(217, 70, 239, 0.16)), radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 35%)',
        borderColor: 'rgba(196, 181, 253, 0.34)',
      },
      {
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.28), rgba(16, 185, 129, 0.16)), radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 35%)',
        borderColor: 'rgba(110, 231, 183, 0.32)',
      },
      {
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.28), rgba(251, 191, 36, 0.16)), radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 35%)',
        borderColor: 'rgba(253, 224, 71, 0.3)',
      },
      {
        background: 'linear-gradient(135deg, rgba(190, 24, 93, 0.28), rgba(244, 114, 182, 0.16)), radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 35%)',
        borderColor: 'rgba(251, 182, 206, 0.3)',
      },
      {
        background: 'linear-gradient(135deg, rgba(67, 56, 202, 0.3), rgba(56, 189, 248, 0.16)), radial-gradient(circle at top right, rgba(255,255,255,0.16), transparent 35%)',
        borderColor: 'rgba(165, 180, 252, 0.32)',
      },
    ];
    return tones[index % tones.length];
  };

  const getInsightCardStyle = (tone: 'progress' | 'state' | 'mix'): CSSProperties => {
    if (tone === 'progress') {
      return {
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(59, 130, 246, 0.1)), radial-gradient(circle at 18% 20%, rgba(255,255,255,0.24) 0, transparent 24%), repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 12px)',
        borderColor: 'rgba(125, 211, 252, 0.3)',
      };
    }
    if (tone === 'state') {
      return {
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.16), rgba(249, 115, 22, 0.1)), radial-gradient(circle at 18% 20%, rgba(255,255,255,0.2) 0, transparent 24%), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 10px)',
        borderColor: 'rgba(253, 186, 116, 0.3)',
      };
    }
    return {
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(45, 212, 191, 0.1)), radial-gradient(circle at 18% 20%, rgba(255,255,255,0.2) 0, transparent 24%), repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 11px)',
      borderColor: 'rgba(110, 231, 183, 0.28)',
    };
  };

  const renderSection = (assignment: ClassroomAssignment) => (
    assignment.sections.map((section, index) => (
      <div
        key={`${assignment.id}_${section.title}`}
        id={`${assignment.id}_${section.title}`.replace(/[^a-zA-Z0-9_-]/g, '_')}
        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Section {index + 1}</p>
            <h4 className="mt-1 text-lg font-semibold text-slate-900">{section.title}</h4>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{section.type}</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {section.questions?.length || 1} task{(section.questions?.length || 1) > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {'instructions' in section && section.instructions ? <p className="mt-3 text-sm text-slate-600">{section.instructions}</p> : null}
        {'prompt' in section && section.prompt ? <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">{section.prompt}</p> : null}
        {'questions' in section && section.questions ? (
          <div className="mt-4 space-y-3">
            {section.questions.map((question) => {
              const picked = !teacherView ? (assignment.submission?.answers?.[`${section.title}_${question.no}`] || answerDrafts[assignment.id]?.[`${section.title}_${question.no}`] || '') : undefined;
              const isSubmitted = !teacherView && (assignment.submission?.status === 'Submitted' || assignment.submission?.status === 'Graded');
              const isCorrect = isSubmitted && picked === question.answer;
              const isWrong = isSubmitted && Boolean(picked) && picked !== question.answer;

              return (
                <div key={question.no} className={`rounded-2xl border p-4 shadow-sm transition-colors ${isSubmitted ? (isCorrect ? 'border-emerald-500 bg-emerald-900/60' : isWrong ? 'border-rose-500 bg-rose-900/60' : 'border-slate-700 bg-slate-900') : 'border-slate-700 bg-slate-900'}`}>
                  <p className="text-sm font-bold text-white">
                    {question.no}. {question.stem}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => {
                      const active = picked === option;
                      const revealCorrect = isSubmitted && option === question.answer;
                      const revealWrong = isSubmitted && active && option !== question.answer;
                      
                      return (
                        <label key={option} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition-all ${
                          revealCorrect ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' :
                          revealWrong ? 'border-rose-500 bg-rose-500/20 text-rose-300' :
                          active ? 'border-sky-400 bg-sky-400/10 text-sky-300' :
                          'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800 cursor-pointer'
                        }`}>
                          <input
                            type="radio"
                            name={`${assignment.id}_${question.no}`}
                            className="h-4 w-4"
                            disabled={isSubmitted}
                            checked={teacherView ? option === question.answer : active}
                            onChange={() => updateAnswer(assignment.id, `${section.title}_${question.no}`, option)}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  {isSubmitted && <ExplanationLoader question={question} />}
                </div>
              );
            })}
          </div>
        ) : null}
        {'left' in section && section.left && section.right ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Column A</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {section.left.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Column B</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {section.right.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {!teacherView && section.type !== 'Multiple Choice' ? (
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
            placeholder="Type your answer here…"
            value={answerDrafts[assignment.id]?.[section.title] || ''}
            onChange={(event) => updateAnswer(assignment.id, section.title, event.target.value)}
          />
        ) : null}
      </div>
    ))
  );

  const renderAssignmentSidePanel = (assignment: ClassroomAssignment) => (
    <aside className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Teacher feedback
        </div>
        <p className="mt-3 text-sm text-slate-600">{assignment.teacherFeedback}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageCircleMore className="h-4 w-4 text-sky-600" />
          General comments
        </div>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {assignment.comments.map((comment) => (
            <div key={comment.id} className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">{comment.author}</p>
              <p className="mt-1">{comment.text}</p>
              <p className="mt-2 text-xs text-slate-400">{comment.likes} likes</p>
            </div>
          ))}
        </div>
        <textarea
          className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:bg-white"
          placeholder="Add a public class comment…"
          value={publicDrafts[assignment.id] || ''}
          onChange={(event) => setPublicDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))}
        />
        <button type="button" onClick={() => postComment(assignment.id)} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {busyKey === `public_${assignment.id}` ? 'Posting…' : 'Post comment'}
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Bot className="h-4 w-4 text-emerald-600" />
          Private teacher chat
        </div>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {assignment.privateThread.map((message) => (
            <div key={message.id} className={`rounded-2xl px-4 py-3 ${message.from === 'Teacher' ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50'}`}>
              <p className="font-semibold">{message.from}</p>
              <p className="mt-1">{message.text}</p>
            </div>
          ))}
        </div>
        <textarea
          className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:bg-white"
          placeholder={teacherView ? 'Reply privately or give correction instructions…' : 'Ask for more explanation privately…'}
          value={privateDrafts[assignment.id] || ''}
          onChange={(event) => setPrivateDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))}
        />
        <button type="button" onClick={() => postPrivateMessage(assignment.id)} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {busyKey === `private_${assignment.id}` ? 'Sending…' : 'Send private message'}
        </button>
      </div>

      {teacherView ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            Learner submissions
          </div>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {assignment.submissionList?.length ? assignment.submissionList.map((submission) => (
              <div key={submission.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{submission.studentName}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">{submission.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'Not yet submitted'}</p>
              </div>
            )) : <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No learner submissions yet.</div>}
          </div>
        </div>
      ) : null}
    </aside>
  );

  return (
    <div className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
      {teacherView ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
            <button 
              onClick={() => setCreateCardOpen(!createCardOpen)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
                   <FileText className="h-5 w-5" />
                </div> 
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-slate-900">Create Assignment</h3>
                  <p className="text-xs text-slate-500">Draft a new task or quiz for your students</p>
                </div>
              </div>
              {createCardOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>

            {createCardOpen && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid gap-3 md:grid-cols-4">
                  <input
                    value={newAssignment.title}
                    onChange={(event) => setNewAssignment((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Assignment title"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                  />
                  <input
                    value={newAssignment.subject}
                    onChange={(event) => setNewAssignment((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Subject"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                  />
                  <input
                    value={newAssignment.className}
                    onChange={(event) => setNewAssignment((current) => ({ ...current, className: event.target.value }))}
                    placeholder="Class name"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                  />
                  <div className="flex gap-3">
                    <input
                      value={newAssignment.due}
                      onChange={(event) => setNewAssignment((current) => ({ ...current, due: event.target.value }))}
                      placeholder="Due date"
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <p className="mb-3 text-sm font-bold text-slate-900">Assignment Generation & Formatting Settings</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm text-slate-700 font-medium">
                      Option Format
                      <select value={optionFormat} onChange={(e) => setOptionFormat(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
                        <option value="A, B, C, D">A, B, C, D</option>
                        <option value="a, b, c, d">a, b, c, d</option>
                        <option value="A., B., C., D.">A., B., C., D.</option>
                        <option value="a., b., c., d.">a., b., c., d.</option>
                        <option value="(A), (B), (C), (D)">(A), (B), (C), (D)</option>
                        <option value="(a), (b), (c), (d)">(a), (b), (c), (d)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm text-slate-700 font-medium">
                      Marking & Review Mode
                      <select value={markingMode} onChange={(e) => setMarkingMode(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
                        <option value="Automatically marked (Requires Review)">Automatically marked (Requires Review)</option>
                        <option value="Manually reviewed">Manually reviewed</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input type="checkbox" checked={applyBlooms} onChange={(e) => setApplyBlooms(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                      Apply Bloom's Taxonomy (Mix higher/lower order questions)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                      <input type="checkbox" checked={randomizeAnswers} onChange={(e) => setRandomizeAnswers(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                      Randomize correct answer distribution (Mix up option order)
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={submitAssignment} className="rounded-2xl bg-white border border-slate-200 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
                    {busyKey === 'create_assignment' ? 'Saving…' : 'Create Assignment'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
            <button 
              onClick={() => setInfoCardsOpen(!infoCardsOpen)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-2xl bg-violet-100 p-3 text-violet-700">
                   <Sparkles className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-slate-900">Platform Capabilities</h3>
                  <p className="text-xs text-slate-500">Learn about authoring, sequencing, and feedback features</p>
                </div>
              </div>
              {infoCardsOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>

          {infoCardsOpen && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="inline-flex rounded-2xl bg-sky-50 p-3 text-sky-700">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Authoring workflow</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Build sections with independent time and mark weight.</li>
                  <li>• Auto-save objective answer keys as teachers edit.</li>
                  <li>• Duplicate, reorder, archive, or reopen assignments.</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="inline-flex rounded-2xl bg-violet-50 p-3 text-violet-700">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Anti-copy sequencing</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Shuffle question order per learner without changing difficulty.</li>
                  <li>• Rotate answer options so correct letters do not repeat patterns.</li>
                  <li>• Keep one master grading map for all variants.</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
                  <MessagesSquare className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Feedback channels</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Public class comments for hints and reminders.</li>
                  <li>• Private teacher-student thread for extra explanation.</li>
                  <li>• Return-for-correction flow with tracked resubmissions.</li>
                </ul>
              </div>
            </div>
          )}
          </section>
        </>
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading assignment workspace…</div> : null}

      {!teacherView && activeStudentAssignment ? (
        <section key={activeStudentAssignment.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" onClick={closeAssignmentPage} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                <ArrowLeft className="h-4 w-4" />
                Back to assignments
              </button>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${activeStudentAssignment.subject === 'English Language' ? 'bg-slate-950 text-white font-extrabold' : 'bg-sky-50 text-sky-700 font-semibold'}`}>{activeStudentAssignment.subject}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{activeStudentAssignment.className}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{getAssignmentBadge(activeStudentAssignment)}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{activeStudentAssignment.title}</h3>
              <p className="mt-2 text-sm text-slate-600">Due: {activeStudentAssignment.due}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Current score</p>
              <p>{activeStudentAssignment.score}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border p-3.5 backdrop-blur-xl" style={getInsightCardStyle('progress')}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-sky-600" />
                Assignment progress
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {getAnsweredCount(activeStudentAssignment)}/{getQuestionCount(activeStudentAssignment)}
              </p>
              <p className="mt-1 text-xs text-slate-700">Questions or sections answered so far.</p>
            </div>
            <div className="rounded-2xl border p-3.5 backdrop-blur-xl" style={getInsightCardStyle('state')}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Clock3 className="h-4 w-4 text-amber-600" />
                Submission state
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{activeStudentAssignment.submission?.status || 'Not started'}</p>
              <p className="mt-1 text-xs text-slate-700">Save a draft first, then submit when you are satisfied.</p>
            </div>
            <div className="rounded-2xl border p-3.5 backdrop-blur-xl" style={getInsightCardStyle('mix')}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Question mix
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{activeStudentAssignment.types.join(' • ')}</p>
              <p className="mt-1 text-xs text-slate-700">Every section is available inside this workspace.</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Question navigator</p>
                <p className="mt-1 text-sm text-slate-600">Jump straight to any section while you work.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeStudentAssignment.sections.map((section, index) => (
                  <button
                    key={`${activeStudentAssignment.id}_${section.title}_nav`}
                    type="button"
                    onClick={() => scrollToSection(activeStudentAssignment.id, section.title)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {index + 1}. {section.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="space-y-4">
              {renderSection(activeStudentAssignment)}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => saveSubmission(activeStudentAssignment.id, 'Draft')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                  {busyKey === `Draft_${activeStudentAssignment.id}` ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" onClick={() => saveSubmission(activeStudentAssignment.id, 'Submitted')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {busyKey === `Submitted_${activeStudentAssignment.id}` ? 'Submitting…' : 'Submit answers'}
                </button>
              </div>
            </div>

            {renderAssignmentSidePanel(activeStudentAssignment)}
          </div>
        </section>
      ) : (
      <div className={`grid gap-6 ${teacherView ? 'xl:grid-cols-[1fr_1.1fr]' : ''}`}>
        <div className={`grid gap-3 auto-rows-fr ${teacherView ? 'sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}`}>
          {visibleAssignments.map((assignment, index) => (
            <button
              key={assignment.id}
              type="button"
              onClick={() => {
                openAssignmentPage(assignment.id);
              }}
              className={`flex h-full min-h-44 flex-col rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur-xl transition ${activeAssignment?.id === assignment.id ? 'ring-2 ring-sky-400 shadow-lg' : 'hover:-translate-y-0.5 hover:shadow-md'}`}
              style={getAssignmentCardTone(index)}
            >
              <div className="flex flex-wrap justify-center gap-1.5 text-center">
                <span className={`rounded-full px-3 py-1 text-xs backdrop-blur-md ${getSubjectBadgeClassName(assignment.subject)}`}>{assignment.subject}</span>
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold text-slate-950 backdrop-blur-md dark:text-slate-100">{assignment.className}</span>
                <span className="rounded-full bg-white/22 px-3 py-1 text-xs font-semibold text-slate-950 backdrop-blur-md dark:text-amber-100">{getAssignmentBadge(assignment)}</span>
              </div>
              <div className="mt-1.5 text-center">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-950">{assignment.title}</h3>
                <p className="mt-0.5 text-[11px] font-medium text-white">Due: {assignment.due}</p>
              </div>
              <p className="mt-1.5 line-clamp-2 text-center text-[11px] leading-4.5 text-white">{assignment.teacherFeedback}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-[11px] text-slate-950">
                <span className="rounded-xl bg-white/18 px-3 py-2 font-semibold backdrop-blur-md">{assignment.types.length} formats</span>
                <span className="rounded-xl bg-white/18 px-3 py-2 font-semibold backdrop-blur-md">Score: {assignment.score}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 text-[10px] text-slate-950">
                {assignment.types.slice(0, 2).map((type) => (
                  <span key={`${assignment.id}_${type}`} className="rounded-full border border-white/15 bg-white/12 px-2.5 py-1 font-semibold backdrop-blur-md">{type}</span>
                ))}
              </div>
              {!teacherView ? (
                <div className="mt-auto flex justify-center pt-2">
                  <span className="inline-flex rounded-full bg-slate-900/92 px-3 py-2 text-xs font-extrabold text-white shadow-sm">
                  {assignment.submission?.status === 'Submitted' ? 'Review submission' : assignment.submission?.status === 'Draft' ? 'Continue assignment' : 'Open assignment page'}
                  </span>
                </div>
              ) : null}
            </button>
          ))}
        </div>

        {!teacherView && submittedAssignments.length ? (
            <section className="rounded-3xl border border-white/35 bg-white/14 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-sky-300/18 dark:bg-slate-950/26 dark:shadow-[0_24px_60px_rgba(2,8,23,0.46)]">
            <button
              type="button"
              onClick={() => setMarkedTermOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/30 bg-white/18 px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition hover:bg-white/24 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/12"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">This term</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Marked assignments</p>
              </div>
              {markedTermOpen ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
            </button>

            {markedTermOpen ? (
              <div className="mt-3 space-y-2.5">
                {Object.entries(markedAssignmentsByWeek).map(([weekLabel, weekAssignments]) => {
                  const isOpen = markedWeekOpen[weekLabel] ?? true;
                  return (
                    <div key={weekLabel} className="rounded-2xl border border-white/28 bg-white/12 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                      <button
                        type="button"
                        onClick={() => setMarkedWeekOpen((current) => ({ ...current, [weekLabel]: !isOpen }))}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{weekLabel}</p>
                          <p className="text-xs text-slate-500">{weekAssignments.length} marked assignment{weekAssignments.length > 1 ? 's' : ''}</p>
                        </div>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
                      </button>

                      {isOpen ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {weekAssignments.map((assignment, index) => (
                            <button
                              key={`marked_${assignment.id}`}
                              type="button"
                              onClick={() => openAssignmentPage(assignment.id)}
                              className="flex min-h-32 flex-col rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md dark:shadow-[0_10px_24px_rgba(2,8,23,0.32)]"
                              style={getAssignmentCardTone(index)}
                            >
                              <div className="flex flex-wrap justify-center gap-1.5 text-center">
                                <span className={`rounded-full px-3 py-1 text-xs backdrop-blur-md ${getSubjectBadgeClassName(assignment.subject)}`}>{assignment.subject}</span>
                                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold text-slate-950 backdrop-blur-md">Submitted</span>
                              </div>
                              <div className="mt-1.5 text-center">
                                <h4 className="line-clamp-2 text-sm font-semibold text-slate-950">{assignment.title}</h4>
                                <p className="mt-0.5 text-[11px] text-white">{assignment.score}</p>
                              </div>
                              <div className="mt-auto flex justify-center pt-2">
                                <span className="inline-flex rounded-full bg-slate-900/92 px-3 py-2 text-xs font-extrabold text-white">Review submission</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {teacherView && activeAssignment ? (
          <section key={activeAssignment.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs ${activeAssignment.subject === 'English Language' ? 'bg-slate-950 text-white font-extrabold' : 'bg-sky-50 text-sky-700 font-semibold'}`}>{activeAssignment.subject}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{activeAssignment.className}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{getAssignmentBadge(activeAssignment)}</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{activeAssignment.title}</h3>
                <p className="mt-2 text-sm text-slate-600">Due: {activeAssignment.due}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Current score</p>
                  <p>{activeAssignment.score}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Question mix</p>
                  <p>{activeAssignment.types.join(' • ')}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
              <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Focus mode
                </div>
                {renderSection(activeAssignment)}
              </div>

              {renderAssignmentSidePanel(activeAssignment)}
            </div>
          </section>
        ) : null}
      </div>
      )}

      {nextPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Assignment submitted</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">{nextPrompt.submittedTitle} has been submitted.</h3>
            <p className="mt-3 text-sm text-slate-600">
              {nextPrompt.nextAssignmentTitle
                ? `Next assignment: ${nextPrompt.nextAssignmentTitle}`
                : 'There are no more assignments waiting right now.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setNextPrompt(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                Do it later
              </button>
              {nextPrompt.nextAssignmentTitle ? (
                <button type="button" onClick={openNextAssignment} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Do next assignment now
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

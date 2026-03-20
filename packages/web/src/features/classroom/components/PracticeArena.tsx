/* cspell:words Ndovera fafc */
import { useEffect, useMemo, useState } from 'react';
import {
  BookCopy,
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Filter,
  Layers3,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
  Lightbulb,
  X,
} from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { practicePrograms } from '../data/classroomExperience';
import { createSchoolQuestionBank, explainQuestion, type PracticeQuestion, type PracticeSet } from '../services/classroomApi';

type PracticeArenaProps = {
  role: string;
};

type ScopeFilter = 'all' | 'practice' | 'exam' | 'cbt' | 'mid-term';
type PracticeFocusMode = 'all' | 'practice' | 'weak-area' | 'exam-review';

function FeatureSuggestionFAB({ role }: { role: string }) {
  const [show, setShow] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5001/api/super/settings/feature-suggestions')
      .then(r => r.json())
      .then(d => { if (d.ok) setEnabled(d.enabled); })
      .catch(() => {});
  }, []);

  if (!enabled) return null;

  const submit = () => {
    fetch('http://localhost:5001/api/public/feature-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_id: 'current_school',
        user_id: 'current_user',
        user_type: role === 'Student' ? 'student' : 'staff',
        suggestion
      })
    })
    .then(() => setSent(true))
    .catch(() => {});
  };

  return (
    <>
      <button 
        onClick={() => setShow(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition z-50 flex items-center gap-2 group"
      >
        <Lightbulb className="w-5 h-5" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-medium">
          Suggest Feature
        </span>
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative dark:bg-slate-800">
            <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5"/>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 dark:bg-indigo-900/40">
                 <Lightbulb className="w-6 h-6"/>
              </div>
              <h2 className="text-xl font-bold dark:text-white">Suggest Update</h2>
            </div>
            
            {sent ? (
               <div className="text-center py-6">
                 <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3"/>
                 <p className="text-emerald-600 font-medium">Thank you!</p>
                 <p className="text-sm text-slate-500 mt-1">Your suggestion has been securely sent directly to Super Admins.</p>
               </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">Have an idea for Ndovera? Let us know!</p>
                <textarea 
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  rows={4}
                  placeholder="I wish the system could..."
                />
                <button 
                  onClick={submit}
                  disabled={!suggestion.trim()}
                  className="w-full mt-4 bg-indigo-600 text-white font-medium py-2.5 rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition"
                >
                  Send Suggestion
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ExplanationLoader({ question }: { question: PracticeQuestion }) {
  const [explanation, setExplanation] = useState<string | null>(question.explanation || null);
  const [loading, setLoading] = useState(!question.explanation);

  useEffect(() => {
    if (question.explanation) {
      setExplanation(question.explanation);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    explainQuestion(question.id, question.stem, question.options, question.answer)
      .then((res) => {
        if (mounted) {
          setExplanation(res);
          question.explanation = res; // cache it locally
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setExplanation('Explanation could not be generated.');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [question]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
        <WandSparkles className="h-4 w-4" />
        <p>AI generating explanation...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-sky-900/30 p-3 border border-sky-500/20">
      <p className="font-bold text-sky-200 text-xs uppercase tracking-wider mb-1">AI Explanation ✓</p>
      <p className="text-sky-100">{explanation}</p>
    </div>
  );
}

type DraftQuestion = {
  id: string;
  stem: string;
  options: [string, string, string, string];
  answer: string;
};

type SessionState = {
  setId: string;
  questionOrder: string[];
  answers: Record<string, string>;
  submitted: boolean;
};

type PracticeProgramSeed = Partial<PracticeSet> & Pick<PracticeSet, 'id' | 'title' | 'subject' | 'questions' | 'note'>;

const referenceModes = [
  {
    id: 'practice',
    label: 'Practice Mode',
    detail: 'Build fluency with randomized question-bank questions.',
    icon: Sparkles,
    tone: 'bg-sky-50 dark:bg-transparent dark:from-sky-500/20 dark:to-cyan-500/10 border-sky-200 dark:border-sky-300/20 text-sky-900 dark:text-sky-100',
  },
  {
    id: 'weak-area',
    label: 'Weak Area Mode',
    detail: 'Retry missed concepts and review wrong answers first.',
    icon: Target,
    tone: 'bg-amber-50 dark:bg-transparent dark:from-amber-500/20 dark:to-orange-500/10 border-amber-200 dark:border-amber-300/20 text-amber-900 dark:text-amber-100',
  },
  {
    id: 'exam-review',
    label: 'Exam Review Mode',
    detail: 'Use school and shared banks for structured exam readiness.',
    icon: Trophy,
    tone: 'bg-violet-50 dark:bg-transparent dark:from-violet-500/20 dark:to-fuchsia-500/10 border-violet-200 dark:border-violet-300/20 text-violet-900 dark:text-violet-100',
  },
];

function matchesPracticeMode(program: PracticeSet, focusMode: PracticeFocusMode) {
  if (focusMode === 'all') return true;

  const modeText = `${program.mode} ${program.note} ${program.title} ${program.scope}`.toLowerCase();

  if (focusMode === 'practice') {
    return program.scope === 'practice' || modeText.includes('practice') || modeText.includes('adaptive');
  }

  if (focusMode === 'weak-area') {
    return modeText.includes('weak') || modeText.includes('target') || modeText.includes('adaptive');
  }

  return program.scope === 'exam' || program.scope === 'cbt' || modeText.includes('exam') || modeText.includes('review') || modeText.includes('timed');
}

function makeDraftQuestion(index = 0): DraftQuestion {
  return {
    id: `draft_question_${Date.now()}_${index}`,
    stem: '',
    options: ['', '', '', ''],
    answer: '',
  };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getScopeLabel(scope: string) {
  if (scope === 'cbt') return 'Global CBT';
  if (scope === 'exam') return 'School Exam Bank';
  if (scope === 'mid-term') return 'Official Mid-Term Exam';
  return 'Practice Pool';
}

function getSetTone(scope: string) {
  if (scope === 'cbt') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/20 dark:bg-violet-500/10 dark:text-violet-100';
  if (scope === 'exam') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100';
  if (scope === 'mid-term') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-500/10 dark:text-rose-100';
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-100';
}

function getScoreTone(scorePercent: number) {
  if (scorePercent >= 80) return 'text-emerald-300';
  if (scorePercent >= 50) return 'text-amber-300';
  return 'text-rose-300';
}

function inferScope(program: PracticeProgramSeed) {
  const modeText = `${program.mode || ''} ${program.note || ''} ${program.title || ''}`.toLowerCase();
  if (program.scope === 'practice' || program.scope === 'exam' || program.scope === 'cbt') return program.scope;
  if (modeText.includes('exam') || modeText.includes('review')) return 'exam';
  if (modeText.includes('cbt') || modeText.includes('timed')) return 'cbt';
  return 'practice';
}

function buildFallbackQuestion(program: PracticeProgramSeed, index: number): PracticeQuestion {
  const title = program.title || 'Practice set';
  const subject = program.subject || 'General Studies';
  const topic = title.replace(/\s+(weak-area|drill|challenge|review|mode|past questions?)$/i, '').trim() || title;
  const answer = `Key point ${index + 1}`;

  return {
    id: `${program.id || 'practice'}_q_${index + 1}`,
    stem: `${subject}: ${topic} — question ${index + 1}`,
    options: [answer, `Example ${index + 1}`, `Revision note ${index + 1}`, `Try again ${index + 1}`],
    answer,
  };
}

function normalizeQuestion(question: Partial<PracticeQuestion>, index: number, program: PracticeProgramSeed): PracticeQuestion {
  const fallback = buildFallbackQuestion(program, index);
  const options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
  const safeOptions = options.length >= 4 ? options.slice(0, 4) : [...options, ...fallback.options].slice(0, 4);
  const answer = question.answer && safeOptions.includes(question.answer) ? question.answer : safeOptions[0];

  return {
    id: question.id || fallback.id,
    stem: question.stem || fallback.stem,
    options: safeOptions,
    answer,
  };
}

function normalizePracticeSet(program: PracticeProgramSeed, index: number): PracticeSet {
  const fallbackCount = Math.max(1, Number(program.questions || 0) || 5);
  const rawQuestions = Array.isArray(program.questionItems) && program.questionItems.length
    ? program.questionItems
    : Array.from({ length: fallbackCount }, (_, questionIndex) => buildFallbackQuestion(program, questionIndex));

  const questionItems = rawQuestions.map((question, questionIndex) => normalizeQuestion(question, questionIndex, program));
  const scope = inferScope(program);

  return {
    id: program.id || `practice_set_${index + 1}`,
    source: program.source || (scope === 'exam' ? 'School bank' : scope === 'cbt' ? 'Global CBT bank' : 'Practice pool'),
    scope,
    subject: program.subject || 'General Studies',
    title: program.title || `Practice set ${index + 1}`,
    level: program.level,
    mode: program.mode || (scope === 'exam' ? 'Exam Review Mode' : 'Practice Mode'),
    reward: program.reward,
    questions: Number(program.questions || questionItems.length) || questionItems.length,
    note: program.note || 'Practice questions ready for guided revision.',
    questionItems,
  };
}

export function PracticeArena({ role }: PracticeArenaProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin' || role === 'HOS';
  const studentView = !teacherView;
  const { data, refetch } = useData<PracticeSet[]>('/api/classroom/practice');
  const practiceSource = (data && data.length ? data : practicePrograms) as PracticeProgramSeed[];
  const programs = useMemo(
    () => practiceSource.map((program, index) => normalizePracticeSet(program, index)),
    [practiceSource],
  );

  const [showStudentGuide, setShowStudentGuide] = useState(studentView);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [focusMode, setFocusMode] = useState<PracticeFocusMode>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'list' | 'detail' | 'practice'>('list');
  const [session, setSession] = useState<SessionState | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftLevel, setDraftLevel] = useState('JSS 1');
  const [draftMode, setDraftMode] = useState('Teacher Curated');
  const [draftNote, setDraftNote] = useState('Teacher-authored school question bank set.');
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([makeDraftQuestion(1), makeDraftQuestion(2)]);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Generation & Option Formatting Settings
  const [optionFormat, setOptionFormat] = useState('A, B, C, D');
  const [markingMode, setMarkingMode] = useState('Automatically marked (Requires Review)');
  const [applyBlooms, setApplyBlooms] = useState(true);
  const [randomizeAnswers, setRandomizeAnswers] = useState(true);

  const subjectOptions = useMemo(
    () => ['all', ...Array.from(new Set(programs.map((program) => program.subject))).sort((left, right) => left.localeCompare(right))],
    [programs],
  );

  const filteredPrograms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesScope = scopeFilter === 'all' ? true : program.scope === scopeFilter;
      const matchesFocus = matchesPracticeMode(program, focusMode);
      const matchesSubject = subjectFilter === 'all' ? true : program.subject === subjectFilter;
      const haystack = `${program.subject} ${program.title} ${program.note} ${program.mode} ${program.source}`.toLowerCase();
      const matchesSearch = query ? haystack.includes(query) : true;
      return matchesScope && matchesFocus && matchesSubject && matchesSearch;
    });
  }, [focusMode, programs, scopeFilter, search, subjectFilter]);

  const selectedSet = useMemo(
    () => filteredPrograms.find((program) => program.id === selectedSetId) || programs.find((program) => program.id === selectedSetId) || filteredPrograms[0] || programs[0] || null,
    [filteredPrograms, programs, selectedSetId],
  );

  const selectedQuestions = useMemo(() => {
    if (!selectedSet) return [];
    const questionItems = Array.isArray(selectedSet.questionItems) ? selectedSet.questionItems : [];
    const order = session && session.setId === selectedSet.id ? session.questionOrder : questionItems.map((question) => question.id);
    const questionMap = new Map(questionItems.map((question) => [question.id, question]));
    return order.map((id) => questionMap.get(id)).filter(Boolean) as PracticeQuestion[];
  }, [selectedSet, session]);

  const scopeSummary = useMemo(() => ({
    totalSets: programs.length,
    practicePools: programs.filter((program) => program.scope === 'practice').length,
    examBanks: programs.filter((program) => program.scope === 'exam').length,
    cbtDrills: programs.filter((program) => program.scope === 'cbt').length,
    totalQuestions: programs.reduce((total, program) => total + Number(program.questions || 0), 0),
  }), [programs]);

  const focusModeSummary = useMemo(
    () => ({
      practice: programs.filter((program) => matchesPracticeMode(program, 'practice')).length,
      'weak-area': programs.filter((program) => matchesPracticeMode(program, 'weak-area')).length,
      'exam-review': programs.filter((program) => matchesPracticeMode(program, 'exam-review')).length,
    }),
    [programs],
  );

  const sessionResult = useMemo(() => {
    if (!selectedSet || !session || !session.submitted) return null;
    const questionItems = Array.isArray(selectedSet.questionItems) ? selectedSet.questionItems : [];
    const questions = questionItems.filter((question) => session.questionOrder.includes(question.id));
    const total = questions.length;
    const correct = questions.filter((question) => session.answers[question.id] === question.answer).length;
    const wrong = questions.filter((question) => session.answers[question.id] && session.answers[question.id] !== question.answer);
    const unanswered = questions.filter((question) => !session.answers[question.id]);
    const scorePercent = total ? Math.round((correct / total) * 100) : 0;
    return { total, correct, wrong, unanswered, scorePercent };
  }, [selectedSet, session]);

  const answeredCount = useMemo(
    () => (session && selectedSet && session.setId === selectedSet.id ? Object.keys(session.answers).filter((key) => Boolean(session.answers[key])).length : 0),
    [selectedSet, session],
  );

  const activeQuestion = selectedQuestions[Math.min(currentQuestionIndex, Math.max(selectedQuestions.length - 1, 0))] || null;

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [selectedSetId]);

  const startPractice = (set: PracticeSet) => {
    const questionItems = Array.isArray(set.questionItems) ? set.questionItems : [];
    setSelectedSetId(set.id);
    setCurrentQuestionIndex(0);
    setViewState('practice');
    setSession({
      setId: set.id,
      questionOrder: shuffle(questionItems.map((question) => question.id)),
      answers: {},
      submitted: false,
    });
  };

  const updateAnswer = (questionId: string, answer: string) => {
    setSession((current) => {
      if (!current || current.submitted) return current;
      return {
        ...current,
        answers: { ...current.answers, [questionId]: answer },
      };
    });
  };

  const submitSession = () => {
    setSession((current) => current ? { ...current, submitted: true } : current);
  };

  const resetSession = () => {
    if (!selectedSet) return;
    startPractice(selectedSet);
  };

  const goToNextQuestion = () => {
    setCurrentQuestionIndex((current) => Math.min(current + 1, Math.max(selectedQuestions.length - 1, 0)));
  };

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex((current) => Math.max(current - 1, 0));
  };

  const updateDraftQuestion = (id: string, updater: (question: DraftQuestion) => DraftQuestion) => {
    setDraftQuestions((current) => current.map((question) => (question.id === id ? updater(question) : question)));
  };

  const addDraftQuestion = () => {
    setDraftQuestions((current) => [...current, makeDraftQuestion(current.length + 1)]);
  };

  const removeDraftQuestion = (id: string) => {
    setDraftQuestions((current) => (current.length > 1 ? current.filter((question) => question.id !== id) : current));
  };

  const saveSchoolSet = async () => {
    const cleanedQuestions = draftQuestions
      .map((question) => ({
        id: question.id,
        stem: question.stem.trim(),
        options: question.options.map((option) => option.trim()).filter(Boolean),
        answer: question.answer.trim(),
      }))
      .filter((question) => question.stem && question.options.length === 4 && question.answer);

    if (!draftTitle.trim() || !draftSubject.trim() || cleanedQuestions.length === 0) {
      setSaveError('Add a title, subject, and at least one complete question.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await createSchoolQuestionBank({
        title: draftTitle.trim(),
        subject: draftSubject.trim(),
        level: draftLevel.trim() || undefined,
        mode: draftMode.trim() || undefined,
        note: draftNote.trim() || undefined,
        questions: cleanedQuestions.map((question) => ({
          id: question.id,
          stem: question.stem,
          options: question.options,
          answer: question.answer,
        })),
      });
      setDraftTitle('');
      setDraftSubject('');
      setDraftLevel('JSS 1');
      setDraftMode('Teacher Curated');
      setDraftNote('Teacher-authored school question bank set.');
      setDraftQuestions([makeDraftQuestion(1), makeDraftQuestion(2)]);
      await refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save question bank right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {viewState === 'list' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {referenceModes.map((mode) => {
              const Icon = mode.icon;
              const active = focusMode === mode.id;
              const count = focusModeSummary[mode.id as keyof typeof focusModeSummary];
              return (
                <button key={mode.id} type="button" onClick={() => setFocusMode((current) => current === mode.id ? 'all' : mode.id as PracticeFocusMode)} className={`rounded-3xl border bg-white dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.58)_0%,rgba(2,6,23,0.7)_100%)] p-4 text-left shadow-sm transition ${mode.tone} ${active ? 'ring-2 ring-slate-400/40 dark:ring-white/45' : 'hover:border-slate-300 dark:hover:border-white/30 dark:border-white/5'} ${active ? 'border-transparent' : ''}`}>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{mode.label}</p>
                    <span className="rounded-full bg-black/5 dark:bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-200">{count}</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-200/90">{mode.detail}</p>
                </button>
              );
            })}
          </div>

          {studentView && showStudentGuide ? (
            <section className="rounded-[1.75rem] border border-purple-200 bg-linear-to-r from-purple-50 to-white dark:border-purple-700/50 dark:from-purple-900 dark:to-black p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="w-full">
                  <span className="inline-flex rounded-full bg-purple-100 dark:bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700 dark:text-purple-200">Before you start</span>
                  <h3 className="mt-2 text-xl font-bold text-purple-900 dark:text-white">Practice guide</h3>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm leading-6 text-purple-700 dark:text-purple-100">
                    <p>• Pick a subject and source first, then start the drill.</p>
                    <p>• Answer every question before submitting for summary.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStudentGuide(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-white/10 dark:text-purple-200 shadow-sm transition dark:hover:bg-white/20"
                  title="Close guide"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </section>
          ) : null}

          <section className="space-y-4 rounded-4xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.58)_0%,rgba(2,6,23,0.7)_100%)] dark:shadow-[0_20px_40px_rgba(2,8,23,0.34)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Question bank explorer</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/6 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-200">
              <Filter className="h-3.5 w-3.5" />
              {filteredPrograms.length} visible
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, source, note, or mode"
                className="w-full rounded-2xl border border-slate-200 dark:border-white/12 bg-slate-50 dark:bg-white/8 py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:bg-white dark:focus:bg-white/8"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)} className="rounded-2xl border border-slate-200 dark:border-white/12 bg-slate-50 dark:bg-white/8 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400">
                <option value="all">All sources</option>
                <option value="practice">Practice pool</option>
                <option value="exam">School exam bank</option>                  <option value="mid-term">Mid-Term Exams</option>                <option value="cbt">Global CBT</option>
              </select>
              <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="rounded-2xl border border-slate-200 dark:border-white/12 bg-slate-50 dark:bg-white/8 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400">
                {subjectOptions.map((option) => (
                  <option key={option} value={option}>{option === 'all' ? 'All subjects' : option}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-1">
              <button type="button" onClick={() => setFocusMode('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${focusMode === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'bg-slate-100 text-slate-700 dark:bg-white/8 dark:text-slate-200'}`}>
                All focus modes
              </button>
              <button type="button" onClick={() => setFocusMode('practice')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${focusMode === 'practice' ? 'bg-sky-500 text-white dark:bg-sky-200 dark:text-slate-950' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-100'}`}>
                Practice Mode
              </button>
              <button type="button" onClick={() => setFocusMode('weak-area')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${focusMode === 'weak-area' ? 'bg-amber-500 text-white dark:bg-amber-200 dark:text-slate-950' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-100'}`}>
                Weak Area
              </button>
              <button type="button" onClick={() => setFocusMode('exam-review')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${focusMode === 'exam-review' ? 'bg-violet-500 text-white dark:bg-violet-200 dark:text-slate-950' : 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-100'}`}>
                Exam Review
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPrograms.map((program) => {
              const active = selectedSet?.id === program.id;
              return (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => {
                    setSelectedSetId(program.id);
                    setCurrentQuestionIndex(0);
                    setViewState('detail');
                  }}
                  className={`w-full rounded-[1.6rem] border p-4 text-left shadow-sm transition ${active ? 'border-sky-400 bg-sky-50 dark:border-sky-400/50 dark:bg-sky-500/12' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/6 dark:hover:border-white/20 dark:hover:bg-white/8'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-200/50 dark:bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100">{program.subject}</span>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getSetTone(program.scope)}`}>{getScopeLabel(program.scope)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{program.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{program.note}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-200/50 dark:bg-white/8 px-3 py-2 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Questions</p>
                      <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{program.questions}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="rounded-full bg-slate-200/50 dark:bg-white/8 px-3 py-1">{program.mode}</span>
                    <span className="rounded-full bg-slate-200/50 dark:bg-white/8 px-3 py-1">{program.source}</span>
                    {program.level ? <span className="rounded-full bg-slate-200/50 dark:bg-white/8 px-3 py-1">{program.level}</span> : null}
                    {program.reward ? <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/12 px-3 py-1 text-emerald-700 dark:text-emerald-200">{program.reward}</span> : null}
                  </div>
                </button>
              );
            })}
            {!filteredPrograms.length ? <div className="rounded-[1.6rem] border border-dashed border-slate-300 dark:border-white/12 bg-slate-50 dark:bg-white/5 p-5 text-sm text-slate-600 dark:text-slate-300">No practice sets match the current filters.</div> : null}
          </div>
        </section>

        {teacherView ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">Teacher question-bank studio</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Build teacher-created, non-AI question banks for revision, randomized practice, and later exam reuse.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewState('detail');
                  // For teacher build, we might need a dedicated state, but maybe setting selectedSetId to null is enough. 
                  // Wait, actually let's just keep it simple and handle teacher studio below if needed.
                }}
              >
              </button>
            </div>
          </section>
        ) : null}
        </>
      ) : null}

      {viewState === 'detail' && selectedSet ? (
        <section className="space-y-5 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.4)_0%,rgba(2,6,23,0.5)_100%)]">
          <button onClick={() => setViewState('list')} className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
            <ChevronLeft className="h-4 w-4" /> Back to practice tab
          </button>
          
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{selectedSet.subject}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">{selectedSet.mode}</span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{getScopeLabel(selectedSet.scope)}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-extrabold text-orange-600 dark:text-orange-400">{selectedSet.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{selectedSet.note}</p>
                </div>

                <div className="grid w-full gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-800/50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Source</p>
                    <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{selectedSet.source}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-800/50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Questions</p>
                    <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{selectedSet.questionItems.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-800/50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Blueprint rule</p>
                    <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">Teacher / real-school derived</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-900/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-950 dark:text-white">In-app practice runner</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Questions stay inside Ndovera so learners can practice, submit, and review immediately.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startPractice(selectedSet)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                      {teacherView ? 'Preview practice' : 'Start practice'}
                    </button>
                    {session ? (
                      <button type="button" onClick={() => setViewState('practice')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                        Resume session
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
        </section>
      ) : null}

      {viewState === 'practice' && session && session.setId === selectedSet?.id ? (
        <section className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950 sm:p-10">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">Practice: {selectedSet.title}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setViewState('detail')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                  Save for later
                </button>
                <button onClick={() => setViewState('detail')} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.3rem] bg-white px-5 py-5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#fef08a]">Progress</p>
                          <p className="mt-2 text-sm font-bold text-[#fef08a]">{answeredCount} of {selectedQuestions.length} answered</p>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          Question {Math.min(currentQuestionIndex + 1, selectedQuestions.length || 1)} of {selectedQuestions.length}
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-300" style={{ width: `${selectedQuestions.length ? (answeredCount / selectedQuestions.length) * 100 : 0}%` }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedQuestions.map((question, index) => {
                        const answered = Boolean(session.answers[question.id]);
                        const active = index === currentQuestionIndex;
                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() => setCurrentQuestionIndex(index)}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : answered ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400'}`}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>

                    {activeQuestion ? (() => {
                      const picked = session.answers[activeQuestion.id] || '';
                      const submitted = session.submitted;
                      const isCorrect = submitted && picked === activeQuestion.answer;
                      const isWrong = submitted && Boolean(picked) && picked !== activeQuestion.answer;
                      return (
                        <article key={activeQuestion.id} className={`rounded-3xl border p-4 shadow-sm transition-colors ${submitted ? (isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-900/60' : isWrong ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-900/60' : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900') : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Question {currentQuestionIndex + 1}</p>
                              <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{activeQuestion.stem}</p>
                            </div>
                            {submitted ? (
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : isWrong ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                                {isCorrect ? 'Correct' : isWrong ? 'Review this' : 'Unanswered'}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {activeQuestion.options.map((option) => {
                              const active = picked === option;
                              const revealCorrect = submitted && option === activeQuestion.answer;
                              const revealWrong = submitted && active && option !== activeQuestion.answer;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  disabled={submitted}
                                  onClick={() => updateAnswer(activeQuestion.id, option)}
                                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${revealCorrect ? 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-white' : revealWrong ? 'border-rose-500 bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-white' : active ? 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-500/20 dark:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-slate-500'}`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>

                          {submitted ? (
                            <div className="mt-4 rounded-[1.2rem] bg-slate-100 px-4 py-4 text-sm leading-7 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                              <p className="font-semibold text-slate-900 dark:text-white">Review note</p>
                              <p className="mt-2">Correct answer: <span className="font-bold text-slate-900 dark:text-white">{activeQuestion.answer}</span></p>
                              {activeQuestion.explanation ? (
                                <div className="mt-3 rounded-lg bg-sky-50 p-3 border border-sky-200 dark:bg-sky-900/30 dark:border-sky-500/20">
                                  <p className="font-bold text-sky-700 dark:text-sky-200 text-xs uppercase tracking-wider mb-1">AI Explanation ✓</p>
                                  <p className="text-sky-900 dark:text-sky-100">{activeQuestion.explanation}</p>
                                </div>
                              ) : (
                                <div className="mt-3">
                                  <ExplanationLoader question={activeQuestion} />
                                </div>
                              )}
                              <p className="mt-3">Use this result for weak-area revision before restarting the set.</p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })() : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </button>
                        <button type="button" onClick={goToNextQuestion} disabled={currentQuestionIndex >= selectedQuestions.length - 1} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      {!session.submitted ? (
                        <button type="button" onClick={submitSession} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                          Submit practice
                        </button>
                      ) : null}
                    </div>

                    {sessionResult ? (
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#0a1833_0%,#102347_100%)] p-5 text-white dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.58)_0%,rgba(2,6,23,0.7)_100%)]">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-300">
                              {selectedSet.scope === 'mid-term' ? 'Mid-Term Exam Summary' : 'Practice summary'}
                            </p>
                            <h4 className="mt-2 text-2xl font-extrabold">{sessionResult.correct} / {sessionResult.total} correct</h4>
                            <p className={`mt-2 text-sm font-bold ${getScoreTone(sessionResult.scorePercent)}`}>Score: {sessionResult.scorePercent}%</p>
                            {selectedSet.scope === 'mid-term' && (
                              <div className="mt-3 inline-block rounded-full bg-emerald-500/20 px-3 py-1 font-bold text-emerald-300 text-xs border border-emerald-500/30">
                                ✓ Calculated out of 20 & Synced to CA 
                              </div>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.3rem] bg-white/8 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400">Correct</p>
                              <p className="mt-2 text-2xl font-extrabold text-emerald-300">{sessionResult.correct}</p>
                            </div>
                            <div className="rounded-[1.3rem] bg-white/8 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400">Wrong</p>
                              <p className="mt-2 text-2xl font-extrabold text-amber-300">{sessionResult.wrong.length}</p>
                            </div>
                            <div className="rounded-[1.3rem] bg-white/8 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400">Unanswered</p>
                              <p className="mt-2 text-2xl font-extrabold text-slate-100">{sessionResult.unanswered.length}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl bg-white/8 p-4">
                            <div className="flex items-center gap-2 text-amber-200">
                              <Target className="h-4 w-4" />
                              <p className="text-sm font-bold">Weak-area review</p>
                            </div>
                            <div className="mt-3 space-y-3">
                              {sessionResult.wrong.length ? sessionResult.wrong.map((question) => (
                                <div key={question.id} className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white">
                                  <p className="font-bold text-white">{question.stem}</p>
                                  <p className="mt-2 text-xs font-bold text-white mb-2">Correct answer: {question.answer}</p>
                                  <ExplanationLoader question={question} />
                                </div>
                              )) : <p className="text-sm font-bold text-slate-200">No weak-area items. This set is ready for a harder random round.</p>}
                            </div>
                          </div>

                          <div className="rounded-3xl bg-white/8 p-4">
                            <div className="flex items-center gap-2 text-emerald-200">
                              <CheckCircle2 className="h-4 w-4" />
                              <p className="text-sm font-bold">What this supports next</p>
                            </div>
                            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                              <li>• Re-run in a new randomized order.</li>
                              <li>• Use missed questions for weak-area mode.</li>
                              <li>• Reuse the same bank later for assignment or exam prep.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {viewState === 'list' && teacherView ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.4)_0%,rgba(2,6,23,0.5)_100%)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-950">Teacher question-bank studio</p>
                  <p className="mt-1 text-sm text-slate-600">Build teacher-created, non-AI question banks for revision, randomized practice, and later exam reuse.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <BookCopy className="h-3.5 w-3.5" />
                  Manual upload / typed only
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} placeholder="Subject" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
                <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Question bank title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
                <input value={draftLevel} onChange={(event) => setDraftLevel(event.target.value)} placeholder="Level / class" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
                <input value={draftMode} onChange={(event) => setDraftMode(event.target.value)} placeholder="Mode" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
              </div>

              {/* Generation and formatting settings */}
              <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-bold text-slate-900">Question Settings (Generation & Format)</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm text-slate-700 font-medium">
                    Option Format
                    <select value={optionFormat} onChange={(e) => setOptionFormat(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
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
                    <select value={markingMode} onChange={(e) => setMarkingMode(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
                      <option value="Automatically marked (Requires Review)">Automatically marked (Requires Review)</option>
                      <option value="Manually reviewed">Manually reviewed</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="checkbox" checked={applyBlooms} onChange={(e) => setApplyBlooms(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                    Apply Bloom's Taxonomy (Mix higher/lower order questions)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="checkbox" checked={randomizeAnswers} onChange={(e) => setRandomizeAnswers(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                    Randomize correct answer distribution (Mix up option order in options list)
                  </label>
                </div>
              </div>

              <textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Question-bank note" className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />

              <div className="mt-4 space-y-4">
                {draftQuestions.map((question, questionIndex) => (
                  <div key={question.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Question {questionIndex + 1}</p>
                      <button type="button" onClick={() => removeDraftQuestion(question.id)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Remove
                      </button>
                    </div>

                    <textarea value={question.stem} onChange={(event) => updateDraftQuestion(question.id, (current) => ({ ...current, stem: event.target.value }))} placeholder="Question stem" className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <input
                          key={`${question.id}_${optionIndex}`}
                          value={option}
                          onChange={(event) => updateDraftQuestion(question.id, (current) => {
                            const nextOptions = [...current.options] as DraftQuestion['options'];
                            nextOptions[optionIndex] = event.target.value;
                            return { ...current, options: nextOptions };
                          })}
                          placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                        />
                      ))}
                    </div>

                    <input value={question.answer} onChange={(event) => updateDraftQuestion(question.id, (current) => ({ ...current, answer: event.target.value }))} placeholder="Correct answer (must match one option)" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={addDraftQuestion} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  <Plus className="h-4 w-4" />
                  Add question
                </button>
                <div className="flex items-center gap-3">
                  {saveError ? <p className="text-sm font-medium text-rose-600">{saveError}</p> : null}
                  <button type="button" onClick={saveSchoolSet} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
                    {saving ? <WandSparkles className="h-4 w-4 animate-pulse" /> : <ClipboardList className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save school bank'}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
    </div>
  );
}

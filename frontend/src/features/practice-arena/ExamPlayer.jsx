import React, { useCallback, useEffect, useRef, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { askConfirm } from '../../shared/components/AppDialog';
import { TYPE_LABELS, keywordOverlap, markAnswer } from './engine';
import { ChoiceAnswer, MatchingAnswer, MathKeys, formatClock } from './QuizPlayer';

// Exam Simulation, as strict as a Ndovera exam: one clock for the paper, no answers or marks
// until the paper is handed in, free movement between questions, a question map, and every
// time the student leaves the exam screen counted. Theory is marked against the model answer's
// key words (70% or more is full marks, 35% half) — answers are shown only on the results.

const OPEN = ['essay', 'comprehension'];

/** Marks the whole paper at hand-in. */
export function markPaper(questions, answers, startedAtMs) {
  return questions.map(question => {
    const answer = answers[question.id];
    const timeMs = answer?.timeMs || 0;
    if (OPEN.includes(question.type)) {
      const text = String(answer?.text || '').trim();
      if (!text) return { questionId: question.id, type: question.type, response: null, credit: 0, correct: false, unanswered: true, timeMs, question };
      const overlap = keywordOverlap(text, question.modelAnswer || '');
      const selfRating = overlap >= 70 ? 'got_it' : overlap >= 35 ? 'partly' : 'missed';
      const marked = markAnswer(question, text, selfRating);
      return { questionId: question.id, type: question.type, response: text, selfRating, credit: marked.credit, correct: marked.correct, timeMs, question };
    }
    const response = question.type === 'crossmatching' ? answer?.matching : question.type === 'mcq' || question.type === 'truefalse' ? answer?.choice : answer?.text;
    const empty = response === undefined || response === null || response === '' || (typeof response === 'object' && !Object.keys(response).length);
    if (empty) return { questionId: question.id, type: question.type, response: null, credit: 0, correct: false, unanswered: true, timeMs, question };
    const marked = markAnswer(question, response);
    const sent = (question.type === 'mcq' || question.type === 'truefalse') && typeof response === 'number' ? question.options[response] : response;
    return { questionId: question.id, type: question.type, response: sent, credit: marked.credit, correct: marked.correct, timeMs, question };
  });
}

function answered(question, answer) {
  if (!answer) return false;
  if (question.type === 'mcq' || question.type === 'truefalse') return typeof answer.choice === 'number';
  if (question.type === 'crossmatching') return Boolean(answer.matching && Object.values(answer.matching).some(Boolean));
  return Boolean(String(answer.text || '').trim());
}

export default function ExamPlayer({ quiz, subjectName, onFinish, onExit }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(quiz.seconds || 0);
  const [leftScreen, setLeftScreen] = useState(0);
  const startedAt = useRef(new Date().toISOString());
  const shownAt = useRef(Date.now());
  const finished = useRef(false);
  const inputRef = useRef(null);
  const question = quiz.questions[index];
  const answer = answers[question?.id] || {};
  const doneCount = quiz.questions.filter(item => answered(item, answers[item.id])).length;

  const handIn = useCallback((timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    onFinish({ results: markPaper(quiz.questions, answers), startedAt: startedAt.current, finishedAt: new Date().toISOString(), timedOut, leftScreen, strict: true });
  }, [answers, leftScreen, onFinish, quiz.questions]);

  useEffect(() => {
    if (!quiz.seconds) return undefined;
    const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [quiz.seconds]);
  useEffect(() => { if (quiz.seconds && remaining === 0) handIn(true); }, [handIn, quiz.seconds, remaining]);

  // Leaving the exam screen (another app or tab) is counted, as in a Ndovera exam.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && !finished.current) setLeftScreen(count => count + 1); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useEffect(() => { shownAt.current = Date.now(); setTimeout(() => inputRef.current?.focus?.(), 50); }, [index]);

  const update = patch => setAnswers(current => {
    const before = current[question.id] || {};
    return { ...current, [question.id]: { ...before, ...patch, timeMs: (before.timeMs || 0) + (Date.now() - shownAt.current) } };
  });
  const goTo = target => { shownAt.current = Date.now(); setIndex(Math.max(0, Math.min(quiz.questions.length - 1, target))); };

  async function confirmHandIn() {
    const left = quiz.questions.length - doneCount;
    const ok = await askConfirm(left ? `${left} question${left === 1 ? ' is' : 's are'} not answered. Hand in the paper anyway? You cannot change answers after.` : 'Hand in the paper? You cannot change answers after.');
    if (ok) handIn(false);
  }

  if (!question) return null;
  const lowTime = quiz.seconds && remaining <= 60;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">Exam conditions</p>
          <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{subjectName} · {quiz.label}</p>
        </div>
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{doneCount}/{quiz.questions.length} answered</span>
        {quiz.seconds ? <span className={`rounded-full px-3 py-1 text-sm font-black tabular-nums ${lowTime ? 'animate-pulse bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-cyan-400 dark:text-black'}`} aria-label="Time left">⏱ {formatClock(remaining)}</span> : null}
        <button type="button" onClick={confirmHandIn} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-black text-white">Hand in</button>
        <button type="button" onClick={onExit} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 dark:border-white/20 dark:text-slate-300" aria-label="Leave exam">✕</button>
      </div>
      {leftScreen > 0 ? <p role="status" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">You left the exam screen {leftScreen} time{leftScreen === 1 ? '' : 's'}. In a real exam this is recorded.</p> : null}

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Questions">
        {quiz.questions.map((item, position) => {
          const done = answered(item, answers[item.id]);
          return (
            <button key={item.id} type="button" onClick={() => goTo(position)} aria-current={position === index ? 'step' : undefined} aria-label={`Question ${position + 1}${done ? ', answered' : ''}`}
              className={`h-9 w-9 rounded-lg text-sm font-black ${position === index ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : done ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{position + 1}</button>
          );
        })}
      </nav>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl md:p-7 dark:border-white/10 dark:bg-slate-900/80" aria-label={`Question ${index + 1}`}>
        <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-white dark:bg-white dark:text-black">Question {index + 1}</span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{TYPE_LABELS[question.type] || question.type}</span>
        </div>
        {question.passage ? (
          <details open className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-200">
            <summary className="cursor-pointer font-bold">Read the passage</summary>
            <div className="mt-2"><RichContent text={question.passage} /></div>
          </details>
        ) : null}
        <div className="mb-5 text-lg font-semibold leading-relaxed text-slate-900 dark:text-white"><RichContent text={question.prompt} /></div>
        {question.imageUrl ? <img src={question.imageUrl} alt="" className="mb-4 max-h-64 rounded-2xl" /> : null}

        {question.type === 'mcq' || question.type === 'truefalse' ? (
          // Locked stays off: the choice can change until hand-in, and nothing shows right or wrong.
          <div className="[&_button]:transition">
            <ChoiceAnswer question={{ ...question, correctIndex: -1 }} chosen={answer.choice ?? null} locked={false} onChoose={choice => update({ choice })} />
            {typeof answer.choice === 'number' ? <p className="mt-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">Your answer: {'ABCDEFGH'[answer.choice]}</p> : null}
          </div>
        ) : null}
        {question.type === 'shortanswer' || question.type === 'fillgaps' ? (
          <div className="grid gap-2">
            <input ref={inputRef} value={answer.text || ''} onChange={event => update({ text: event.target.value })} placeholder="Type your answer" aria-label="Your answer"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            <MathKeys inputRef={inputRef} value={answer.text || ''} onChange={text => update({ text })} />
          </div>
        ) : null}
        {question.type === 'crossmatching' ? <MatchingAnswer question={question} value={answer.matching || {}} locked={false} onChange={matching => update({ matching })} /> : null}
        {OPEN.includes(question.type) ? (
          <div className="grid gap-2">
            <textarea ref={inputRef} rows={8} value={answer.text || ''} onChange={event => update({ text: event.target.value })} placeholder="Write your answer and working: numbers, units and steps." aria-label="Your answer"
              className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            <MathKeys inputRef={inputRef} value={answer.text || ''} onChange={text => update({ text })} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button type="button" disabled={index === 0} onClick={() => goTo(index - 1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40 dark:border-white/20 dark:text-slate-200">← Previous</button>
          {index + 1 < quiz.questions.length
            ? <button type="button" onClick={() => goTo(index + 1)} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white dark:bg-white dark:text-black">Next →</button>
            : <button type="button" onClick={confirmHandIn} className="rounded-xl bg-rose-700 px-5 py-2 text-sm font-black text-white">Hand in the paper</button>}
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">Answers and marks appear only after you hand in.</p>
    </div>
  );
}

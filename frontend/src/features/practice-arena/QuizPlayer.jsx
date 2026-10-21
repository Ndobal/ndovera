import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import RichContent from '../../shared/rich/RichContent';
import { TYPE_LABELS, estimateXp, keywordOverlap, markAnswer } from './engine';
import { questionSpeech, readAloud, useReadAloudPlayer } from '../../shared/components/ReadAloud';

const LETTERS = 'ABCDEFGH';
const AUTO_READ_KEY = 'ndovera:quizAutoRead';
const canSpeak = () => typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';
const loadAutoRead = () => { try { return localStorage.getItem(AUTO_READ_KEY) === '1'; } catch { return false; } };

export function formatClock(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function expectedText(question) {
  if (question.type === 'mcq' || question.type === 'truefalse') return question.options[question.correctIndex];
  if (question.type === 'shortanswer' || question.type === 'fillgaps') return (question.accepted || []).join(' / ');
  if (question.type === 'crossmatching') return (question.pairs || []).map(pair => `${pair.left} → ${pair.right}`).join('; ');
  return question.modelAnswer || '';
}

export function ChoiceAnswer({ question, chosen, locked, onChoose, reading = -1 }) {
  return (
    <div className="grid gap-3" role="group" aria-label="Options">
      {question.options.map((option, index) => {
        const isChosen = chosen === index;
        const isRight = locked && index === question.correctIndex;
        const isWrong = locked && isChosen && index !== question.correctIndex;
        const isRead = !locked && reading === index;
        return (
          <motion.button
            key={`${question.id}-${index}`}
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={locked}
            onClick={() => onChoose(index)}
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors ${isRead ? 'ring-4 ring-amber-300 dark:ring-amber-400/60 ' : ''}${
              isRight ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
                : isWrong ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-cyan-400'
            }`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black ${isRight ? 'bg-emerald-500 text-white' : isWrong ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200'}`}>{LETTERS[index]}</span>
            <span className="min-w-0 flex-1"><RichContent text={String(option)} inline /></span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function MatchingAnswer({ question, value, locked, onChange }) {
  const rights = useMemo(() => [...question.pairs.map(pair => pair.right)].sort(), [question]);
  return (
    <div className="grid gap-2">
      {question.pairs.map(pair => (
        <label key={pair.left} className="grid items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 sm:grid-cols-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
          <span>{pair.left}</span>
          <select
            aria-label={`Match for ${pair.left}`}
            disabled={locked}
            value={value?.[pair.left] || ''}
            onChange={event => onChange({ ...(value || {}), [pair.left]: event.target.value })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-white/20 dark:bg-slate-900"
          >
            <option value="">Choose…</option>
            {rights.map(right => <option key={right} value={right}>{right}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

// Theory and working: symbols a phone keyboard does not have, typed at the cursor.
const MATH_KEYS = ['²', '³', '√', 'π', '×', '÷', '±', '≤', '≥', '≠', '°', '½', '¼', '∠', '△', '→', 'θ', 'Δ'];

export function MathKeys({ inputRef, value, onChange }) {
  const insert = symbol => {
    const field = inputRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${symbol}${value.slice(end)}`);
    setTimeout(() => { field?.focus?.(); field?.setSelectionRange?.(start + symbol.length, start + symbol.length); }, 0);
  };
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Maths symbols">
      {MATH_KEYS.map(symbol => (
        <button key={symbol} type="button" onClick={() => insert(symbol)} className="min-w-[2.25rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-700 hover:border-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">{symbol}</button>
      ))}
    </div>
  );
}

export default function QuizPlayer({ quiz, subjectName, onFinish, onExit }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [text, setText] = useState('');
  const [matching, setMatching] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [remaining, setRemaining] = useState(quiz.seconds || 0);
  const startedAt = useRef(new Date().toISOString());
  const questionStarted = useRef(Date.now());
  const finished = useRef(false);
  const inputRef = useRef(null);
  const [autoRead, setAutoRead] = useState(loadAutoRead);
  const speaking = useReadAloudPlayer();

  const question = quiz.questions[index];
  const readSource = question ? `quiz:${question.id}` : '';
  const readingThis = speaking.status !== 'idle' && speaking.source === readSource;
  const spoken = useMemo(() => questionSpeech(question, { withPassage: true }), [question]);
  const readingOption = readingThis ? (spoken[speaking.at]?.option ?? -1) : -1;
  const readQuestion = useCallback(() => {
    if (!spoken.length || !canSpeak()) return;
    readAloud.start({ chunks: spoken.map(piece => piece.text), title: 'This question', source: readSource, inPlace: true });
  }, [readSource, spoken]);
  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    try { localStorage.setItem(AUTO_READ_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (next) readQuestion(); else readAloud.stop();
  };

  // Each new question is read when the student asked for that; reading ends with the question and the quiz.
  useEffect(() => {
    if (autoRead) readQuestion();
    return () => { readAloud.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const combo = useMemo(() => {
    let run = 0;
    for (let i = results.length - 1; i >= 0 && results[i].correct; i -= 1) run += 1;
    return run;
  }, [results]);
  const xp = estimateXp(results, quiz.mode);

  const finish = useCallback((finalResults, timedOut = false) => {
    if (finished.current) return;
    finished.current = true;
    let all = finalResults;
    // In an exam simulation, questions left unanswered count as wrong; a blitz counts what was answered.
    if (timedOut && quiz.mode === 'exam') {
      const answered = new Set(finalResults.map(result => result.questionId));
      all = [...finalResults, ...quiz.questions.filter(item => !answered.has(item.id)).map(item => ({ questionId: item.id, type: item.type, credit: 0, correct: false, response: null, unanswered: true, question: item }))];
    }
    onFinish({ results: all, startedAt: startedAt.current, finishedAt: new Date().toISOString(), timedOut });
  }, [onFinish, quiz]);

  useEffect(() => {
    if (!quiz.seconds) return undefined;
    const timer = setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [quiz.seconds]);

  useEffect(() => {
    if (quiz.seconds && remaining === 0 && !finished.current) finish(results, true);
  }, [finish, quiz.seconds, remaining, results]);

  useEffect(() => {
    questionStarted.current = Date.now();
    setChosen(null);
    setText('');
    setMatching({});
    setRevealed(false);
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus?.(), 50);
  }, [index]);

  const record = useCallback((response, selfRating) => {
    if (!question || feedback) return;
    const marked = markAnswer(question, response, selfRating);
    // Choices go to Ndovera as the option's text: the order on this device was shuffled.
    const sent = (question.type === 'mcq' || question.type === 'truefalse') && typeof response === 'number' ? question.options[response] : response;
    const result = { questionId: question.id, type: question.type, response: sent, selfRating, credit: marked.credit, correct: marked.correct, timeMs: Date.now() - questionStarted.current, question };
    setResults(previous => [...previous, result]);
    setFeedback(result);
  }, [feedback, question]);

  const next = useCallback(() => {
    if (!feedback) return;
    if (index + 1 >= quiz.questions.length) finish(results);
    else setIndex(value => value + 1);
  }, [feedback, finish, index, quiz.questions.length, results]);

  const choose = useCallback(optionIndex => {
    if (feedback) return;
    setChosen(optionIndex);
    if (readingThis) readAloud.stop();
    record(optionIndex);
  }, [feedback, readingThis, record]);

  useEffect(() => {
    const onKey = event => {
      if (event.target?.tagName === 'TEXTAREA') return;
      if (event.key === 'Enter' && feedback) { event.preventDefault(); next(); return; }
      if (!question || feedback || !['mcq', 'truefalse'].includes(question.type)) return;
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'SELECT') return;
      const letter = LETTERS.indexOf(String(event.key).toUpperCase());
      const digit = Number(event.key) - 1;
      const pick = letter >= 0 ? letter : digit;
      if (pick >= 0 && pick < question.options.length) choose(pick);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, feedback, next, question]);

  if (!question) return null;
  const openEnded = question.type === 'essay' || question.type === 'comprehension';
  const progress = Math.round((index / quiz.questions.length) * 100);
  const lowTime = quiz.seconds && remaining <= 20;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExit} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Leave quiz">✕</button>
        <div className="h-3 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Quiz progress">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400" animate={{ width: `${progress}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
        </div>
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{index + 1}/{quiz.questions.length}</span>
        {quiz.seconds ? (
          <span className={`rounded-full px-3 py-1 text-sm font-black tabular-nums ${lowTime ? 'animate-pulse bg-rose-500 text-white' : 'bg-slate-900 text-white dark:bg-cyan-400 dark:text-black'}`} aria-label="Time left">⏱ {formatClock(remaining)}</span>
        ) : null}
        <AnimatePresence>
          {combo >= 2 ? (
            <motion.span key={combo} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1 text-sm font-black text-white shadow">
              🔥 {combo} in a row
            </motion.span>
          ) : null}
        </AnimatePresence>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800 dark:bg-amber-400/20 dark:text-amber-200" aria-label="XP this quiz">+{xp} XP</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={question.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22 }}
          className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-xl backdrop-blur md:p-7 dark:border-white/10 dark:bg-slate-900/80"
        >
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">{TYPE_LABELS[question.type] || question.type}</span>
            {question.level ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">{question.level}</span> : null}
            {question.topic ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{question.topic}</span> : null}
            {question.fromNdovera ? <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-200">Ndovera bank</span> : null}
            {canSpeak() ? (
              <span className="ml-auto flex items-center gap-2 normal-case tracking-normal">
                <button type="button" onClick={() => (readingThis ? readAloud.stop() : readQuestion())} aria-pressed={readingThis}
                  className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100">
                  {readingThis ? '■ Stop reading' : '🔊 Read aloud'}
                </button>
                <label className="flex cursor-pointer items-center gap-1 text-slate-500 dark:text-slate-300">
                  <input type="checkbox" checked={autoRead} onChange={toggleAutoRead} className="h-3.5 w-3.5" /> Read every question
                </label>
              </span>
            ) : null}
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
            <ChoiceAnswer question={question} chosen={chosen} locked={Boolean(feedback)} onChoose={choose} reading={readingOption} />
          ) : null}

          {question.type === 'shortanswer' || question.type === 'fillgaps' ? (
            <form onSubmit={event => { event.preventDefault(); if (text.trim()) record(text); }} className="flex flex-col gap-3 sm:flex-row">
              <input ref={inputRef} value={text} disabled={Boolean(feedback)} onChange={event => setText(event.target.value)} placeholder="Type your answer" aria-label="Your answer"
                className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              <button type="submit" disabled={!text.trim() || Boolean(feedback)} className="rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white disabled:opacity-50 dark:bg-cyan-400 dark:text-black">Check</button>
            </form>
          ) : null}

          {question.type === 'crossmatching' ? (
            <div className="grid gap-3">
              <MatchingAnswer question={question} value={matching} locked={Boolean(feedback)} onChange={setMatching} />
              {!feedback ? <button type="button" onClick={() => record(matching)} className="justify-self-end rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white dark:bg-cyan-400 dark:text-black">Check</button> : null}
            </div>
          ) : null}

          {openEnded ? (
            <div className="grid gap-3">
              <textarea ref={inputRef} rows={6} value={text} disabled={revealed} onChange={event => setText(event.target.value)} placeholder="Write your answer and working (numbers, units, steps), then compare it with the model answer." aria-label="Your answer"
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              {!revealed ? <MathKeys inputRef={inputRef} value={text} onChange={setText} /> : null}
              {!revealed ? (
                <button type="button" onClick={() => setRevealed(true)} className="justify-self-end rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white dark:bg-cyan-400 dark:text-black">Show the model answer</button>
              ) : (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-400/30 dark:bg-indigo-500/10">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Model answer</p>
                  <div className="text-sm text-slate-800 dark:text-slate-100"><RichContent text={question.modelAnswer} /></div>
                  {text.trim() ? <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">You used {keywordOverlap(text, question.modelAnswer)}% of its key words.</p> : null}
                  {!feedback ? (
                    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Mark yourself">
                      <button type="button" onClick={() => record(text, 'got_it')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">✅ I got it</button>
                      <button type="button" onClick={() => record(text, 'partly')} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">🤏 Partly</button>
                      <button type="button" onClick={() => record(text, 'missed')} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white">❌ I missed it</button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          <AnimatePresence>
            {feedback ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`mt-5 rounded-2xl p-4 ${feedback.correct ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100' : feedback.credit > 0 ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100' : 'bg-rose-50 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100'}`} role="status">
                <p className="text-lg font-black">{feedback.correct ? ['Brilliant! 🎉', 'Spot on! ⭐', 'Nailed it! 💪'][index % 3] : feedback.credit > 0 ? 'Nearly there 👍' : 'Not quite 💡'}</p>
                {!feedback.correct && !openEnded ? <p className="mt-1 text-sm">Answer: <strong><RichContent text={String(expectedText(question))} inline /></strong></p> : null}
                {question.explanation && question.explanation !== question.modelAnswer ? <div className="mt-2 text-sm"><RichContent text={question.explanation} /></div> : null}
                <button type="button" onClick={next} className="mt-3 rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white dark:bg-white dark:text-black" autoFocus>
                  {index + 1 >= quiz.questions.length ? 'See results →' : 'Next →'}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.section>
      </AnimatePresence>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{subjectName} · {quiz.label} · Keys: A–D or 1–4 to answer, Enter for next</p>
    </div>
  );
}

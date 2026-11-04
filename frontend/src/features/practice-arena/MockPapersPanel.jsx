import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getMockPapers, openMockPaper, submitMockPaper } from './practiceApi';
import { askConfirm } from '../../shared/components/AppDialog';

// Mock papers: a student chooses objectives only, theory only, or both, sits it against the
// clock, and sees the answers after handing in. Theory is compared with the model answer.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'font-black text-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const PRIMARY = 'rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50';
const SECONDARY = 'rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const letter = index => String.fromCharCode(65 + index);
const DIAGRAM = 'mt-2 max-h-80 max-w-full rounded-xl bg-white p-1';
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function Sitting({ paper, onFinish, onLeave }) {
  const [answers, setAnswers] = useState({});
  const [written, setWritten] = useState({});
  const [left, setLeft] = useState(paper.minutes * 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handedIn = useRef(false);

  const handIn = useCallback(async () => {
    if (handedIn.current) return;
    handedIn.current = true;
    setBusy(true); setError('');
    try {
      const { result } = await submitMockPaper(paper.id, { part: paper.part, answers });
      onFinish(result, written);
    } catch (submitError) {
      handedIn.current = false;
      setError(submitError.message);
      setBusy(false);
    }
  }, [answers, onFinish, paper, written]);

  useEffect(() => {
    const timer = setInterval(() => setLeft(current => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (left === 0) handIn(); }, [left, handIn]);

  return (
    <div className="space-y-4">
      <div className={`${CARD} sticky top-2 z-10 flex flex-wrap items-center gap-3`}>
        <p className={`flex-1 ${HEADING}`}>{paper.examLabel} {paper.subjectName}: {paper.setLabel}</p>
        <p role="timer" aria-label="Time left" className="text-lg font-black text-slate-900 dark:text-white">{clock(left)}</p>
        <button type="button" className={SECONDARY} disabled={busy} onClick={onLeave}>Leave</button>
        <button type="button" className={PRIMARY} disabled={busy} onClick={handIn}>{busy ? 'Handing in…' : 'Hand in'}</button>
      </div>
      {error ? <p role="alert" className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-900 dark:bg-red-950 dark:text-red-100">{error}</p> : null}
      {paper.instructions ? <p className={BODY}>{paper.instructions}</p> : null}
      {paper.objectives.map(item => (
        <fieldset key={item.id} className={CARD}>
          <legend className="sr-only">Question {item.position}</legend>
          <p className={`${BODY} font-semibold`}>{item.position}. {item.prompt}</p>
          {item.imageUrl ? <img src={item.imageUrl} alt={`Diagram for question ${item.position}`} className={DIAGRAM} /> : null}
          <div className="mt-2 space-y-1">
            {item.options.map((option, index) => (
              <label key={option} className={`flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1 ${BODY}`}>
                <input type="radio" name={item.id} checked={answers[item.id] === index} onChange={() => setAnswers(current => ({ ...current, [item.id]: index }))} />
                <span>{letter(index)}. {option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {paper.theory.map(item => (
        <div key={item.id} className={CARD}>
          <p className={`${BODY} font-semibold`}>Theory {item.position} ({item.marks} marks). {item.prompt}</p>
          {item.imageUrl ? <img src={item.imageUrl} alt={`Diagram for theory question ${item.position}`} className={DIAGRAM} /> : null}
          <label className="mt-2 block text-xs font-bold text-slate-700 dark:text-slate-200">Your answer
            <textarea rows={6} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white" value={written[item.id] || ''} onChange={event => { const { value } = event.target; setWritten(current => ({ ...current, [item.id]: value })); }} />
          </label>
        </div>
      ))}
    </div>
  );
}

function Results({ paper, result, written, onClose }) {
  return (
    <div className="space-y-4">
      <div className={`${CARD} flex flex-wrap items-center gap-3`}>
        <div className="flex-1">
          <p className={HEADING}>{paper.examLabel} {paper.subjectName}: {paper.setLabel}</p>
          {result.total ? <p className="text-2xl font-black text-slate-900 dark:text-white">{result.score} / {result.total}</p> : null}
          {result.theory.length ? <p className={BODY}>Compare your theory answers with the model answers below. They are Ndovera's own, not an official marking scheme.</p> : null}
        </div>
        <button type="button" className={PRIMARY} onClick={onClose}>Back to papers</button>
      </div>
      {result.objectives.map(item => (
        <div key={item.id} className={CARD}>
          <p className={`${BODY} font-semibold`}>{item.position}. {item.prompt}</p>
          {item.imageUrl ? <img src={item.imageUrl} alt={`Diagram for question ${item.position}`} className={DIAGRAM} /> : null}
          <p className={`mt-1 text-sm font-bold ${item.correct ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
            {item.correct ? 'Correct' : item.picked === null ? 'Not answered' : `Your answer: ${letter(item.picked)}`} · Answer: {letter(item.answerIndex)}. {item.options[item.answerIndex]}
          </p>
          {item.explanation ? <p className={`mt-1 ${BODY}`}>{item.explanation}</p> : null}
        </div>
      ))}
      {result.theory.map(item => (
        <div key={item.id} className={CARD}>
          <p className={`${BODY} font-semibold`}>Theory {item.position} ({item.marks} marks). {item.prompt}</p>
          {item.imageUrl ? <img src={item.imageUrl} alt={`Diagram for theory question ${item.position}`} className={DIAGRAM} /> : null}
          {written[item.id] ? <p className={`mt-2 whitespace-pre-wrap ${BODY}`}><strong>Your answer:</strong> {written[item.id]}</p> : null}
          <p className={`mt-2 whitespace-pre-wrap ${BODY}`}><strong>Model answer:</strong> {item.modelAnswer}</p>
          {item.markingPoints.length ? <ul className={`mt-1 ml-5 list-disc ${BODY}`}>{item.markingPoints.map(point => <li key={point}>{point}</li>)}</ul> : null}
        </div>
      ))}
    </div>
  );
}

export default function MockPapersPanel({ onNeedPass }) {
  const [papers, setPapers] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sitting, setSitting] = useState(null);
  const [finished, setFinished] = useState(null);

  useEffect(() => { getMockPapers().then(result => setPapers(result.papers || [])).catch(error => { setPapers([]); setNotice(error.message); }); }, []);

  async function start(paper, part) {
    setBusy(true); setNotice('');
    try {
      setSitting((await openMockPaper(paper.id, part)).paper);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }

  const finish = useCallback((result, written) => { setFinished({ result, written }); }, []);
  const leave = async () => { if (await askConfirm('Leave this paper? It is not handed in and nothing is saved.')) setSitting(null); };

  if (finished && sitting) return <Results paper={sitting} result={finished.result} written={finished.written} onClose={() => { setFinished(null); setSitting(null); }} />;
  if (sitting) return <Sitting paper={sitting} onFinish={finish} onLeave={leave} />;

  return (
    <div className="space-y-3">
      {notice ? <p role="status" className="rounded-2xl bg-indigo-100 px-4 py-3 text-sm font-semibold text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100">{notice}</p> : null}
      {papers === null ? <p role="status" className={BODY}>Loading…</p> : null}
      {papers?.length === 0 ? <p className={`${CARD} ${BODY}`}>No mock papers for your section yet. They appear here as soon as they are ready.</p> : null}
      {(papers || []).map(paper => (
        <article key={paper.id} className={`${CARD} space-y-2`}>
          <h3 className={HEADING}>{paper.examLabel} {paper.subjectName}: {paper.setLabel}</h3>
          <p className={BODY}>
            {paper.objectiveCount ? `${paper.objectiveCount} objective questions, ${paper.objectiveMinutes} minutes` : ''}
            {paper.objectiveCount && paper.theoryCount ? ' · ' : ''}
            {paper.theoryCount ? `${paper.theoryCount} theory questions, ${paper.theoryMinutes} minutes` : ''}
          </p>
          {paper.locked ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className={`flex-1 ${BODY}`}>🔒 {paper.lockedReason}</p>
              <button type="button" className={SECONDARY} onClick={() => onNeedPass?.(paper.exam)}>See passes</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {paper.objectiveCount ? <button type="button" className={PRIMARY} disabled={busy} onClick={() => start(paper, 'objective')}>Objectives only</button> : null}
              {paper.theoryCount ? <button type="button" className={PRIMARY} disabled={busy} onClick={() => start(paper, 'theory')}>Theory only</button> : null}
              {paper.objectiveCount && paper.theoryCount ? <button type="button" className={PRIMARY} disabled={busy} onClick={() => start(paper, 'both')}>Both</button> : null}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

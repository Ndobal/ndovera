import React, { useCallback, useEffect, useRef, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { submitAssignment } from '../classroom/classroomService';
import { CountdownBar, useTimedAttempt } from '../classroom/assignments/TimedAttempt';
import { listStudentExams, openStudentExamPaper } from './assessmentsApi';

// A student's CBT exams. Each one shows only between its opening and closing
// times; the clock is the server's; time up submits what has been answered.
// Once written, the exam disappears — the paper comes back in the Assignments
// tab, with the answers, after the teacher posts the scores.

const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';

function Question({ question, number, value, onChange }) {
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    <li className="rounded-2xl border border-[#c9a96e]/40 bg-white p-4 text-[#191970]">
      <div className="flex gap-2"><span className="font-black">{number}.</span><div className="flex-1 font-semibold"><RichContent text={question.prompt} /></div><span className="whitespace-nowrap text-xs font-bold">[{question.score} mark{question.score === 1 ? '' : 's'}]</span></div>
      {question.type === 'mcq' ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {options.map((option, index) => (
            <label key={index} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${value === option ? 'border-[#1a5c38] bg-[#e8f5ee]' : 'border-[#c9a96e]/40'}`}>
              <input type="radio" name={question.id} className="mt-1" checked={value === option} onChange={() => onChange(option)} />
              <span><strong>{String.fromCharCode(65 + index)}.</strong> <RichContent inline text={option} /></span>
            </label>
          ))}
        </div>
      ) : question.type === 'fillgaps' ? (
        <input aria-label={`Answer to question ${number}`} className="mt-2 w-full rounded-xl border border-[#c9a96e]/45 p-2 text-sm" value={value || ''} onChange={event => onChange(event.target.value)} />
      ) : (
        <textarea aria-label={`Answer to question ${number}`} rows={question.type === 'essay' ? 10 : 5} className="mt-2 w-full rounded-xl border border-[#c9a96e]/45 p-2 text-sm" value={value || ''} onChange={event => onChange(event.target.value)} />
      )}
    </li>
  );
}

// Answers are kept on this device too, so a refresh or a dropped connection loses nothing (the timer resumes on the server).
const draftKey = paper => `ndv-exam-${paper.assignment.id}`;
function readDraft(paper) { try { return JSON.parse(localStorage.getItem(draftKey(paper)) || '{}') || {}; } catch { return {}; } }

function ExamRoom({ paper, onDone }) {
  const [answers, setAnswers] = useState(() => readDraft(paper));
  useEffect(() => { try { localStorage.setItem(draftKey(paper), JSON.stringify(answers)); } catch { /* storage unavailable */ } }, [paper, answers]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitted = useRef(false);

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    if (!auto) {
      const unanswered = paper.questions.filter(question => !String(answersRef.current[question.id] ?? '').trim()).length;
      if (unanswered && !window.confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} not answered. Submit anyway? You cannot change your answers afterwards.`)) return;
    }
    submitted.current = true;
    setBusy(true); setError('');
    try {
      const result = await submitAssignment(paper.assignment.id, { answers: answersRef.current });
      if (result && result.success === false) throw new Error(result.message || 'Could not submit.');
      try { localStorage.removeItem(draftKey(paper)); } catch { /* storage unavailable */ }
      onDone(auto ? 'Time is up — your answers were submitted.' : 'Submitted. Your teacher will post your score.');
    } catch (err) {
      submitted.current = false;
      setError(err.message || 'Could not submit. Check your connection and try again.');
    } finally { setBusy(false); }
  }, [paper, onDone]);

  const attempt = useTimedAttempt(paper.assignment, { onTimeUp: () => submit(true) });
  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 text-[#191970]">
        <h2 className="text-xl font-black text-[#800000]">{paper.exam.title}</h2>
        <p className="text-sm">{paper.exam.subjectName} · {paper.questions.length} questions · {paper.exam.durationMinutes} minutes{paper.exam.theoryOnPaper ? ' · the theory section is written on paper' : ''}</p>
      </section>
      <CountdownBar attempt={attempt} />
      {attempt.ready ? (
        <>
          <ol className="space-y-3">
            {paper.questions.map((question, index) => <Question key={question.id} question={question} number={index + 1} value={answers[question.id]} onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} />)}
          </ol>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
          <button type="button" className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`} disabled={busy} onClick={() => submit(false)}>{busy ? 'Submitting…' : 'Submit exam'}</button>
        </>
      ) : null}
    </div>
  );
}

export default function StudentExamRoom() {
  const [exams, setExams] = useState(null);
  const [paper, setPaper] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => listStudentExams().then(data => setExams(data.exams || [])).catch(err => setError(err.message)), []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000); // exams open on time without a refresh
    return () => clearInterval(timer);
  }, [load]);

  async function start(exam) {
    setError(''); setNotice('');
    try { setPaper(await openStudentExamPaper(exam.id)); } catch (err) { setError(err.message); load(); }
  }

  if (paper) return <ExamRoom paper={paper} onDone={message => { setPaper(null); setNotice(message); load(); }} />;
  return (
    <section className="space-y-3" aria-label="CBT exams">
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#1a5c38]">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
      {!exams ? <p role="status">Loading your exams…</p> : !exams.length ? <p className="text-sm text-slate-400">No CBT exams right now. Exams appear here when it is time to write them.</p> : (
        <ul className="space-y-2">
          {exams.map(exam => (
            <li key={exam.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#c9a96e]/40 bg-white p-4 text-[#191970]">
              <span className="flex-1"><strong>{exam.title}</strong><span className="block text-xs">{exam.subjectName} · {exam.durationMinutes} minutes · {exam.phase === 'open' ? `closes ${new Date(exam.closesAt).toLocaleString()}` : `opens ${new Date(exam.opensAt).toLocaleString()}`}{exam.theoryOnPaper ? ' · theory on paper' : ''}</span></span>
              {exam.phase === 'open'
                ? <button type="button" className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`} onClick={() => { if (window.confirm(`Start ${exam.title}? The ${exam.durationMinutes}-minute timer starts now and cannot be paused.`)) start(exam); }}>Start exam</button>
                : <span className="rounded-full bg-[#fff6e0] px-3 py-1 text-xs font-bold">Not open yet</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

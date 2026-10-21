import React, { useEffect, useState } from 'react';
import * as svc from '../classroomService';
import RichContent from '../../../shared/rich/RichContent';
import Overlay from '../../../shared/components/Overlay';
import { optionLetter, questionScore, totalScore, typeLabel } from './assignmentModel';

export const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY = `${BTN} bg-[#191970] text-white hover:bg-[#12124f] dark:bg-indigo-500 dark:hover:bg-indigo-400`;
export const SECONDARY = `${BTN} border border-slate-300 bg-white text-[#191970] hover:bg-slate-50 dark:border-white/15 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700`;
export const DANGER = `${BTN} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-400/30 dark:bg-slate-800 dark:text-rose-300`;

export function DialogHeader({ eyebrow, title, subtitle, onClose }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-[#c9a96e]">{eyebrow}</p> : null}
        <h3 className="truncate text-lg font-black text-[#0b1f3a] dark:text-white">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-xl leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
    </div>
  );
}

function QuestionReadOnly({ question, index }) {
  return (
    <article className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question {index + 1} · {typeLabel(question.type)}</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{questionScore(question)} mark{questionScore(question) === 1 ? '' : 's'}</span>
      </div>
      {question.passage ? <RichContent className="mb-2 rounded-xl bg-slate-50 p-3 text-[15px] dark:bg-white/5" text={question.passage} /> : null}
      <RichContent className="text-[15px] font-semibold text-slate-900 dark:text-white" text={question.prompt || ''} />
      {question.imageUrl ? <img src={question.imageUrl} alt="" className="mt-2 max-h-64 rounded-xl object-contain" /> : null}
      {question.type === 'mcq' && Array.isArray(question.options) ? (
        <ol className="mt-3 space-y-1.5">
          {question.options.map((option, optionIndex) => {
            const correct = option === question.answer;
            return (
              <li key={optionIndex} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[15px] ${correct ? 'bg-emerald-50 font-bold text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-slate-50 dark:bg-white/5'}`}>
                <span className="font-black">{optionLetter(optionIndex)}.</span><RichContent inline text={option} />{correct ? <span className="ml-auto text-xs">✓ Answer</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {question.type === 'crossmatching' && Array.isArray(question.pairs) ? (
        <ul className="mt-3 space-y-1 text-[15px]">{question.pairs.map((pair, pairIndex) => <li key={pairIndex} className="grid grid-cols-[1fr_auto_1fr] gap-2"><RichContent inline text={pair.left} /><span>↔</span><RichContent inline text={pair.right} /></li>)}</ul>
      ) : null}
      {question.explanation || question.markingGuide || (question.type !== 'mcq' && question.answer) || question.acceptedAnswers?.length ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-400/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Answer / marking guide</p>
          <RichContent className="text-slate-800 dark:text-slate-100" text={question.explanation || question.markingGuide || question.answer || (Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.join(', ') : question.acceptedAnswers) || ''} />
        </div>
      ) : null}
    </article>
  );
}

export function AssignmentViewer({ assignment, onClose }) {
  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
  return (
    <Overlay onClose={onClose} label={assignment.title} size="max-w-3xl">
      <DialogHeader eyebrow={assignment.subjectName || 'Assignment'} title={assignment.title} subtitle={`${questions.length} question${questions.length === 1 ? '' : 's'} · ${totalScore(questions)} marks`} onClose={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {assignment.description ? <RichContent className="rounded-xl bg-slate-50 p-3 text-[15px] dark:bg-white/5" text={assignment.description} /> : null}
        {questions.map((question, index) => <QuestionReadOnly key={question.id || index} question={question} index={index} />)}
        {!questions.length ? <p className="text-sm text-slate-500">No questions saved for this assignment.</p> : null}
      </div>
    </Overlay>
  );
}

export function SubmissionsPanel({ assignment, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState('');
  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
  const outOf = totalScore(questions) || Number(assignment?.metadata?.totalScore) || 100;

  useEffect(() => {
    svc.getSubmissions(assignment.id).then(data => setSubmissions(data?.submissions || [])).catch(() => {}).finally(() => setLoading(false));
  }, [assignment.id]);

  async function grade(submission) {
    const entry = grading[submission.id] || {};
    const value = entry.grade !== undefined ? entry.grade : submission.grade;
    if (value === '' || value === undefined || value === null) { setMessage(`Enter a mark (0–${outOf}) first.`); return; }
    const mark = Math.max(0, Math.min(Number(value) || 0, outOf));
    setSavingId(submission.id); setMessage('');
    try {
      const response = await svc.gradeSubmission(submission.id, { grade: mark, feedback: entry.feedback ?? submission.feedback ?? '' });
      if (!response?.success) throw new Error(response?.error || 'Could not save the mark.');
      setSubmissions(previous => previous.map(item => (item.id === submission.id ? { ...item, grade: mark, feedback: entry.feedback ?? item.feedback } : item)));
      setMessage(`Saved ${submission.studentName || 'mark'}: ${mark}/${outOf}.`);
    } catch (error) { setMessage(error.message); } finally { setSavingId(null); }
  }

  const marked = submissions.filter(submission => submission.grade != null).length;
  return (
    <Overlay onClose={onClose} label={`Submissions for ${assignment.title}`} size="max-w-4xl">
      <DialogHeader eyebrow="Submissions" title={assignment.title} subtitle={`${submissions.length} submitted · ${marked} marked`} onClose={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {message ? <p role="status" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-white/10 dark:text-white">{message}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading submissions…</p> : null}
        {!loading && !submissions.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">No student has submitted yet.</p> : null}
        {submissions.map(submission => {
          const answers = submission.content?.answers || submission.content || {};
          const paper = submission.paperQuestions || questions;
          const open = openId === submission.id;
          return (
            <article key={submission.id} className="rounded-2xl border border-slate-200 dark:border-white/10">
              <button type="button" onClick={() => setOpenId(open ? '' : submission.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191970] text-sm font-black text-[#c9a96e]">{String(submission.studentName || '?').charAt(0)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-900 dark:text-white">{submission.studentName || submission.studentId}</span>
                  <span className="block text-xs text-slate-500">{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ''}</span>
                </span>
                {submission.grade != null ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">{submission.grade}/{outOf}</span> : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">To mark</span>}
                <span aria-hidden="true" className="text-slate-400">{open ? '▴' : '▾'}</span>
              </button>
              {open ? (
                <div className="space-y-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                  {submission.paperCode ? <p className="text-xs font-bold text-[#800020]">Unique paper {submission.paperCode}: questions as this student saw them.</p> : null}
                  {paper.length ? paper.map((question, index) => {
                    const answer = answers[question.id || index];
                    const right = question.type === 'mcq' && question.answer && answer === question.answer;
                    return (
                      <div key={question.id || index} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                        <div className="flex gap-1 text-xs font-bold text-slate-500"><span>Q{index + 1}.</span><RichContent inline className="min-w-0" text={question.prompt || ''} /></div>
                        <div className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{answer !== undefined && answer !== '' ? <RichContent inline text={String(typeof answer === 'object' ? JSON.stringify(answer) : answer)} /> : <span className="italic text-slate-400">No answer</span>}</div>
                        {question.type === 'mcq' && question.answer ? <p className={`text-xs font-bold ${right ? 'text-emerald-700' : 'text-rose-700'}`}>{right ? '✓ Correct' : <>Correct answer: <RichContent inline text={question.answer} /></>}</p> : null}
                      </div>
                    );
                  }) : answers.response ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-[15px] dark:bg-white/5">{String(answers.response)}</p> : null}
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <label className="text-xs font-bold uppercase text-slate-500">Mark (0–{outOf})
                      <input type="number" min="0" max={outOf} inputMode="decimal" value={grading[submission.id]?.grade ?? (submission.grade ?? '')}
                        onChange={event => setGrading(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], grade: event.target.value } }))}
                        className="mt-1 block w-24 rounded-xl border border-slate-300 px-3 py-2 text-[15px] text-slate-900 dark:border-white/15 dark:bg-slate-800 dark:text-white" />
                    </label>
                    <label className="min-w-[12rem] flex-1 text-xs font-bold uppercase text-slate-500">Feedback (optional)
                      <input value={grading[submission.id]?.feedback ?? (submission.feedback || '')} onChange={event => setGrading(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], feedback: event.target.value } }))}
                        className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] text-slate-900 dark:border-white/15 dark:bg-slate-800 dark:text-white" placeholder="Well done, or what to improve" />
                    </label>
                    <button type="button" className={PRIMARY} disabled={savingId === submission.id} onClick={() => grade(submission)}>{savingId === submission.id ? 'Saving…' : 'Save mark'}</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Overlay>
  );
}

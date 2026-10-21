import React, { useEffect, useState } from 'react';
import * as svc from '../classroomService';
import { approveAssessmentBlueprint, createAiAssessment, generateNextQuestions } from '../../assessments/assessmentsApi';
import { getApiUrl } from '../../../config/apiBase';
import { buildSelectedRoleHeader } from '../../auth/services/authApi';
import Overlay from '../../../shared/components/Overlay';
import { DialogHeader, PRIMARY, SECONDARY } from './AssignmentDialogs';
import { questionForEditing } from './assignmentModel';

// "Create with Ndovera AI": the teacher says how many questions of each type, the marks and
// the topics; Ndovera AI writes them (the same engine as Ndovera AI assessments, paid from the
// teacher's or school's AI credits), and they land in the builder to review, edit and publish.

const TYPES = [
  ['mcq', 'Multiple choice', 1],
  ['short', 'Short answer', 2],
  ['fill', 'Fill in the gap', 1],
  ['calculation', 'Calculation', 4],
  ['structured', 'Structured / theory', 5],
  ['essay', 'Essay', 10],
];
const DIFFICULTY = [['easy', 'Easy'], ['standard', 'Standard'], ['hard', 'Challenging'], ['external', 'External exam (WAEC/NECO/BECE)']];
const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 dark:border-white/15 dark:bg-slate-800 dark:text-white';

async function classroomQuestions(assessmentId) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(`/api/ai-assessments/${encodeURIComponent(assessmentId)}/classroom-questions`), {
    credentials: 'include', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Could not load the questions.');
  return data;
}

export default function AiDraftDialog({ classId, subjectId, subjectName, className, title, onClose, onDone }) {
  const [topics, setTopics] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [counts, setCounts] = useState({ mcq: 10, short: 0, fill: 0, calculation: 0, structured: 2, essay: 0 });
  const [marks, setMarks] = useState(Object.fromEntries(TYPES.map(([key, , mark]) => [key, mark])));
  const [difficulty, setDifficulty] = useState('standard');
  const [instructions, setInstructions] = useState('');
  const [step, setStep] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    svc.getTopics(classId, subjectId).then(data => setTopics(data?.topics || [])).catch(() => setTopics([]));
  }, [classId, subjectId]);

  const chosen = TYPES.filter(([key]) => Number(counts[key]) > 0);
  const questionCount = chosen.reduce((sum, [key]) => sum + Number(counts[key]), 0);
  const totalMarks = chosen.reduce((sum, [key]) => sum + Number(counts[key]) * Math.max(1, Number(marks[key]) || 1), 0);

  async function generate() {
    setError('');
    try {
      setStep('Planning the questions…');
      const created = await createAiAssessment({
        kind: 'assignment', title: title || `${subjectName} assignment`, classId, subjectId, topicIds,
        questionCount, totalMarks, types: chosen.map(([key]) => key), difficulty, instructions, delivery: 'online',
      });
      const assessmentId = created.assessment.id;
      const blueprint = {
        sections: chosen.map(([key, label], index) => ({ name: String.fromCharCode(65 + index), type: key, questions: Number(counts[key]), attempt: Number(counts[key]), marksPerQuestion: Math.max(1, Number(marks[key]) || 1), instructions: label })),
        topics: (created.assessment.config?.topicNames || []).map(name => ({ name, marks: 0 })),
      };
      await approveAssessmentBlueprint(assessmentId, blueprint);
      // Written a few at a time, so each step stays inside the server's time limit.
      for (let round = 0; round < 25; round += 1) {
        const result = await generateNextQuestions(assessmentId);
        const done = Number(result.assessment?.questions?.length || 0);
        setStep(`Writing questions… ${Math.min(done, questionCount)} of ${questionCount}`);
        if (result.done) break;
      }
      setStep('Checking the answers…');
      const ready = await classroomQuestions(assessmentId);
      const flags = (ready.review?.issues || ready.review?.flags || []).length;
      onDone(ready.questions.map(questionForEditing), flags);
    } catch (generateError) {
      setStep('');
      setError(generateError.status === 402 || /credit/i.test(generateError.message || '')
        ? `${generateError.message} Buy AI credits in Ndovera AI, or ask the school to share its credits.`
        : (generateError.message || 'Ndovera AI could not write the questions. Try again.'));
    }
  }

  return (
    <Overlay onClose={step ? () => {} : onClose} label="Create with Ndovera AI" size="max-w-2xl">
      <DialogHeader eyebrow="Ndovera AI" title="Create questions with AI" subtitle={[subjectName, className].filter(Boolean).join(' · ')} onClose={step ? () => {} : onClose} />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Topics</p>
          {topics.length ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {topics.map(topic => {
                const on = topicIds.includes(topic.id);
                return <button key={topic.id} type="button" aria-pressed={on} onClick={() => setTopicIds(on ? topicIds.filter(id => id !== topic.id) : [...topicIds, topic.id])} className={`rounded-full border px-3 py-1 text-sm font-bold ${on ? 'border-[#191970] bg-[#191970] text-white' : 'border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{on ? '✓ ' : ''}{topic.name}</button>;
              })}
            </div>
          ) : <p className="mt-1 text-sm text-slate-500">This subject has no topics yet. Describe what to cover in the instructions below, or add topics in Subjects.</p>}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Questions</p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-white/5"><tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">How many</th><th className="px-3 py-2">Marks each</th></tr></thead>
              <tbody>
                {TYPES.map(([key, label]) => (
                  <tr key={key} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100">{label}</td>
                    <td className="px-3 py-1.5"><input type="number" min="0" max="60" inputMode="numeric" aria-label={`${label}: how many`} value={counts[key]} onChange={event => setCounts(current => ({ ...current, [key]: Math.max(0, Math.min(60, Number(event.target.value) || 0)) }))} className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-white/15 dark:bg-slate-800 dark:text-white" /></td>
                    <td className="px-3 py-1.5"><input type="number" min="1" max="50" inputMode="numeric" aria-label={`${label}: marks each`} value={marks[key]} onChange={event => setMarks(current => ({ ...current, [key]: Math.max(1, Math.min(50, Number(event.target.value) || 1)) }))} className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-white/15 dark:bg-slate-800 dark:text-white" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-sm font-bold text-[#0b1f3a] dark:text-white">{questionCount} question{questionCount === 1 ? '' : 's'} · {totalMarks} marks</p>
        </div>

        <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Difficulty</span>
          <select className={`${FIELD} mt-1`} value={difficulty} onChange={event => setDifficulty(event.target.value)}>{DIFFICULTY.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
        <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Anything else (optional)</span>
          <textarea rows={2} className={`${FIELD} mt-1`} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="e.g. Focus on word problems about money. Include one table to read." />
        </label>

        <p className="rounded-xl bg-[#eef0ff] px-3 py-2 text-sm text-[#191970] dark:bg-indigo-400/10 dark:text-indigo-100">Uses <b>100 AI credits</b> for the set (₦100), from your credits first, then the school's. You review and can change every question before publishing.</p>
        {step ? <p role="status" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-white/10 dark:text-white">⏳ {step}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10">
        <button type="button" className={SECONDARY} disabled={Boolean(step)} onClick={onClose}>Cancel</button>
        <button type="button" className={PRIMARY} disabled={Boolean(step) || !questionCount || (!topicIds.length && !instructions.trim())} onClick={generate}>{step ? 'Working…' : `Create ${questionCount} question${questionCount === 1 ? '' : 's'}`}</button>
      </div>
    </Overlay>
  );
}

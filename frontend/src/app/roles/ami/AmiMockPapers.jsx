import React, { useCallback, useEffect, useState } from 'react';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiBase } from '../../../config/apiBase';
import { askConfirm } from '../../../shared/components/AppDialog';

// Mock papers written with an AI assistant: choose the paper, copy the prompt, paste the
// reply back, check it, save it as a draft, read it through, then publish. On publishing,
// the objectives also go to the night's chief-examiner check.

const apiBase = getApiBase('');

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'font-black text-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const FIELD_LABEL = 'block text-xs font-bold text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50';
const SECONDARY = 'rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50 dark:border-white/20 dark:bg-slate-800 dark:text-white';

const EXAMS = [
  { key: 'waec', label: 'WAEC', options: 4 },
  { key: 'neco', label: 'NECO', options: 5 },
  { key: 'jamb', label: 'JAMB', options: 4, noTheory: true },
  { key: 'bece', label: 'BECE', options: 4 },
  { key: 'common_entrance', label: 'Common Entrance', options: 4 },
];

async function call(path, options = {}) {
  const auth = getStoredAuth();
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || data.error || `Request failed (${response.status})`), { data });
  return data;
}

/** The prompt Ami copies into an AI assistant. It asks for original questions in a form Ndovera can read. */
export function buildPaperPrompt({ exam, subject, setLabel, objectives, theory, objectiveMinutes, theoryMinutes }) {
  const info = EXAMS.find(item => item.key === exam) || EXAMS[0];
  const theoryCount = info.noTheory ? 0 : Number(theory) || 0;
  const letters = 'ABCDE'.slice(0, info.options).split('').join(', ');
  return [
    `Write an original ${info.label}-style practice paper in ${subject || '[SUBJECT]'} for Nigerian students.`,
    '',
    'Rules:',
    `- Write ${Number(objectives) || 0} objective questions, each with ${info.options} options (${letters}) and exactly one correct answer.`,
    theoryCount ? `- Write ${theoryCount} theory questions, each with its marks, a full model answer and marking points.` : '- Do not write theory questions.',
    `- Follow the ${info.label} syllabus and standard for this subject, and cover its topics evenly.`,
    '- Every question must be newly written. Do not copy or closely reword real past questions, and do not name a year or say a question came from a past paper.',
    `- Use diagrams, graphs or tables where a real ${info.label} paper in this subject would. Do not draw them. For each one, add a "diagram" field to that question describing exactly what must be drawn: every part, label, value and axis, with labels such as I, II, III. The description must not give away the answer.`,
    '- Leave out the "diagram" field for questions that do not need one.',
    '- Work out each answer before giving it, and explain the objective answers in one or two sentences.',
    '',
    'Reply with JSON only, with no other text, in exactly this form:',
    JSON.stringify({
      exam: info.label,
      subject: subject || '[SUBJECT]',
      setLabel: setLabel || 'Mock 1',
      objectiveMinutes: Number(objectiveMinutes) || 0,
      theoryMinutes: theoryCount ? Number(theoryMinutes) || 0 : 0,
      instructions: 'Answer all the objective questions.',
      objectives: [{ question: '...', options: ['...', '...'], answer: 'A', explanation: '...', diagram: 'Only if needed: what to draw' }],
      theory: theoryCount ? [{ question: '...', marks: 10, modelAnswer: '...', markingPoints: ['...'], diagram: 'Only if needed: what to draw' }] : [],
    }, null, 2),
  ].join('\n');
}

/** A question's diagram on the draft: what to draw, the image, and attaching or replacing it. */
function DiagramControl({ question, label, draft, busy, onAttach, onRemove }) {
  if (!question.diagram && !question.imageUrl && !draft) return null;
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-300 bg-white p-3 dark:border-white/20 dark:bg-slate-900">
      {question.diagram ? <p className={BODY}><strong>Diagram to draw:</strong> {question.diagram}</p> : null}
      {question.imageUrl ? <img src={question.imageUrl} alt={`Diagram for ${label}`} className="max-h-64 rounded-lg bg-white p-1" /> : null}
      {question.diagram && !question.imageUrl ? <p className="text-sm font-bold text-red-800 dark:text-red-300">Diagram not attached yet</p> : null}
      {draft ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className={FIELD_LABEL}>{question.imageUrl ? `Replace diagram for ${label}` : `Attach diagram for ${label}`}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className={`${BODY} mt-1 block`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAttach(question.id, file); }} />
          </label>
          {question.imageUrl ? <button type="button" className={SECONDARY} disabled={busy} onClick={() => onRemove(question.id)}>Remove diagram</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function ReadThrough({ paper, busy, onAttach, onRemove }) {
  const draft = paper.status !== 'published';
  const controls = { draft, busy, onAttach, onRemove };
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
      {paper.objectives.map(item => (
        <div key={item.id} className={BODY}>
          <p className="font-semibold">{item.position}. {item.prompt}</p>
          <ol className="ml-5 list-[upper-alpha]">{item.options.map((option, index) => <li key={option} className={index === item.answerIndex ? 'font-bold text-emerald-800 dark:text-emerald-300' : ''}>{option}{index === item.answerIndex ? ' ✓' : ''}</li>)}</ol>
          {item.explanation ? <p className="text-xs">{item.explanation}</p> : null}
          <DiagramControl question={item} label={`Objective ${item.position}`} {...controls} />
        </div>
      ))}
      {paper.theory.map(item => (
        <div key={item.id} className={BODY}>
          <p className="font-semibold">Theory {item.position} ({item.marks} marks). {item.prompt}</p>
          <p className="mt-1 whitespace-pre-wrap">{item.modelAnswer}</p>
          {item.markingPoints.length ? <ul className="ml-5 list-disc">{item.markingPoints.map(point => <li key={point}>{point}</li>)}</ul> : null}
          <DiagramControl question={item} label={`Theory ${item.position}`} {...controls} />
        </div>
      ))}
    </div>
  );
}

export default function AmiMockPapers() {
  const [form, setForm] = useState({ exam: 'waec', subject: '', setLabel: 'Mock 1', objectives: 50, theory: 6, objectiveMinutes: 60, theoryMinutes: 120 });
  const [text, setText] = useState('');
  const [check, setCheck] = useState(null);
  const [papers, setPapers] = useState([]);
  const [open, setOpen] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => call('/api/ami/mock-papers').then(result => setPapers(result.papers || [])).catch(error => setMessage(error.message)), []);
  useEffect(() => { load(); }, [load]);

  const prompt = buildPaperPrompt(form);
  const noTheory = EXAMS.find(item => item.key === form.exam)?.noTheory;
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function run(action) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error.message); if (error.data?.problems) setCheck({ problems: error.data.problems, warnings: error.data.warnings || [] }); } finally { setBusy(false); }
  }

  const copy = () => run(async () => { await navigator.clipboard.writeText(prompt); setMessage('Prompt copied. Paste it into ChatGPT.'); });
  const checkPaper = () => run(async () => setCheck(await call('/api/ami/mock-papers/check', { method: 'POST', body: JSON.stringify({ text }) })));
  const save = () => run(async () => {
    const result = await call('/api/ami/mock-papers', { method: 'POST', body: JSON.stringify({ text }) });
    setMessage(`Saved "${result.paper.setLabel}" as a draft. Read it through below, then publish it.`);
    setText(''); setCheck(null); setOpen(result.paper); await load();
  });
  const read = id => run(async () => { if (open?.id === id) { setOpen(null); return; } setOpen((await call(`/api/ami/mock-papers/${id}`)).paper); });
  const setStatus = (id, status) => run(async () => {
    const result = await call(`/api/ami/mock-papers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    if (open?.id === id) setOpen(result.paper);
    setMessage(status === 'published' ? 'Published. Its objectives join tonight\'s quality check.' : 'Withdrawn. Students can no longer open it.');
    await load();
  });
  const attach = (paperId, questionId, file) => run(async () => {
    const data = new FormData();
    data.append('file', file);
    setOpen((await call(`/api/ami/mock-papers/${paperId}/questions/${questionId}/diagram`, { method: 'POST', body: data })).paper);
    setMessage('Diagram attached. Check it matches the question.');
    await load();
  });
  const detach = (paperId, questionId) => run(async () => {
    setOpen((await call(`/api/ami/mock-papers/${paperId}/questions/${questionId}/diagram`, { method: 'DELETE' })).paper);
    await load();
  });
  const remove = paper => run(async () => {
    if (!await askConfirm(`Delete "${paper.setLabel}" for ${paper.examLabel} ${paper.subjectName}?`)) return;
    await call(`/api/ami/mock-papers/${paper.id}`, { method: 'DELETE' });
    if (open?.id === paper.id) setOpen(null);
    await load();
  });

  return (
    <section className={`${CARD} space-y-5`} aria-label="Mock papers">
      <div>
        <h2 className={`text-lg ${HEADING}`}>Mock papers</h2>
        <p className={BODY}>Whole papers with objectives and theory. Students choose objectives only, theory only, or both. Write them with ChatGPT in three steps. Use original questions, not real past papers. ChatGPT describes any diagrams it needs, and you attach the images before publishing.</p>
      </div>

      <div className="space-y-3">
        <h3 className={HEADING}>1. Choose the paper and copy the prompt</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className={FIELD_LABEL}>Exam
            <select className={FIELD} value={form.exam} onChange={event => change('exam', event.target.value)}>{EXAMS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          </label>
          <label className={FIELD_LABEL}>Subject
            <input className={FIELD} value={form.subject} onChange={event => change('subject', event.target.value)} placeholder="e.g. Mathematics" />
          </label>
          <label className={FIELD_LABEL}>Paper name
            <input className={FIELD} value={form.setLabel} onChange={event => change('setLabel', event.target.value)} />
          </label>
          <label className={FIELD_LABEL}>Objective questions
            <input type="number" min="0" className={FIELD} value={form.objectives} onChange={event => change('objectives', event.target.value)} />
          </label>
          <label className={FIELD_LABEL}>Objective minutes
            <input type="number" min="0" className={FIELD} value={form.objectiveMinutes} onChange={event => change('objectiveMinutes', event.target.value)} />
          </label>
          {!noTheory && (
            <>
              <label className={FIELD_LABEL}>Theory questions
                <input type="number" min="0" className={FIELD} value={form.theory} onChange={event => change('theory', event.target.value)} />
              </label>
              <label className={FIELD_LABEL}>Theory minutes
                <input type="number" min="0" className={FIELD} value={form.theoryMinutes} onChange={event => change('theoryMinutes', event.target.value)} />
              </label>
            </>
          )}
        </div>
        <label className={FIELD_LABEL}>Prompt for ChatGPT
          <textarea readOnly rows={8} className={`${FIELD} font-mono text-xs`} value={prompt} />
        </label>
        <button type="button" className={SECONDARY} disabled={busy || !form.subject.trim()} onClick={copy}>Copy prompt</button>
      </div>

      <div className="space-y-3">
        <h3 className={HEADING}>2. Paste the reply and check it</h3>
        <label className={FIELD_LABEL}>ChatGPT's reply
          <textarea rows={8} className={`${FIELD} font-mono text-xs`} value={text} onChange={event => { setText(event.target.value); setCheck(null); }} placeholder="Paste the whole reply here" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY} disabled={busy || !text.trim()} onClick={checkPaper}>Check paper</button>
          <button type="button" className={PRIMARY} disabled={busy || !check?.summary} onClick={save}>Save as draft</button>
        </div>
        {check?.summary ? <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50">Ready: {check.summary.subjectName}, "{check.summary.setLabel}", {check.summary.objectives} objective and {check.summary.theory} theory questions{check.summary.diagrams ? `, ${check.summary.diagrams} needing a diagram you will attach after saving` : ''}.</p> : null}
        {check?.problems?.length ? <ul role="alert" className="list-disc rounded-2xl bg-red-100 px-8 py-3 text-sm font-semibold text-red-900 dark:bg-red-950 dark:text-red-100">{check.problems.map(problem => <li key={problem}>{problem}</li>)}</ul> : null}
        {check?.warnings?.length ? <ul className="list-disc rounded-2xl bg-amber-100 px-8 py-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{check.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      </div>

      <div className="space-y-3">
        <h3 className={HEADING}>3. Read it through and publish</h3>
        {message ? <p role="status" className="rounded-2xl bg-indigo-100 px-4 py-3 text-sm font-semibold text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100">{message}</p> : null}
        {papers.length ? papers.map(paper => (
          <article key={paper.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`flex-1 ${BODY}`}><strong>{paper.examLabel} {paper.subjectName}: {paper.setLabel}</strong><br />{paper.objectiveCount} objective ({paper.objectiveMinutes} min) · {paper.theoryCount} theory ({paper.theoryMinutes} min) · {paper.status === 'published' ? 'Published' : 'Draft'}{paper.diagramsMissing ? ` · ${paper.diagramsMissing} diagram${paper.diagramsMissing === 1 ? '' : 's'} to attach` : ''}</p>
              <button type="button" className={SECONDARY} disabled={busy} onClick={() => read(paper.id)}>{open?.id === paper.id ? 'Close' : 'Read'}</button>
              {paper.status === 'published'
                ? <button type="button" className={SECONDARY} disabled={busy} onClick={() => setStatus(paper.id, 'draft')}>Withdraw</button>
                : <>
                    <button type="button" className={PRIMARY} disabled={busy || paper.diagramsMissing > 0} onClick={() => setStatus(paper.id, 'published')}>Publish</button>
                    <button type="button" className={SECONDARY} disabled={busy} onClick={() => remove(paper)}>Delete</button>
                  </>}
            </div>
            {open?.id === paper.id ? <ReadThrough paper={open} busy={busy} onAttach={(questionId, file) => attach(paper.id, questionId, file)} onRemove={questionId => detach(paper.id, questionId)} /> : null}
          </article>
        )) : <p className={BODY}>No mock papers yet.</p>}
      </div>
    </section>
  );
}

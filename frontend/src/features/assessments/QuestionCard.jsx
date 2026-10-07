import React, { useRef, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import RichTextToolbar from '../../shared/rich/RichTextToolbar';
import { PART_LABELS } from './paperStructure';
import { fillTemplates, hasVariables, masterValues } from './variants';
import { BLOOM, BLOOM_LABELS, TYPE_LABELS, letter } from './assessmentsApi';

// One question in the teacher's review: read view with every control the spec
// asks for — Edit, Delete, Regenerate, Duplicate, Move, Change marks / Bloom /
// difficulty, page break — and an inline editor.

const BTN = 'rounded-lg border border-[#c9a96e]/45 bg-white px-2 py-1 text-xs font-bold text-[#800020] hover:bg-[#fff6e0] disabled:opacity-40';
const FIELD = 'w-full rounded-lg border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const DIFFICULTY = ['easy', 'standard', 'hard', 'external'];
const lines = value => String(value || '').split('\n').map(line => line.trim()).filter(Boolean);

function Editor({ question, optionCount, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    ...question,
    optionsText: question.options || [],
    markingText: (question.markingPoints || []).join('\n'),
    alternativesText: (question.alternatives || []).join('\n'),
    workingText: (question.workingSteps || []).join('\n'),
    rubricText: (question.rubric || []).map(row => `${row.criterion} | ${row.marks}`).join('\n'),
    partsDraft: (question.parts || []).map(part => ({ ...part, markingText: (part.markingPoints || []).join('\n') })),
  }));
  const promptRef = useRef(null);
  const set = patch => setDraft(previous => ({ ...previous, ...patch }));
  const setPart = (index, patch) => set({ partsDraft: draft.partsDraft.map((part, i) => (i === index ? { ...part, ...patch } : part)) });
  const objective = ['mcq', 'truefalse'].includes(draft.type);
  const partMarks = draft.partsDraft.reduce((sum, part) => sum + (Number(part.marks) || 0), 0);

  function save() {
    const parts = objective ? [] : draft.partsDraft.filter(part => part.prompt.trim()).map((part, index) => ({
      label: PART_LABELS[index], prompt: part.prompt, marks: Math.max(0, Number(part.marks) || 0), answer: part.answer || '', markingPoints: lines(part.markingText),
    }));
    const options = draft.type === 'truefalse' ? ['True', 'False'] : draft.optionsText.map(option => option.trim());
    onSave({
      ...question,
      type: draft.type, prompt: draft.prompt, marks: parts.length ? parts.reduce((sum, part) => sum + part.marks, 0) : Math.max(0, Number(draft.marks) || 0), parts, compulsory: Boolean(draft.compulsory), bloom: draft.bloom, difficulty: draft.difficulty, topic: draft.topic,
      options: objective ? options : [], answerIndex: objective ? Number(draft.answerIndex) : -1,
      answer: draft.answer || '', markingPoints: lines(draft.markingText), alternatives: lines(draft.alternativesText), workingSteps: lines(draft.workingText),
      rubric: lines(draft.rubricText).map(line => { const [criterion, marks] = line.split('|'); return { criterion: (criterion || '').trim(), marks: Number(marks) || 0 }; }),
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[#1a5c38]/30 bg-[#f4fbf7] p-3">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Question type" className={`${FIELD} w-auto`} value={draft.type} onChange={event => set({ type: event.target.value, optionsText: event.target.value === 'mcq' && !draft.optionsText.length ? Array(optionCount).fill('') : draft.optionsText })}>
          {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs font-bold text-[#800020]">Marks <input type="number" min="0" className={`${FIELD} w-20`} disabled={draft.partsDraft.length > 0} value={draft.partsDraft.length ? partMarks : draft.marks} onChange={event => set({ marks: event.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs font-bold text-[#800020]"><input type="checkbox" checked={Boolean(draft.compulsory)} onChange={event => set({ compulsory: event.target.checked })} /> Compulsory</label>
        <select aria-label="Bloom level" className={`${FIELD} w-auto`} value={draft.bloom} onChange={event => set({ bloom: event.target.value })}>{BLOOM.map(level => <option key={level} value={level}>{BLOOM_LABELS[level]}</option>)}</select>
        <select aria-label="Difficulty" className={`${FIELD} w-auto`} value={draft.difficulty} onChange={event => set({ difficulty: event.target.value })}>{DIFFICULTY.map(level => <option key={level} value={level}>{level}</option>)}</select>
        <input aria-label="Topic" className={`${FIELD} w-40`} value={draft.topic} onChange={event => set({ topic: event.target.value })} placeholder="Topic" />
      </div>
      <div className="block text-xs font-bold text-[#800020]">Question — use the toolbar for tables, formulas, graphs and diagrams
        <RichTextToolbar textareaRef={promptRef} value={draft.prompt || ''} onChange={prompt => set({ prompt })} />
        <textarea ref={promptRef} aria-label="Question" rows={5} className={FIELD} value={draft.prompt} onChange={event => set({ prompt: event.target.value })} />
        {draft.prompt ? <div className="mt-1 rounded-lg bg-white p-2 font-normal text-[#191970]"><RichContent text={hasVariables(draft.prompt) ? fillTemplates(draft.prompt, masterValues({ prompt: draft.prompt })) : draft.prompt} /></div> : null}
        <details className="mt-1 font-normal text-[#191970]">
          <summary className="cursor-pointer text-[11px] font-bold text-[#800020]">Different numbers for each student</summary>
          <p className="mt-1 text-xs">Write <code>{'{{d=100..300}}'}</code> for a number that changes (whole numbers from 100 to 300; add <code>step 0.5</code> for halves), <code>{'{{d}}'}</code> to repeat it, and <code>{'{{= d/t}}'}</code> for a worked value (<code>{'{{= d/t :1}}'}</code> rounds to 1 decimal place). Use them in the options and answer too, e.g. option A <code>{'{{= d/t}} km/h'}</code>, option B <code>{'{{= d*t}} km/h'}</code>. sin, cos and tan use degrees. The preview shows the lowest values; each student gets their own.</p>
        </details>
      </div>
      {draft.type === 'mcq' && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-bold text-[#800020]">Options — select the correct one</legend>
          {draft.optionsText.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input type="radio" name={`answer-${question.id}`} aria-label={`Option ${letter(index)} is correct`} checked={Number(draft.answerIndex) === index} onChange={() => set({ answerIndex: index })} />
              <span className="w-5 font-bold">{letter(index)}.</span>
              <input className={FIELD} value={option} onChange={event => set({ optionsText: draft.optionsText.map((value, i) => (i === index ? event.target.value : value)) })} />
            </div>
          ))}
        </fieldset>
      )}
      {draft.type === 'truefalse' && (
        <label className="flex items-center gap-2 text-sm">Correct answer
          <select className={`${FIELD} w-auto`} value={draft.answerIndex} onChange={event => set({ answerIndex: Number(event.target.value) })}><option value={0}>True</option><option value={1}>False</option></select>
        </label>
      )}
      {!objective && (
        <fieldset className="space-y-2 rounded-xl border border-[#c9a96e]/40 p-2">
          <legend className="px-1 text-xs font-bold text-[#800020]">Parts {draft.partsDraft.length ? `— ${partMarks} marks in all` : '(optional: (a), (b), (c)…)'}</legend>
          {draft.partsDraft.map((part, index) => (
            <div key={index} className="space-y-1 rounded-lg bg-white p-2">
              <div className="flex items-center gap-2">
                <span className="font-black">({PART_LABELS[index]})</span>
                <input aria-label={`Part ${PART_LABELS[index]}`} className={FIELD} value={part.prompt} onChange={event => setPart(index, { prompt: event.target.value })} />
                <label className="flex items-center gap-1 text-xs font-bold text-[#800020]">Marks<input type="number" min="0" className={`${FIELD} w-16`} value={part.marks} onChange={event => setPart(index, { marks: event.target.value })} /></label>
                <button type="button" className={BTN} onClick={() => set({ partsDraft: draft.partsDraft.filter((_, i) => i !== index) })}>Remove</button>
              </div>
              <div className="grid gap-1 md:grid-cols-2">
                <textarea rows={2} aria-label={`Part ${PART_LABELS[index]} answer`} className={FIELD} placeholder="Expected answer" value={part.answer || ''} onChange={event => setPart(index, { answer: event.target.value })} />
                <textarea rows={2} aria-label={`Part ${PART_LABELS[index]} marking points`} className={FIELD} placeholder="Marking points, one per line" value={part.markingText} onChange={event => setPart(index, { markingText: event.target.value })} />
              </div>
            </div>
          ))}
          <button type="button" className={BTN} disabled={draft.partsDraft.length >= PART_LABELS.length} onClick={() => set({ partsDraft: [...draft.partsDraft, { prompt: '', marks: 2, answer: '', markingText: '' }] })}>+ Part ({PART_LABELS[draft.partsDraft.length] || '—'})</button>
        </fieldset>
      )}
      {!objective && (
        <label className="block text-xs font-bold text-[#800020]">Expected answer
          <textarea rows={2} className={FIELD} value={draft.answer} onChange={event => set({ answer: event.target.value })} />
        </label>
      )}
      <label className="block text-xs font-bold text-[#800020]">Marking points (one per line)
        <textarea rows={3} className={FIELD} value={draft.markingText} onChange={event => set({ markingText: event.target.value })} />
      </label>
      {!objective && (
        <div className="grid gap-2 md:grid-cols-3">
          <label className="block text-xs font-bold text-[#800020]">Also accept (one per line)<textarea rows={2} className={FIELD} value={draft.alternativesText} onChange={event => set({ alternativesText: event.target.value })} /></label>
          <label className="block text-xs font-bold text-[#800020]">Working steps (one per line)<textarea rows={2} className={FIELD} value={draft.workingText} onChange={event => set({ workingText: event.target.value })} /></label>
          <label className="block text-xs font-bold text-[#800020]">Rubric: criterion | marks<textarea rows={2} className={FIELD} value={draft.rubricText} onChange={event => set({ rubricText: event.target.value })} /></label>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="rounded-lg bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]" onClick={save}>Done</button>
        <button type="button" className={BTN} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function QuestionCard({ question, number, total, optionCount, readOnly, finding, onChange, onDelete, onDuplicate, onMove, onRegenerate, busy }) {
  // Templates stay in what is edited and saved; the card shows the master values.
  const shown = hasVariables(question) ? fillTemplates(question, masterValues(question)) : question;
  const [editing, setEditing] = useState(!question.prompt);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState('');

  if (editing && !readOnly) {
    return <Editor question={question} optionCount={optionCount} onSave={next => { onChange(next); setEditing(false); }} onCancel={() => (question.prompt ? setEditing(false) : onDelete())} />;
  }

  return (
    <article className={`rounded-2xl border bg-white p-4 text-[#191970] ${finding ? 'border-amber-400' : 'border-[#c9a96e]/40'}`} aria-label={`Question ${number}`}>
      {question.pageBreakBefore && <p className="ndv-page-break-marker">Page break</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[#191970] px-2 py-0.5 font-black text-white">Q{number}</span>
        <span className="rounded-full bg-[#fff6e0] px-2 py-0.5 font-bold">{TYPE_LABELS[question.type]}</span>
        <span className="rounded-full bg-[#e8f5ee] px-2 py-0.5 font-bold text-[#1a5c38]">{BLOOM_LABELS[question.bloom]}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{question.difficulty}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{question.topic || '—'}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5">Section {question.section}</span>
        {hasVariables(question) && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-900" title="Each student gets their own numbers; shown here at the lowest values">Numbers vary per student</span>}
        {question.source === 'teacher' && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-900">Teacher's question</span>}
        <span className="ml-auto font-black">{question.marks} mark{question.marks === 1 ? '' : 's'}</span>
      </div>
      {question.compulsory && <p className="mt-2 text-xs font-black italic text-[#800020]">Compulsory</p>}
      <RichContent text={shown.prompt} className="mt-2 text-[15px]" />
      {question.parts?.length > 0 && (
        <ol className="mt-2 space-y-1">
          {shown.parts.map(part => <li key={part.label} className="flex gap-2 text-sm"><span className="font-black">({part.label})</span><RichContent text={part.prompt} className="flex-1" /><span className="whitespace-nowrap text-xs font-bold">[{part.marks}]</span></li>)}
        </ol>
      )}
      {question.options?.length > 0 && (
        <ol className="mt-2 grid gap-1 sm:grid-cols-2">
          {shown.options.map((option, index) => (
            <li key={index} className={`rounded-lg px-2 py-1 text-sm ${index === question.answerIndex ? 'bg-emerald-50 font-bold text-emerald-900 ring-1 ring-emerald-300' : 'bg-slate-50'}`}>
              {letter(index)}. <RichContent inline text={option} />{index === question.answerIndex ? ' ✓' : ''}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-bold text-[#800020]">Marking scheme</summary>
        {shown.answer && <RichContent text={shown.answer} className="mt-1" />}
        {shown.markingPoints?.length > 0 && <ul className="mt-1 list-disc pl-5">{shown.markingPoints.map((point, i) => <li key={i}><RichContent inline text={point} /></li>)}</ul>}
        {shown.workingSteps?.length > 0 && <ol className="mt-1 list-decimal pl-5">{shown.workingSteps.map((step, i) => <li key={i}><RichContent inline text={step} /></li>)}</ol>}
        {(shown.parts || []).map(part => (
          <div key={part.label} className="mt-1"><strong>({part.label})</strong> {part.answer ? <RichContent inline text={part.answer} /> : null}
            {part.markingPoints?.length > 0 && <ul className="list-disc pl-5">{part.markingPoints.map((point, i) => <li key={i}><RichContent inline text={point} /></li>)}</ul>}
          </div>
        ))}
        {question.rubric?.length > 0 && <ul className="mt-1">{question.rubric.map((row, i) => <li key={i}>{row.criterion} — {row.marks}</li>)}</ul>}
      </details>
      {finding && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">⚠ Ndovera AI review: {finding}</p>}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-1">
          <button type="button" className={BTN} onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className={BTN} disabled={busy} onClick={() => setRegenOpen(open => !open)}>Regenerate</button>
          <button type="button" className={BTN} onClick={onDuplicate}>Duplicate</button>
          <button type="button" className={BTN} disabled={number === 1} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button type="button" className={BTN} disabled={number === total} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <label className="flex items-center gap-1 text-xs font-bold text-[#800020]">Marks
            <input type="number" min="0" disabled={question.parts?.length > 0} title={question.parts?.length ? 'Set marks on each part in Edit' : undefined} className="w-14 rounded-lg border border-[#c9a96e]/45 p-1" value={question.marks} onChange={event => onChange({ ...question, marks: Math.max(0, Number(event.target.value) || 0) })} />
          </label>
          <select aria-label="Bloom level" className="rounded-lg border border-[#c9a96e]/45 p-1 text-xs" value={question.bloom} onChange={event => onChange({ ...question, bloom: event.target.value })}>{BLOOM.map(level => <option key={level} value={level}>{BLOOM_LABELS[level]}</option>)}</select>
          <select aria-label="Difficulty" className="rounded-lg border border-[#c9a96e]/45 p-1 text-xs" value={question.difficulty} onChange={event => onChange({ ...question, difficulty: event.target.value })}>{DIFFICULTY.map(level => <option key={level} value={level}>{level}</option>)}</select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(question.pageBreakBefore)} onChange={event => onChange({ ...question, pageBreakBefore: event.target.checked })} /> Page break before</label>
          <button type="button" className={`${BTN} !text-rose-700`} onClick={onDelete}>Delete</button>
        </div>
      )}
      {regenOpen && !readOnly && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-[#eef0ff] p-2">
          <input className="flex-1 rounded-lg border border-[#c9a96e]/45 p-1.5 text-sm" placeholder="Optional: what to change (e.g. use a data table, make it harder)" value={instruction} onChange={event => setInstruction(event.target.value)} />
          <button type="button" className="rounded-lg bg-[#191970] px-3 py-1.5 text-xs font-bold text-white" disabled={busy} onClick={() => { onRegenerate(instruction); setRegenOpen(false); setInstruction(''); }}>{busy ? 'Writing…' : 'Regenerate with Ndovera AI'}</button>
        </div>
      )}
    </article>
  );
}

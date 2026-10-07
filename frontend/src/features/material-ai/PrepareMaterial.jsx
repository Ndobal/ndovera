import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AiBlockEditor, AiBlockView, BLOCK_LABELS } from './AiBlocks';
import * as api from './materialAiApi';

// "✨ Prepare with Ndovera AI" in Materials. The teacher chooses what to teach;
// Ndovera checks where it sits in the school's curriculum (and says so when
// the class does not match), grounds it in the chosen examinations, writes it
// section by section, checks it, and the teacher reviews, edits and publishes.

const CARD = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-4 dark:border-white/10 dark:bg-slate-900';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2.5 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-400';
const CHECK = { pass: '✅', warn: '⚠️', fail: '⛔' };

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[#b5e3f4] shadow-2xl sm:rounded-3xl dark:bg-slate-950">
        <div className="flex items-center gap-3 border-b border-[#c9a96e]/40 px-4 py-3">
          <p className="flex-1 text-lg font-black text-[#800000] dark:text-white">✨ {title}</p>
          <button type="button" className={SECONDARY} onClick={onClose}>Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Step 1–3: what, where in the curriculum, which examinations, how ──────

function ResolutionPanel({ resolution, onDecide, decision, levelPick, setLevelPick, onChangeTopic }) {
  const { status, message, matches = [], match, chosenClass } = resolution;
  const tone = status === 'matched' ? 'border-emerald-400 bg-emerald-50' : status === 'no_curriculum' || status === 'not_found' ? 'border-amber-400 bg-amber-50' : 'border-rose-300 bg-rose-50';
  return (
    <div className={`rounded-2xl border p-4 text-sm text-[#191970] ${tone}`} role="status">
      <p className="font-bold">{status === 'mismatch' ? 'Curriculum mismatch detected' : status === 'multiple' ? 'This topic appears at several curriculum levels' : status === 'matched' ? 'Found in your curriculum' : status === 'not_found' ? 'Not found in your curriculum' : 'No curriculum on file'}</p>
      <p className="mt-1">{message}</p>
      {status === 'matched' && match && (
        <div className="mt-2 rounded-xl bg-white/80 p-3">
          <p className="font-semibold">{match.classLabel} › {match.subject}{match.theme ? ` › ${match.theme}` : ''} › {match.topic} <span className="text-xs text-slate-500">({Math.round(match.confidence * 100)}% match · {match.curriculumName})</span></p>
          {match.objectives?.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{match.objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul>}
        </div>
      )}
      {status === 'mismatch' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={decision === 'use_found' ? PRIMARY : SECONDARY} onClick={() => onDecide('use_found', [matches[0]?.id])}>Use {matches[0]?.classLabel} curriculum objectives</button>
          <button type="button" className={decision === 'keep' ? PRIMARY : SECONDARY} onClick={() => onDecide('keep', [])}>Keep {chosenClass?.label || 'my class'}</button>
          <button type="button" className={SECONDARY} onClick={onChangeTopic}>Choose another topic</button>
        </div>
      )}
      {status === 'multiple' && (
        <div className="mt-3 space-y-2">
          {matches.map(row => (
            <label key={row.id} className="flex items-start gap-2 rounded-xl bg-white/80 p-2">
              <input type="radio" name="curriculum-level" checked={levelPick === row.id && decision === 'matched'} onChange={() => { setLevelPick(row.id); onDecide('matched', [row.id]); }} />
              <span><strong>{row.classLabel}</strong> — {row.topic}{row.objectives?.length ? <span className="block text-xs text-slate-600">{row.objectives.slice(0, 3).join('; ')}</span> : null}</span>
            </label>
          ))}
          <button type="button" className={decision === 'progressive' ? PRIMARY : SECONDARY} onClick={() => onDecide('progressive', matches.map(row => row.id))}>Generate progressive material across levels</button>
        </div>
      )}
      {(status === 'not_found' || status === 'no_curriculum') && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={decision === 'ungrounded' ? PRIMARY : SECONDARY} onClick={() => onDecide('ungrounded', [])}>Continue — label it “not curriculum-checked”</button>
          {status === 'not_found' && <button type="button" className={SECONDARY} onClick={onChangeTopic}>Choose another topic</button>}
        </div>
      )}
    </div>
  );
}

function Setup({ classId, subjects, defaultSubjectId, onCreated }) {
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || '');
  const [options, setOptions] = useState(null);
  const [kind, setKind] = useState('study_note');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('__class__');
  const [resolved, setResolved] = useState(null);
  const [decision, setDecision] = useState('');
  const [curriculumTopicIds, setCurriculumTopicIds] = useState([]);
  const [levelPick, setLevelPick] = useState('');
  const [exams, setExams] = useState([]);
  const [customExam, setCustomExam] = useState('');
  const [length, setLength] = useState('detailed');
  const [advanced, setAdvanced] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subjectId) return;
    setOptions(null);
    setResolved(null);
    api.getMaterialAiOptions(classId, subjectId).then(setOptions).catch(err => setError(err.message));
  }, [classId, subjectId]);

  const defaults = options?.kindDefaults?.[kind] || [];
  const selected = chosen || defaults;
  const blocked = key => options && ((key === 'images' && !options.settings.images) || (key === 'tables' && !options.settings.tables) || (key === 'formulae' && !options.settings.formulae) || (['graphs', 'charts', 'diagrams'].includes(key) && !options.settings.graphs));
  const examOptions = resolved?.exams || options?.exams || [];
  const levelLabel = level === '__class__' ? undefined : level;

  async function check(event) {
    event?.preventDefault();
    if (!topic.trim()) { setError('Enter the topic you want to teach.'); return; }
    setBusy('check'); setError(''); setDecision(''); setCurriculumTopicIds([]);
    try {
      const result = await api.resolveCurriculum({ classId, subjectId, topic, classLevel: levelLabel });
      setResolved(result);
      if (result.resolution.status === 'matched') { setDecision('matched'); setCurriculumTopicIds([result.resolution.match.id]); }
      setExams(current => current.filter(key => result.exams.some(exam => exam.key === key)));
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  async function generate() {
    setBusy('create'); setError('');
    try {
      const { draft } = await api.createMaterialDraft({
        classId, subjectId, topic, kind, length, options: selected.filter(key => !blocked(key)),
        exams: [...exams, ...(customExam.trim() ? ['custom'] : [])], customExam, curriculumTopicIds, levelDecision: decision || 'ungrounded', classLevel: levelLabel,
      });
      onCreated(draft);
    } catch (err) { setError(err.message); setBusy(''); }
  }

  if (!subjects.length) return <p className={CARD}>Add a subject to this class first.</p>;
  const ready = resolved && decision;
  return (
    <div className="space-y-4">
      <section className={CARD}>
        <p className={LABEL}>1 · What are you preparing?</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(options?.kinds || []).map(item => (
            <button key={item.key} type="button" onClick={() => { setKind(item.key); setChosen(null); }} aria-pressed={kind === item.key}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${kind === item.key ? 'border-[#1a5c38] bg-[#1a5c38] text-[#b5e3f4]' : 'border-[#c9a96e]/50 bg-white text-[#191970]'}`}>{item.label}</button>
          ))}
        </div>
        <form onSubmit={check} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="text-xs font-semibold text-[#800020]">Subject
            <select className={FIELD} value={subjectId} onChange={event => setSubjectId(event.target.value)}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-[#800020]">Topic
            <input className={FIELD} list="material-ai-topics" value={topic} onChange={event => { setTopic(event.target.value); setResolved(null); }} placeholder="e.g. Quadratic Equations" />
            <datalist id="material-ai-topics">{(options?.topics || []).map(item => <option key={item.id} value={item.name} />)}</datalist>
          </label>
          <label className="text-xs font-semibold text-[#800020]">Curriculum level (optional)
            <select className={FIELD} value={level} onChange={event => { setLevel(event.target.value); setResolved(null); }}>
              <option value="__class__">This class{options?.classLevel?.label ? ` (${options.classLevel.label})` : ''}</option>
              <option value="">Let Ndovera find it</option>
              {(options?.levels || []).map(item => <option key={item.key} value={item.label}>{item.label}</option>)}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className={PRIMARY} disabled={busy === 'check' || !options}>{busy === 'check' ? 'Checking the curriculum…' : 'Check the curriculum'}</button>
            {options && !options.curricula.length && <span className="ml-3 text-xs text-[#800020]">Ndovera has no curriculum on file for your school yet.</span>}
          </div>
        </form>
        {resolved && (
          <div className="mt-3">
            <ResolutionPanel resolution={resolved.resolution} decision={decision} levelPick={levelPick} setLevelPick={setLevelPick}
              onDecide={(next, ids) => { setDecision(next); setCurriculumTopicIds(ids.filter(Boolean)); }} onChangeTopic={() => { setTopic(''); setResolved(null); }} />
          </div>
        )}
      </section>

      {ready && (
        <section className={CARD}>
          <p className={LABEL}>2 · Preparing students for an examination?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"><input type="checkbox" checked={!exams.length && !customExam} onChange={() => { setExams([]); setCustomExam(''); }} /> Normal curriculum</label>
            {examOptions.map(exam => (
              <label key={exam.key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm" title={exam.note}>
                <input type="checkbox" checked={exams.includes(exam.key)} onChange={event => setExams(current => (event.target.checked ? [...current, exam.key] : current.filter(key => key !== exam.key)))} />
                {exam.label}
                <span className={`rounded-full px-2 text-[10px] font-bold ${exam.grounded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{exam.grounded ? `Spec ${exam.version}` : 'No spec on file'}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"><input type="checkbox" checked={exams.includes('school')} onChange={event => setExams(current => (event.target.checked ? [...current, 'school'] : current.filter(key => key !== 'school')))} /> School examination</label>
            <input className={`${FIELD} max-w-xs`} placeholder="Custom examination (optional)" value={customExam} onChange={event => setCustomExam(event.target.value)} />
          </div>
          {exams.some(key => examOptions.find(exam => exam.key === key && !exam.grounded)) && <p className="mt-2 text-xs text-amber-800">Ndovera has no specification on file for one of these, so that practice will be general exam-style and its coverage is not verified.</p>}
        </section>
      )}

      {ready && (
        <section className={CARD}>
          <p className={LABEL}>3 · Length and content</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(options?.lengths || {}).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"><input type="radio" name="length" checked={length === key} onChange={() => setLength(key)} /> {label}</label>
            ))}
            <button type="button" className={SECONDARY} onClick={() => setAdvanced(value => !value)} aria-expanded={advanced}>{advanced ? 'Hide advanced settings' : 'Advanced settings'}</button>
          </div>
          {advanced && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {Object.entries(options?.contentOptions || {}).map(([group, items]) => (
                <fieldset key={group} className="rounded-xl bg-white p-3">
                  <legend className={LABEL}>{group}</legend>
                  {items.map(([key, label]) => (
                    <label key={key} className={`flex items-center gap-2 text-sm ${blocked(key) ? 'opacity-50' : ''}`} title={blocked(key) ? 'Switched off by your school' : ''}>
                      <input type="checkbox" disabled={blocked(key)} checked={selected.includes(key) && !blocked(key)} onChange={event => setChosen((event.target.checked ? [...selected, key] : selected.filter(item => item !== key)))} /> {label}
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="text-xs text-[#191970] md:col-span-3">Ndovera uses each one only where it helps: ticking graphs does not mean a graph in every section.{options?.settings?.images ? ` Up to ${options.settings.maxImages} AI illustration(s) per material.` : ''}</p>
            </div>
          )}
          <button type="button" className={`${PRIMARY} mt-3`} onClick={generate} disabled={busy === 'create'}>{busy === 'create' ? 'Starting…' : 'Generate with Ndovera AI'}</button>
        </section>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    </div>
  );
}

// ─── Writing, checking, editing, publishing ─────────────────────────────────

function ChecksPanel({ draft, onReview, reviewing }) {
  const validation = draft.validation;
  if (!validation) return null;
  return (
    <section className={CARD} aria-label="Checks">
      <div className="flex flex-wrap items-center gap-2">
        <p className={`${LABEL} flex-1`}>Ndovera checks</p>
        <button type="button" className={SECONDARY} onClick={onReview} disabled={reviewing}>{reviewing ? 'Ndovera AI is reviewing…' : 'Ask Ndovera AI to review'}</button>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-[#191970]">
        {validation.checks.map(check => <li key={check.key}><span aria-hidden="true">{CHECK[check.status]}</span> <strong>{check.label}:</strong> {check.detail}</li>)}
      </ul>
      {validation.coverage?.length > 0 && (
        <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold text-[#800020]">Objective coverage ({validation.coverage.filter(item => item.covered).length}/{validation.coverage.length})</summary>
          <ul className="mt-1 space-y-0.5">{validation.coverage.map((item, index) => <li key={index}>{item.covered ? '✅' : '⚠️'} {item.objective} <span className="text-xs text-slate-500">({item.classLabel})</span></li>)}</ul>
        </details>
      )}
      {draft.review && (
        <div className="mt-3 rounded-xl bg-white p-3 text-sm">
          <p className="font-bold text-[#800020]">Ndovera AI review{draft.review.summary ? ` — ${draft.review.summary}` : ''}</p>
          {draft.review.findings.length ? <ul className="mt-1 space-y-1">{draft.review.findings.map((finding, index) => <li key={index}>{finding.severity === 'error' ? '⛔' : '⚠️'} Block {finding.block}: {finding.issue}{finding.fix ? ` — ${finding.fix}` : ''}</li>)}</ul> : <p>No problems found.</p>}
        </div>
      )}
    </section>
  );
}

function Workspace({ initialDraft, onPublished, onDiscarded }) {
  const [draft, setDraft] = useState(initialDraft);
  const [blocks, setBlocks] = useState(initialDraft.blocks);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(-1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [instruction, setInstruction] = useState({});
  const [publish, setPublish] = useState({ title: '', weekLabel: '', visibility: 'student_parent' });
  const [needsAck, setNeedsAck] = useState(false);
  const running = useRef(false);
  const pending = draft.sections.filter(section => section.status === 'pending').length;
  const examLabels = useMemo(() => [...(draft.grounding?.exams || []).map(exam => exam.label.replace(/\s*\(.*\)$/, '')), ...(draft.grounding?.customExam ? [draft.grounding.customExam] : [])], [draft.grounding]);
  const questionLabel = examLabels.length ? `${examLabels.join('/')}-style Practice Question` : 'Practice Question';

  const accept = useCallback(next => { setDraft(next); setBlocks(next.blocks); setDirty(false); }, []);

  const writeAll = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setError('');
    try {
      for (let guard = 0; guard < 30; guard += 1) {
        const result = await api.generateNextSection(draft.id);
        accept(result.draft);
        if (result.done) break;
      }
    } catch (err) { setError(`${err.message} You can continue where it stopped.`); } finally { running.current = false; setBusy(''); }
  }, [accept, draft.id]);

  useEffect(() => { if (pending > 0) { setBusy('writing'); writeAll(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (label, work) => {
    setBusy(label); setError('');
    try { await work(); } catch (err) { setError(err.message); if (err.data?.needsAcknowledgement) setNeedsAck(true); } finally { setBusy(''); }
  };
  const save = () => act('save', async () => accept((await api.saveDraftBlocks(draft.id, blocks)).draft));
  const update = (index, block) => { setBlocks(current => current.map((item, position) => (position === index ? block : item))); setDirty(true); };
  const move = (index, delta) => { setBlocks(current => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(index + delta, 0, item); return next; }); setDirty(true); };
  const remove = index => { setBlocks(current => current.filter((_, position) => position !== index)); setDirty(true); setEditing(-1); };
  const doPublish = (status, acknowledgeChecks = false) => act(status, async () => {
    if (dirty) accept((await api.saveDraftBlocks(draft.id, blocks)).draft);
    const result = await api.publishDraft(draft.id, { ...publish, status, acknowledgeChecks });
    onPublished(result.material, status);
  });

  let questionNumber = 0;
  return (
    <div className="space-y-4">
      <section className={CARD}>
        <p className="text-lg font-black text-[#800000]">{draft.topic}</p>
        <p className="text-sm text-[#191970]">{draft.className} · {draft.subjectName} · {draft.grounding?.curriculum?.length ? `Curriculum: ${[...new Set(draft.grounding.curriculum.map(topic => `${topic.classLabel} — ${topic.curriculumName}`))].join('; ')}` : 'Not curriculum-checked'}{examLabels.length ? ` · Preparing for ${examLabels.join(', ')}` : ''}</p>
        <ol className="mt-3 flex flex-wrap gap-2 text-xs">
          {draft.sections.map(section => (
            <li key={section.key} className={`rounded-full px-3 py-1 font-semibold ${section.status === 'done' ? 'bg-emerald-100 text-emerald-800' : section.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-white text-slate-600'}`}>
              {section.status === 'done' ? '✓' : section.status === 'failed' ? '✕' : '…'} {section.title}
            </li>
          ))}
        </ol>
        {pending > 0 && (
          <div className="mt-3 flex items-center gap-3 text-sm text-[#191970]" role="status">
            {busy === 'writing' ? <span>Ndovera AI is writing — {draft.sections.length - pending} of {draft.sections.length} sections done…</span> : <button type="button" className={PRIMARY} onClick={() => { setBusy('writing'); writeAll(); }}>Continue writing</button>}
          </div>
        )}
      </section>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {pending === 0 && <ChecksPanel draft={draft} reviewing={busy === 'review'} onReview={() => act('review', async () => accept((await api.reviewDraft(draft.id)).draft))} />}

      {draft.sections.map(section => {
        const indexes = blocks.map((block, index) => (block.section === section.key ? index : -1)).filter(index => index >= 0);
        return (
          <section key={section.key} className="rounded-2xl bg-white p-4 dark:bg-slate-900" aria-label={section.title}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="flex-1 text-lg font-bold text-[#800000] dark:text-white">{section.title}</h3>
              {section.status !== 'pending' && pending === 0 && (
                <>
                  <input className={`${FIELD} max-w-xs`} placeholder="Instruction (optional), e.g. simpler words" value={instruction[section.key] || ''} onChange={event => setInstruction(current => ({ ...current, [section.key]: event.target.value }))} />
                  <button type="button" className={SECONDARY} disabled={Boolean(busy)} onClick={() => act(`regen:${section.key}`, async () => accept((await api.regenerateSection(draft.id, section.key, instruction[section.key] || '')).draft))}>
                    {busy === `regen:${section.key}` ? 'Rewriting…' : 'Regenerate'}
                  </button>
                </>
              )}
            </div>
            {section.status === 'failed' && <p className="text-sm text-rose-700">Ndovera AI could not write this section{section.note ? ` (${section.note})` : ''}. Regenerate it, or add your own content.</p>}
            <div className="space-y-3 text-[15px] leading-7 text-[#191970] dark:text-slate-100">
              {indexes.map(index => {
                const block = blocks[index];
                if (block.type === 'question') questionNumber += 1;
                return (
                  <div key={index} className="group relative rounded-xl border border-transparent p-1 hover:border-[#c9a96e]/50">
                    {editing === index ? (
                      <div className="space-y-2 rounded-xl bg-[#fff8f0] p-3">
                        <p className={LABEL}>{BLOCK_LABELS[block.type] || block.type}</p>
                        <AiBlockEditor block={block} onChange={next => update(index, next)} />
                        <div className="rounded-xl border border-[#c9a96e]/40 bg-white p-2"><AiBlockView block={block} number={questionNumber} questionLabel={questionLabel} /></div>
                        <button type="button" className={SECONDARY} onClick={() => setEditing(-1)}>Done</button>
                      </div>
                    ) : <AiBlockView block={block} number={questionNumber} questionLabel={questionLabel} />}
                    {editing !== index && pending === 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button type="button" className="rounded-lg bg-[#fff8f0] px-2 py-1 font-semibold" onClick={() => setEditing(index)}>Edit</button>
                        <button type="button" className="rounded-lg bg-[#fff8f0] px-2 py-1 font-semibold" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                        <button type="button" className="rounded-lg bg-[#fff8f0] px-2 py-1 font-semibold" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} aria-label="Move down">↓</button>
                        <button type="button" className="rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700" onClick={() => remove(index)}>Remove</button>
                        {block.type === 'image' && <button type="button" className="rounded-lg bg-[#fff8f0] px-2 py-1 font-semibold" disabled={Boolean(busy) || dirty} title={dirty ? 'Save your changes first' : ''} onClick={() => act('image', async () => accept((await api.redrawImage(draft.id, index)).draft))}>{block.url ? 'Redraw' : 'Draw'}</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {pending === 0 && (
        <section className={`${CARD} sticky bottom-0`} aria-label="Publish">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input className={FIELD} placeholder={`Title (default: ${draft.topic})`} value={publish.title} onChange={event => setPublish(current => ({ ...current, title: event.target.value }))} />
            <input className={FIELD} placeholder="Week label (optional)" value={publish.weekLabel} onChange={event => setPublish(current => ({ ...current, weekLabel: event.target.value }))} />
            <select className={FIELD} value={publish.visibility} onChange={event => setPublish(current => ({ ...current, visibility: event.target.value }))}>
              <option value="student_parent">Students + Parents</option><option value="student">Students only</option><option value="teacher">Teacher only</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dirty && <button type="button" className={SECONDARY} onClick={save} disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>}
            <button type="button" className={SECONDARY} onClick={() => doPublish('draft')} disabled={Boolean(busy)}>Save to materials as draft</button>
            <button type="button" className={PRIMARY} onClick={() => doPublish('published')} disabled={Boolean(busy)}>{busy === 'published' ? 'Publishing…' : 'Publish to students'}</button>
            <button type="button" className="ml-auto text-xs font-semibold text-rose-700 underline" onClick={() => act('discard', async () => { await api.discardMaterialDraft(draft.id); onDiscarded(); })}>Discard draft</button>
          </div>
          {needsAck && (
            <div role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              Some checks failed. Fix them above, or confirm you have reviewed the material yourself.
              <button type="button" className={`${PRIMARY} ml-2`} onClick={() => doPublish('published', true)}>I have reviewed it — publish</button>
            </div>
          )}
          <p className="mt-2 text-xs text-[#191970]">Students will see “Prepared with Ndovera AI · reviewed by you”. You are the publisher: nothing reaches students until you publish.</p>
        </section>
      )}
    </div>
  );
}

/** The button, the teacher's unfinished drafts, and the generator itself. */
export default function PrepareMaterialPanel({ classId, subjects = [], defaultSubjectId = '', onPublished }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(() => { if (classId) api.listMaterialDrafts(classId).then(result => setDrafts(result.drafts || [])).catch(() => setDrafts([])); }, [classId]);
  useEffect(refresh, [refresh]);
  const close = () => { setOpen(false); setDraft(null); refresh(); };
  const unfinished = drafts.filter(item => item.status !== 'published');

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY} onClick={() => { setDraft(null); setOpen(true); }} disabled={!classId}>✨ Prepare with Ndovera AI</button>
        {unfinished.slice(0, 3).map(item => (
          <button key={item.id} type="button" className={SECONDARY} onClick={() => api.getMaterialDraft(item.id).then(result => { setDraft(result.draft); setOpen(true); }).catch(err => setNotice(err.message))}>
            Continue: {item.topic} · {item.kindLabel}
          </button>
        ))}
      </div>
      {notice && <p role="status" className="mt-2 text-sm font-semibold text-[#1a5c38]">{notice}</p>}
      {open && (
        <Modal title="Prepare with Ndovera AI" onClose={close}>
          {draft
            ? <Workspace initialDraft={draft} onDiscarded={close} onPublished={(material, status) => { setNotice(status === 'draft' ? `“${material.title}” is saved in your materials as a draft.` : `“${material.title}” is published to students.`); close(); onPublished?.(material); }} />
            : <Setup classId={classId} subjects={subjects} defaultSubjectId={defaultSubjectId} onCreated={setDraft} />}
        </Modal>
      )}
    </div>
  );
}

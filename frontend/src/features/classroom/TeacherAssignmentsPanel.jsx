import React, { useEffect, useMemo, useState } from 'react';
import * as svc from './classroomService';
import { askConfirm } from '../../shared/components/AppDialog';
import Overlay from '../../shared/components/Overlay';
import RichContent from '../../shared/rich/RichContent';
import RichField, { FIELD } from './assignments/RichField';
import { AssignmentViewer, DialogHeader, DANGER, PRIMARY, SECONDARY, SubmissionsPanel } from './assignments/AssignmentDialogs';
import { importQuestions } from './assignments/questionImport';
import {
  QUESTION_TYPES, createId, createQuestion, inferFormat, isQuestionBlank, normalizeQuestionForSave, optionLetter,
  questionForEditing, questionProblem, totalScore, typeLabel,
} from './assignments/assignmentModel';

// The teacher's assignments for a class: a list, and one builder for writing questions
// (with formulas, symbols, tables, graphs and shapes), pasting a whole set at once, and
// giving the same assignment to several classes or arms. Saved through the same API as before.

const IMPORT_EXAMPLE = `1. What is the capital of Nigeria?
A. Lagos  B. Abuja  C. Kano  D. Ibadan
Answer: B
2. Simplify \\(\\frac{2}{4}\\)
(a) \\(\\frac{1}{2}\\)  (b) \\(\\frac{1}{4}\\)  (c) 2
Ans: a
3. Explain the water cycle.`;

const LABEL = 'text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const classLabel = classroom => classroom?.className || classroom?.name || 'Class';
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function dueInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dueText(value) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function freshDraft(classId = '', subjectId = '') {
  return { classId, subjectId, extraClassIds: [], title: '', description: '', dueAt: '', topic: '', questions: [createQuestion('mcq')] };
}

/** One question in the builder. */
function QuestionEditor({ question, index, count, onChange, onRemove, onMove, onDuplicate, onUpload, uploading }) {
  const [open, setOpen] = useState(true);
  const problem = questionProblem(question);
  const set = patch => onChange({ ...question, ...patch });
  const setOption = (optionIndex, text) => {
    const options = [...(question.options || [])];
    const wasAnswer = options[optionIndex] === question.answer && question.answer;
    options[optionIndex] = text;
    set({ options, ...(wasAnswer ? { answer: text } : {}) });
  };
  const removeOption = optionIndex => {
    const options = (question.options || []).filter((_, position) => position !== optionIndex);
    set({ options, ...(question.options?.[optionIndex] === question.answer ? { answer: '' } : {}) });
  };

  return (
    <section className={`rounded-2xl border bg-white dark:bg-slate-900 ${problem && !isQuestionBlank(question) ? 'border-amber-300 dark:border-amber-400/40' : 'border-slate-200 dark:border-white/10'}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
        <button type="button" onClick={() => setOpen(value => !value)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#191970] text-xs font-black text-white">{index + 1}</span>
          <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{open ? typeLabel(question.type) : (String(question.prompt || question.passage || '').replace(/\s+/g, ' ').slice(0, 80) || typeLabel(question.type))}</span>
        </button>
        <select aria-label={`Question ${index + 1} type`} value={question.type} onChange={event => onChange({ ...createQuestion(event.target.value), id: question.id, prompt: question.prompt || '', imageUrl: question.imageUrl || '', score: question.score })}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white">
          {QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs font-bold text-slate-500">Marks
          <input type="number" min="1" step="1" inputMode="numeric" value={question.score ?? 1} onChange={event => set({ score: event.target.value })} className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white" />
        </label>
        <div className="flex items-center">
          <button type="button" title="Move up" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10">↑</button>
          <button type="button" title="Move down" aria-label={`Move question ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10">↓</button>
          <button type="button" title="Duplicate" aria-label={`Duplicate question ${index + 1}`} onClick={onDuplicate} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">⧉</button>
          <button type="button" title="Delete" aria-label={`Delete question ${index + 1}`} disabled={count === 1} onClick={onRemove} className="rounded-lg px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-400/10">🗑</button>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 p-4">
          {question.type === 'comprehension' ? <RichField label="Passage" value={question.passage} onChange={passage => set({ passage })} rows={6} placeholder="Paste or type the passage students read." /> : null}
          <RichField label="Question" value={question.prompt} onChange={prompt => set({ prompt })} rows={3} placeholder={question.type === 'fillgaps' ? 'Use ____ for each blank, e.g. The capital of Ghana is ____.' : 'Type the question. Use ∑ for fractions, powers, roots, tables, graphs and shapes.'} />

          <div className="flex flex-wrap items-center gap-2">
            <label className={`${SECONDARY} cursor-pointer`}>
              {uploading ? 'Uploading…' : question.imageUrl ? 'Change picture' : '🖼 Add a picture'}
              <input type="file" accept="image/*" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} />
            </label>
            {question.imageUrl ? <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={() => set({ imageUrl: '' })}>Remove picture</button> : null}
          </div>
          {question.imageUrl ? <img src={question.imageUrl} alt="" className="max-h-56 rounded-xl border border-slate-200 object-contain" /> : null}

          {question.type === 'mcq' ? (
            <div className="space-y-2">
              <p className={LABEL}>Options · tap the letter of the correct answer</p>
              {(question.options || []).map((option, optionIndex) => {
                const correct = option && option === question.answer;
                return (
                  <div key={optionIndex} className="flex items-start gap-2">
                    <button type="button" onClick={() => option && set({ answer: option })} disabled={!option}
                      aria-label={`Make ${optionLetter(optionIndex)} the correct answer`} aria-pressed={Boolean(correct)}
                      className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition ${correct ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 dark:bg-white/10 dark:text-slate-200'}`}>
                      {correct ? '✓' : optionLetter(optionIndex)}
                    </button>
                    <div className="min-w-0 flex-1"><RichField compact value={option} onChange={text => setOption(optionIndex, text)} rows={1} placeholder={`Option ${optionLetter(optionIndex)}`} /></div>
                    {(question.options || []).length > 2 ? <button type="button" aria-label={`Remove option ${optionLetter(optionIndex)}`} onClick={() => removeOption(optionIndex)} className="mt-2 rounded-lg px-2 py-1 text-slate-400 hover:text-rose-600">✕</button> : null}
                  </div>
                );
              })}
              {(question.options || []).length < 8 ? <button type="button" className={SECONDARY} onClick={() => set({ options: [...(question.options || []), ''] })}>+ Add option</button> : null}
              <RichField label="Explanation (shown after marking, optional)" value={question.explanation} onChange={explanation => set({ explanation })} rows={2} />
            </div>
          ) : null}

          {question.type === 'shortanswer' ? (
            <label className="block"><span className={LABEL}>Expected answer</span><input className={`${FIELD} mt-1`} value={question.answer || ''} onChange={event => set({ answer: event.target.value })} placeholder="The answer you will accept" /></label>
          ) : null}
          {question.type === 'fillgaps' ? (
            <label className="block"><span className={LABEL}>Accepted answers (separate with commas)</span><input className={`${FIELD} mt-1`} value={question.acceptedAnswers || ''} onChange={event => set({ acceptedAnswers: event.target.value })} placeholder="e.g. Accra, accra" /></label>
          ) : null}
          {question.type === 'crossmatching' ? (
            <div className="space-y-2">
              <p className={LABEL}>Pairs to match</p>
              {(question.pairs || []).map(pair => (
                <div key={pair.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <input className={FIELD} value={pair.left} placeholder="Column A" onChange={event => set({ pairs: question.pairs.map(item => (item.id === pair.id ? { ...item, left: event.target.value } : item)) })} />
                  <span className="text-slate-400">↔</span>
                  <input className={FIELD} value={pair.right} placeholder="Column B" onChange={event => set({ pairs: question.pairs.map(item => (item.id === pair.id ? { ...item, right: event.target.value } : item)) })} />
                  <button type="button" aria-label="Remove pair" disabled={question.pairs.length <= 2} onClick={() => set({ pairs: question.pairs.filter(item => item.id !== pair.id) })} className="rounded-lg px-2 py-1 text-slate-400 hover:text-rose-600 disabled:opacity-30">✕</button>
                </div>
              ))}
              <button type="button" className={SECONDARY} onClick={() => set({ pairs: [...(question.pairs || []), { id: createId('pair'), left: '', right: '' }] })}>+ Add pair</button>
            </div>
          ) : null}
          {['essay', 'longanswer', 'comprehension'].includes(question.type) ? (
            <RichField label="Marking guide (only you see this)" value={question.markingGuide} onChange={markingGuide => set({ markingGuide })} rows={3} placeholder="Points to look for, or a model answer." />
          ) : null}

          {problem && !isQuestionBlank(question) ? <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">Still needed: {problem}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Paste a whole set of questions; see them before adding. */
function PasteQuestions({ onAdd }) {
  const [text, setText] = useState('');
  const result = useMemo(() => (text.trim() ? importQuestions(text) : null), [text]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">Copy questions from Word, WhatsApp or a past paper and paste them here. Number each question (1. 2. 3.) and start options with A. B. C. D. (or a), (b)…). Put the answer as <b>Answer: B</b>, a <b>*</b> after the right option, or an answer key at the end.</p>
      <textarea value={text} onChange={event => setText(event.target.value)} rows={10} className={`${FIELD} font-mono text-sm`} placeholder={IMPORT_EXAMPLE} aria-label="Paste questions" />
      {result ? (
        <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
          <p className="text-sm font-bold text-[#0b1f3a] dark:text-white">Found {result.questions.length} question{result.questions.length === 1 ? '' : 's'}</p>
          {result.warnings.length ? <ul className="mt-1 list-inside list-disc text-xs font-semibold text-amber-800 dark:text-amber-200">{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
          <ol className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {result.questions.map((question, index) => (
              <li key={question.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                <div className="flex gap-1.5 font-semibold"><span>{index + 1}.</span><RichContent inline text={question.prompt || question.passage || ''} /><span className="ml-auto shrink-0 rounded-full bg-white px-2 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">{typeLabel(question.type)}</span></div>
                {question.type === 'mcq' ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-5 text-xs">
                    {question.options.map((option, optionIndex) => <span key={optionIndex} className={option === question.answer ? 'font-black text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}>{optionLetter(optionIndex)}. <RichContent inline text={option} />{option === question.answer ? ' ✓' : ''}</span>)}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <button type="button" className={`${PRIMARY} mt-3 w-full`} disabled={!result.questions.length} onClick={() => { onAdd(result.questions); setText(''); }}>
            Add {result.questions.length} question{result.questions.length === 1 ? '' : 's'} to this assignment
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function TeacherAssignmentsPanel({
  assignedClasses = [],
  currentClassId = '',
  currentClassName = '',
  assignments = [],
  canModerate = false,
  onRefreshAssignments,
  onSelectClass,
  // Changing this number opens the builder (the Subjects tab's "+" shortcut).
  openComposerSignal = 0,
}) {
  const [viewing, setViewing] = useState(null);
  const [marking, setMarking] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('build');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(() => freshDraft(currentClassId || assignedClasses[0]?.id || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadingId, setUploadingId] = useState('');
  const [topics, setTopics] = useState([]);
  const [allClasses, setAllClasses] = useState(assignedClasses);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Every class this teacher teaches (with its subjects), for "also give to" other classes and arms.
  useEffect(() => { setAllClasses(previous => (assignedClasses.length > previous.length ? assignedClasses : previous)); }, [assignedClasses]);
  useEffect(() => {
    if (!open || allClasses.length > 1) return undefined;
    let active = true;
    svc.getAssignedClasses().then(data => {
      if (!active || !Array.isArray(data?.classes) || !data.classes.length) return;
      const byId = new Map(data.classes.map(item => [item.id, item]));
      // Keep the subjects this screen was given for its own class.
      assignedClasses.forEach(item => { if (byId.has(item.id) && item.subjects?.length) byId.set(item.id, { ...byId.get(item.id), subjects: byId.get(item.id).subjects?.length ? byId.get(item.id).subjects : item.subjects }); });
      setAllClasses(Array.from(byId.values()));
    }).catch(() => {});
    return () => { active = false; };
  }, [open, allClasses.length, assignedClasses]);

  const classes = allClasses.length ? allClasses : assignedClasses;
  const draftClass = classes.find(item => item.id === draft.classId) || assignedClasses.find(item => item.id === draft.classId) || null;
  const subjects = draftClass?.subjects || [];
  const draftSubject = subjects.find(subject => subject.id === draft.subjectId) || null;
  // Other classes (arms) with a subject of the same name this teacher can set work in.
  const siblings = useMemo(() => (draftSubject ? classes.filter(item => item.id !== draft.classId).map(item => ({ classroom: item, subject: (item.subjects || []).find(subject => sameName(subject.name, draftSubject.name)) })).filter(item => item.subject) : []), [classes, draft.classId, draftSubject]);

  useEffect(() => {
    if (!open || !draft.classId || !draft.subjectId) { setTopics([]); return undefined; }
    let active = true;
    svc.getTopics(draft.classId, draft.subjectId).then(data => { if (active) setTopics(data?.topics || []); }).catch(() => { if (active) setTopics([]); });
    return () => { active = false; };
  }, [open, draft.classId, draft.subjectId]);

  function startNew() {
    const classId = currentClassId || assignedClasses[0]?.id || '';
    const classroom = classes.find(item => item.id === classId) || assignedClasses.find(item => item.id === classId);
    const only = classroom?.subjects?.length === 1 ? classroom.subjects[0].id : '';
    setEditingId(null); setDraft(freshDraft(classId, only)); setMode('build'); setError(''); setNotice(''); setOpen(true);
  }
  useEffect(() => {
    if (openComposerSignal > 0) startNew();
    // Only a new signal should open it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openComposerSignal]);

  function startEdit(assignment) {
    setEditingId(assignment.id);
    setDraft({
      classId: assignment.classId || currentClassId, subjectId: assignment.subjectId || '', extraClassIds: [],
      title: assignment.title || '', description: assignment.description || '', dueAt: dueInput(assignment.dueAt),
      topic: String(assignment.topic || assignment.metadata?.topic || '').trim(),
      questions: (Array.isArray(assignment.questions) && assignment.questions.length ? assignment.questions : [createQuestion('mcq')]).map(questionForEditing),
    });
    setMode('build'); setError(''); setNotice(''); setOpen(true);
  }

  const set = patch => setDraft(previous => ({ ...previous, ...patch }));
  const setQuestion = (id, next) => setDraft(previous => ({ ...previous, questions: previous.questions.map(question => (question.id === id ? next : question)) }));
  const moveQuestion = (index, step) => setDraft(previous => {
    const questions = [...previous.questions];
    const target = index + step;
    if (target < 0 || target >= questions.length) return previous;
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return { ...previous, questions };
  });
  const addQuestion = type => setDraft(previous => ({ ...previous, questions: [...previous.questions, createQuestion(type || previous.questions[previous.questions.length - 1]?.type || 'mcq')] }));
  const addImported = imported => {
    setDraft(previous => ({ ...previous, questions: [...previous.questions.filter(question => !isQuestionBlank(question)), ...imported] }));
    setMode('build');
    setNotice(`Added ${imported.length} question${imported.length === 1 ? '' : 's'}. Check them below, then save.`);
  };

  async function upload(questionId, file) {
    if (!draft.classId) return;
    setUploadingId(questionId); setError('');
    try {
      const response = await svc.uploadAssignmentAsset(draft.classId, { file, title: file.name });
      if (!response?.success || !response?.asset?.url) throw new Error(response?.message || 'Could not upload the picture.');
      setDraft(previous => ({ ...previous, questions: previous.questions.map(question => (question.id === questionId ? { ...question, imageUrl: response.asset.url } : question)) }));
    } catch (uploadError) { setError(uploadError.message); } finally { setUploadingId(''); }
  }

  const filled = draft.questions.filter(question => !isQuestionBlank(question));
  const problems = filled.map((question, index) => ({ index, problem: questionProblem(question) })).filter(item => item.problem);

  async function save() {
    setError(''); setNotice('');
    if (!draft.classId) { setError('Choose the class.'); return; }
    if (!draft.subjectId || !draftSubject) { setError(subjects.length ? 'Choose the subject.' : 'You have no subject in this class yet. Ask the Head of School to assign you one, or open the class you teach.'); return; }
    if (!draft.title.trim()) { setError('Give the assignment a title.'); return; }
    if (!filled.length) { setError('Add at least one question.'); return; }
    if (problems.length) { setError(`Question ${problems[0].index + 1}: ${problems[0].problem}`); return; }
    const questions = filled.map(normalizeQuestionForSave);
    const base = {
      title: draft.title.trim(), description: draft.description.trim(), dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null, topic: draft.topic.trim(),
      format: inferFormat(questions), questions,
      metadata: { questionCount: questions.length, totalScore: totalScore(questions), questionTypes: Array.from(new Set(questions.map(question => question.type))) },
    };
    setSaving(true);
    try {
      if (editingId) {
        const response = await svc.updateAssignment(draft.classId, editingId, { ...base, subjectId: draft.subjectId, subjectName: draftSubject.name });
        if (!response?.success) throw new Error(response?.message || 'Could not update the assignment.');
        setNotice(`Saved "${base.title}".`);
      } else {
        // The same assignment for each chosen class, under that class's own subject; one group id links them.
        const groupId = draft.extraClassIds.length ? createId('agroup') : '';
        const targets = [{ classroom: draftClass, subject: draftSubject }, ...siblings.filter(item => draft.extraClassIds.includes(item.classroom.id))];
        const done = [];
        const failed = [];
        for (const target of targets) {
          try {
            const response = await svc.createAssignment(target.classroom.id, { ...base, subjectId: target.subject.id, subjectName: target.subject.name, metadata: { ...base.metadata, ...(groupId ? { groupId, sharedWith: targets.map(item => classLabel(item.classroom)) } : {}) } });
            if (!response?.success) throw new Error(response?.message || 'Not saved.');
            done.push(classLabel(target.classroom));
          } catch (createError) { failed.push(`${classLabel(target.classroom)} (${createError.message})`); }
        }
        if (!done.length) throw new Error(failed.join('; ') || 'Could not create the assignment.');
        setNotice(`"${base.title}" is live for ${done.join(', ')}.${failed.length ? ` Not created for ${failed.join('; ')}.` : ''}`);
      }
      setOpen(false);
      if (draft.classId !== currentClassId && onSelectClass) Promise.resolve(onSelectClass(draft.classId)).catch(() => {});
      else Promise.resolve(onRefreshAssignments?.(draft.classId)).catch(() => {});
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  async function remove(assignment) {
    if (!(await askConfirm(`Delete "${assignment.title}"? Its submissions are deleted too.`))) return;
    try {
      const response = await svc.deleteAssignment(assignment.classId || currentClassId, assignment.id);
      if (!response?.success) throw new Error(response?.message || 'Could not delete it.');
      setNotice(`Deleted "${assignment.title}".`);
      onRefreshAssignments?.();
    } catch (deleteError) { setError(deleteError.message); }
  }

  const now = Date.now();
  const shown = assignments.filter(assignment => {
    if (query.trim() && !`${assignment.title} ${assignment.subjectName}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    const due = assignment.dueAt ? new Date(assignment.dueAt).getTime() : null;
    if (filter === 'open') return !due || due >= now;
    if (filter === 'past') return due && due < now;
    return true;
  });

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-[#c9a96e]">Assignments</p>
            <h3 className="truncate text-lg font-black text-[#0b1f3a] dark:text-white">{currentClassName || 'Your class'} · {assignments.length}</h3>
          </div>
          <button type="button" onClick={startNew} className={PRIMARY}>+ New assignment</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <input type="search" aria-label="Search assignments" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} className={`${FIELD} max-w-xs py-1.5`} />
          {[['all', 'All'], ['open', 'Open'], ['past', 'Past due']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === key ? 'bg-[#191970] text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{label}</button>
          ))}
        </div>
        {!open && error ? <p role="alert" className="mx-4 mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 sm:mx-5">{error}</p> : null}
        {!open && notice ? <p role="status" className="mx-4 mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 sm:mx-5">{notice}</p> : null}

        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {shown.map(assignment => {
            const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
            const due = assignment.dueAt ? new Date(assignment.dueAt).getTime() : null;
            const closed = due && due < now;
            const canManage = canModerate || assignment.canManage === true;
            return (
              <li key={assignment.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setViewing(assignment)} className="text-left text-base font-bold text-[#191970] hover:underline dark:text-indigo-200">{assignment.title}</button>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{assignment.subjectName || 'No subject'}</span>
                      <span>{questions.length || assignment.metadata?.questionCount || 0} questions · {totalScore(questions) || assignment.metadata?.totalScore || 0} marks</span>
                      <span>Due {dueText(assignment.dueAt)}</span>
                      {assignment.metadata?.sharedWith?.length > 1 ? <span>Also in {assignment.metadata.sharedWith.filter(name => name !== currentClassName).join(', ')}</span> : null}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${closed ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'}`}>{closed ? 'Closed' : 'Open'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={SECONDARY} onClick={() => setMarking(assignment)}>Submissions</button>
                  <button type="button" className={SECONDARY} onClick={() => setViewing(assignment)}>View</button>
                  {canManage ? <button type="button" className={SECONDARY} onClick={() => startEdit(assignment)}>Edit</button> : null}
                  {canManage ? <button type="button" className={DANGER} onClick={() => remove(assignment)}>Delete</button> : null}
                </div>
              </li>
            );
          })}
          {!shown.length ? <li className="px-5 py-10 text-center text-sm text-slate-500">{assignments.length ? 'No assignment matches.' : 'No assignments yet. Press "+ New assignment" to set the first one.'}</li> : null}
        </ul>
      </section>

      {open ? (
        <Overlay onClose={() => setOpen(false)} label={editingId ? 'Edit assignment' : 'New assignment'} size="max-w-4xl">
          <DialogHeader eyebrow={editingId ? 'Edit assignment' : 'New assignment'} title={draft.title || 'Untitled assignment'} subtitle={[classLabel(draftClass), draftSubject?.name].filter(Boolean).join(' · ')} onClose={() => setOpen(false)} />
          <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-5 dark:bg-slate-950">
            {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p> : null}

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm font-black text-[#0b1f3a] dark:text-white">Who it is for</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={LABEL}>Class</span>
                  <select className={`${FIELD} mt-1`} value={draft.classId} disabled={Boolean(editingId)} onChange={event => {
                    const classroom = classes.find(item => item.id === event.target.value);
                    set({ classId: event.target.value, subjectId: classroom?.subjects?.length === 1 ? classroom.subjects[0].id : '', extraClassIds: [] });
                  }}>
                    <option value="">Choose a class…</option>
                    {classes.map(item => <option key={item.id} value={item.id}>{classLabel(item)}</option>)}
                  </select>
                </label>
                <label className="block"><span className={LABEL}>Subject</span>
                  <select className={`${FIELD} mt-1`} value={draft.subjectId} onChange={event => set({ subjectId: event.target.value, extraClassIds: [] })} disabled={!subjects.length}>
                    <option value="">{subjects.length ? 'Choose a subject…' : 'No subject of yours in this class'}</option>
                    {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </select>
                </label>
              </div>
              {draft.classId && !subjects.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">You are not assigned a subject in {classLabel(draftClass)}. The Head of School or Owner can assign you one under Settings → Subjects.</p> : null}
              {!editingId && siblings.length ? (
                <div>
                  <p className={LABEL}>Also give it to (same {draftSubject?.name})</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {siblings.map(item => {
                      const chosen = draft.extraClassIds.includes(item.classroom.id);
                      return (
                        <button key={item.classroom.id} type="button" aria-pressed={chosen}
                          onClick={() => set({ extraClassIds: chosen ? draft.extraClassIds.filter(id => id !== item.classroom.id) : [...draft.extraClassIds, item.classroom.id] })}
                          className={`rounded-full border px-3 py-1.5 text-sm font-bold ${chosen ? 'border-[#191970] bg-[#191970] text-white' : 'border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {chosen ? '✓ ' : '+ '}{classLabel(item.classroom)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm font-black text-[#0b1f3a] dark:text-white">Details</p>
              <label className="block"><span className={LABEL}>Title</span><input className={`${FIELD} mt-1`} value={draft.title} onChange={event => set({ title: event.target.value })} placeholder="e.g. Fractions: Week 3 class work" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={LABEL}>Due</span><input type="datetime-local" className={`${FIELD} mt-1`} value={draft.dueAt} onChange={event => set({ dueAt: event.target.value })} /></label>
                <label className="block"><span className={LABEL}>Topic (optional)</span>
                  <input list="assignment-topic-options" className={`${FIELD} mt-1`} value={draft.topic} onChange={event => set({ topic: event.target.value })} placeholder="Pick or type a topic" />
                  <datalist id="assignment-topic-options">{topics.map(topic => <option key={topic.id || topic.name} value={topic.name} />)}</datalist>
                </label>
              </div>
              <RichField label="Instructions (optional)" value={draft.description} onChange={description => set({ description })} rows={2} placeholder="e.g. Answer all questions. Show your working." />
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm font-black text-[#0b1f3a] dark:text-white">Questions</p>
                <div className="inline-flex rounded-xl bg-slate-200/70 p-1 dark:bg-white/10" role="tablist">
                  {[['build', 'Write questions'], ['paste', 'Paste many at once']].map(([key, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${mode === key ? 'bg-white text-[#191970] shadow dark:bg-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{label}</button>
                  ))}
                </div>
              </div>
              {mode === 'paste' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"><PasteQuestions onAdd={addImported} /></div>
              ) : (
                <>
                  {draft.questions.map((question, index) => (
                    <QuestionEditor key={question.id} question={question} index={index} count={draft.questions.length}
                      onChange={next => setQuestion(question.id, next)}
                      onRemove={() => setDraft(previous => ({ ...previous, questions: previous.questions.filter(item => item.id !== question.id) }))}
                      onMove={step => moveQuestion(index, step)}
                      onDuplicate={() => setDraft(previous => { const copy = { ...questionForEditing(JSON.parse(JSON.stringify(question))), id: createId('question') }; const questions = [...previous.questions]; questions.splice(index + 1, 0, copy); return { ...previous, questions }; })}
                      onUpload={file => upload(question.id, file)} uploading={uploadingId === question.id} />
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={PRIMARY} onClick={() => addQuestion()}>+ Add question</button>
                    {QUESTION_TYPES.filter(type => type.value !== 'mcq').slice(0, 4).map(type => <button key={type.value} type="button" className={SECONDARY} onClick={() => addQuestion(type.value)}>+ {type.label}</button>)}
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+var(--safe-bottom,0px))] sm:px-5 dark:border-white/10 dark:bg-slate-900">
            {error ? <p role="alert" className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm text-slate-600 dark:text-slate-300"><b>{filled.length}</b> question{filled.length === 1 ? '' : 's'} · <b>{totalScore(filled)}</b> marks{problems.length ? <span className="font-bold text-amber-700"> · {problems.length} need attention</span> : null}{draft.extraClassIds.length ? ` · for ${draft.extraClassIds.length + 1} classes` : ''}</p>
              <button type="button" className={SECONDARY} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish'}</button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {viewing ? <AssignmentViewer assignment={viewing} onClose={() => setViewing(null)} /> : null}
      {marking ? <SubmissionsPanel assignment={marking} onClose={() => setMarking(null)} /> : null}
    </div>
  );
}


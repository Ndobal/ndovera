import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAssignedClasses } from '../classroom/classroomService';
import {
  BLOOM, BLOOM_LABELS, KIND_LABELS, STATUS_LABELS, approveAssessmentBlueprint, createAiAssessment, generateNextQuestions, getAiAssessment,
  getAssessmentOptions, getExamLetterhead, listMyAssessments, saveExamLetterhead,
} from './assessmentsApi';
import AssessmentWorkspace from './AssessmentWorkspace';
import PaperStructureEditor from './PaperStructureEditor';
import { Letterhead } from './PaperPreview';
import { describeSection, presetStructure, structureTotals, toBlueprint } from './paperStructure';

// Ndovera AI assessments for teachers: AI Quiz Builder, AI Assignment Builder
// and AI Exam Builder, all grounded in the teacher's own topics and notes.
// Opening /roles/teacher/ai-assessments?classId=…&subjectId=…&topicId=…&kind=quiz
// (as the topic hub does) starts with that class, subject and topic chosen.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-[#800020]';
const DIFFICULTIES = [['easy', 'Easy'], ['standard', 'Standard'], ['hard', 'Hard'], ['external', 'External exam'], ['mixed', 'Mixed']];
const SOURCES = [['combination', 'Topics, notes & materials'], ['notes', 'Notes'], ['materials', 'Materials'], ['topics', 'Topics only'], ['curriculum', 'Curriculum / objectives']];
const MINUTES = { quiz: 15, assignment: 0, test: 45, exam: 120 };

function SetupForm({ classes, prefill, onCreated, onCancel }) {
  const firstSubject = classId => classes.find(item => item.id === classId)?.subjects?.[0]?.id || '';
  const [classId, setClassId] = useState(prefill.classId || classes[0]?.id || '');
  const subjects = classes.find(item => item.id === classId)?.subjects || [];
  const [subjectId, setSubjectId] = useState(() => {
    const start = prefill.classId || classes[0]?.id || '';
    const wanted = prefill.subjectId;
    return classes.find(item => item.id === start)?.subjects?.some(subject => subject.id === wanted) ? wanted : firstSubject(start);
  });
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(() => {
    const kind = MINUTES[prefill.kind] !== undefined ? prefill.kind : 'quiz';
    return { kind, standard: 'school', difficulty: 'standard', durationMinutes: MINUTES[kind], bloomMode: 'auto', bloom: {}, source: 'combination', topicIds: prefill.topicId ? [prefill.topicId] : [], instructions: '', delivery: kind === 'exam' ? 'printable' : 'online', title: '' };
  });
  const [sections, setSections] = useState(() => presetStructure(MINUTES[prefill.kind] !== undefined ? prefill.kind : 'quiz', 'school'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = patch => setForm(previous => ({ ...previous, ...patch }));

  // Class and subject change together, so the server is never asked about a subject from another class.
  function chooseClass(next) {
    setClassId(next);
    setSubjectId(firstSubject(next));
  }
  useEffect(() => {
    if (!classId || !subjectId) { setOptions(null); return undefined; }
    let current = true;
    setOptions(null);
    setError('');
    getAssessmentOptions(classId, subjectId).then(data => { if (current) setOptions(data); }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [classId, subjectId]);

  function setKind(kind) {
    set({ kind, durationMinutes: MINUTES[kind], delivery: kind === 'exam' ? 'printable' : 'online' });
    setSections(presetStructure(kind, form.standard));
  }
  function setStandard(standard) {
    set({ standard });
    if (form.kind === 'exam') setSections(presetStructure('exam', standard));
  }
  const toggle = (key, value) => set({ [key]: form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value] });
  const profile = options?.profiles?.find(item => item.key === form.standard);
  const autoBloom = form.difficulty === 'hard' || form.difficulty === 'external' || ['waec', 'neco', 'igcse', 'sat'].includes(form.standard)
    ? { remember: 10, understand: 15, apply: 25, analyse: 25, evaluate: 20, create: 5 }
    : form.difficulty === 'easy' ? { remember: 35, understand: 30, apply: 20, analyse: 10, evaluate: 5, create: 0 } : (profile?.bloom || {});
  const bloom = form.bloomMode === 'custom' ? form.bloom : autoBloom;
  const totals = structureTotals(sections);

  async function create() {
    setBusy(true); setError('');
    try {
      const blueprint = toBlueprint(sections);
      const { assessment } = await createAiAssessment({ ...form, classId, subjectId, bloom, blueprint, types: [...new Set(blueprint.sections.map(section => section.type))], questionCount: totals.questions, totalMarks: totals.marks });
      onCreated(assessment);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className={`${CARD} space-y-4`} aria-label="Create with Ndovera AI">
      <h2 className="text-xl font-black text-[#800000] dark:text-white">Ndovera AI Assessment</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(KIND_LABELS).map(([key, label]) => <button key={key} type="button" className={form.kind === key ? PRIMARY : SECONDARY} onClick={() => setKind(key)}>AI {label}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={LABEL}>Class<select className={FIELD} value={classId} onChange={event => chooseClass(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}{item.arm ? ` ${item.arm}` : ''}</option>)}</select></label>
        <label className={LABEL}>Subject<select className={FIELD} value={subjectId} onChange={event => setSubjectId(event.target.value)}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label className={LABEL}>Title (optional)<input className={FIELD} value={form.title} onChange={event => set({ title: event.target.value })} placeholder="Ndovera names it for you" /></label>
      </div>
      {!options ? (error ? null : classId && subjectId ? <p role="status">Loading topics…</p> : <p className="text-sm">Choose a class and subject.</p>) : (
        <>
          <fieldset>
            <legend className={LABEL}>Topics</legend>
            {options.topics.length === 0 ? <p className="text-sm text-[#191970]">No topics yet for this subject. Add topics in the classroom first, so Ndovera AI works from what you teach.</p> : (
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" className={SECONDARY} onClick={() => set({ topicIds: form.topicIds.length === options.topics.length ? [] : options.topics.map(topic => topic.id) })}>{form.topicIds.length === options.topics.length ? 'Clear' : 'All taught topics'}</button>
                {options.topics.map(topic => (
                  <label key={topic.id} className={`flex cursor-pointer items-center gap-1 rounded-xl border px-3 py-1.5 text-sm ${form.topicIds.includes(topic.id) ? 'border-[#1a5c38] bg-[#e8f5ee] font-bold text-[#1a5c38]' : 'border-[#c9a96e]/45 bg-white text-[#191970]'}`}>
                    <input type="checkbox" className="sr-only" checked={form.topicIds.includes(topic.id)} onChange={() => toggle('topicIds', topic.id)} />{topic.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="grid gap-3 md:grid-cols-5">
            <label className={LABEL}>Standard<select className={FIELD} value={form.standard} onChange={event => setStandard(event.target.value)}>{options.profiles.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label className={LABEL}>Difficulty<select className={FIELD} value={form.difficulty} onChange={event => set({ difficulty: event.target.value })}>{DIFFICULTIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className={LABEL}>Duration (minutes)<input type="number" min="0" className={FIELD} value={form.durationMinutes} onChange={event => set({ durationMinutes: event.target.value })} /></label>
            <label className={LABEL}>Source<select className={FIELD} value={form.source} onChange={event => set({ source: event.target.value })}>{SOURCES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className={LABEL}>Delivery<select className={FIELD} value={form.delivery} onChange={event => set({ delivery: event.target.value })}><option value="online">Online</option><option value="printable">Printable</option><option value="both">Both</option></select></label>
          </div>
          <fieldset className="rounded-2xl bg-white/60 p-3">
            <legend className={LABEL}>Paper structure</legend>
            <PaperStructureEditor sections={sections} onChange={setSections} />
          </fieldset>
          <fieldset className="rounded-2xl bg-white/60 p-3">
            <legend className={LABEL}>Bloom's levels</legend>
            <div className="flex gap-2">
              <button type="button" className={form.bloomMode === 'auto' ? PRIMARY : SECONDARY} onClick={() => set({ bloomMode: 'auto' })}>Automatic</button>
              <button type="button" className={form.bloomMode === 'custom' ? PRIMARY : SECONDARY} onClick={() => set({ bloomMode: 'custom', bloom: { ...autoBloom, ...form.bloom } })}>Custom distribution</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {BLOOM.map(level => (
                <label key={level} className="text-xs font-bold text-[#191970]">{BLOOM_LABELS[level]}
                  <input type="number" min="0" max="100" disabled={form.bloomMode !== 'custom'} className={FIELD} value={bloom[level] ?? 0} onChange={event => set({ bloom: { ...form.bloom, [level]: Number(event.target.value) } })} />
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-[#191970]">{form.bloomMode === 'auto' ? 'Senior and external-exam classes get more Apply, Analyse and Evaluate automatically.' : `Weights total ${BLOOM.reduce((sum, level) => sum + (Number(bloom[level]) || 0), 0)} — they are used as proportions.`}</p>
          </fieldset>
          <label className={LABEL}>Anything else for Ndovera AI (optional)<textarea rows={2} className={FIELD} value={form.instructions} onChange={event => set({ instructions: event.target.value })} placeholder="e.g. include a velocity-time graph; use Nigerian examples; one question on the 2024 price table" /></label>
          <p className="text-xs text-[#191970]">Answers and the marking scheme are generated automatically. Graphs, charts, diagrams and circuits are drawn where questions need them. Nothing is published until you review and approve it.</p>
        </>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={PRIMARY} disabled={busy || !options || !totals.questions} onClick={create}>{busy ? 'Starting…' : form.kind === 'exam' ? 'Review the exam plan' : `Write ${totals.questions} question${totals.questions === 1 ? '' : 's'}`}</button>
        <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

/** A saved blueprint section as a row of the structure editor. */
function structureRow(section) {
  const row = {
    name: section.name, type: section.type, questions: section.questions, attempt: section.attempt,
    marksPerQuestion: section.marksPerQuestion || Math.max(1, Math.round((Number(section.marks) || 0) / (Number(section.attempt) || 1))),
    parts: section.parts || 0, compulsory: (section.compulsory || []).join(', '), bloom: section.bloom, instructions: section.instructions || '',
  };
  return { ...row, instructionsEdited: Boolean(row.instructions) && row.instructions !== describeSection(row) };
}

function BlueprintEditor({ assessment, onApproved }) {
  const [sections, setSections] = useState(() => assessment.blueprint.sections.map(structureRow));
  const [topics, setTopics] = useState(assessment.blueprint.topics || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setTopic = (index, marks) => setTopics(previous => previous.map((topic, i) => (i === index ? { ...topic, marks: Number(marks) || 0 } : topic)));
  const total = structureTotals(sections).marks;
  const topicTotal = topics.reduce((sum, topic) => sum + (Number(topic.marks) || 0), 0);

  async function approve() {
    setBusy(true); setError('');
    try {
      const blueprint = toBlueprint(sections);
      // Keep each section's cognitive demand when the type is unchanged.
      blueprint.sections = blueprint.sections.map((section, index) => (sections[index]?.bloom && assessment.blueprint.sections[index]?.type === section.type ? { ...section, bloom: sections[index].bloom } : section));
      const result = await approveAssessmentBlueprint(assessment.id, { ...blueprint, topics });
      onApproved(result.assessment);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className={`${CARD} space-y-4`} aria-label="Exam blueprint">
      <div>
        <h2 className="text-xl font-black text-[#800000] dark:text-white">Exam blueprint — {assessment.subjectName}, {assessment.className}</h2>
        <p className="text-sm text-[#191970] dark:text-slate-300">Approve or change the structure before Ndovera AI writes a single question.</p>
      </div>
      <div className="rounded-2xl bg-white/60 p-3"><PaperStructureEditor sections={sections} onChange={setSections} /></div>
      <div>
        <h3 className="font-black text-[#800000] dark:text-white">Topic coverage</h3>
        <table className="mt-1 text-sm text-[#191970] dark:text-slate-200">
          <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-1">Topic</th><th className="p-1">Target marks</th></tr></thead>
          <tbody>
            {topics.map((topic, index) => <tr key={topic.name}><td className="p-1">{topic.name}</td><td className="p-1"><input type="number" min="0" className={`${FIELD} w-24`} value={topic.marks} onChange={event => setTopic(index, event.target.value)} /></td></tr>)}
            <tr className="font-black"><td className="p-1">Total</td><td className="p-1">{topicTotal}{topicTotal !== total ? <span className="ml-2 text-xs font-semibold text-amber-700">(paper total is {total})</span> : null}</td></tr>
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <button type="button" className={PRIMARY} disabled={busy} onClick={approve}>{busy ? 'Saving…' : 'Approve blueprint & write the paper'}</button>
    </section>
  );
}

function GenerationProgress({ assessment, onDone }) {
  const [state, setState] = useState({ written: assessment.questions.length, total: assessment.slots.length, error: '' });
  const stopped = useRef(false);
  const run = useCallback(async () => {
    setState(previous => ({ ...previous, error: '' }));
    try {
      for (let guard = 0; guard < 60 && !stopped.current; guard += 1) {
        const result = await generateNextQuestions(assessment.id);
        setState({ written: result.assessment.questions.length, total: result.assessment.slots.length, error: '' });
        if (result.done) { onDone(result.assessment); return; }
      }
    } catch (err) { setState(previous => ({ ...previous, error: err.message })); }
  }, [assessment.id, onDone]);
  useEffect(() => { stopped.current = false; run(); return () => { stopped.current = true; }; }, [run]);
  const percent = state.total ? Math.round((state.written / state.total) * 100) : 0;
  return (
    <section className={`${CARD} space-y-3`} aria-live="polite">
      <h2 className="text-xl font-black text-[#800000] dark:text-white">Ndovera AI is writing your {KIND_LABELS[assessment.kind].toLowerCase()}…</h2>
      <p className="text-sm text-[#191970] dark:text-slate-300">From your topics and notes, a few questions at a time. Each one is checked before it is kept.</p>
      <div className="h-4 w-full overflow-hidden rounded-full bg-white"><div className="h-full bg-[#1a5c38] transition-all" style={{ width: `${percent}%` }} /></div>
      <p className="text-sm font-bold text-[#191970] dark:text-white">{state.written} of {state.total} questions written</p>
      {state.error && <div className="flex items-center gap-2"><p role="alert" className="flex-1 text-sm font-semibold text-rose-700">{state.error}</p><button type="button" className={PRIMARY} onClick={run}>Try again</button></div>}
    </section>
  );
}

function LetterheadEditor({ letterhead, onSaved }) {
  const [form, setForm] = useState(letterhead);
  const [notice, setNotice] = useState('');
  const set = patch => setForm(previous => ({ ...previous, ...patch }));
  return (
    <section className={`${CARD} space-y-2`} aria-label="Exam letterhead">
      <h2 className="text-lg font-black text-[#800000] dark:text-white">Exam letterhead</h2>
      <p className="text-sm text-[#191970] dark:text-slate-300">Printed at the top of every examination paper and marking scheme from this school, in the school's colours and never more than 1 inch tall. The logo and colours start from the school's branding.</p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className={LABEL}>School name<input className={FIELD} value={form.schoolName} onChange={event => set({ schoolName: event.target.value })} /></label>
        <label className={LABEL}>Logo URL<input className={FIELD} value={form.logoUrl} onChange={event => set({ logoUrl: event.target.value })} /></label>
        <label className={LABEL}>Address<input className={FIELD} value={form.address} onChange={event => set({ address: event.target.value })} /></label>
        <label className={LABEL}>Motto<input className={FIELD} value={form.motto} onChange={event => set({ motto: event.target.value })} /></label>
        <label className={LABEL}>Contact (phone, email, website)<input className={FIELD} value={form.contact || ''} onChange={event => set({ contact: event.target.value })} /></label>
        <div className="flex gap-3">
          <label className={LABEL}>Main colour<input type="color" className="mt-1 block h-9 w-16 rounded-lg border border-[#c9a96e]/45" value={form.primaryColor || '#14215b'} onChange={event => set({ primaryColor: event.target.value })} /></label>
          <label className={LABEL}>Accent colour<input type="color" className="mt-1 block h-9 w-16 rounded-lg border border-[#c9a96e]/45" value={form.accentColor || '#1a5c38'} onChange={event => set({ accentColor: event.target.value })} /></label>
        </div>
        <label className={`${LABEL} md:col-span-2`}>Default instructions to candidates<textarea rows={3} className={FIELD} value={form.defaultInstructions} onChange={event => set({ defaultInstructions: event.target.value })} /></label>
        <label className={LABEL}>Footer<input className={FIELD} value={form.footer} onChange={event => set({ footer: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.showStudentFields !== false} onChange={event => set({ showStudentFields: event.target.checked })} /> Student name / admission number / date boxes</label>
      </div>
      <div className="rounded-xl bg-white p-3" aria-label="Letterhead preview"><Letterhead letterhead={form} /></div>
      <button type="button" className={PRIMARY} onClick={async () => { try { const result = await saveExamLetterhead(form); onSaved(result.letterhead); setNotice('Saved.'); } catch (err) { setNotice(err.message); } }}>Save letterhead</button>
      {notice && <p role="status" className="text-sm font-semibold text-[#1a5c38]">{notice}</p>}
    </section>
  );
}

/** Owner / HOS page for the school's exam letterhead. */
export function ExamLetterheadPage({ dashboardLabel = 'Dashboard' }) {
  const [letterhead, setLetterhead] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getExamLetterhead().then(data => setLetterhead(data.letterhead)).catch(err => setError(err.message)); }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}
      {letterhead && <LetterheadEditor letterhead={letterhead} onSaved={setLetterhead} />}
    </div>
  );
}

export default function AiAssessmentStudio() {
  const location = useLocation();
  const prefill = Object.fromEntries(new URLSearchParams(location.search).entries());
  const [classes, setClasses] = useState(null);
  const [list, setList] = useState(null);
  const [letterhead, setLetterhead] = useState(null);
  const [canEditLetterhead, setCanEditLetterhead] = useState(false);
  // A link with a class, or with a kind (the Exams page's "With Ndovera AI"), starts creating at once.
  const [view, setView] = useState(prefill.classId || prefill.kind ? 'create' : 'home');
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');

  const loadList = useCallback(() => listMyAssessments().then(data => setList(data.assessments)).catch(err => setError(err.message)), []);
  useEffect(() => {
    getAssignedClasses().then(data => setClasses((data?.classes || []).filter(item => item.subjects?.length))).catch(() => setClasses([]));
    getExamLetterhead().then(data => { setLetterhead(data.letterhead); setCanEditLetterhead(data.canEdit); }).catch(() => setLetterhead({ schoolName: '' }));
    loadList();
  }, [loadList]);

  async function open(id) {
    try {
      const data = await getAiAssessment(id);
      const assessment = { ...data.assessment, canEdit: data.canEdit };
      setCurrent(assessment);
      if (assessment.kind === 'exam' && !assessment.blueprintApproved) setView('blueprint');
      else if (assessment.pending > 0 && assessment.status === 'draft' && !assessment.failed.length && assessment.questions.length < assessment.slots.length) setView('generate');
      else setView('workspace');
    } catch (err) { setError(err.message); }
  }

  // The Exams page opens a typed or uploaded paper here: ?tab=assessment&open=<id>
  useEffect(() => { if (prefill.open) open(prefill.open); }, [prefill.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterCreate = assessment => { setCurrent(assessment); setView(assessment.kind === 'exam' ? 'blueprint' : 'generate'); };
  const onGenerated = useCallback(assessment => { setCurrent(assessment); setView('workspace'); loadList(); }, [loadList]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <section className={`${CARD} ndv-no-print`}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Ndovera AI</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">AI Assessments</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Quizzes, assignments, tests and examinations written from your own topics and notes — with Bloom's coverage, balanced answer keys, marking schemes and a quality check. You review and approve everything before students see it.</p>
      </section>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}

      {view === 'home' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} disabled={!classes?.length} onClick={() => setView('create')}>+ Create with Ndovera AI</button>
            {canEditLetterhead && <button type="button" className={SECONDARY} onClick={() => setView('letterhead')}>Exam letterhead</button>}
          </div>
          {classes && !classes.length && <p className="text-sm text-[#191970] dark:text-slate-300">No classes with subjects are assigned to you yet.</p>}
          <section className={CARD}>
            <h2 className="mb-2 font-black text-[#800000] dark:text-white">Your assessments</h2>
            {!list ? <p role="status">Loading…</p> : !list.length ? <p className="text-sm text-[#191970] dark:text-slate-300">Nothing yet.</p> : (
              <ul className="space-y-2">
                {list.map(item => (
                  <li key={item.id}>
                    <button type="button" onClick={() => open(item.id)} className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-left text-[#191970] hover:ring-2 hover:ring-[#800020]/30">
                      <span className="flex-1 font-bold">{item.title}</span>
                      <span className="text-xs">{KIND_LABELS[item.kind]} · {item.className} · {item.subjectName}</span>
                      <span className="rounded-full bg-[#fff6e0] px-2 py-0.5 text-xs font-bold">{STATUS_LABELS[item.status] || item.status} · v{item.version}</span>
                      <span className="text-xs">{item.questionCount}/{item.plannedCount || item.questionCount} questions · {new Date(item.updatedAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {view === 'create' && (classes ? (classes.length ? <SetupForm classes={classes} prefill={prefill} onCreated={afterCreate} onCancel={() => setView('home')} /> : <p>No classes with subjects are assigned to you yet.</p>) : <p role="status">Loading your classes…</p>)}
      {view === 'blueprint' && current && <BlueprintEditor assessment={current} onApproved={next => { setCurrent(next); setView('generate'); }} />}
      {view === 'generate' && current && <GenerationProgress assessment={current} onDone={onGenerated} />}
      {view === 'workspace' && current && <AssessmentWorkspace key={current.id} initial={current} letterhead={letterhead || {}} onBack={() => { setView('home'); setCurrent(null); loadList(); }} />}
      {view === 'letterhead' && letterhead && (
        <>
          <button type="button" className={SECONDARY} onClick={() => setView('home')}>← Back</button>
          <LetterheadEditor letterhead={letterhead} onSaved={setLetterhead} />
        </>
      )}
    </div>
  );
}

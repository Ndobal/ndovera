import React, { useCallback, useEffect, useState } from 'react';
import * as api from './materialAiApi';

// The Curriculum & Examination Library behind Ndovera AI materials.
//   Ami ("ami"): Ndovera's curricula, examination specifications, mapping, AI limits.
//   A school ("school"): its own curricula, which curricula its teachers use, and its AI choices.
// Rows come from CSV or from syllabus text Ndovera AI restructures (never adds to);
// nothing reaches teachers until it is published.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';
const STATUS_TONE = { published: 'bg-emerald-100 text-emerald-800', draft: 'bg-amber-100 text-amber-800', archived: 'bg-slate-200 text-slate-700' };

const lines = value => String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
const Status = ({ status }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[status] || STATUS_TONE.draft}`}>{status}</span>;

function useNotice() {
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const run = useCallback(async (work, success = '') => {
    setNotice({ text: '', tone: 'ok' });
    try { const result = await work(); if (success) setNotice({ text: success, tone: 'ok' }); return result; } catch (error) { setNotice({ text: error.message, tone: 'error' }); return null; }
  }, []);
  const view = notice.text ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p> : null;
  return [run, view, setNotice];
}

/** Paste a long document; Ndovera AI restructures it a piece at a time. */
function TextImport({ label, onChunk, extraFields = null }) {
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  async function start() {
    setError('');
    let offset = 0;
    let added = 0;
    let rejected = 0;
    setProgress({ done: 0, total: text.length, added: 0 });
    try {
      for (let guard = 0; guard < 200; guard += 1) {
        const result = await onChunk(text, offset);
        added += result.added || 0;
        rejected += (result.rejected || []).length;
        offset = result.next;
        setProgress({ done: offset, total: result.total || text.length, added, rejected });
        if (result.done) break;
      }
    } catch (err) { setError(`${err.message} (stopped at ${Math.round((offset / Math.max(1, text.length)) * 100)}% — run again to retry the rest)`); }
  }
  return (
    <div className="space-y-2">
      <p className={LABEL}>{label}</p>
      {extraFields}
      <textarea rows={6} className={FIELD} value={text} onChange={event => setText(event.target.value)} placeholder="Paste the official syllabus / scheme of work text here. Ndovera AI only restructures it into rows — it does not add anything — and you review the rows before publishing." />
      <button type="button" className={PRIMARY} disabled={!text.trim() || (progress && progress.done < progress.total && !error)} onClick={start}>Read with Ndovera AI</button>
      {progress && <p className="text-sm text-[#191970]" role="status">{Math.round((progress.done / Math.max(1, progress.total)) * 100)}% read · {progress.added} row(s) added{progress.rejected ? ` · ${progress.rejected} skipped (no topic/subject/class)` : ''}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

function CsvImport({ label, columns, onImport }) {
  const [csv, setCsv] = useState('');
  return (
    <div className="space-y-2">
      <p className={LABEL}>{label}</p>
      <p className="text-xs text-[#191970]">Columns: <code>{columns}</code>. Separate several subtopics or objectives with semicolons.</p>
      <input type="file" accept=".csv,.tsv,.txt" onChange={event => { const file = event.target.files?.[0]; if (file) file.text().then(setCsv); }} />
      <textarea rows={4} className={`${FIELD} font-mono text-xs`} value={csv} onChange={event => setCsv(event.target.value)} placeholder={columns} />
      <button type="button" className={PRIMARY} disabled={!csv.trim()} onClick={async () => { if (await onImport(csv)) setCsv(''); }}>Import rows</button>
    </div>
  );
}

// ─── Curricula ───────────────────────────────────────────────────────────────

const BLANK_TOPIC = { class: '', subject: '', theme: '', topic: '', subtopics: '', objectives: '', competencies: '', term: '', week: '' };
const topicForm = topic => ({ class: topic.classLabel, subject: topic.subject, theme: topic.theme, topic: topic.topic, subtopics: topic.subtopics.join('\n'), objectives: topic.objectives.join('\n'), competencies: topic.competencies.join('\n'), term: topic.term, week: topic.week });

function TopicForm({ value, onChange, onSave, onCancel, saving }) {
  const field = (key, label, rows = 0) => (
    <label className="text-xs font-semibold text-[#800020]">{label}
      {rows ? <textarea rows={rows} className={FIELD} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} /> : <input className={FIELD} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} />}
    </label>
  );
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {field('class', 'Class (e.g. SS 2, Primary 4)')}{field('subject', 'Subject')}{field('theme', 'Theme / strand')}
      {field('topic', 'Topic')}{field('term', 'Term')}{field('week', 'Week')}
      {field('subtopics', 'Subtopics — one per line', 3)}{field('objectives', 'Learning objectives — one per line', 3)}{field('competencies', 'Expected competencies — one per line', 3)}
      <div className="flex gap-2 md:col-span-3">
        <button type="button" className={PRIMARY} disabled={saving} onClick={() => onSave({ ...value, subtopics: lines(value.subtopics), objectives: lines(value.objectives), competencies: lines(value.competencies) })}>Save topic</button>
        {onCancel && <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function CurriculumEditor({ scope, curriculum, onBack, onChanged }) {
  const [run, notice] = useNotice();
  const [topics, setTopics] = useState([]);
  const [filter, setFilter] = useState({ subject: '', classKey: '' });
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [importDefaults, setImportDefaults] = useState({ subject: '', classLabel: '' });
  const load = useCallback(() => api.listCurriculumTopics(scope, curriculum.id).then(result => setTopics(result.topics || [])).catch(() => setTopics([])), [scope, curriculum.id]);
  useEffect(() => { load(); }, [load]);
  const subjects = [...new Set(topics.map(topic => topic.subject))].sort();
  const classes = [...new Map(topics.map(topic => [topic.classKey, topic])).values()].sort((a, b) => a.classOrder - b.classOrder);
  const shown = topics.filter(topic => (!filter.subject || topic.subject === filter.subject) && (!filter.classKey || topic.classKey === filter.classKey));
  const setStatus = status => run(async () => { await api.setCurriculumStatus(scope, curriculum.id, status); onChanged(); }, status === 'published' ? 'Published: teachers are now grounded in this curriculum.' : `Marked ${status}.`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={SECONDARY} onClick={onBack}>← All curricula</button>
        <h2 className="flex-1 text-xl font-black text-[#800000] dark:text-white">{curriculum.name} <Status status={curriculum.status} /></h2>
        {curriculum.status !== 'published' && <button type="button" className={PRIMARY} onClick={() => setStatus('published')}>Publish</button>}
        {curriculum.status === 'published' && <button type="button" className={SECONDARY} onClick={() => setStatus('draft')}>Unpublish</button>}
        {curriculum.status !== 'archived' && <button type="button" className={SECONDARY} onClick={() => setStatus('archived')}>Archive</button>}
        <button type="button" className="text-sm font-semibold text-rose-700 underline" onClick={() => { if (window.confirm(`Delete "${curriculum.name}" and all ${topics.length} topics?`)) run(async () => { await api.deleteCurriculum(scope, curriculum.id); onBack(); onChanged(); }); }}>Delete</button>
      </div>
      {notice}
      <div className={INNER}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className={`${FIELD} max-w-[12rem]`} value={filter.subject} onChange={event => setFilter(current => ({ ...current, subject: event.target.value }))} aria-label="Subject"><option value="">All subjects</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select>
          <select className={`${FIELD} max-w-[10rem]`} value={filter.classKey} onChange={event => setFilter(current => ({ ...current, classKey: event.target.value }))} aria-label="Class"><option value="">All classes</option>{classes.map(item => <option key={item.classKey} value={item.classKey}>{item.classLabel}</option>)}</select>
          <span className="flex-1 text-sm text-[#191970]">{shown.length} of {topics.length} topic(s)</span>
          <button type="button" className={PRIMARY} onClick={() => setAdding({ ...BLANK_TOPIC, subject: filter.subject })}>Add topic</button>
        </div>
        {adding && <div className="mb-3 rounded-xl bg-[#fff8f0] p-3"><TopicForm value={adding} onChange={setAdding} onCancel={() => setAdding(null)} onSave={row => run(async () => { const result = await api.addCurriculumTopics(scope, curriculum.id, { rows: [row] }); if (!result.added) throw new Error(`Not saved: ${result.rejected[0]?.problems.join(', ')}`); setAdding(null); load(); onChanged(); }, 'Topic added.')} /></div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-[#191970] dark:text-slate-200">
            <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">Class</th><th className="p-2">Subject</th><th className="p-2">Theme</th><th className="p-2">Topic</th><th className="p-2">Objectives</th><th className="p-2" /></tr></thead>
            <tbody>
              {shown.map(topic => (editing?.id === topic.id ? (
                <tr key={topic.id}><td colSpan={6} className="bg-[#fff8f0] p-3"><TopicForm value={editing.form} onChange={form => setEditing({ ...editing, form })} onCancel={() => setEditing(null)} onSave={row => run(async () => { await api.updateCurriculumTopic(scope, curriculum.id, topic.id, row); setEditing(null); load(); }, 'Saved.')} /></td></tr>
              ) : (
                <tr key={topic.id} className="border-t border-[#c9a96e]/25 align-top">
                  <td className="p-2 whitespace-nowrap">{topic.classLabel}</td><td className="p-2">{topic.subject}</td><td className="p-2">{topic.theme}</td>
                  <td className="p-2 font-semibold">{topic.topic}{topic.subtopics.length ? <span className="block text-xs font-normal text-slate-500">{topic.subtopics.join('; ')}</span> : null}</td>
                  <td className="p-2 text-xs">{topic.objectives.length ? topic.objectives.join('; ') : <span className="text-amber-700">none — coverage cannot be checked</span>}</td>
                  <td className="p-2 whitespace-nowrap">
                    <button type="button" className="text-xs font-semibold underline" onClick={() => setEditing({ id: topic.id, form: topicForm(topic) })}>Edit</button>{' '}
                    <button type="button" className="text-xs font-semibold text-rose-700 underline" onClick={() => run(async () => { await api.deleteCurriculumTopic(scope, curriculum.id, topic.id); load(); onChanged(); })}>Delete</button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
          {!topics.length && <p className="p-3 text-sm text-[#191970]">No topics yet — add them, import a CSV, or paste the curriculum text below.</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={INNER}><CsvImport label="Import a CSV" columns="class,subject,theme,topic,subtopics,objectives,competencies,term,week" onImport={csv => run(async () => { const result = await api.addCurriculumTopics(scope, curriculum.id, { csv }); load(); onChanged(); if (result.rejected.length) throw new Error(`${result.added} added; ${result.rejected.length} skipped: ${result.rejected.slice(0, 3).map(item => `row ${item.index + 2} (${item.problems.join(', ')})`).join('; ')}`); return true; }, 'Imported.')} /></div>
        <div className={INNER}>
          <TextImport label="Paste curriculum text" onChunk={async (text, offset) => { const result = await api.importCurriculumText(scope, curriculum.id, { text, offset, ...importDefaults }); load(); onChanged(); return result; }}
            extraFields={<div className="grid grid-cols-2 gap-2"><input className={FIELD} placeholder="Subject, if the text does not say" value={importDefaults.subject} onChange={event => setImportDefaults(current => ({ ...current, subject: event.target.value }))} /><input className={FIELD} placeholder="Class, if the text does not say" value={importDefaults.classLabel} onChange={event => setImportDefaults(current => ({ ...current, classLabel: event.target.value }))} /></div>} />
        </div>
      </div>
    </div>
  );
}

function CurriculaManager({ scope }) {
  const [run, notice] = useNotice();
  const [curricula, setCurricula] = useState([]);
  const [openId, setOpenId] = useState('');
  const [form, setForm] = useState({ name: '', country: 'Nigeria', system: '', version: '', source: '' });
  const load = useCallback(() => api.listCurricula(scope).then(result => setCurricula(result.curricula || [])).catch(() => setCurricula([])), [scope]);
  useEffect(() => { load(); }, [load]);
  const open = curricula.find(item => item.id === openId);
  if (open) return <CurriculumEditor scope={scope} curriculum={open} onBack={() => setOpenId('')} onChanged={load} />;
  return (
    <div className="space-y-4">
      {notice}
      <div className={INNER}>
        <p className={LABEL}>New curriculum</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input className={FIELD} placeholder="Name, e.g. NERDC Basic Education Curriculum" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          <input className={FIELD} placeholder="Country" value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} />
          <input className={FIELD} placeholder="System / body" value={form.system} onChange={event => setForm({ ...form, system: event.target.value })} />
          <input className={FIELD} placeholder="Version / year" value={form.version} onChange={event => setForm({ ...form, version: event.target.value })} />
          <button type="button" className={PRIMARY} disabled={!form.name.trim()} onClick={() => run(async () => { const result = await api.createCurriculum(scope, form); setForm({ ...form, name: '', version: '' }); await load(); setOpenId(result.curriculum.id); })}>Create</button>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {curricula.map(item => (
          <li key={item.id}>
            <button type="button" onClick={() => setOpenId(item.id)} className={`${INNER} w-full text-left hover:ring-2 hover:ring-[#c9a96e]`}>
              <p className="font-bold text-[#800000] dark:text-white">{item.name} <Status status={item.status} /></p>
              <p className="text-sm text-[#191970] dark:text-slate-300">{[item.country, item.system, item.version].filter(Boolean).join(' · ')} · {item.topicCount} topic(s){scope === 'school' ? '' : item.owner === 'school' ? ' · a school\'s own' : ''}</p>
            </button>
          </li>
        ))}
      </ul>
      {!curricula.length && <p className="text-sm text-[#191970]">No curricula yet.</p>}
    </div>
  );
}

// ─── Examination specifications (Ndovera only) ──────────────────────────────

const BLANK_SPEC = { examKey: 'waec', subject: '', name: '', body: '', country: 'Nigeria', qualification: '', version: '', effectiveFrom: '', effectiveTo: '', source: '', calculator: '', practical: '', papers: '', assessmentObjectives: '', requiredSkills: '', questionTypes: '', notes: '' };
const specForm = spec => ({ ...BLANK_SPEC, ...spec, papers: spec.papers.map(paper => [paper.name, paper.marks || '', paper.durationMinutes || '', (paper.questionTypes || []).join('; ')].join(' | ')).join('\n'), assessmentObjectives: spec.assessmentObjectives.join('\n'), requiredSkills: spec.requiredSkills.join('\n'), questionTypes: spec.questionTypes.join('\n') });
const specPayload = form => ({
  ...form, assessmentObjectives: lines(form.assessmentObjectives), requiredSkills: lines(form.requiredSkills), questionTypes: lines(form.questionTypes),
  papers: lines(form.papers).map(line => { const [name, marks, durationMinutes, types] = line.split('|').map(part => part.trim()); return { name, marks: Number(marks) || 0, durationMinutes: Number(durationMinutes) || 0, questionTypes: (types || '').split(';').map(item => item.trim()).filter(Boolean) }; }),
});

function SpecForm({ value, onChange, catalog, onSave, onCancel }) {
  const field = (key, label, rows = 0, placeholder = '') => (
    <label className="text-xs font-semibold text-[#800020]">{label}
      {rows ? <textarea rows={rows} className={FIELD} placeholder={placeholder} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} /> : <input className={FIELD} placeholder={placeholder} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} />}
    </label>
  );
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <label className="text-xs font-semibold text-[#800020]">Examination
        <input className={FIELD} list="exam-catalog" value={value.examKey} onChange={event => onChange({ ...value, examKey: event.target.value })} />
        <datalist id="exam-catalog">{catalog.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</datalist>
      </label>
      {field('subject', 'Subject')}{field('version', 'Specification version', 0, 'e.g. 2025–2027 syllabus')}
      {field('name', 'Display name', 0, 'e.g. WAEC (WASSCE)')}{field('body', 'Examination body')}{field('qualification', 'Qualification')}
      {field('effectiveFrom', 'Effective from (YYYY-MM-DD)')}{field('effectiveTo', 'Effective to (optional)')}{field('source', 'Source (document, URL)')}
      {field('papers', 'Papers — one per line: name | marks | minutes | question types', 3, 'Paper 1 | 50 | 90 | objective')}
      {field('assessmentObjectives', 'Assessment objectives — one per line', 3)}{field('requiredSkills', 'Required skills — one per line', 3)}
      {field('questionTypes', 'Question types — one per line', 2)}{field('calculator', 'Calculator rules', 2)}{field('practical', 'Practical requirements', 2)}
      <div className="flex gap-2 md:col-span-3"><button type="button" className={PRIMARY} onClick={() => onSave(specPayload(value))}>Save specification</button>{onCancel && <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}

function SpecEditor({ spec, catalog, onBack, onChanged }) {
  const [run, notice] = useNotice();
  const [data, setData] = useState({ topics: [], mappings: [] });
  const [form, setForm] = useState(null);
  const [topic, setTopic] = useState({ area: '', topic: '', objectives: '' });
  const load = useCallback(() => api.getExamSpecTopics(spec.id).then(setData).catch(() => {}), [spec.id]);
  useEffect(() => { load(); }, [load]);
  const links = id => data.mappings.filter(mapping => mapping.specTopicId === id);
  const setStatus = status => run(async () => { await api.setExamSpecStatus(spec.id, status); onChanged(); }, `Marked ${status}.`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={SECONDARY} onClick={onBack}>← All specifications</button>
        <h2 className="flex-1 text-xl font-black text-[#800000] dark:text-white">{spec.name} — {spec.subject} <span className="text-sm font-semibold">({spec.version})</span> <Status status={spec.status} /></h2>
        {spec.status !== 'published' ? <button type="button" className={PRIMARY} onClick={() => setStatus('published')}>Publish</button> : <button type="button" className={SECONDARY} onClick={() => setStatus('draft')}>Unpublish</button>}
        <button type="button" className={SECONDARY} onClick={() => setForm(specForm(spec))}>Edit details</button>
        <button type="button" className={SECONDARY} onClick={() => run(async () => { const result = await api.autoMapExamSpec(spec.id); load(); return result; }, 'Mapped to Ndovera\'s curricula.')}>Map to curricula</button>
        <button type="button" className="text-sm font-semibold text-rose-700 underline" onClick={() => { if (window.confirm('Delete this specification?')) run(async () => { await api.deleteExamSpec(spec.id); onBack(); onChanged(); }); }}>Delete</button>
      </div>
      {notice}
      {form && <div className={INNER}><SpecForm value={form} onChange={setForm} catalog={catalog} onCancel={() => setForm(null)} onSave={payload => run(async () => { await api.updateExamSpec(spec.id, payload); setForm(null); onChanged(); }, 'Saved.')} /></div>}
      <div className={INNER}>
        <p className={LABEL}>Topics ({data.topics.length})</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
          <input className={FIELD} placeholder="Area, e.g. Algebra" value={topic.area} onChange={event => setTopic({ ...topic, area: event.target.value })} />
          <input className={FIELD} placeholder="Topic" value={topic.topic} onChange={event => setTopic({ ...topic, topic: event.target.value })} />
          <input className={FIELD} placeholder="Objectives (separate with ;)" value={topic.objectives} onChange={event => setTopic({ ...topic, objectives: event.target.value })} />
          <button type="button" className={PRIMARY} disabled={!topic.topic.trim()} onClick={() => run(async () => { await api.addExamSpecTopics(spec.id, { rows: [topic] }); setTopic({ area: topic.area, topic: '', objectives: '' }); load(); onChanged(); })}>Add topic</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-[#191970] dark:text-slate-200">
            <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">Area</th><th className="p-2">Topic</th><th className="p-2">Objectives</th><th className="p-2">Curriculum links</th><th className="p-2" /></tr></thead>
            <tbody>{data.topics.map(item => (
              <tr key={item.id} className="border-t border-[#c9a96e]/25 align-top">
                <td className="p-2">{item.area}</td><td className="p-2 font-semibold">{item.topic}</td><td className="p-2 text-xs">{item.objectives.join('; ')}</td>
                <td className="p-2 text-xs">{links(item.id).map(link => (
                  <span key={link.curriculumTopicId} className="mr-1 inline-flex items-center gap-1 rounded-full bg-[#e8f5ee] px-2 py-0.5">{link.classLabel} {link.curriculumTopic}{link.method === 'auto' ? ' (auto)' : ''}
                    <button type="button" aria-label="Remove link" onClick={() => run(async () => { await api.setExamMapping({ curriculumTopicId: link.curriculumTopicId, specTopicId: item.id, linked: false }); load(); })}>×</button>
                  </span>
                ))}{!links(item.id).length && <span className="text-slate-500">none</span>}</td>
                <td className="p-2"><button type="button" className="text-xs font-semibold text-rose-700 underline" onClick={() => run(async () => { await api.deleteExamSpecTopic(spec.id, item.id); load(); onChanged(); })}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={INNER}><CsvImport label="Import topics (CSV)" columns="area,topic,objectives,skills,questionTypes" onImport={csv => run(async () => { await api.addExamSpecTopics(spec.id, { csv }); load(); onChanged(); return true; }, 'Imported.')} /></div>
        <div className={INNER}><TextImport label="Paste syllabus text" onChunk={async (text, offset) => { const result = await api.importExamSpecText(spec.id, { text, offset }); load(); onChanged(); return result; }} /></div>
      </div>
    </div>
  );
}

function ExamSpecsManager() {
  const [run, notice] = useNotice();
  const [state, setState] = useState({ specs: [], catalog: [] });
  const [openId, setOpenId] = useState('');
  const [form, setForm] = useState(null);
  const load = useCallback(() => api.listExamSpecs().then(setState).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const open = state.specs.find(spec => spec.id === openId);
  if (open) return <SpecEditor spec={open} catalog={state.catalog} onBack={() => setOpenId('')} onChanged={load} />;
  return (
    <div className="space-y-4">
      {notice}
      <div className="flex items-center gap-2"><p className="flex-1 text-sm text-[#191970]">One authoritative specification per examination and subject. Teachers see “No specification on file” for anything not published here.</p><button type="button" className={PRIMARY} onClick={() => setForm({ ...BLANK_SPEC })}>New specification</button></div>
      {form && <div className={INNER}><SpecForm value={form} onChange={setForm} catalog={state.catalog} onCancel={() => setForm(null)} onSave={payload => run(async () => { const result = await api.createExamSpec(payload); setForm(null); await load(); setOpenId(result.spec.id); })} /></div>}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {state.specs.map(spec => (
          <li key={spec.id}><button type="button" onClick={() => setOpenId(spec.id)} className={`${INNER} w-full text-left hover:ring-2 hover:ring-[#c9a96e]`}>
            <p className="font-bold text-[#800000] dark:text-white">{spec.name} — {spec.subject} <Status status={spec.status} /></p>
            <p className="text-sm text-[#191970] dark:text-slate-300">{spec.version}{spec.effectiveFrom ? ` · from ${spec.effectiveFrom}` : ''} · {spec.topicCount} topic(s)</p>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

// ─── What Ndovera AI may produce ─────────────────────────────────────────────

function SettingsPanel({ scope }) {
  const [run, notice] = useNotice();
  const [settings, setSettings] = useState(null);
  const [curricula, setCurricula] = useState([]);
  useEffect(() => {
    (scope === 'ami' ? api.getPlatformMaterialAi() : api.getSchoolMaterialAi())
      .then(result => { setSettings(result.settings); setCurricula(result.curricula || []); }).catch(() => {});
  }, [scope]);
  if (!settings) return <p className="text-sm text-[#191970]">Loading…</p>;
  const platform = settings.platform;
  const toggle = (key, label) => (
    <label className={`flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm ${platform && !platform[key] ? 'opacity-50' : ''}`}>
      <span>{label}{platform && !platform[key] ? ' — switched off by Ndovera' : ''}</span>
      <input type="checkbox" disabled={platform && !platform[key]} checked={Boolean(settings[key])} onChange={event => setSettings({ ...settings, [key]: event.target.checked })} />
    </label>
  );
  return (
    <div className="space-y-4">
      {notice}
      {scope === 'school' && (
        <div className={INNER}>
          <p className={LABEL}>Curricula your teachers are grounded in</p>
          <p className="mt-1 text-xs text-[#191970]">Leave all unticked to use your school's own curricula, or every published Ndovera curriculum if you have none.</p>
          <div className="mt-2 space-y-1">{curricula.map(item => (
            <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.curriculumIds.includes(item.id)} onChange={event => setSettings({ ...settings, curriculumIds: event.target.checked ? [...settings.curriculumIds, item.id] : settings.curriculumIds.filter(id => id !== item.id) })} /> {item.name}{item.version ? ` (${item.version})` : ''} · {item.owner === 'school' ? 'your school' : 'Ndovera'}</label>
          ))}{!curricula.length && <p className="text-sm">No published curricula yet.</p>}</div>
        </div>
      )}
      <div className={INNER}>
        <p className={LABEL}>AI material generation</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"><span>Text generation</span><span className="font-bold text-emerald-700">Enabled</span></div>
          {toggle('tables', 'Tables')}{toggle('formulae', 'Formulae')}{toggle('graphs', 'Graphs, charts and diagrams')}{toggle('images', 'AI illustrations')}
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
            <span>Maximum illustrations per material{platform ? ` (Ndovera allows ${platform.maxImages})` : ''}</span>
            <input type="number" min="0" max={platform ? platform.maxImages : 8} className={`${FIELD} w-20`} value={settings.maxImages} onChange={event => setSettings({ ...settings, maxImages: Number(event.target.value) || 0 })} />
          </label>
        </div>
        <button type="button" className={`${PRIMARY} mt-3`} onClick={() => run(async () => { const result = scope === 'ami' ? await api.savePlatformMaterialAi(settings) : await api.saveSchoolMaterialAi(settings); setSettings(result.settings); }, 'Saved.')}>Save</button>
      </div>
    </div>
  );
}

export default function CurriculumLibraryPage({ scope = 'ami' }) {
  const tabs = scope === 'ami'
    ? [['curricula', 'Curricula'], ['exams', 'Examination specifications'], ['settings', 'AI limits']]
    : [['settings', 'Curriculum & Ndovera AI'], ['curricula', 'Our own curricula']];
  const [tab, setTab] = useState(tabs[0][0]);
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>{scope === 'ami' ? 'Ndovera' : 'School'}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Curriculum & Examination Library</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">What Ndovera AI grounds every material and tutor answer in: the curriculum decides what is taught at each level; examination specifications decide what is examined. Nothing here is guessed.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tab === key ? PRIMARY : SECONDARY}>{label}</button>)}
        </div>
      </div>
      {tab === 'curricula' && <CurriculaManager scope={scope} />}
      {tab === 'exams' && scope === 'ami' && <ExamSpecsManager />}
      {tab === 'settings' && <SettingsPanel scope={scope} />}
    </div>
  );
}

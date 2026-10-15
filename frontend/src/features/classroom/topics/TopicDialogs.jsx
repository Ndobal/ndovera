import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteTopic, getCurriculumTopicsForSubject, importCurriculumTopics, updateTopic } from '../classroomService';

const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
const LABEL = 'block text-xs font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-300';

function Dialog({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-auto bg-[#191970]/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg rounded-3xl bg-[#b5e3f4] p-5 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="flex-1 text-lg font-bold text-[#800000] dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]">Close</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Edit a topic's details. Renaming carries its notes, materials and assignments along. */
export function TopicEditorDialog({ classId, topic, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: topic.name || '',
    description: topic.description || '',
    week: topic.week || '',
    objectives: (topic.objectives || []).join('\n'),
    status: topic.status || 'published',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) { setError('Give the topic a name.'); return; }
    setBusy(true); setError('');
    const response = await updateTopic(classId, topic.id, { ...form, objectives: form.objectives.split('\n') }).catch(err => ({ success: false, message: err.message }));
    setBusy(false);
    if (!response?.success) { setError(response?.message || 'Could not save the topic.'); return; }
    onSaved(response.topic);
  }

  return (
    <Dialog title={`Edit topic — ${topic.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className={LABEL}>Title<input value={form.name} onChange={set('name')} className={FIELD} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>Week / sequence<input value={form.week} onChange={set('week')} placeholder="e.g. Week 4" className={FIELD} /></label>
          <label className={LABEL}>Visible to students
            <select value={form.status} onChange={set('status')} className={FIELD}>
              <option value="published">Published</option>
              <option value="draft">Draft (hidden)</option>
            </select>
          </label>
        </div>
        <label className={LABEL}>Overview<textarea value={form.description} onChange={set('description')} rows={3} className={FIELD} /></label>
        <label className={LABEL}>Learning objectives (one per line)<textarea value={form.objectives} onChange={set('objectives')} rows={4} className={FIELD} /></label>
        <p className="text-xs text-[#191970] dark:text-slate-300">Renaming keeps every note, material and assignment filed under this topic.</p>
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">{busy ? 'Saving…' : 'Save topic'}</button>
      </form>
    </Dialog>
  );
}

/**
 * Remove a topic. Its content is never deleted: if anything is filed under it,
 * the teacher moves it to another topic or leaves it unassigned.
 */
export function RemoveTopicDialog({ classId, topic, content, otherTopics, onClose, onRemoved }) {
  const [action, setAction] = useState(otherTopics.length ? 'move' : 'unassign');
  const [targetTopicId, setTargetTopicId] = useState(otherTopics[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true); setError('');
    const response = await deleteTopic(classId, topic.id, { contentAction: action, targetTopicId: action === 'move' ? targetTopicId : '' })
      .catch(err => ({ success: false, message: err.message }));
    setBusy(false);
    if (!response?.success) { setError(response?.message || 'Could not remove the topic.'); return; }
    onRemoved();
  }

  return (
    <Dialog title={`Remove topic — ${topic.name}`} onClose={onClose}>
      <p className="text-sm text-[#191970] dark:text-slate-200">
        This topic has {content.materials} material{content.materials === 1 ? '' : 's'} and {content.assignments} assignment{content.assignments === 1 ? '' : 's'}. Removing the topic does not delete them. Choose where they go:
      </p>
      <div className="mt-3 space-y-2 text-sm text-[#191970] dark:text-slate-100">
        <label className="flex items-center gap-2">
          <input type="radio" name="topic-content" value="move" checked={action === 'move'} disabled={!otherTopics.length} onChange={() => setAction('move')} />
          Move them to
          <select value={targetTopicId} disabled={action !== 'move' || !otherTopics.length} onChange={event => setTargetTopicId(event.target.value)} className="rounded-lg border border-[#c9a96e]/45 bg-white p-1 dark:bg-slate-800">
            {otherTopics.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="topic-content" value="unassign" checked={action === 'unassign'} onChange={() => setAction('unassign')} />
          Leave them in the subject without a topic
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <button type="button" disabled={busy || (action === 'move' && !targetTopicId)} onClick={remove} className="mt-4 rounded-2xl bg-[#800000] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
        {busy ? 'Removing…' : 'Remove topic'}
      </button>
    </Dialog>
  );
}

const TERM_NAMES = { 1: 'First term', 2: 'Second term', 3: 'Third term' };

/**
 * Bring the term's topics for this class level and subject in from the curriculum
 * the school uses. They arrive as drafts so the teacher can edit, add and then publish.
 */
export function CurriculumImportDialog({ classId, subjectId, subjectName, onClose, onImported }) {
  const [data, setData] = useState(null);
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurriculumTopicsForSubject(classId, subjectId)
      .then(result => {
        if (!result?.success) throw new Error(result?.message || 'Could not load the curriculum.');
        const terms = [...new Set((result.topics || []).map(topic => String(topic.term || '')))];
        const start = terms.includes(String(result.currentTerm)) ? String(result.currentTerm) : (terms[0] || '');
        setData(result);
        setTerm(start);
        setPicked(new Set((result.topics || []).filter(topic => String(topic.term || '') === start && !topic.added).map(topic => topic.id)));
      })
      .catch(err => setError(err.message || 'Could not load the curriculum.'));
  }, [classId, subjectId]);

  const terms = useMemo(() => [...new Set((data?.topics || []).map(topic => String(topic.term || '')))], [data]);
  const shown = (data?.topics || []).filter(topic => String(topic.term || '') === term);

  function chooseTerm(next) {
    setTerm(next);
    setPicked(new Set((data?.topics || []).filter(topic => String(topic.term || '') === next && !topic.added).map(topic => topic.id)));
  }
  function toggle(id) {
    setPicked(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function run() {
    setBusy(true); setError('');
    const response = await importCurriculumTopics(classId, subjectId, [...picked]).catch(err => ({ success: false, message: err.message }));
    setBusy(false);
    if (!response?.success) { setError(response?.message || 'Could not import the topics.'); return; }
    onImported(response);
  }

  return (
    <Dialog title={`Import topics — ${subjectName || 'subject'}`} onClose={onClose}>
      {!data && !error && <p className="text-sm text-[#191970] dark:text-slate-200">Loading the curriculum…</p>}
      {data && (
        <div className="space-y-3">
          <p className="text-sm text-[#191970] dark:text-slate-200">
            {data.level ? <>From {data.curricula?.join(', ') || 'the curriculum'} for <strong>{data.level} {data.subject}</strong>. </> : null}
            The topics come in as <strong>drafts</strong>: students see them only after you publish. You can edit them, add your own and reorder them first.
          </p>
          {data.message && <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">{data.message}</p>}
          {terms.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Term">
              {terms.map(item => (
                <button key={item} type="button" role="tab" aria-selected={term === item} onClick={() => chooseTerm(item)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold ${term === item ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#191970] dark:bg-slate-800 dark:text-slate-100'}`}>
                  {TERM_NAMES[item] || (item ? `Term ${item}` : 'No term')}{String(data.currentTerm) === item ? ' (now)' : ''}
                </button>
              ))}
            </div>
          )}
          {shown.length > 0 && (
            <div className="flex gap-3 text-xs font-semibold text-[#191970] dark:text-slate-200">
              <button type="button" className="underline" onClick={() => setPicked(new Set(shown.filter(topic => !topic.added).map(topic => topic.id)))}>Select all</button>
              <button type="button" className="underline" onClick={() => setPicked(new Set())}>Select none</button>
            </div>
          )}
          <ul className="max-h-[50vh] space-y-1 overflow-auto rounded-2xl bg-white/70 p-2 dark:bg-slate-800/60">
            {shown.map(topic => (
              <li key={topic.id}>
                <label className={`flex items-start gap-2 rounded-xl p-2 text-sm ${topic.added ? 'opacity-60' : ''} text-[#191970] dark:text-slate-100`}>
                  <input type="checkbox" className="mt-1" disabled={topic.added} checked={picked.has(topic.id)} onChange={() => toggle(topic.id)} />
                  <span>
                    <span className="font-semibold">{topic.week ? `Week ${topic.week}: ` : ''}{topic.topic}</span>
                    {topic.added && <span className="ml-1 text-xs">(already in this subject)</span>}
                    {topic.subtopics?.length ? <span className="block text-xs text-slate-600 dark:text-slate-300">{topic.subtopics.join('; ')}</span> : null}
                  </span>
                </label>
              </li>
            ))}
            {!shown.length && <li className="p-2 text-sm text-[#191970] dark:text-slate-200">No curriculum topics here.</li>}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {data && (
        <button type="button" disabled={busy || !picked.size} onClick={run} className="mt-4 rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
          {busy ? 'Importing…' : `Import ${picked.size} topic${picked.size === 1 ? '' : 's'} as drafts`}
        </button>
      )}
    </Dialog>
  );
}

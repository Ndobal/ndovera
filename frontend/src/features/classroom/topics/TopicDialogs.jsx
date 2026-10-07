import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteTopic, updateTopic } from '../classroomService';

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

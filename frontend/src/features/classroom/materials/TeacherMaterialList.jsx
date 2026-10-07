import React, { useState } from 'react';
import RichContent from '../../../shared/rich/RichContent';
import { createPortal } from 'react-dom';
import MaterialTypeThumbnail, { materialTypeLabel } from '../../../shared/components/MaterialTypeThumbnail';
import StructuredMaterialEditor from './StructuredMaterialEditor';
import * as svc from '../classroomService';

// A teacher's materials for the current term, with the full lifecycle on each:
// Edit · Hide/Show · Delete · Reuse · View History.

const FIELD = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]';
const ACTION = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] hover:bg-[#154a2e] disabled:opacity-50 dark:bg-[#00ffff] dark:text-[#000000]';

const STATUS_BADGES = {
  draft: { label: 'Draft — not visible to students', className: 'bg-amber-100 text-amber-900' },
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-900' },
  hidden: { label: 'Hidden from students', className: 'bg-slate-200 text-slate-800' },
};

const EVENT_LABELS = {
  published: 'Published', drafted: 'Saved as draft', edited: 'Edited', hidden: 'Hidden from students',
  shown: 'Shown to students again', unpublished: 'Moved back to draft', reused: 'Created by reusing another material',
  reused_elsewhere: 'Reused in another class', deleted: 'Deleted',
};

function visibilityLabel(value) {
  if (value === 'teacher') return 'Teacher only (private resource)';
  if (value === 'student') return 'Students';
  return 'Students + Parents';
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Dialog({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-[#191970]/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-3xl rounded-3xl bg-[#b5e3f4] p-5 shadow-xl dark:bg-[#35002b]">
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

function EditDialog({ classId, material, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: material.title || '',
    url: material.url || '',
    topic: material.topic || '',
    weekLabel: material.weekLabel || '',
    visibility: material.visibility || 'student_parent',
    releaseAt: toLocalInput(material.releaseAt),
    description: material.description || '',
    blocks: material.blocks || [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setBusy(true); setError('');
    const response = await svc.updateMaterial(classId, material.id, {
      ...form,
      title: form.title.trim(),
      releaseAt: form.releaseAt ? new Date(form.releaseAt).toISOString() : '',
    }).catch(err => ({ success: false, message: err.message }));
    setBusy(false);
    if (!response?.success) { setError(response?.message || 'Could not save this material.'); return; }
    onSaved(`Saved ${form.title.trim()}. The previous version is kept in its history.`);
  }

  return (
    <Dialog title={`Edit “${material.title}”`} onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Title<input value={form.title} onChange={set('title')} className={FIELD} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Link<input value={form.url} onChange={set('url')} className={FIELD} placeholder="Leave blank for a lesson note" /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Topic<input value={form.topic} onChange={set('topic')} className={FIELD} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Week<input value={form.weekLabel} onChange={set('weekLabel')} className={FIELD} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Audience
          <select value={form.visibility} onChange={set('visibility')} className={FIELD}>
            <option value="student_parent">Students + Parents</option>
            <option value="student">Students Only</option>
            <option value="teacher">Teacher Only (private resource)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Release at<input type="datetime-local" value={form.releaseAt} onChange={set('releaseAt')} className={FIELD} /></label>
        <div className="md:col-span-2">
          <StructuredMaterialEditor
            value={form.description}
            onChange={description => setForm(current => ({ ...current, description }))}
            blocks={form.blocks}
            onBlocksChange={blocks => setForm(current => ({ ...current, blocks }))}
          />
        </div>
        {error && <p role="alert" className="md:col-span-2 text-sm font-semibold text-[#800000]">{error}</p>}
        <div className="md:col-span-2 flex gap-2">
          <button type="submit" disabled={busy} className={PRIMARY}>{busy ? 'Saving…' : 'Save new version'}</button>
          <button type="button" onClick={onClose} className={ACTION}>Cancel</button>
        </div>
      </form>
    </Dialog>
  );
}

function HistoryDialog({ classId, material, onClose }) {
  const [state, setState] = useState({ loading: true, versions: [], events: [], error: '' });
  React.useEffect(() => {
    let cancelled = false;
    svc.getMaterialHistory(classId, material.id)
      .then(response => {
        if (cancelled) return;
        if (!response?.success) throw new Error(response?.message || 'Could not load the history.');
        setState({ loading: false, versions: response.versions || [], events: response.events || [], error: '' });
      })
      .catch(err => { if (!cancelled) setState({ loading: false, versions: [], events: [], error: err.message }); });
    return () => { cancelled = true; };
  }, [classId, material.id]);

  return (
    <Dialog title={`History of “${material.title}”`} onClose={onClose}>
      {state.loading && <p role="status" className="text-sm text-[#191970]">Loading history…</p>}
      {state.error && <p role="alert" className="text-sm font-semibold text-[#800000]">{state.error}</p>}
      {!state.loading && !state.error && (
        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Versions</h3>
            {state.versions.length === 0 ? <p className="text-sm text-[#191970]">This material has not been edited since it was published.</p> : (
              <ol className="space-y-2">
                {state.versions.map(version => (
                  <li key={version.version} className="rounded-2xl bg-[#fff8f0] p-3 text-sm text-[#191970]">
                    <p className="font-bold">Version {version.version}: {version.title}</p>
                    <p className="text-xs text-[#800020]">{new Date(version.createdAt).toLocaleString()}{version.createdByName ? ` • ${version.createdByName}` : ''}</p>
                    {version.metadata?.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs">{version.metadata.description}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Activity</h3>
            {state.events.length === 0 ? <p className="text-sm text-[#191970]">No recorded activity yet.</p> : (
              <ol className="space-y-2">
                {state.events.map((event, index) => (
                  <li key={index} className="rounded-2xl bg-[#fff8f0] p-3 text-sm text-[#191970]">
                    <p className="font-bold">{EVENT_LABELS[event.action] || event.action}</p>
                    <p className="text-xs text-[#800020]">{new Date(event.createdAt).toLocaleString()}{event.actorName ? ` • ${event.actorName}` : ''}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

export function ReuseDialog({ material, classes, onClose, onReused }) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const subjects = classes.find(item => String(item.id) === classId)?.subjects || [];

  async function reuse(status) {
    setBusy(true); setError('');
    const response = await svc.reuseArchivedMaterial(material.id, { classId, subjectId, status })
      .catch(err => ({ success: false, message: err.message }));
    setBusy(false);
    if (!response?.success) { setError(response?.message || 'Could not reuse this material.'); return; }
    onReused(status === 'draft'
      ? `“${material.title}” is now a draft in the chosen class. Edit it, then publish when ready. The original is unchanged.`
      : `“${material.title}” is published in the chosen class. The original is unchanged.`);
  }

  return (
    <Dialog title={`Reuse “${material.title}”`} onClose={onClose}>
      <p className="mb-3 text-sm text-[#191970]">
        Reuse links to the original rather than copying it — any attached file is shared, not duplicated. Your edits to the reused version start its own history and never change the original.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Class
          <select value={classId} disabled={busy} onChange={event => { setClassId(event.target.value); setSubjectId(''); }} className={FIELD}>
            <option value="">Choose a class</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.className || item.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#800020]">Subject
          <select value={subjectId} disabled={busy || !classId} onChange={event => setSubjectId(event.target.value)} className={FIELD}>
            <option value="">Choose a subject</option>
            {subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#800000]">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !subjectId} onClick={() => reuse('draft')} className={ACTION}>Reuse as draft</button>
        <button type="button" disabled={busy || !subjectId} onClick={() => reuse('published')} className={PRIMARY}>{busy ? 'Working…' : 'Reuse and publish'}</button>
      </div>
    </Dialog>
  );
}

export default function TeacherMaterialList({ classId, materials, classes, canManage, academicContext, onChanged, onOpen, onMessage }) {
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [reusing, setReusing] = useState(null);
  const [busyId, setBusyId] = useState('');

  async function changeStatus(material, status, done) {
    setBusyId(material.id);
    const response = await svc.setMaterialStatus(classId, material.id, status).catch(err => ({ success: false, message: err.message }));
    setBusyId('');
    if (!response?.success) { onMessage(response?.message || 'Could not update this material.'); return; }
    onMessage(done);
    onChanged();
  }

  async function remove(material) {
    if (!window.confirm(`Delete “${material.title}”? It will be removed from teacher and student views. A deletion record is kept in the school's audit trail.`)) return;
    setBusyId(material.id);
    const response = await svc.deleteMaterial(classId, material.id).catch(err => ({ success: false, message: err.message }));
    setBusyId('');
    if (!response?.success) { onMessage(response?.message || 'Could not delete this material.'); return; }
    onMessage(`Deleted ${material.title}.`);
    onChanged();
  }

  const contextLabel = [academicContext?.sessionName, academicContext?.termName].filter(Boolean).join(' • ');

  return (
    <>
      {contextLabel && (
        <p className="mb-3 text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
          Showing {contextLabel}. Earlier terms and sessions are in Academic History.
        </p>
      )}
      {materials.length === 0 ? (
        <p className="text-sm text-[#191970] dark:text-[#39ff14]">No materials have been posted for this class this term yet.</p>
      ) : (
        <div className="space-y-3">
          {materials.map(material => {
            const badge = STATUS_BADGES[material.status] || STATUS_BADGES.published;
            const manageable = canManage(material);
            const busy = busyId === material.id;
            return (
              <div key={material.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <MaterialTypeThumbnail material={material} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#191970] dark:text-[#ffffff]">{material.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
                        {material.audience === 'teacher_only' && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-900">Teacher only</span>}
                        {material.metadata?.postedByLabel && <span className="rounded-full bg-[#800020] px-2 py-0.5 text-[11px] font-bold text-[#b5e3f4]">Posted by {material.metadata.postedByLabel}</span>}
                        {material.version > 1 && <span className="text-[11px] font-semibold text-[#800020]">v{material.version}</span>}
                      </div>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{material.subjectName || 'General Material'} • {materialTypeLabel(material)}</p>
                      {(material.topic || material.weekLabel) && <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">{material.topic || 'Lesson note'}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>}
                      {material.description && <RichContent className="mt-2 line-clamp-4 text-sm text-[#191970] dark:text-[#39ff14]" text={material.description} />}
                      <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">{visibilityLabel(material.visibility)} • {material.releaseAt ? `Releases ${new Date(material.releaseAt).toLocaleString()}` : 'Immediate release'}</p>
                      <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{material.uploadedAt ? new Date(material.uploadedAt).toLocaleString() : 'Recently uploaded'}{material.uploadedByName ? ` • ${material.metadata?.postedByLabel ? `${material.metadata.postedByLabel} (${material.uploadedByName})` : material.uploadedByName}` : ''}{material.reusedFromId ? ' • Reused' : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onOpen(material)} className={PRIMARY}>{material.url ? 'Open' : 'Read'}</button>
                    {manageable && <button type="button" disabled={busy} onClick={() => setEditing(material)} className={ACTION}>Edit</button>}
                    {manageable && material.status === 'draft' && <button type="button" disabled={busy} onClick={() => changeStatus(material, 'published', `Published ${material.title}.`)} className={ACTION}>Publish</button>}
                    {manageable && material.status === 'published' && <button type="button" disabled={busy} onClick={() => changeStatus(material, 'hidden', `${material.title} is hidden from students. Correct it, then show it again.`)} className={ACTION}>Hide</button>}
                    {manageable && material.status === 'hidden' && <button type="button" disabled={busy} onClick={() => changeStatus(material, 'published', `${material.title} is visible to students again.`)} className={ACTION}>Show</button>}
                    <button type="button" disabled={busy} onClick={() => setReusing(material)} className={ACTION}>Reuse</button>
                    {manageable && <button type="button" disabled={busy} onClick={() => setHistory(material)} className={ACTION}>History</button>}
                    {manageable && <button type="button" disabled={busy} onClick={() => remove(material)} className="rounded-2xl border border-[#800000]/25 bg-white/70 px-3 py-2 text-sm font-semibold text-[#800000] hover:bg-[#ffe8db] disabled:opacity-50 dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff]">Delete</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <EditDialog classId={classId} material={editing} onClose={() => setEditing(null)} onSaved={message => { setEditing(null); onMessage(message); onChanged(); }} />}
      {history && <HistoryDialog classId={classId} material={history} onClose={() => setHistory(null)} />}
      {reusing && <ReuseDialog material={reusing} classes={classes} onClose={() => setReusing(null)} onReused={message => { setReusing(null); onMessage(message); onChanged(); }} />}
    </>
  );
}

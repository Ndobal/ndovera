import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';
import { currentUserKey, entries, getItem, isOnline, requestPersistentStorage, setItem } from '../../shared/offline/offlineStore';

// Ndovera Notes: a well-formatted Ndovera copy of every material your teachers
// share (made by the harvester), saved on this device so it can be read with no
// internet. Notes open from the device first; online, they are refreshed.

async function request(path) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), { credentials: 'include', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || 'Request failed.'), { status: response.status });
  return data;
}

const listKey = () => `notes:${currentUserKey()}:list`;
const noteKey = materialId => `notes:${currentUserKey()}:note:${materialId}`;

export async function saveNoteOffline(materialId) {
  const data = await request(`/api/ndovera-notes/${encodeURIComponent(materialId)}`);
  await setItem(noteKey(materialId), { ...data.note, savedAt: Date.now() });
  return data.note;
}

export default function OfflineNotesPage() {
  const [notes, setNotes] = useState([]);
  const [saved, setSaved] = useState({});
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!isOnline());

  const refreshSaved = useCallback(async () => {
    const kept = await entries(`notes:${currentUserKey()}:note:`);
    setSaved(Object.fromEntries(kept.map(([, note]) => [note.materialId, note])));
  }, []);

  useEffect(() => {
    requestPersistentStorage();
    (async () => {
      await refreshSaved();
      if (isOnline()) {
        try {
          const data = await request('/api/ndovera-notes');
          setNotes(data.notes || []);
          await setItem(listKey(), data.notes || []);
          return;
        } catch {}
      }
      setOffline(true);
      setNotes((await getItem(listKey())) || []);
    })();
  }, [refreshSaved]);

  const openNote = useCallback(async note => {
    const kept = saved[note.materialId];
    if (kept) setOpen(kept);
    if (isOnline()) {
      try {
        // Opening a note keeps it on this device for next time.
        const fresh = await saveNoteOffline(note.materialId);
        setOpen({ ...fresh, savedAt: Date.now() });
        refreshSaved();
      } catch (error) {
        if (!kept) setStatus(error.message);
      }
    } else if (!kept) {
      setStatus('This note is not on this device yet. Open it once while online to keep it.');
    }
  }, [refreshSaved, saved]);

  const saveAll = useCallback(async () => {
    setBusy(true);
    let count = 0;
    for (const note of notes) {
      try { await saveNoteOffline(note.materialId); count += 1; setStatus(`Saving… ${count} of ${notes.length}`); } catch {}
    }
    await refreshSaved();
    setBusy(false);
    setStatus(`${count} note${count === 1 ? '' : 's'} saved on this device — readable without internet.`);
  }, [notes, refreshSaved]);

  const shown = useMemo(() => {
    const list = notes.length ? notes : Object.values(saved);
    const term = filter.trim().toLowerCase();
    return list.filter(note => !term || `${note.title} ${note.subjectName} ${note.topic}`.toLowerCase().includes(term));
  }, [filter, notes, saved]);

  if (open) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <button type="button" onClick={() => setOpen(null)} className="mb-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-white/20 dark:text-slate-200">← All notes</button>
        <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-8 dark:border-white/10 dark:bg-slate-900/80">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-cyan-300">{open.subjectName}{open.topic ? ` · ${open.topic}` : ''} · {open.words || 0} words</p>
          <div className="prose max-w-none dark:prose-invert"><RichContent text={open.markdown} /></div>
          <p className="mt-6 text-xs text-slate-500">Ndovera copy of your teacher&apos;s material{open.savedAt ? ' · saved on this device' : ''}.</p>
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Student Dashboard</p>
        <h1 className="text-3xl font-black">Ndovera Notes</h1>
        <p className="mt-1 max-w-2xl text-white/90">Every material your teachers share, neatly formatted and saved on this device — read it anywhere, even with no internet.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveAll} disabled={busy || offline || !notes.length} className="rounded-2xl bg-white px-5 py-2.5 font-black text-emerald-700 disabled:opacity-60">{busy ? 'Saving…' : '📥 Save all for offline'}</button>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{Object.keys(saved).length} saved on this device</span>
          {offline ? <span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-amber-950">📴 Offline — showing saved notes</span> : null}
        </div>
      </section>
      {status ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100" role="status">{status}</p> : null}
      <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search notes by title, subject or topic" aria-label="Search notes"
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-white/20 dark:bg-slate-900 dark:text-white" />
      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(note => (
            <button key={note.materialId} type="button" onClick={() => openNote(note)} className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{note.subjectName || 'Notes'}</p>
              <h2 className="mt-1 font-black text-slate-900 dark:text-white">{note.title}</h2>
              {note.topic ? <p className="text-sm text-slate-600 dark:text-slate-300">{note.topic}</p> : null}
              <p className="mt-2 text-xs font-semibold text-slate-500">{saved[note.materialId] ? '✅ On this device' : '☁️ Open once online to keep'}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-white/20 dark:text-slate-300">No notes yet. When your teachers add materials, Ndovera prepares a copy here within a few minutes.</p>
      )}
    </div>
  );
}

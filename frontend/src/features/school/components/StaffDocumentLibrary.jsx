import React, { useEffect, useRef, useState } from 'react';
import { getStaffDocuments, uploadStaffDocument, deleteStaffDocument } from '../services/schoolApi';

const CATEGORIES = ['Scheme of Work', 'Lesson Note', 'Resource', 'Exam/Test', 'Policy', 'General'];
const input = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const lbl = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

function fileIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('pdf')) return '📕';
  if (t.includes('word') || t.includes('doc')) return '📘';
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return '📗';
  if (t.includes('image') || t.includes('png') || t.includes('jpg')) return '🖼️';
  if (t.includes('video')) return '🎬';
  return '📄';
}

export default function StaffDocumentLibrary() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({ title: '', category: 'Scheme of Work', description: '' });
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getStaffDocuments();
      setDocs(Array.isArray(data?.documents) ? data.documents : []);
    } catch (e) {
      setMessage(e.message || 'Could not load the library.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(event) {
    const file = (event.target.files || [])[0];
    if (!file) return;
    if (!form.title.trim()) { setMessage('Add a title before choosing a file.'); if (fileRef.current) fileRef.current.value = ''; return; }
    setUploading(true); setMessage('');
    try {
      await uploadStaffDocument(file, { title: form.title.trim(), category: form.category, description: form.description.trim() });
      setForm({ title: '', category: form.category, description: '' });
      setMessage('Uploaded. Your colleagues can now find and reuse it.');
      await load();
    } catch (e) {
      setMessage(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id) {
    try { await deleteStaffDocument(id); await load(); } catch (e) { setMessage(e.message || 'Could not delete.'); }
  }

  const categories = ['All', ...CATEGORIES];
  const shown = filter === 'All' ? docs : docs.filter(d => d.category === filter);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40">
        <h1 className="text-xl font-black text-[#800000] dark:text-slate-100">Staff Resource Library</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Upload schemes of work, lesson notes, and resources. Everything you share lands here for every staff member to find, download, and reuse.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Title</label><input className={input} value={form.title} onChange={e => setForm(c => ({ ...c, title: e.target.value }))} placeholder="e.g. JSS1 Maths Scheme of Work" /></div>
          <div>
            <label className={lbl}>Category</label>
            <select className={input} value={form.category} onChange={e => setForm(c => ({ ...c, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className={lbl}>Description (optional)</label><input className={input} value={form.description} onChange={e => setForm(c => ({ ...c, description: e.target.value }))} placeholder="A short note about this file" /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60">
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          {message ? <span className={`text-sm ${message.includes('Uploaded') ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-red-600'}`}>{message}</span> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {categories.map(c => (
          <button key={c} type="button" onClick={() => setFilter(c)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${filter === c ? 'bg-[#191970] text-white' : 'bg-[#191970]/10 text-[#191970] dark:bg-white/10 dark:text-slate-200'}`}>{c}</button>
        ))}
      </div>

      {loading ? <p className="text-sm text-[#4a5578] dark:text-slate-400">Loading…</p> : shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map(doc => (
            <div key={doc.id} className="rounded-2xl border border-[#c9a96e]/35 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#14215b] dark:text-slate-100">{fileIcon(doc.fileType)} {doc.title}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#c9a96e]">{doc.category}</p>
                  {doc.description ? <p className="mt-1 text-sm text-[#31416f] dark:text-slate-300">{doc.description}</p> : null}
                  <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">By {doc.uploaderName} · {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#191970] px-4 py-1.5 text-xs font-bold text-white">Download / Reuse</a>
                <button type="button" onClick={() => remove(doc.id)} className="rounded-xl border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="py-8 text-center text-sm text-[#4a5578] dark:text-slate-400">No documents shared yet. Be the first to upload a resource.</p>}
    </div>
  );
}

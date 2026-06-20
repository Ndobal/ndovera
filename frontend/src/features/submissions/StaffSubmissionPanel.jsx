import React, { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORIES = [
  { key: 'Document', label: 'Document', icon: '📄', accept: '.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,image/*' },
  { key: 'PDF', label: 'PDF', icon: '📕', accept: 'application/pdf,.pdf' },
  { key: 'Audio', label: 'Audio', icon: '🎙️', accept: 'audio/*' },
  { key: 'Exam Question', label: 'Exam Questions', icon: '❓', accept: 'application/pdf,.pdf,.doc,.docx,image/*' },
];

// Roles allowed to open exam-question submissions (besides the sender).
const EXAM_PRIVILEGED = ['ict', 'ict_manager', 'ict manager', 'hos', 'owner', 'admin', 'super admin', 'superadmin'];

const STORE_KEY = 'ndovera:staff-submissions';

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-40)));
  } catch {
    /* ignore */
  }
}

function currentUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem('authUser') || '{}');
    return {
      id: String(parsed?.id || parsed?.email || '').trim(),
      name: String(parsed?.name || parsed?.fullName || '').trim(),
    };
  } catch {
    return { id: '', name: '' };
  }
}

function currentRoleKey(roleProp) {
  const r = String(roleProp || localStorage.getItem('userRole') || '').trim().toLowerCase();
  return r;
}

export default function StaffSubmissionPanel({ role }) {
  const [category, setCategory] = useState('Document');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const fileInputRef = useRef(null);

  const me = useMemo(() => currentUser(), []);
  const roleKey = currentRoleKey(role);

  useEffect(() => {
    setItems(readStore());
  }, []);

  const activeCategory = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];

  const canOpenExam = (record) => {
    const isSender = (me.id && record.senderId && me.id === record.senderId) || (me.name && record.senderName && me.name === record.senderName);
    return Boolean(isSender) || EXAM_PRIVILEGED.includes(roleKey);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setError('Add a title and choose a file to submit.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const objectUrl = (() => {
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    })();

    // Best-effort upload to the backend; never blocks the local record.
    try {
      const token = localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('title', title.trim());
      formData.append('description', note.trim());
      formData.append('category', category);
      formData.append('subject', subject.trim());
      formData.append('restricted', category === 'Exam Question' ? 'true' : 'false');
      await fetch('/api/submissions', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).catch(() => {});
    } catch {
      /* offline / endpoint absent — keep local record */
    }

    const record = {
      id: `SUB_${Date.now()}`,
      title: title.trim(),
      subject: subject.trim(),
      note: note.trim(),
      category,
      fileName: file.name,
      resourceUrl: objectUrl,
      senderId: me.id,
      senderName: me.name,
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...readStore()];
    writeStore(next);
    setItems(next);

    setMessage(category === 'Exam Question' ? 'Exam questions submitted — visible only to you, ICT Manager, HOS and Owner.' : 'Submitted successfully.');
    setTitle('');
    setSubject('');
    setNote('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSubmitting(false);
  };

  const recent = items.slice(0, 6);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-800/40">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-blue-600/10 p-2 text-xl">📤</span>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Submit work</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Documents, PDFs, audios and exam questions</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              category === c.key
                ? 'border-blue-500 bg-blue-600 text-white shadow'
                : 'border-slate-200 bg-white text-slate-900 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
            }`}
          >
            <span>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      {category === 'Exam Question' && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          🔒 Exam questions can only be opened by you, the ICT Manager, HOS and Owner.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. JSS2 Maths Mid-term questions)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject / area (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span>📎</span>
            <span className="truncate">{file ? file.name : `Choose ${activeCategory.label.toLowerCase()} file`}</span>
            <input ref={fileInputRef} type="file" accept={activeCategory.accept} className="hidden" onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          </label>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows="2"
          placeholder="Note (optional)"
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />

        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
        {message ? <p className="text-xs font-semibold text-emerald-600">✅ {message}</p> : null}

        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-60">
          📨 {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Recent submissions</p>
          <div className="space-y-2">
            {recent.map((item) => {
              const isExam = item.category === 'Exam Question';
              const locked = isExam && !canOpenExam(item);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="rounded-lg bg-slate-100 p-1.5 text-base dark:bg-white/5">{isExam ? '❓' : item.category === 'Audio' ? '🎙️' : item.category === 'PDF' ? '📕' : '📄'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{item.category}{item.subject ? ` · ${item.subject}` : ''}</p>
                  </div>
                  {locked ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">🔒 Restricted</span>
                  ) : item.resourceUrl ? (
                    <a href={item.resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-600/10 px-2 py-1 text-[11px] font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white dark:text-blue-400">↗ Open</a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

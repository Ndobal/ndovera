import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../../../config/apiBase';
import { buildSelectedRoleHeader } from '../../auth/services/authApi';

// Upload a term calendar or a class timetable (PDF, Word, Excel or a photo). Ndovera AI reads it
// just after midnight and adds it: calendar activities to the school calendar, the timetable to
// the class. Each upload shows when it will be read and what happened.

const STATUS = {
  pending: ['Waiting for midnight', 'bg-amber-100 text-amber-900'],
  reading: ['Being read', 'bg-sky-100 text-sky-900'],
  done: ['Added', 'bg-emerald-100 text-emerald-900'],
  failed: ['Could not read', 'bg-rose-100 text-rose-900'],
  withdrawn: ['Withdrawn', 'bg-slate-100 text-slate-700'],
};

async function call(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), { credentials: 'include', ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Something went wrong.');
  return data;
}

export default function AiImportCard({ kind = 'calendar', classId = '', className = '', onChanged }) {
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const timetable = kind === 'timetable';

  const load = useCallback(() => {
    if (timetable && !classId) { setUploads([]); return; }
    call(`/api/school/imports?kind=${kind}${classId ? `&classId=${encodeURIComponent(classId)}` : ''}`).then(data => setUploads(data.uploads || [])).catch(() => setUploads([]));
  }, [kind, classId, timetable]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (onChanged && uploads.some(item => item.status === 'done')) onChanged(); }, [uploads, onChanged]);

  async function upload(file) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      if (classId) form.append('classId', classId);
      await call('/api/school/imports', { method: 'POST', body: form });
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function withdraw(id) {
    await call(`/api/school/imports/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(err => setError(err.message));
    load();
  }

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-gradient-to-br from-[#eef0ff] to-white p-5 dark:border-white/10 dark:from-indigo-500/10 dark:to-slate-900" aria-label={timetable ? 'Upload a timetable' : 'Upload the school calendar'}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-3xl" aria-hidden="true">✨</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-[#191970] dark:text-white">{timetable ? `Upload ${className || 'this class'}'s timetable` : 'Upload your term calendar'}</h3>
          <p className="mt-1 text-sm text-[#191970]/80 dark:text-slate-300">
            {timetable
              ? 'A PDF, Word, Excel file or clear photo of the timetable. Tonight at midnight Ndovera AI reads it, matches each lesson to the class\'s subjects and teachers, and puts it on the class timetable. The current one stays in Versions.'
              : 'A PDF, Word file or clear photo of the calendar (Week | Date | Activity). Tonight at midnight Ndovera AI adds each activity to the school calendar: resumption, C.A. tests, mid-term break, examinations, closing and holidays.'}
          </p>
        </div>
        <label className={`cursor-pointer rounded-2xl bg-[#191970] px-4 py-2 text-sm font-bold text-white ${busy || (timetable && !classId) ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? 'Uploading…' : 'Choose file'}
          <input ref={fileRef} type="file" className="sr-only" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.csv" disabled={busy || (timetable && !classId)} onChange={event => upload(event.target.files?.[0])} />
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p> : null}
      {uploads.length ? (
        <ul className="mt-3 space-y-1.5">
          {uploads.slice(0, 6).map(item => {
            const [label, tone] = STATUS[item.status] || STATUS.pending;
            return (
              <li key={item.id} className="rounded-xl bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#191970] dark:text-slate-100">{item.fileName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>
                  <span className="text-xs text-slate-500">{String(item.at).slice(0, 10)} · {item.by}</span>
                  {item.status === 'pending' ? <button type="button" onClick={() => withdraw(item.id)} className="text-xs font-bold text-rose-700 underline">Withdraw</button> : null}
                </div>
                {item.message ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.message}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

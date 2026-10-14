import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiBase } from '../../../config/apiBase';

// Ndovera's question bank from documents: Ami uploads a PDF, Word or text file of
// questions, says which section (and optionally which class level) they are for,
// and the harvester reads it in the background. Students in that section — at that
// level and above — then practise them. The harvester's progress shows below.

const apiBase = getApiBase('');

export const SECTIONS = [
  { key: 'nursery', label: 'Nursery / Early Years', levels: ['Creche', 'Pre-Nursery', 'Nursery 1', 'Nursery 2'] },
  { key: 'primary', label: 'Primary', levels: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'] },
  { key: 'junior', label: 'Junior Secondary', levels: ['JSS 1', 'JSS 2', 'JSS 3'] },
  { key: 'senior', label: 'Senior Secondary', levels: ['SS 1', 'SS 2', 'SS 3'] },
];

async function call(path, options = {}) {
  const auth = getStoredAuth();
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

const EXAM_LABELS = { waec: 'WAEC', neco: 'NECO', jamb: 'JAMB', bece: 'BECE', common_entrance: 'Common Entrance' };
const SOURCE_LABELS = { exam_topic: 'Examination syllabus topics', curriculum_topic: 'Curriculum topics', material: 'Teachers\' materials' };

/**
 * The night builder (00:00–04:00 Lagos): questions written from every syllabus, curriculum
 * and material, and every objective question checked and upgraded. Ami sets the nightly budget.
 */
function NightBuilder({ surface, label, body, input, primary }) {
  const [data, setData] = useState(null);
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => call('/api/ami/practice/builder').then(result => { setData(result); setBudget(String(result.settings.batchesPerNight)); }).catch(error => setMessage(error.message)), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return message ? <p className={body}>{message}</p> : null;
  const bySource = {};
  for (const row of data.queue) {
    const entry = bySource[row.source_type] || { items: 0, target: 0, made: 0, done: 0 };
    entry.items += Number(row.items); entry.target += Number(row.target || 0); entry.made += Number(row.made || 0);
    if (row.status === 'done') entry.done += Number(row.items);
    bySource[row.source_type] = entry;
  }
  const tonight = data.nights[0];
  return (
    <section className={surface} aria-label="Night builder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={label}>Night builder · {data.window}</p>
        <button type="button" className="text-xs font-bold underline" onClick={async () => { try { const result = await call('/api/ami/practice/builder/step', { method: 'POST' }); setMessage(`One step run: ${result.result.added || 0} written, ${result.result.reviewed || 0} checked.`); load(); } catch (error) { setMessage(error.message); } }}>Run one step now</button>
      </div>
      <p className={`${body} mt-1`}>Writes questions from every published examination syllabus (WAEC, NECO, JAMB, BECE, Common Entrance), curriculum topic and teacher's material, continuing each night where it stopped, and checks every objective question against its standard — upgrading weak ones and withdrawing the rest. Examination passes go on sale once an examination has {data.minStock} checked questions.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(EXAM_LABELS).map(([key, name]) => (
          <div key={key} className="rounded-2xl bg-white/70 p-3 text-center dark:bg-black/20">
            <p className={`text-xl font-black ${Number(data.stock[key] || 0) >= data.minStock ? 'text-[#1a5c38]' : 'text-[#800000]'} dark:text-white`}>{Number(data.stock[key] || 0).toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-[#191970] dark:text-slate-300">{name} checked{Number(data.stock[key] || 0) >= data.minStock ? ' · on sale' : ''}</p>
          </div>
        ))}
      </div>
      <ul className={`${body} mt-3 space-y-1`}>
        {Object.entries(bySource).map(([source, entry]) => <li key={source}><strong>{SOURCE_LABELS[source] || source}:</strong> {entry.made.toLocaleString()} of {entry.target.toLocaleString()} questions written · {entry.done} of {entry.items} sources complete</li>)}
        {!Object.keys(bySource).length && <li>Nothing queued yet. Publish an examination syllabus or curriculum in the Curriculum Library; materials are picked up as teachers share them.</li>}
        <li><strong>Waiting to be checked:</strong> {Number(data.unchecked || 0).toLocaleString()} objective questions</li>
        {tonight && <li><strong>Last night ({tonight.day}):</strong> {tonight.steps} steps · {tonight.added} written · {tonight.reviewed} checked · {tonight.upgraded} upgraded · {tonight.rejected} withdrawn{tonight.failures ? ` · ${tonight.failures} failed` : ''}</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className={`${body} text-xs font-bold`}>Steps per night (each is one AI call, about 8 questions)
          <input type="number" min="0" max="5000" className={`${input} mt-1 block w-32`} value={budget} onChange={event => setBudget(event.target.value)} />
        </label>
        <button type="button" className={primary} onClick={async () => { try { await call('/api/ami/practice/builder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchesPerNight: Number(budget) }) }); setMessage('Saved.'); load(); } catch (error) { setMessage(error.message); } }}>Save</button>
        <span className={`${body} text-xs`}>On Cloudflare's free plan keep this near 12 (about 100 questions a night). On the paid plan, 600 steps write about 5,000 questions a night.</span>
      </div>
      {message ? <p role="status" className={`${body} mt-2 text-sm font-semibold`}>{message}</p> : null}
    </section>
  );
}

const STATUS = { queued: 'Waiting', reading: 'Reading', processing: 'Finding questions', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' };

export default function AmiQuestionUploads({ surface, label, input, primary, body, onImported }) {
  const [form, setForm] = useState({ section: 'junior', classLevel: '', subject: '', topic: '', releaseAt: '' });
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [harvest, setHarvest] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const [imports, status] = await Promise.all([call('/api/ami/question-bank/imports').catch(() => null), call('/api/ami/harvest').catch(() => null)]);
    if (imports) setDocuments(imports.documents || []);
    if (status) setHarvest(status);
    return imports?.documents || [];
  }, []);

  useEffect(() => { load(); }, [load]);

  // While something is being read, lend the cron a hand and keep the progress live.
  useEffect(() => {
    const active = documents.filter(document => document.active);
    if (!active.length) return undefined;
    const timer = setTimeout(async () => {
      await call(`/api/ami/question-bank/imports/${active[0].id}/step`, { method: 'POST' }).catch(() => null);
      const next = await load();
      if (!next.some(document => document.active)) onImported?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [documents, load, onImported]);

  async function upload(event) {
    event.preventDefault();
    if (!file) { setMessage('Choose a document first.'); return; }
    setBusy(true); setMessage('');
    try {
      const data = new FormData();
      data.append('file', file);
      Object.entries(form).forEach(([key, value]) => { if (value) data.append(key, value); });
      await call('/api/ami/question-bank/import', { method: 'POST', body: data });
      setMessage(`"${file.name}" uploaded. Ndovera is reading it — questions appear in practice for ${SECTIONS.find(item => item.key === form.section)?.label}${form.classLevel ? ` (${form.classLevel} and above)` : ''} as soon as it finishes.`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function act(id, action) {
    try { await call(`/api/ami/question-bank/imports/${id}/${action}`, { method: 'POST' }); await load(); } catch (error) { setMessage(error.message); }
  }

  const levels = SECTIONS.find(item => item.key === form.section)?.levels || [];
  return (
    <div className="space-y-4">
      <form onSubmit={upload} className={`${surface} space-y-3`} aria-label="Upload a question document">
        <p className={label}>Upload a question document</p>
        <p className={body}>PDF, Word or text. Objective questions with an answer key (an "ANSWER KEY" list, an asterisk, or "Answer: B") are used as they are; questions without answers are given an answer key by Ndovera AI once, and it is stored.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>Section *
            <select required value={form.section} onChange={event => setForm(current => ({ ...current, section: event.target.value, classLevel: '' }))} className={input}>
              {SECTIONS.map(section => <option key={section.key} value={section.key}>{section.label}</option>)}
            </select>
          </label>
          <label className={label}>Class level (optional)
            <select value={form.classLevel} onChange={event => setForm(current => ({ ...current, classLevel: event.target.value }))} className={input}>
              <option value="">Whole section</option>
              {levels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label className={label}>Subject *
            <input required value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} className={input} placeholder="e.g. Mathematics" />
          </label>
          <label className={label}>Topic (optional)
            <input value={form.topic} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} className={input} placeholder="e.g. Fractions" />
          </label>
          <label className={label}>Hold until (optional)
            <input type="date" value={form.releaseAt} onChange={event => setForm(current => ({ ...current, releaseAt: event.target.value }))} className={input} />
          </label>
          <label className={label}>Document *
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.html" onChange={event => setFile(event.target.files?.[0] || null)} className={input} />
          </label>
        </div>
        <button type="submit" disabled={busy} className={primary}>{busy ? 'Uploading…' : 'Upload questions'}</button>
        {message ? <p className={body} role="status">{message}</p> : null}
      </form>

      {documents.length ? (
        <section className={surface} aria-label="Uploaded documents">
          <p className={`${label} mb-2`}>Uploaded documents</p>
          <ul className="space-y-2">
            {documents.map(document => (
              <li key={document.id} className="rounded-2xl bg-white/70 p-3 text-sm text-[#191970] dark:bg-black/20 dark:text-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-bold">{document.fileName}</span>
                  <span className="text-xs">{SECTIONS.find(item => item.key === document.section)?.label || document.section}{document.classLevel ? ` · ${document.classLevel}` : ''} · {document.subject}</span>
                  <span className="rounded-full bg-[#fff6e0] px-2 py-0.5 text-xs font-bold text-[#800000]">{STATUS[document.status] || document.status}{document.status === 'done' ? ` · ${document.added} questions` : ''}</span>
                  {document.status === 'failed' ? <button type="button" className="text-xs font-bold underline" onClick={() => act(document.id, 'retry')}>Retry</button> : null}
                  {document.active ? <button type="button" className="text-xs font-bold underline" onClick={() => act(document.id, 'cancel')}>Cancel</button> : null}
                </div>
                {document.active ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#1a5c38] transition-all" style={{ width: `${document.percent}%` }} /></div> : null}
                {document.error ? <p className="mt-1 text-xs text-rose-700">{document.error}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {harvest ? (
        <section className={surface} aria-label="Question harvester">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={label}>Question harvester</p>
            <button type="button" className="text-xs font-bold underline" onClick={async () => { await call('/api/ami/harvest/run', { method: 'POST' }).catch(error => setMessage(error.message)); load(); }}>Run now</button>
          </div>
          <p className={`${body} mt-1`}>Gathers every question given in Ndovera (assignments, notes, materials, AI assessments, submitted papers) into the bank within a minute, with a full sweep every night at midnight.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[['Questions in all banks', harvest.bank.total], ['Ready for practice', harvest.bank.playable], ['Held until after exams', harvest.bank.heldUntilAfterExam], ['AI answer keys', harvest.bank.aiAnswerKeys], ['Ndovera notes', harvest.notes]].map(([name, value]) => (
              <div key={name} className="rounded-2xl bg-white/70 p-3 text-center dark:bg-black/20">
                <p className="text-xl font-black text-[#800000] dark:text-white">{Number(value || 0).toLocaleString()}</p>
                <p className="text-[11px] font-semibold text-[#191970] dark:text-slate-300">{name}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <NightBuilder surface={surface} label={label} body={body} input={input} primary={primary} />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { loadHealthPhoto, reportIncident, searchHealthStudents, uploadHealthPhoto } from './healthApi';

export const CATEGORY_LABELS = {
  injury: 'Injury', illness: 'Illness', allergic_reaction: 'Allergic reaction', fever: 'Fever', headache: 'Headache',
  stomach_ache: 'Stomach ache', breathing: 'Breathing difficulty', fainting: 'Fainting / dizziness', other: 'Other',
};
export const SEVERITY_LABELS = { minor: 'Minor', moderate: 'Moderate', serious: 'Serious', emergency: 'Emergency' };
export const SEVERITY_TONE = { minor: 'bg-emerald-100 text-emerald-900', moderate: 'bg-amber-100 text-amber-900', serious: 'bg-orange-200 text-orange-950', emergency: 'bg-rose-200 text-rose-950' };
export const OUTCOME_LABELS = {
  returned_to_class: 'Returned to class', rested_then_class: 'Rested, then back to class', sent_home: 'Sent home',
  picked_up_by_parent: 'Picked up by parent', referred_to_hospital: 'Referred to hospital', emergency_services: 'Emergency services called',
};
export const STATUS_LABELS = { reported: 'Reported', in_care: 'In care', closed: 'Closed' };

export const FIELD = 'w-full rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
export const LABEL = 'block text-[11px] font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300';

export const when = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

const localNow = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

/** A private photo, loaded with the signed-in account. */
export function HealthPhoto({ url, alt = 'Injury photo' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    loadHealthPhoto(url).then(next => { objectUrl = next; if (!cancelled) setSrc(next); }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return src
    ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} className="h-24 w-24 rounded-xl border border-[#c9a96e]/50 object-cover" /></a>
    : <div className="h-24 w-24 animate-pulse rounded-xl bg-slate-200" />;
}

/** Find a child by name. */
export function StudentPicker({ value, onChange }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(() => { searchHealthStudents(term.trim()).then(data => setResults(data.students || [])).catch(() => setResults([])); }, 250);
    return () => clearTimeout(timer);
  }, [term]);
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#1a5c38]/40 bg-emerald-50 px-3 py-2 text-sm text-[#191970]">
        <span className="flex-1"><b>{value.name}</b> <span className="text-xs text-slate-600">{value.className}</span></span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-[#800020] underline">Change</button>
      </div>
    );
  }
  return (
    <div>
      <input value={term} onChange={event => setTerm(event.target.value)} placeholder="Type the child's name" className={FIELD} aria-label="Find the child" />
      {results.length ? (
        <ul className="mt-1 max-h-48 overflow-auto rounded-xl border border-[#c9a96e]/40 bg-white text-sm shadow">
          {results.map(student => (
            <li key={student.id}><button type="button" onClick={() => { onChange(student); setTerm(''); setResults([]); }} className="w-full px-3 py-1.5 text-left text-[#191970] hover:bg-[#b5e3f4]/50"><b>{student.name}</b> <span className="text-xs text-slate-500">{student.className}</span></button></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const BLANK = { student: null, occurredAt: '', location: '', category: 'injury', severity: 'minor', complaint: '', description: '', firstAidGiven: '', givenByName: '', temperature: '' };

/** Report what happened and the first aid given (any member of staff). */
export function IncidentForm({ onSaved, title = 'Report a health incident' }) {
  const [form, setForm] = useState(() => ({ ...BLANK, occurredAt: localNow() }));
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (!form.student) { setError('Choose the child.'); return; }
    if (!form.complaint.trim()) { setError('Say what happened.'); return; }
    setBusy(true); setError('');
    try {
      const { student, occurredAt, ...rest } = form;
      const result = await reportIncident({ ...rest, studentId: student.id, occurredAt: occurredAt ? new Date(occurredAt).toISOString() : '' });
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await uploadHealthPhoto(result.id, file);
      }
      setForm({ ...BLANK, occurredAt: localNow() });
      setFiles([]);
      onSaved?.(result.id, student);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-3xl border border-[#c9a96e]/50 bg-[#fff8ef] p-4 dark:bg-slate-900/50">
      <h2 className="text-lg font-black text-[#800000] dark:text-amber-200">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><span className={LABEL}>Child</span><StudentPicker value={form.student} onChange={student => setForm(current => ({ ...current, student }))} /></div>
        <label className={LABEL}>When<input type="datetime-local" value={form.occurredAt} onChange={set('occurredAt')} className={FIELD} /></label>
        <label className={LABEL}>Where<input value={form.location} onChange={set('location')} placeholder="e.g. Playground, Class JSS 1A" className={FIELD} /></label>
        <label className={LABEL}>Type
          <select value={form.category} onChange={set('category')} className={FIELD}>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
        <label className={LABEL}>Severity
          <select value={form.severity} onChange={set('severity')} className={FIELD}>{Object.entries(SEVERITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
        <label className={`${LABEL} sm:col-span-2`}>What happened / complaint<input value={form.complaint} onChange={set('complaint')} placeholder="e.g. Grazed knee after a fall" className={FIELD} /></label>
        <label className={`${LABEL} sm:col-span-2`}>Details<textarea value={form.description} onChange={set('description')} rows={2} className={FIELD} /></label>
        <label className={`${LABEL} sm:col-span-2`}>First aid given<textarea value={form.firstAidGiven} onChange={set('firstAidGiven')} rows={2} placeholder="e.g. Cleaned the wound and applied a plaster" className={FIELD} /></label>
        <label className={LABEL}>First aid given by<input value={form.givenByName} onChange={set('givenByName')} placeholder="Leave blank if it was you" className={FIELD} /></label>
        <label className={LABEL}>Temperature (°C)<input value={form.temperature} onChange={set('temperature')} placeholder="e.g. 37.8" className={FIELD} /></label>
        <label className={`${LABEL} sm:col-span-2`}>Photos of the injury (optional, up to 6)
          <input type="file" accept="image/*" capture="environment" multiple onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 6))} className={FIELD} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-black text-[#b5e3f4] disabled:opacity-60">{busy ? 'Saving…' : 'Save report'}</button>
    </form>
  );
}

/** One record, read-only. */
export function IncidentCard({ incident, onOpen, showStudent = true }) {
  return (
    <article className="rounded-2xl border border-[#c9a96e]/40 bg-white/90 p-3 text-sm text-[#191970] dark:bg-slate-900/60 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 font-black">{showStudent ? `${incident.studentName} · ` : ''}{incident.complaint}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEVERITY_TONE[incident.severity] || SEVERITY_TONE.minor}`}>{SEVERITY_LABELS[incident.severity] || 'Minor'}</span>
        <span className="rounded-full bg-[#b5e3f4] px-2 py-0.5 text-[11px] font-bold">{STATUS_LABELS[incident.status] || incident.status}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">{when(incident.occurredAt)}{incident.location ? ` · ${incident.location}` : ''} · {CATEGORY_LABELS[incident.category] || 'Other'}{showStudent && incident.className ? ` · ${incident.className}` : ''}</p>
      {incident.firstAidGiven ? <p className="mt-1"><b>First aid:</b> {incident.firstAidGiven}{incident.givenByName ? ` (by ${incident.givenByName})` : ''}</p> : null}
      {incident.medication ? <p><b>Medication:</b> {incident.medication}</p> : null}
      {incident.restMinutes !== null && incident.restMinutes !== undefined ? <p><b>Rest in sick bay:</b> {incident.restMinutes} min{incident.restEndedAt ? '' : ' (still resting)'}</p> : null}
      {incident.outcome ? <p><b>Outcome:</b> {OUTCOME_LABELS[incident.outcome] || incident.outcome}</p> : null}
      {incident.followUpNeeded ? <p><b>Follow-up:</b> {incident.followUpNotes || 'Needed'}{incident.followUpDate ? ` · by ${incident.followUpDate}` : ''}{incident.followUpDoneAt ? ' · done' : ''}</p> : null}
      {incident.photos?.length ? <div className="mt-2 flex flex-wrap gap-2">{incident.photos.map(photo => <HealthPhoto key={photo.id} url={photo.url} />)}</div> : null}
      {onOpen ? <button type="button" onClick={() => onOpen(incident)} className="mt-2 rounded-xl bg-[#191970] px-3 py-1.5 text-xs font-bold text-[#c9a96e]">Open record</button> : null}
    </article>
  );
}

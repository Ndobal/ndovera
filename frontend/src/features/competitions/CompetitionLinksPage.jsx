import React, { useCallback, useEffect, useState } from 'react';
import {
  getLinkCompetitionEntries, listLinkCompetitions, makeLinkCompetitionLink, saveLinkCompetition,
  setLinkCompetitionStatus, turnOffLinkCompetitionLink, uploadCompetitionFlier,
} from '../school/services/schoolApi';
import { getApiUrl } from '../../config/apiBase';
import { getStoredAuth } from '../auth/services/authApi';
import { askConfirm } from '../../shared/components/AppDialog';

// Competitions shared by link. The school (Owner/HoS) or Ndovera (Ami) writes up the
// competition and its entry form; once it is active they make a link and send it. Only people
// with the link can see the page. A new link stops the old one working.

const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300';
const PRIMARY = 'rounded-lg bg-[#191970] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const SECONDARY = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const MUTED = 'text-sm text-slate-600 dark:text-slate-300';
const STATUS = {
  draft: ['Draft — only you can see it', 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'],
  active: ['Active — link can be shared', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'],
  closed: ['Closed — no new entries', 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'],
};
const OPTIONAL_STANDARD = [['phone', 'Phone number'], ['email', 'Email address'], ['school', 'School'], ['classOrAge', 'Class or age']];
const EMPTY = { title: '', summary: '', details: '', rules: '', prizes: '', venue: '', startsAt: '', endsAt: '', entriesCloseAt: '', maxEntries: '', fliers: [], standardFields: ['phone', 'email', 'school', 'classOrAge'], required: { phone: true }, custom: [] };

export const competitionLink = token => `https://ndovera.com/c/${token}`;
// Dates are typed in the browser's local time and stored as exact moments (UTC).
const toLocal = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const toIso = value => (value ? new Date(value).toISOString() : '');

function toForm(competition) {
  const standardKeys = OPTIONAL_STANDARD.map(([key]) => key);
  const fields = competition.fields || [];
  return {
    id: competition.id, title: competition.title, summary: competition.summary, details: competition.details, rules: competition.rules, prizes: competition.prizes, venue: competition.venue,
    startsAt: toLocal(competition.startsAt), endsAt: toLocal(competition.endsAt), entriesCloseAt: toLocal(competition.entriesCloseAt), maxEntries: competition.maxEntries || '',
    fliers: competition.fliers || [],
    standardFields: fields.filter(field => standardKeys.includes(field.key)).map(field => field.key),
    required: Object.fromEntries(fields.filter(field => standardKeys.includes(field.key)).map(field => [field.key, field.required])),
    custom: fields.filter(field => /^q\d+$/.test(field.key)).map(field => ({ label: field.label, type: field.type, required: field.required, options: (field.options || []).join('\n') })),
  };
}

function Editor({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const addFliers = async files => {
    setBusy('flier'); setError('');
    try {
      const urls = [];
      for (const file of Array.from(files).slice(0, 6 - form.fliers.length)) urls.push((await uploadCompetitionFlier(file)).url);
      set('fliers', [...form.fliers, ...urls]);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const save = async event => {
    event.preventDefault();
    setBusy('save'); setError('');
    try {
      const fields = [
        ...form.standardFields.map(key => ({ key, required: Boolean(form.required[key]) })),
        ...form.custom.map(field => ({ ...field, options: field.type === 'choice' ? field.options : undefined })),
      ];
      const result = await saveLinkCompetition({ ...form, fields, maxEntries: form.maxEntries || null, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), entriesCloseAt: toIso(form.entriesCloseAt) });
      onSaved(result.id);
    } catch (err) { setError(err.message); setBusy(''); }
  };

  return (
    <form onSubmit={save} className={`${CARD} space-y-4`}>
      <h2 className="text-lg font-black text-[#191970] dark:text-white">{form.id ? 'Edit competition' : 'New competition'}</h2>
      <label className={LABEL}>Title<input required maxLength={160} className={FIELD} value={form.title} onChange={event => set('title', event.target.value)} /></label>
      <label className={LABEL}>One-line summary<input maxLength={400} className={FIELD} value={form.summary} onChange={event => set('summary', event.target.value)} /></label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={LABEL}>Details<textarea rows={5} className={`${FIELD} normal-case`} value={form.details} onChange={event => set('details', event.target.value)} /></label>
        <label className={LABEL}>Rules<textarea rows={5} className={`${FIELD} normal-case`} value={form.rules} onChange={event => set('rules', event.target.value)} /></label>
        <label className={LABEL}>Prizes<textarea rows={3} className={`${FIELD} normal-case`} value={form.prizes} onChange={event => set('prizes', event.target.value)} /></label>
        <label className={LABEL}>Venue or where it holds<textarea rows={3} className={`${FIELD} normal-case`} value={form.venue} onChange={event => set('venue', event.target.value)} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={LABEL}>Starts<input type="datetime-local" className={FIELD} value={form.startsAt} onChange={event => set('startsAt', event.target.value)} /></label>
        <label className={LABEL}>Ends<input type="datetime-local" className={FIELD} value={form.endsAt} onChange={event => set('endsAt', event.target.value)} /></label>
        <label className={LABEL}>Entries close<input type="datetime-local" className={FIELD} value={form.entriesCloseAt} onChange={event => set('entriesCloseAt', event.target.value)} /></label>
        <label className={LABEL}>Most entries (blank = no limit)<input type="number" min={1} className={FIELD} value={form.maxEntries} onChange={event => set('maxEntries', event.target.value)} /></label>
      </div>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Fliers (up to 6 images)</legend>
        <div className="flex flex-wrap gap-3">
          {form.fliers.map(url => (
            <div key={url} className="relative">
              <img src={url} alt="Flier" className="h-28 w-28 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              <button type="button" aria-label="Remove this flier" onClick={() => set('fliers', form.fliers.filter(item => item !== url))} className="absolute -right-2 -top-2 rounded-full bg-rose-700 px-2 text-sm font-bold text-white">×</button>
            </div>
          ))}
        </div>
        {form.fliers.length < 6 ? <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Add fliers" disabled={busy === 'flier'} onChange={event => addFliers(event.target.files)} className="text-sm text-slate-700 dark:text-slate-200" /> : null}
        {busy === 'flier' ? <p className={MUTED}>Uploading…</p> : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Entry form</legend>
        <p className={MUTED}>Full name is always asked. Choose what else to ask:</p>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_STANDARD.map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.standardFields.includes(key)} onChange={event => set('standardFields', event.target.checked ? [...form.standardFields, key] : form.standardFields.filter(item => item !== key))} /> {label}</label>
              {form.standardFields.includes(key) ? <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(form.required[key])} onChange={event => set('required', { ...form.required, [key]: event.target.checked })} /> required</label> : null}
            </span>
          ))}
        </div>
        {form.custom.map((field, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_10rem_auto_auto]">
            <label className={LABEL}>Question {index + 1}<input className={FIELD} value={field.label} onChange={event => set('custom', form.custom.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))} /></label>
            <label className={LABEL}>Answer type
              <select className={FIELD} value={field.type} onChange={event => set('custom', form.custom.map((item, i) => (i === index ? { ...item, type: event.target.value } : item)))}>
                <option value="text">Short text</option><option value="long">Long text</option><option value="number">Number</option><option value="choice">Choose one</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1 self-end text-sm"><input type="checkbox" checked={field.required} onChange={event => set('custom', form.custom.map((item, i) => (i === index ? { ...item, required: event.target.checked } : item)))} /> required</label>
            <button type="button" className={`${SECONDARY} self-end`} onClick={() => set('custom', form.custom.filter((_, i) => i !== index))}>Remove</button>
            {field.type === 'choice' ? <label className={`${LABEL} sm:col-span-4`}>Options (one per line)<textarea rows={3} className={`${FIELD} normal-case`} value={field.options} onChange={event => set('custom', form.custom.map((item, i) => (i === index ? { ...item, options: event.target.value } : item)))} /></label> : null}
          </div>
        ))}
        {form.custom.length < 15 ? <button type="button" className={SECONDARY} onClick={() => set('custom', [...form.custom, { label: '', type: 'text', required: false, options: '' }])}>+ Add a question</button> : null}
      </fieldset>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className={PRIMARY} disabled={busy !== ''}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Entries({ competition, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getLinkCompetitionEntries(competition.id).then(setData).catch(err => setError(err.message)); }, [competition.id]);
  const download = async () => {
    const response = await fetch(getApiUrl(`/api/link-competitions/${encodeURIComponent(competition.id)}/entries?format=csv`), { headers: { Authorization: `Bearer ${getStoredAuth()?.token || ''}` } });
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = `${competition.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-entries.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  const fields = data?.competition?.fields || competition.fields || [];
  return (
    <section className={`${CARD} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[#191970] dark:text-white">Entries · {competition.title}</h2>
        <div className="flex gap-2"><button type="button" className={SECONDARY} onClick={download}>Download CSV</button><button type="button" className={SECONDARY} onClick={onClose}>Close</button></div>
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p> : null}
      {!data && !error ? <p className={MUTED}>Loading…</p> : null}
      {data ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-700 dark:text-slate-300">{fields.map(field => <th key={field.key} className="p-2">{field.label}</th>)}<th className="p-2">Entered</th></tr></thead>
            <tbody>
              {data.entries.map(entry => (
                <tr key={entry.id} className="border-t border-slate-200 dark:border-slate-700">{fields.map(field => <td key={field.key} className="p-2">{entry.answers[field.key] || '—'}</td>)}<td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td></tr>
              ))}
              {!data.entries.length ? <tr><td colSpan={fields.length + 1} className="p-4 text-center text-slate-600 dark:text-slate-300">No entries yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function CompetitionLinksPage() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => listLinkCompetitions().then(result => { setData(result); setError(''); }).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (action, message) => {
    setError(''); setNotice('');
    try { const result = await action(); if (message) setNotice(typeof message === 'function' ? message(result) : message); await load(); }
    catch (err) { setError(err.message); }
  };
  const copy = async token => {
    try { await navigator.clipboard.writeText(competitionLink(token)); setNotice('Link copied. Send it to the people you want to see the competition.'); }
    catch { setNotice(competitionLink(token)); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 text-slate-900 sm:p-6 dark:text-slate-100">
      <header className="rounded-2xl bg-[#191970] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">{data?.hostName || 'Competitions'}</p>
        <h1 className="mt-1 text-2xl font-black">Competitions by link</h1>
        <p className="mt-2 text-sm text-slate-100">Write up a competition with its fliers and entry form. When it is active, make a link and send it — only people with the link can see it. It is not listed anywhere.</p>
      </header>
      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      {notice ? <p role="status" className="break-all rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p> : null}

      {editing ? <Editor initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Saved.'); load(); }} /> : (
        <button type="button" className={PRIMARY} onClick={() => setEditing(EMPTY)}>+ New competition</button>
      )}
      {viewing ? <Entries competition={viewing} onClose={() => setViewing(null)} /> : null}

      {!data && !error ? <p className={MUTED}>Loading…</p> : null}
      {data && !data.competitions.length ? <p className={`${CARD} ${MUTED}`}>No competition is created</p> : null}
      {(data?.competitions || []).map(competition => {
        const [statusLabel, statusClass] = STATUS[competition.status] || STATUS.draft;
        return (
          <article key={competition.id} className={`${CARD} space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-[#191970] dark:text-white">{competition.title}</h2>
                {competition.summary ? <p className={MUTED}>{competition.summary}</p> : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>{statusLabel}</span>
            </div>
            <p className={MUTED}>{competition.entries} entr{competition.entries === 1 ? 'y' : 'ies'} · {competition.fliers.length} flier{competition.fliers.length === 1 ? '' : 's'}</p>
            {competition.linkToken ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <code className="break-all text-sm text-slate-900 dark:text-slate-100">{competitionLink(competition.linkToken)}</code>
                <button type="button" className={SECONDARY} onClick={() => copy(competition.linkToken)}>Copy link</button>
                <a className={SECONDARY} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${competition.title}\n${competitionLink(competition.linkToken)}`)}`}>Send by WhatsApp</a>
                <button type="button" className={SECONDARY} onClick={async () => { if (await askConfirm('Make a new link? The old link will stop working for everyone who has it.')) act(() => makeLinkCompetitionLink(competition.id), 'New link made. The old one no longer works.'); }}>New link</button>
                <button type="button" className={SECONDARY} onClick={async () => { if (await askConfirm('Turn the link off? Nobody will be able to open it until you make a new one.')) act(() => turnOffLinkCompetitionLink(competition.id), 'Link turned off.'); }}>Turn link off</button>
              </div>
            ) : competition.status === 'active' ? (
              <button type="button" className={PRIMARY} onClick={() => act(() => makeLinkCompetitionLink(competition.id), result => `Link made: ${competitionLink(result.token)}`)}>Make the link</button>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={SECONDARY} onClick={() => setEditing(toForm(competition))}>Edit</button>
              {competition.status !== 'active' ? <button type="button" className={SECONDARY} onClick={() => act(() => setLinkCompetitionStatus(competition.id, 'active'), 'Active. Make the link to share it.')}>Make active</button> : null}
              {competition.status === 'active' ? <button type="button" className={SECONDARY} onClick={() => act(() => setLinkCompetitionStatus(competition.id, 'closed'), 'Closed: the page still shows, but no new entries.')}>Close entries</button> : null}
              <button type="button" className={SECONDARY} onClick={() => setViewing(competition)}>Entries ({competition.entries})</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

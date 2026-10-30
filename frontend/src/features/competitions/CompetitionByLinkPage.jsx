import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getApiUrl } from '../../config/apiBase';

// The page someone opens from a competition link: fliers, details and the entry form.
// It is reached only through the link — no listing, and search engines are told not to index it.

const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const when = value => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

function Section({ title, text }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="text-sm font-black uppercase tracking-wide text-[#191970] dark:text-amber-200">{title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-200">{text}</p>
    </section>
  );
}

export default function CompetitionByLinkPage() {
  useNoIndex();
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');
  const [flier, setFlier] = useState(null);

  useEffect(() => {
    fetch(getApiUrl(`/api/public/link-competition/${encodeURIComponent(token || '')}`))
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'This link is not valid.');
        setData(body);
        document.title = `${body.competition.title} · ${body.competition.hostName}`;
      })
      .catch(err => setError(err.message));
  }, [token]);

  const submit = async event => {
    event.preventDefault();
    setSending(true); setFormError('');
    try {
      const response = await fetch(getApiUrl(`/api/public/link-competition/${encodeURIComponent(token)}/entries`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, website: trap }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your entry could not be sent. Check your connection and try again.');
      setDone(true);
    } catch (err) { setFormError(err.message); }
    finally { setSending(false); }
  };

  const shell = children => <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><div className="mx-auto max-w-3xl space-y-5">{children}</div></main>;
  if (error) return shell(<div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><h1 className="text-xl font-black">Competition not found</h1><p className="mt-2 text-slate-700 dark:text-slate-300">{error}</p></div>);
  if (!data) return shell(<p role="status" className="text-slate-700 dark:text-slate-300">Loading…</p>);
  const { competition, entriesOpen, closedReason } = data;

  return shell(
    <>
      <header className="rounded-2xl bg-[#191970] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">{competition.hostName}</p>
        <h1 className="mt-1 text-3xl font-black">{competition.title}</h1>
        {competition.summary ? <p className="mt-2 text-slate-100">{competition.summary}</p> : null}
        {(competition.startsAt || competition.entriesCloseAt) ? (
          <p className="mt-3 text-sm text-slate-100">
            {competition.startsAt ? `Starts ${when(competition.startsAt)}` : ''}{competition.endsAt ? ` · ends ${when(competition.endsAt)}` : ''}{competition.entriesCloseAt ? ` · entries close ${when(competition.entriesCloseAt)}` : ''}
          </p>
        ) : null}
      </header>

      {competition.fliers.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {competition.fliers.map(url => (
            <button key={url} type="button" onClick={() => setFlier(url)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <img src={url} alt={`${competition.title} flier`} loading="lazy" className="h-auto w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
      {flier ? (
        <div role="dialog" aria-label="Flier" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setFlier(null)}>
          <img src={flier} alt={`${competition.title} flier`} className="max-h-full max-w-full rounded-lg" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 font-bold text-slate-900" onClick={() => setFlier(null)}>Close</button>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <Section title="About" text={competition.details} />
        <Section title="Rules" text={competition.rules} />
        <Section title="Prizes" text={competition.prizes} />
        <Section title="Venue" text={competition.venue} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-black text-[#191970] dark:text-white">Enter</h2>
        {done ? (
          <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Your entry is in. {competition.hostName} will be in touch.</p>
        ) : !entriesOpen ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">{closedReason}</p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            {competition.fields.map(field => (
              <label key={field.key} className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                {field.label}{field.required ? ' *' : ''}
                {field.type === 'choice' ? (
                  <select required={field.required} className={FIELD} value={answers[field.key] || ''} onChange={event => setAnswers({ ...answers, [field.key]: event.target.value })}>
                    <option value="">Choose…</option>
                    {field.options.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === 'long' ? (
                  <textarea required={field.required} rows={4} maxLength={3000} className={FIELD} value={answers[field.key] || ''} onChange={event => setAnswers({ ...answers, [field.key]: event.target.value })} />
                ) : (
                  <input required={field.required} maxLength={300} type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'} className={FIELD} value={answers[field.key] || ''} onChange={event => setAnswers({ ...answers, [field.key]: event.target.value })} />
                )}
              </label>
            ))}
            {/* Left empty by people; robots fill it in. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={event => setTrap(event.target.value)} className="hidden" aria-hidden="true" />
            {formError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{formError}</p> : null}
            <button type="submit" disabled={sending} className="w-full rounded-lg bg-[#191970] px-4 py-3 text-base font-bold text-white disabled:opacity-60">{sending ? 'Sending…' : 'Send my entry'}</button>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-slate-600 dark:text-slate-400">Shared privately by {competition.hostName} · powered by Ndovera</p>
    </>
  );
}

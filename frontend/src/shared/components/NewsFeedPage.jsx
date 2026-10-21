import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNewsHeadlines } from '../../features/school/services/schoolApi';

// News: headlines only, from Nigerian outlets. A new edition arrives at midnight (Lagos);
// earlier days stay in the history. A headline opens the story on the outlet's own site.

const CARD = 'rounded-2xl border border-[#c9a96e]/40 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60';
const OUTLET_TONE = ['#800020', '#191970', '#1a5c38', '#8a4b00', '#4b3fb5', '#0e6b7a'];

function formatEdition(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function timeOf(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function NewsFeedPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [edition, setEdition] = useState('');
  const [outlet, setOutlet] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNewsHeadlines(edition)
      .then(result => { if (!cancelled) { setData(result); setError(''); } })
      .catch(loadError => { if (!cancelled) setError(loadError?.message || 'Could not load the news.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [edition]);

  const outlets = useMemo(() => data?.outlets || [], [data]);
  const shown = outlet === 'all' ? outlets : outlets.filter(item => item.key === outlet);
  const editions = data?.editions || [];
  const index = editions.findIndex(item => item.edition === data?.edition);

  return (
    <div className="min-h-screen bg-[#fdf7ec] p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800020] dark:text-[#e9b8c4]">Headlines · Nigeria</p>
            <h1 className="mt-1 text-2xl font-black text-[#800000] dark:text-white md:text-3xl">News</h1>
            <p className="mt-1 text-sm text-[#6b5836] dark:text-slate-300">
              {data?.edition ? formatEdition(data.edition) : 'Today'} · updated every night at midnight. Tap a headline to read it on the outlet's site.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-bold text-[#191970] dark:bg-slate-900 dark:text-slate-100">← Back</button>
            {editions.length > 0 ? (
              <>
                <button type="button" disabled={index < 0 || index >= editions.length - 1} onClick={() => setEdition(editions[index + 1].edition)} className="rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-bold text-[#191970] disabled:opacity-40 dark:bg-slate-900 dark:text-slate-100" aria-label="Previous day">‹ Earlier</button>
                <select aria-label="Choose a day" value={data?.edition || ''} onChange={event => setEdition(event.target.value)} className="rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970] dark:bg-slate-900 dark:text-slate-100">
                  {editions.map(item => <option key={item.edition} value={item.edition}>{formatEdition(item.edition)}</option>)}
                </select>
                <button type="button" disabled={index <= 0} onClick={() => setEdition(editions[index - 1].edition)} className="rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-bold text-[#191970] disabled:opacity-40 dark:bg-slate-900 dark:text-slate-100" aria-label="Next day">Later ›</button>
              </>
            ) : null}
          </div>
        </header>

        {outlets.length > 1 ? (
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Outlets">
            {[{ key: 'all', name: 'All outlets' }, ...outlets].map(item => (
              <button key={item.key} type="button" aria-pressed={outlet === item.key} onClick={() => setOutlet(item.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold ${outlet === item.key ? 'border-[#800020] bg-[#800020] text-white' : 'border-[#c9a96e]/50 bg-white text-[#191970] dark:bg-slate-900 dark:text-slate-100'}`}>
                {item.name}{item.headlines ? ` · ${item.headlines.length}` : ''}
              </button>
            ))}
          </nav>
        ) : null}

        {error ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        {loading && !data ? <p role="status" className="text-sm text-[#6b5836] dark:text-slate-300">Loading headlines…</p> : null}
        {!loading && !error && !outlets.length ? (
          <section className={CARD}>
            <p className="font-bold text-[#191970] dark:text-white">No headlines yet.</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The first edition arrives tonight at midnight.</p>
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((item, position) => {
            const tone = OUTLET_TONE[outlets.indexOf(item) % OUTLET_TONE.length] || OUTLET_TONE[position % OUTLET_TONE.length];
            return (
              <section key={item.key} className={`${CARD} overflow-hidden p-0`} aria-label={item.name}>
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-white" style={{ background: tone }}>
                  <h2 className="text-base font-black">{item.name}</h2>
                  <a href={item.site} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline-offset-2 hover:underline">Visit site ↗</a>
                </div>
                <ol className="divide-y divide-[#c9a96e]/25 dark:divide-white/10">
                  {item.headlines.map(headline => (
                    <li key={headline.link}>
                      <a href={headline.link} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 hover:bg-[#fdf2e4] dark:hover:bg-white/5">
                        <span className="block text-[15px] font-semibold leading-snug text-[#191970] dark:text-slate-100">{headline.title}</span>
                        {headline.publishedAt ? <span className="mt-0.5 block text-xs text-slate-500">{timeOf(headline.publishedAt)}</span> : null}
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Headlines and links belong to their outlets. Ndovera only lists them; the stories open on the outlets' own sites.</p>
      </div>
    </div>
  );
}

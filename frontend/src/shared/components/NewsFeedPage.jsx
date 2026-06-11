import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyFeed, getFeedHistory } from '../../features/school/services/schoolApi';

const CATEGORY_TONE = {
  Education: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/30',
  Healthcare: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30',
  Technology: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/30',
  Career: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30',
  General: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30',
};

const CARD = 'rounded-2xl border border-[#c9a96e]/40 bg-[#fff8f0] p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/40';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function NewsFeedPage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeDate, setActiveDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDailyFeed(activeDate)
      .then(data => { if (!cancelled) { setFeed(data); setError(''); if (!activeDate) setActiveDate(data?.date || ''); } })
      .catch(loadError => { if (!cancelled) setError(loadError?.message || 'Could not load the feed.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeDate]);

  useEffect(() => {
    let cancelled = false;
    getFeedHistory().then(data => { if (!cancelled) setHistory(Array.isArray(data?.items) ? data.items : []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const headlines = useMemo(() => (Array.isArray(feed?.headlines) ? feed.headlines : []), [feed]);

  return (
    <div className="min-h-screen bg-[#fdf7ec] p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">Daily Digest</p>
            <h1 className="mt-1 text-2xl font-black text-[#800000] dark:text-white md:text-3xl">News &amp; Did You Know</h1>
            <p className="mt-1 text-sm text-[#6b5836] dark:text-slate-300">Education • Healthcare • Technology • Career — refreshed every day.</p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 ? (
              <select
                value={activeDate}
                onChange={event => setActiveDate(event.target.value)}
                className="rounded-xl border border-[#c9a96e]/45 bg-white/85 px-3 py-2 text-sm text-[#191970] dark:border-white/15 dark:bg-black/20 dark:text-slate-100"
              >
                {history.map(item => (
                  <option key={item.date} value={item.date}>{formatDate(item.date)}</option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-[#800020]/30 bg-white/70 px-4 py-2 text-sm font-bold text-[#800020] dark:border-white/15 dark:bg-slate-900/40 dark:text-slate-100">
              Back
            </button>
          </div>
        </div>

        {error ? <div className={`${CARD} text-sm text-rose-600 dark:text-rose-300`}>{error}</div> : null}
        {loading ? <div className={`${CARD} text-sm text-[#191970] dark:text-slate-200`}>Loading today’s digest…</div> : null}

        {!loading && feed?.didYouKnow ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1a5c38] via-[#0e7a6b] to-[#191970] p-6 shadow-lg">
            <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/80">💡 Did You Know? • {formatDate(feed?.date)}</p>
            <p className="mt-3 text-lg font-semibold leading-8 text-white">{feed.didYouKnow}</p>
          </div>
        ) : null}

        {!loading && headlines.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {headlines.map((item, index) => (
              <article key={`${item.title}-${index}`} className={CARD}>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${CATEGORY_TONE[item.category] || CATEGORY_TONE.General}`}>
                  {item.category || 'General'}
                </span>
                <h2 className="mt-3 text-lg font-bold text-[#191970] dark:text-white">{item.title}</h2>
                {item.summary ? <p className="mt-2 text-sm leading-7 text-[#3a3a52] dark:text-slate-300">{item.summary}</p> : null}
                {item.tip ? (
                  <p className="mt-3 rounded-xl border border-[#1a5c38]/20 bg-[#1a5c38]/8 px-3 py-2 text-sm text-[#1a5c38] dark:border-[#00ffff]/20 dark:bg-[#00ffff]/10 dark:text-[#7df9ff]">
                    <span className="font-bold">Tip:</span> {item.tip}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !feed?.didYouKnow && headlines.length === 0 ? (
          <div className={`${CARD} text-sm text-[#6b5836] dark:text-slate-300`}>Today’s digest is being prepared. Please check back shortly.</div>
        ) : null}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyFeed } from '../../features/school/services/schoolApi';

// Captivating "Did you know?" strip shown on dashboards. Tapping it opens the daily news feed.
export default function DidYouKnowCard() {
  const navigate = useNavigate();
  const [fact, setFact] = useState('');

  useEffect(() => {
    let cancelled = false;
    getDailyFeed()
      .then(data => { if (!cancelled) setFact(String(data?.didYouKnow || '').trim()); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!fact) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/news')}
      className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a5c38] via-[#0e7a6b] to-[#191970] text-left shadow-[0_10px_30px_rgba(26,92,56,0.28)] transition hover:shadow-[0_14px_40px_rgba(26,92,56,0.4)] focus:outline-none focus:ring-2 focus:ring-white/40"
      aria-label="Open the daily news and did-you-know feed"
    >
      <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
      <span className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-[#00ffff]/20 blur-2xl" />
      <div className="relative flex items-center gap-3 px-4 py-3">
        <span className="text-2xl motion-safe:animate-pulse">💡</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">Did you know?</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">{fact}</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white transition group-hover:translate-x-0.5 group-hover:bg-white/30 sm:inline">
          Read news →
        </span>
      </div>
    </button>
  );
}

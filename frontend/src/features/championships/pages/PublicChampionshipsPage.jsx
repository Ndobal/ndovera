import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../public/pages/PublicSitePage';
import { listPublicChampionships } from '../services/championshipApi';
import { MODE_LABEL, SCOPE_LABEL, formatDate, naira } from '../championshipUi';

// Public championship discovery (championship.md §47). Filters are client-side over an already
// small published set, which keeps the page responsive and avoids a request per keystroke.

const MODES = [['', 'Any format'], ['online', 'Online'], ['physical', 'Physical'], ['hybrid', 'Hybrid']];
const COSTS = [['', 'Any cost'], ['free', 'Free'], ['paid', 'Paid']];

function ChampionshipTile({ championship }) {
  const fee = championship.registrationFee > 0 ? naira.format(championship.registrationFee) : 'Free entry';
  const artwork = championship.coverUrl || championship.flyerUrl || '';

  return (
    <Link
      to={`/championships/${championship.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] shadow-[0_18px_36px_rgba(128,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_42px_rgba(25,25,112,0.14)]"
    >
      {artwork ? (
        <img src={artwork} alt="" loading="lazy" className="h-40 w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="flex h-40 w-full items-center justify-center bg-[linear-gradient(135deg,rgba(128,0,32,0.14),rgba(25,25,112,0.10),rgba(26,92,56,0.14))] text-5xl">🏆</div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#191970] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {championship.category || 'Championship'}
          </span>
          {championship.status === 'completed' ? (
            <span className="rounded-full bg-[#c9a96e] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#191970]">Completed</span>
          ) : null}
        </div>

        <h3 className="mt-3 break-words text-xl font-bold leading-tight text-[#191970]">{championship.name}</h3>
        {championship.summary ? <p className="mt-2 break-words text-sm leading-6 text-[#31416f]">{championship.summary}</p> : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#31416f]">
          <div>
            <dt className="font-bold uppercase tracking-wide text-[#800020]">Date</dt>
            <dd>{formatDate(championship.competitionDate) || 'To be announced'}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-[#800020]">Format</dt>
            <dd>{MODE_LABEL[championship.mode] || 'Online'} · {SCOPE_LABEL[championship.scope] || ''}</dd>
          </div>
        </dl>

        <span className="mt-auto pt-4 text-sm font-semibold text-[#1a5c38]">{fee} →</span>
      </div>
    </Link>
  );
}

export default function PublicChampionshipsPage() {
  const [championships, setChampionships] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState({ category: '', mode: '', cost: '' });

  useEffect(() => {
    document.title = 'NDOVERA Championships | Compete. Excel. Be Recognised.';
    let cancelled = false;

    listPublicChampionships()
      .then(data => {
        if (cancelled) return;
        setChampionships(Array.isArray(data?.championships) ? data.championships : []);
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) { setChampionships([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => championships.filter(item => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.mode && item.mode !== filters.mode) return false;
    if (filters.cost === 'free' && item.registrationFee > 0) return false;
    if (filters.cost === 'paid' && item.registrationFee <= 0) return false;
    return true;
  }), [championships, filters]);

  const shellSection = {
    eyebrow: 'NDOVERA Championships',
    title: 'Compete. Excel. Be recognised.',
    description: 'Discover talent, reward excellence and create opportunities. NDOVERA championships are open to schools, students and independent participants.',
    metadata: { stats: [], cards: [], mediaUrls: [] },
  };

  const select = 'rounded-xl border border-[#c9a96e]/60 bg-white px-4 py-2.5 text-sm font-semibold text-[#191970] outline-none focus:border-[#191970]';

  return (
    <PublicShell section={shellSection} hideHero hideCta>
      <div className="space-y-8">
        <header className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#191970] p-6 text-white sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#e3c98b]">🏆 NDOVERA Championships</p>
          <h1 className="mt-3 font-serif text-3xl font-black tracking-tight text-white sm:text-4xl">Compete. Excel. Be recognised.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">
            Discover talent, reward excellence and create opportunities. Championships are open to NDOVERA
            school students, to parents registering a child, and to independent participants.
          </p>
        </header>

        {championships.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            <select className={select} value={filters.category} onChange={e => setFilters(c => ({ ...c, category: e.target.value }))}>
              <option value="">All categories</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className={select} value={filters.mode} onChange={e => setFilters(c => ({ ...c, mode: e.target.value }))}>
              {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className={select} value={filters.cost} onChange={e => setFilters(c => ({ ...c, cost: e.target.value }))}>
              {COSTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#31416f]">Loading championships…</p>
        ) : championships.length === 0 ? (
          <section className="rounded-[2rem] border-2 border-dashed border-[#c9a96e]/70 bg-[#fff8ef] px-6 py-16 text-center">
            <p className="text-5xl" aria-hidden="true">🏆</p>
            <h2 className="mt-4 font-serif text-2xl font-black text-[#191970]">No competition is created</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#31416f]">
              {failed
                ? 'Championships could not be loaded right now. Please try again shortly.'
                : 'NDOVERA has not opened a championship yet. When one is published it will appear here with its stages, eligibility and prizes.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/register-school" className="rounded-full bg-[#191970] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2447d8]">Register a school</Link>
              <Link to="/contact" className="rounded-full border border-[#191970]/30 px-6 py-3 text-sm font-bold text-[#191970] transition hover:border-[#2447d8]">Contact NDOVERA</Link>
            </div>
          </section>
        ) : visible.length === 0 ? (
          <p className="rounded-[1.5rem] border border-dashed border-[#c9a96e]/70 bg-[#fff8ef] px-5 py-8 text-center text-sm text-[#31416f]">
            No championship matches those filters.
          </p>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(championship => <ChampionshipTile key={championship.id} championship={championship} />)}
          </section>
        )}
      </div>
    </PublicShell>
  );
}

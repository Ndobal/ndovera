import React from 'react';

export const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 sm:p-6 dark:border-white/10 dark:bg-slate-900/40';
export const PANEL = 'rounded-2xl border border-[#c9a96e]/40 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-900/50';
export const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';
export const BODY = 'text-sm leading-6 text-[#191970] dark:text-slate-300';
export const MUTED = 'text-xs text-[#4a5578] dark:text-slate-400';
export const INPUT = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2.5 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38]/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100';
export const BTN_PRIMARY = 'rounded-xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-50';
export const BTN_SECONDARY = 'rounded-xl border border-[#191970]/25 bg-white/70 px-5 py-2.5 text-sm font-bold text-[#191970] transition hover:border-[#1a5c38] disabled:opacity-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100';

export const STATUS_TONE = {
  draft: 'bg-[#c9a96e] text-[#191970]',
  published: 'bg-[#1a5c38] text-white',
  live: 'bg-[#800020] text-[#b5e3f4]',
  completed: 'bg-[#191970] text-white',
  archived: 'bg-slate-400 text-white',
};

export const MODE_LABEL = { online: 'Online', physical: 'Physical', hybrid: 'Hybrid' };
export const SCOPE_LABEL = {
  inter_school: 'Inter-school',
  school_only: 'School only',
  regional: 'Regional',
  national: 'National',
  independent: 'Independent',
};

export function formatDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChampionshipPageHeader({ title, subtitle, children }) {
  return (
    <header className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={LABEL}>🏆 NDOVERA Championships</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#191970] dark:text-slate-100">{title}</h1>
          {subtitle ? <p className={`mt-2 max-w-2xl ${BODY}`}>{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * The state a school sees for most of the year: NDOVERA has not opened a competition yet.
 * It says so plainly rather than showing an empty grid that looks like a loading failure.
 */
export function NoCompetitionState({ title = 'No competition is created', detail, action }) {
  return (
    <section className="rounded-3xl border-2 border-dashed border-[#c9a96e]/70 bg-[#fff8ee] px-6 py-12 text-center dark:border-white/15 dark:bg-slate-900/30">
      <p className="text-5xl" aria-hidden="true">🏆</p>
      <h2 className="mt-4 text-xl font-black text-[#191970] dark:text-slate-100">{title}</h2>
      <p className={`mx-auto mt-2 max-w-md ${BODY}`}>
        {detail || 'There is no NDOVERA championship open at the moment. When one is published it will appear here, and everyone eligible will be notified.'}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}

export function ChampionshipBadge({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_TONE[status] || STATUS_TONE.draft}`}>
      {String(status || 'draft').replace(/_/g, ' ')}
    </span>
  );
}

export function EligibilityLine({ championship }) {
  const bits = [];
  if (championship.minAge !== null || championship.maxAge !== null) {
    const min = championship.minAge ?? '';
    const max = championship.maxAge ?? '';
    const range = min && max ? `${min}–${max}` : min ? `${min}+` : `up to ${max}`;
    bits.push(`Ages ${range}${championship.ageAsOf ? ` as of ${formatDate(championship.ageAsOf)}` : ''}`);
  }
  if (championship.classLevels?.length) bits.push(championship.classLevels.join(', '));
  if (championship.geoStates?.length) bits.push(championship.geoStates.join(', '));
  if (!bits.length) return <span className={MUTED}>Open to everyone</span>;
  return <span className={MUTED}>{bits.join(' • ')}</span>;
}

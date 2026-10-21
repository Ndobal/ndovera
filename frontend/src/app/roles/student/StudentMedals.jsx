import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStudentResult } from '../../../features/results-engine/service/resultEngineService';

// My Medals: every subject medal the student has earned on published results (top three in a
// subject, on the 3rd-term cumulative score where it applies), term by term, in a trophy cabinet.

const MEDALS = {
  1: { icon: '🥇', title: 'Gold', label: 'Best in', ring: 'from-amber-300 via-yellow-200 to-amber-500', glow: 'shadow-amber-400/40', text: 'text-amber-950' },
  2: { icon: '🥈', title: 'Silver', label: '2nd in', ring: 'from-slate-200 via-white to-slate-400', glow: 'shadow-slate-300/40', text: 'text-slate-900' },
  3: { icon: '🥉', title: 'Bronze', label: '3rd in', ring: 'from-orange-300 via-amber-200 to-orange-600', glow: 'shadow-orange-400/40', text: 'text-orange-950' },
};

function Medal({ badge, term }) {
  const medal = MEDALS[badge.place] || MEDALS[3];
  return (
    <li className={`relative flex flex-col items-center rounded-3xl bg-gradient-to-b ${medal.ring} p-[2px] shadow-xl ${medal.glow}`}>
      <div className="flex h-full w-full flex-col items-center rounded-[1.4rem] bg-slate-950/85 px-3 pb-4 pt-5 text-center">
        <div className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br ${medal.ring} text-5xl shadow-inner`} aria-hidden="true">{medal.icon}</div>
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">{medal.title}</p>
        <p className="mt-1 text-sm font-black leading-snug text-white">{medal.label} {badge.subjectName}</p>
        <p className="mt-1 text-[11px] text-white/60">{term}</p>
      </div>
    </li>
  );
}

export default function StudentMedals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getStudentResult().then(setData).catch(err => setError(err.message || 'Could not load your medals.'));
  }, []);

  const terms = useMemo(() => (data?.publications || [])
    .map(record => ({ id: record.id, label: record.label, badges: Array.isArray(record.summary?.subjectBadges) ? record.summary.subjectBadges : [] }))
    .filter(term => term.badges.length), [data]);
  const count = place => terms.reduce((sum, term) => sum + term.badges.filter(badge => badge.place === place).length, 0);

  return (
    <StudentSectionShell title="My Medals" subtitle="Every subject where you finished in the top three, term by term.">
      {error ? <section className="glass-surface rounded-3xl p-6 text-rose-300">{error}</section> : null}
      {!data && !error ? <section className="glass-surface rounded-3xl p-6"><p className="neon-subtle">Opening your trophy cabinet…</p></section> : null}
      {data ? (
        <div className="space-y-6">
          <section className="grid grid-cols-3 gap-3" aria-label="Medal count">
            {[1, 2, 3].map(place => (
              <div key={place} className={`rounded-3xl bg-gradient-to-br ${MEDALS[place].ring} p-[2px]`}>
                <div className="rounded-[1.4rem] bg-slate-950/80 p-4 text-center">
                  <p className="text-4xl" aria-hidden="true">{MEDALS[place].icon}</p>
                  <p className="mt-1 text-3xl font-black text-white">{count(place)}</p>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">{MEDALS[place].title}</p>
                </div>
              </div>
            ))}
          </section>

          {data.lockedByFees ? <section className="glass-surface rounded-3xl p-6 text-sm text-slate-200">Your results are locked for now, so your medals are hidden. Ask your parent to check with the school.</section> : null}

          {!terms.length && !data.lockedByFees ? (
            <section className="glass-surface rounded-3xl p-8 text-center">
              <p className="text-5xl" aria-hidden="true">🏆</p>
              <p className="mt-3 text-lg font-black text-white">Your cabinet is waiting</p>
              <p className="mt-1 text-sm text-slate-300">Finish in the top three of any subject this term and your medal lands here.</p>
            </section>
          ) : null}

          {terms.map(term => (
            <section key={term.id} className="glass-surface rounded-3xl p-5" aria-label={term.label}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg command-title neon-title">{term.label}</h2>
                <span className="glass-chip rounded-full px-3 py-1 micro-label accent-amber">{term.badges.length} medal{term.badges.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {term.badges.map(badge => <Medal key={`${term.id}-${badge.subjectName}`} badge={badge} term={term.label} />)}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </StudentSectionShell>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicShell } from '../../public/pages/PublicSitePage';
import { getPublicChampionship } from '../services/championshipApi';
import { MODE_LABEL, SCOPE_LABEL, formatDate, naira } from '../championshipUi';

// The public page for one championship (championship.md §45): what it is, who can enter, the
// stage sequence, prizes, schedule and how to register.

const STAGE_ICON = {
  registration: '📝', screening: '🔍', qualifier: '🎯', preliminary: '📚', round: '🔁',
  quarter_final: '🥉', semi_final: '🥈', final: '🥇', physical_round: '📍', interview: '🎤',
  presentation: '📊', judging: '⚖️', winner_selection: '🏆', awards: '🎖',
};

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 sm:p-7">
      <h2 className="font-serif text-2xl font-black text-[#191970]">{title}</h2>
      <div className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[#31416f]">{children}</div>
    </section>
  );
}

export default function PublicChampionshipDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getPublicChampionship(slug)
      .then(result => { if (!cancelled) { setData(result); setError(''); } })
      .catch(loadError => { if (!cancelled) setError(loadError.message || 'Championship not found.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  const championship = data?.championship;

  useEffect(() => {
    document.title = championship?.name ? `NDOVERA | ${championship.name}` : 'NDOVERA Championships';
  }, [championship?.name]);

  const shellSection = {
    eyebrow: 'NDOVERA Championships',
    title: championship?.name || 'Championship',
    description: championship?.summary || '',
    metadata: { stats: [], cards: [], mediaUrls: [] },
  };

  if (loading) {
    return (
      <PublicShell section={shellSection} hideHero hideCta>
        <p className="text-sm text-[#31416f]">Loading championship…</p>
      </PublicShell>
    );
  }

  if (error || !championship) {
    return (
      <PublicShell section={shellSection} hideHero hideCta>
        <section className="rounded-[2rem] border-2 border-dashed border-[#c9a96e]/70 bg-[#fff8ef] px-6 py-16 text-center">
          <p className="text-5xl" aria-hidden="true">🏆</p>
          <h1 className="mt-4 font-serif text-2xl font-black text-[#191970]">Championship not found</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#31416f]">
            This championship may not be published yet, or the link may be out of date.
          </p>
          <Link to="/championships" className="mt-6 inline-block rounded-full bg-[#191970] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#2447d8]">
            See all championships
          </Link>
        </section>
      </PublicShell>
    );
  }

  const stages = Array.isArray(data?.stages) ? data.stages : [];
  const fee = championship.registrationFee > 0 ? naira.format(championship.registrationFee) : 'Free entry';
  const artwork = championship.coverUrl || championship.flyerUrl || '';
  const isOpen = championship.status === 'published' || championship.status === 'live';

  const facts = [
    ['Category', championship.category],
    ['Format', MODE_LABEL[championship.mode]],
    ['Scope', SCOPE_LABEL[championship.scope]],
    ['Competition date', formatDate(championship.competitionDate)],
    ['Registration opens', formatDate(championship.registrationOpensAt)],
    ['Registration closes', formatDate(championship.registrationClosesAt)],
    ['Entry', fee],
    ['Registered so far', String(data?.registeredCount ?? 0)],
  ].filter(([, value]) => value);

  const eligibility = [
    championship.minAge !== null || championship.maxAge !== null
      ? `Ages ${championship.minAge ?? '—'} to ${championship.maxAge ?? '—'}${championship.ageAsOf ? ` as of ${formatDate(championship.ageAsOf)}` : ''}`
      : '',
    championship.classLevels?.length ? `Classes: ${championship.classLevels.join(', ')}` : '',
    championship.geoStates?.length ? `States: ${championship.geoStates.join(', ')}` : '',
    championship.allowSchoolStudents ? 'Open to NDOVERA school students' : '',
    championship.allowIndependent ? 'Open to independent participants' : '',
  ].filter(Boolean);

  return (
    <PublicShell section={shellSection} hideHero hideCta>
      <article className="space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-[#c9a96e]/45 bg-[#191970] text-white">
          {artwork ? <img src={artwork} alt="" loading="lazy" className="h-56 w-full object-cover sm:h-72" /> : null}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#e3c98b] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#191970]">
                {championship.category || 'Championship'}
              </span>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${isOpen ? 'bg-[#1a5c38] text-white' : 'bg-white/20 text-white'}`}>
                {championship.status === 'live' ? 'Live' : championship.status === 'completed' ? 'Completed' : 'Registration open'}
              </span>
            </div>
            <h1 className="mt-4 font-serif text-3xl font-black tracking-tight text-white sm:text-4xl">{championship.name}</h1>
            {championship.summary ? <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">{championship.summary}</p> : null}
            {championship.sponsorName ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#e3c98b]">Powered by {championship.sponsorName}</p> : null}

            {isOpen ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login" className="rounded-full bg-[#e3c98b] px-6 py-3 text-sm font-bold text-[#191970] transition hover:bg-white">
                  Sign in to enter
                </Link>
                <Link to="/register-school" className="rounded-full border border-white/35 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  Register a school
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-[1.4rem] border border-[#c9a96e]/45 bg-[#b5e3f4]/45 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#800020]">{label}</p>
              <p className="mt-1 break-words text-sm font-bold text-[#191970]">{value}</p>
            </div>
          ))}
        </section>

        {stages.length > 0 ? (
          <section className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-white p-6 sm:p-7">
            <h2 className="font-serif text-2xl font-black text-[#191970]">Stages</h2>
            <ol className="mt-4 space-y-3">
              {stages.map((stage, index) => (
                <li key={stage.id} className="flex gap-3 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ef] p-4">
                  <span aria-hidden="true" className="text-2xl">{STAGE_ICON[stage.kind] || '🔁'}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-[#191970]">
                      <span className="text-[#800020]">{index + 1}.</span> {stage.name}
                    </p>
                    {stage.startsAt || stage.endsAt ? (
                      <p className="mt-0.5 text-xs text-[#4a5578]">
                        {[formatDate(stage.startsAt), formatDate(stage.endsAt)].filter(Boolean).join(' → ')}
                      </p>
                    ) : null}
                    {stage.instructions ? <p className="mt-1 break-words text-sm leading-6 text-[#31416f]">{stage.instructions}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {eligibility.length > 0 ? (
          <section className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 sm:p-7">
            <h2 className="font-serif text-2xl font-black text-[#191970]">Who can enter</h2>
            <ul className="mt-3 space-y-2">
              {eligibility.map(item => (
                <li key={item} className="flex gap-3 text-sm leading-7 text-[#31416f]">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#800020]" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
            {championship.minAge !== null || championship.maxAge !== null ? (
              <p className="mt-4 rounded-xl border border-[#800020]/30 bg-white px-4 py-3 text-xs leading-6 text-[#800020]">
                This championship checks age, so a participant needs a date of birth on their NDOVERA profile before they can enter.
              </p>
            ) : null}
          </section>
        ) : null}

        <Section title="About">{championship.description}</Section>
        <Section title="Rules">{championship.rules}</Section>
        <Section title="Prizes">{championship.prizeStructure}</Section>
        <Section title="Scholarships">{championship.scholarshipNote}</Section>
        <Section title="Terms and conditions">{championship.terms}</Section>

        {championship.contactEmail || championship.contactPhone ? (
          <section className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#b5e3f4] p-6 sm:p-7">
            <h2 className="font-serif text-2xl font-black text-[#191970]">Questions about this championship</h2>
            <p className="mt-2 text-sm leading-7 text-[#31416f]">
              {championship.contactEmail ? <a className="font-bold underline" href={`mailto:${championship.contactEmail}`}>{championship.contactEmail}</a> : null}
              {championship.contactEmail && championship.contactPhone ? ' · ' : ''}
              {championship.contactPhone}
            </p>
          </section>
        ) : null}

        <Link to="/championships" className="inline-block text-sm font-bold text-[#191970] underline">← All championships</Link>
      </article>
    </PublicShell>
  );
}

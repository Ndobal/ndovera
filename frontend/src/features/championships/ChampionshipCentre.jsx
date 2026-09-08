import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getChampionshipEligibility,
  getMyChampionships,
  listPublicChampionships,
  registerForChampionship,
} from './services/championshipApi';
import SchoolChampionshipCentre from './SchoolChampionshipCentre';
import ParentChampionshipCentre from './ParentChampionshipCentre';
import ChampionshipEntryWorkspace from './ChampionshipEntryWorkspace';
import {
  BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, LABEL, MUTED, PANEL,
  ChampionshipBadge, ChampionshipPageHeader, EligibilityLine, MODE_LABEL, SCOPE_LABEL,
  NoCompetitionState, formatDate, naira,
} from './championshipUi';

// The in-app Championship Centre. Three audiences reach the same engine from different angles
// (championship.md sections 36–38), so this picks the right one by role rather than trying to
// serve all of them from a single screen:
//
//   staff  → School Championship Centre  (enter students, track the school's entries)
//   parent → Parent Championship Centre  (enter my children)
//   student→ the participant view below  (my championships, grouped by what is happening)
//
// Nothing here assumes a competition exists — that is the normal state for most of the year.

const PARTICIPANT_ROLES = new Set(['student', 'parent']);

const SCHOOL_STAFF_ROLES = new Set([
  'owner', 'hos', 'ict', 'ict_manager', 'principal', 'viceprincipal', 'examofficer',
  'headteacher', 'nurseryhead', 'teacher', 'classteacher', 'hod', 'admin',
]);

const GROUP_LABEL = { active: 'Happening now', upcoming: 'Coming up', completed: 'Completed' };
const GROUP_ORDER = ['active', 'upcoming', 'completed'];

function ChampionshipCard({ championship, entry, canEnter, onEnter, busy }) {
  const fee = championship.registrationFee > 0 ? naira.format(championship.registrationFee) : 'Free';

  return (
    <article className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[#191970] dark:text-slate-100">{championship.name}</h3>
            <ChampionshipBadge status={championship.status} />
          </div>
          <p className={`mt-1 ${MUTED}`}>
            {[championship.category, MODE_LABEL[championship.mode], SCOPE_LABEL[championship.scope]].filter(Boolean).join(' • ')}
          </p>
        </div>
        <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-white">{fee}</span>
      </div>

      {championship.summary ? <p className={`mt-3 ${BODY}`}>{championship.summary}</p> : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>Competition date</dt>
          <dd className={BODY}>{formatDate(championship.competitionDate) || 'To be announced'}</dd>
        </div>
        <div>
          <dt className={LABEL}>Registration closes</dt>
          <dd className={BODY}>{formatDate(championship.registrationClosesAt) || 'Open'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={LABEL}>Eligibility</dt>
          <dd className="mt-0.5"><EligibilityLine championship={championship} /></dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a href={`/championships/${championship.slug}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
          View details
        </a>
        {entry ? (
          <span className="rounded-xl bg-[#1a5c38]/15 px-4 py-2.5 text-sm font-bold text-[#1a5c38] dark:text-emerald-300">
            Entered — {entry.registrationCode}
          </span>
        ) : canEnter ? (
          <button type="button" onClick={() => onEnter(championship)} disabled={busy === championship.slug} className={BTN_PRIMARY}>
            {busy === championship.slug ? 'Checking…' : 'Enter championship'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function ChampionshipCentre() {
  const params = useParams();
  const roleKey = String(params.role || '').toLowerCase();

  if (roleKey === 'parent') return <ParentChampionshipCentre />;
  if (SCHOOL_STAFF_ROLES.has(roleKey)) return <SchoolChampionshipCentre />;
  return <ParticipantChampionshipCentre roleKey={roleKey} />;
}

function ParticipantChampionshipCentre({ roleKey }) {
  const canEnter = PARTICIPANT_ROLES.has(roleKey);

  const [championships, setChampionships] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [openWorkspace, setOpenWorkspace] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPublicChampionships();
      setChampionships(Array.isArray(data?.championships) ? data.championships : []);
      setError('');
    } catch (loadError) {
      setChampionships([]);
      setError(loadError.message || 'Could not load championships right now.');
    } finally {
      setLoading(false);
    }

    // A failure here must not hide the championship list, so it is loaded separately.
    try {
      const mine = await getMyChampionships();
      setEntries(Array.isArray(mine?.entries) ? mine.entries : []);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function enter(championship) {
    setBusy(championship.slug);
    setNotice('');
    setError('');
    try {
      const check = await getChampionshipEligibility(championship.slug);
      if (!check?.eligibility?.eligible) {
        const reasons = check?.eligibility?.reasons || [];
        setError(
          check?.eligibility?.needsDateOfBirth
            ? 'A date of birth is needed before entering an age-restricted championship. Add it in Settings, then try again.'
            : reasons[0] || 'You are not eligible for this championship.',
        );
        return;
      }

      const result = await registerForChampionship(championship.slug);
      setNotice(
        result?.alreadyRegistered
          ? 'You are already entered for this championship.'
          : result?.registration?.status === 'pending_payment'
            ? `Entry started. Registration ${result.registration.registrationCode} is held until the fee is paid.`
            : `Entered. Your registration code is ${result?.registration?.registrationCode || ''}.`,
      );
      await load();
    } catch (enterError) {
      setError(enterError.message || 'Could not enter that championship.');
    } finally {
      setBusy('');
    }
  }

  const entryBySlug = Object.fromEntries(
    entries.map(item => [item.championship?.slug, item.registration]).filter(([slug]) => slug),
  );

  const open = championships.filter(item => item.status === 'published' || item.status === 'live');
  const completed = championships.filter(item => item.status === 'completed');

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <ChampionshipPageHeader
        title="Championships"
        subtitle="NDOVERA competitions open to your school. Compete, earn recognition, and build an achievement record that stays with you."
      >
        <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
      </ChampionshipPageHeader>

      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      {loading ? (
        <p className={`${MUTED} px-1`}>Loading championships…</p>
      ) : open.length === 0 && completed.length === 0 ? (
        <NoCompetitionState />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="px-1 text-lg font-black text-[#191970] dark:text-slate-100">Open now</h2>
            {open.length === 0 ? (
              <NoCompetitionState
                title="No competition is created"
                detail="Nothing is open for entry at the moment. Completed championships are listed below."
              />
            ) : (
              open.map(championship => (
                <ChampionshipCard
                  key={championship.id}
                  championship={championship}
                  entry={entryBySlug[championship.slug]}
                  canEnter={canEnter}
                  onEnter={enter}
                  busy={busy}
                />
              ))
            )}
          </section>

          {completed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="px-1 text-lg font-black text-[#191970] dark:text-slate-100">Completed</h2>
              {completed.map(championship => (
                <ChampionshipCard key={championship.id} championship={championship} entry={entryBySlug[championship.slug]} canEnter={false} onEnter={enter} busy={busy} />
              ))}
            </section>
          ) : null}
        </>
      )}

      {entries.length > 0 ? (
        <section className={CARD}>
          <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">My championships</h2>

          {GROUP_ORDER.map((group) => {
            const groupEntries = entries.filter(entry => (entry.group || 'upcoming') === group);
            if (groupEntries.length === 0) return null;

            return (
              <div key={group} className="mt-4">
                <p className={LABEL}>{GROUP_LABEL[group]}</p>
                <div className="mt-2 space-y-2">
                  {groupEntries.map(({ registration, championship, currentStage, stages }) => (
                    <div key={registration.id} className="rounded-xl border border-[#c9a96e]/40 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-[#191970] dark:text-slate-100">{championship.name}</p>
                          <p className={MUTED}>Code {registration.registrationCode} • entered {formatDate(registration.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${registration.status === 'confirmed' ? 'bg-[#1a5c38] text-white' : 'bg-[#c9a96e] text-[#191970]'}`}>
                          {registration.status === 'pending_payment' ? 'Payment pending' : registration.status}
                        </span>
                      </div>

                      {currentStage ? (
                        <p className={`mt-2 ${MUTED}`}>
                          <span className="font-bold text-[#800020] dark:text-rose-300">Current stage:</span>{' '}
                          {currentStage.name}
                          {currentStage.startsAt ? ` — from ${formatDate(currentStage.startsAt)}` : ''}
                        </p>
                      ) : null}

                      {/* Written entries are only collected while the competition is running and
                          the entry is paid up, so the workspace stays hidden otherwise. */}
                      {group === 'active' && registration.status === 'confirmed' ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setOpenWorkspace(openWorkspace === registration.id ? '' : registration.id)}
                            className={BTN_SECONDARY}
                          >
                            {openWorkspace === registration.id ? 'Close entry workspace' : 'Open entry workspace'}
                          </button>
                          {openWorkspace === registration.id ? (
                            <div className="mt-3">
                              <ChampionshipEntryWorkspace championship={championship} stages={stages || []} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

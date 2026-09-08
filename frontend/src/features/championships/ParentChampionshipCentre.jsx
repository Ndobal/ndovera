import React, { useCallback, useEffect, useState } from 'react';
import { getParentChampionships, registerChildForChampionship } from './services/championshipApi';
import {
  BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, LABEL, MUTED, PANEL,
  ChampionshipBadge, ChampionshipPageHeader, EligibilityLine, MODE_LABEL, SCOPE_LABEL,
  NoCompetitionState, formatDate, naira,
} from './championshipUi';

// Parent Championship Centre (championship.md section 37).
//
// A parent thinks in terms of their children, not competitions, so each championship lists the
// children by name with a clear verdict for each: enter, already entered, or why not. The
// commonest blocker is a missing date of birth, which is a profile fix rather than a rejection,
// so it is worded that way.

function ChildRow({ child, championshipSlug, onRegister, busyKey }) {
  const key = `${championshipSlug}:${child.id}`;
  const busy = busyKey === key;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#c9a96e]/40 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-[#191970] dark:text-slate-100">{child.name}</span>
        <span className={`block ${MUTED}`}>{child.className || 'No class set'}</span>
      </span>

      {child.registration ? (
        <span className="rounded-full bg-[#1a5c38]/15 px-3 py-1 text-xs font-bold text-[#1a5c38] dark:text-emerald-300">
          Entered — {child.registration.registrationCode}
        </span>
      ) : child.eligible ? (
        <button type="button" className={BTN_PRIMARY} onClick={() => onRegister(championshipSlug, child)} disabled={busy}>
          {busy ? 'Entering…' : 'Enter'}
        </button>
      ) : (
        <span className="rounded-full bg-[#800020]/10 px-3 py-1 text-xs font-bold text-[#800020] dark:text-rose-300">
          {child.needsDateOfBirth ? 'Add date of birth first' : (child.reasons?.[0] || 'Not eligible')}
        </span>
      )}
    </div>
  );
}

export default function ParentChampionshipCentre() {
  const [entries, setEntries] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getParentChampionships();
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setChildren(Array.isArray(data?.children) ? data.children : []);
      setError('');
    } catch (loadError) {
      setEntries([]);
      setChildren([]);
      setError(loadError.message || 'Could not load championships right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function register(slug, child) {
    setBusyKey(`${slug}:${child.id}`);
    setNotice('');
    setError('');
    try {
      const result = await registerChildForChampionship(slug, { childId: child.id });
      setNotice(
        result?.alreadyRegistered
          ? `${child.name} is already entered.`
          : result?.registration?.status === 'pending_payment'
            ? `Entry started for ${child.name}. Registration ${result.registration.registrationCode} is held until the fee is paid.`
            : `${child.name} is entered. Registration code ${result?.registration?.registrationCode || ''}.`,
      );
      await load();
    } catch (registerError) {
      setError(registerError.message || 'Could not enter your child for that championship.');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <ChampionshipPageHeader
        title="Championships"
        subtitle="NDOVERA competitions your children can enter. Track their entries, progress and results in one place."
      >
        <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
      </ChampionshipPageHeader>

      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      {loading ? (
        <p className={`${MUTED} px-1`}>Loading championships…</p>
      ) : children.length === 0 ? (
        <NoCompetitionState
          title="No children linked yet"
          detail="Your account is not linked to any student yet. Ask the school to link your child to your account, then championships they can enter will appear here."
        />
      ) : entries.length === 0 ? (
        <NoCompetitionState detail="There is no NDOVERA championship open at the moment. When one is published, the children who can enter will be listed here." />
      ) : (
        <div className="space-y-4">
          {entries.map(({ championship, children: eligibleChildren }) => {
            const fee = championship.registrationFee > 0 ? naira.format(championship.registrationFee) : 'Free';

            return (
              <section key={championship.id} className={CARD}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">{championship.name}</h2>
                      <ChampionshipBadge status={championship.status} />
                    </div>
                    <p className={`mt-1 ${MUTED}`}>
                      {[championship.category, MODE_LABEL[championship.mode], SCOPE_LABEL[championship.scope]].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-white">{fee}</span>
                </div>

                {championship.summary ? <p className={`mt-3 ${BODY}`}>{championship.summary}</p> : null}

                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className={LABEL}>Competition date</dt>
                    <dd className={BODY}>{formatDate(championship.competitionDate) || 'To be announced'}</dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Registration closes</dt>
                    <dd className={BODY}>{formatDate(championship.registrationClosesAt) || 'Open'}</dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Eligibility</dt>
                    <dd className="mt-0.5"><EligibilityLine championship={championship} /></dd>
                  </div>
                </dl>

                <div className={`mt-4 ${PANEL}`}>
                  <p className={LABEL}>My children</p>
                  <div className="mt-3 space-y-2">
                    {eligibleChildren.map(child => (
                      <ChildRow
                        key={child.id}
                        child={child}
                        championshipSlug={championship.slug}
                        onRegister={register}
                        busyKey={busyKey}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <a href={`/championships/${championship.slug}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                    View details
                  </a>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

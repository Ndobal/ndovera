import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSchoolChampionships,
  getSchoolChampionshipRoster,
  nominateSchoolStudents,
} from './services/championshipApi';
import SchoolQuestionPool from './SchoolQuestionPool';
import {
  BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, LABEL, MUTED, PANEL,
  ChampionshipBadge, ChampionshipPageHeader, EligibilityLine, MODE_LABEL, SCOPE_LABEL,
  NoCompetitionState, formatDate, naira,
} from './championshipUi';

// School Championship Centre (championship.md section 36).
//
// A school administrator's job here is to get the right students entered. So the screen is
// built around the roster: every active student, whether they are eligible, and whether they
// are already in. Eligibility is decided by the server — this only displays the verdict, so a
// student who is not eligible cannot be nominated by ticking a box.

function StatTile({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-[#191970] dark:text-slate-100',
    good: 'text-[#1a5c38] dark:text-emerald-300',
    warn: 'text-[#800020] dark:text-rose-300',
  };
  return (
    <div className="rounded-xl border border-[#c9a96e]/40 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
      <p className={LABEL}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${tones[tone] || tones.default}`}>{value}</p>
    </div>
  );
}

function RosterRow({ student, checked, onToggle }) {
  const blocked = !student.eligible || Boolean(student.registration);
  const reason = student.registration
    ? `Entered — ${student.registration.registrationCode}`
    : student.needsDateOfBirth
      ? 'Date of birth missing on profile'
      : (student.reasons?.[0] || '');

  return (
    <label
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition ${
        blocked
          ? 'border-[#c9a96e]/30 bg-white/40 dark:border-white/5 dark:bg-slate-900/30'
          : 'cursor-pointer border-[#c9a96e]/40 bg-white/75 hover:border-[#1a5c38] dark:border-white/10 dark:bg-slate-900/50'
      }`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[#800020]"
        checked={checked}
        disabled={blocked}
        onChange={() => onToggle(student.id)}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-[#191970] dark:text-slate-100">{student.name}</span>
        <span className={`block ${MUTED}`}>
          {[student.displayId, student.className].filter(Boolean).join(' • ') || 'No class set'}
        </span>
      </span>
      {reason ? (
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            student.registration
              ? 'bg-[#1a5c38]/15 text-[#1a5c38] dark:text-emerald-300'
              : 'bg-[#800020]/10 text-[#800020] dark:text-rose-300'
          }`}
        >
          {reason}
        </span>
      ) : (
        <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-white">Eligible</span>
      )}
    </label>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? 'bg-[#800020] text-[#b5e3f4]'
          : 'border border-[#191970]/25 bg-white/70 text-[#191970] hover:border-[#1a5c38] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

export default function SchoolChampionshipCentre() {
  const [tab, setTab] = useState('competitions');
  const [rows, setRows] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [openSlug, setOpenSlug] = useState('');
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSchoolChampionships();
      setRows(Array.isArray(data?.championships) ? data.championships : []);
      setSchoolName(String(data?.schoolName || ''));
      setError('');
    } catch (loadError) {
      setRows([]);
      setError(loadError.message || 'Could not load championships right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRoster = useCallback(async (slug) => {
    if (openSlug === slug) { setOpenSlug(''); setRoster(null); return; }
    setOpenSlug(slug);
    setRoster(null);
    setSelected(new Set());
    setRosterLoading(true);
    setNotice('');
    setError('');
    try {
      setRoster(await getSchoolChampionshipRoster(slug));
    } catch (rosterError) {
      setError(rosterError.message || 'Could not load the student roster.');
      setOpenSlug('');
    } finally {
      setRosterLoading(false);
    }
  }, [openSlug]);

  const selectableIds = useMemo(
    () => (roster?.students || []).filter(student => student.eligible && !student.registration).map(student => student.id),
    [roster],
  );

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const result = await nominateSchoolStudents(openSlug, Array.from(selected));
      const entered = result?.registered?.length || 0;
      const skipped = result?.skipped?.length || 0;
      setNotice(
        `${entered} student${entered === 1 ? '' : 's'} entered${skipped ? `. ${skipped} could not be entered — see the roster for why.` : '.'}`,
      );
      setSelected(new Set());
      setRoster(await getSchoolChampionshipRoster(openSlug));
      await load();
    } catch (submitError) {
      setError(submitError.message || 'Could not enter those students.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <ChampionshipPageHeader
        title="Championship Centre"
        subtitle={
          schoolName
            ? `Competitions open to ${schoolName}. Enter your students, track their entries, and follow results.`
            : 'Competitions open to your school. Enter your students, track their entries, and follow results.'
        }
      >
        <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
      </ChampionshipPageHeader>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'competitions'} onClick={() => setTab('competitions')}>Competitions</TabButton>
        <TabButton active={tab === 'questions'} onClick={() => setTab('questions')}>Question bank</TabButton>
      </div>

      {tab === 'questions' ? <SchoolQuestionPool /> : (
        <>
      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      {loading ? (
        <p className={`${MUTED} px-1`}>Loading championships…</p>
      ) : rows.length === 0 ? (
        <NoCompetitionState detail="No NDOVERA championship is open to your school at the moment. When one is published it will appear here." />
      ) : (
        <div className="space-y-4">
          {rows.map(({ championship, entries }) => {
            const isOpen = openSlug === championship.slug;
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

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatTile label="Students entered" value={entries.total} tone="good" />
                  <StatTile label="Confirmed" value={entries.confirmed} />
                  <StatTile label="Awaiting payment" value={entries.pendingPayment} tone={entries.pendingPayment ? 'warn' : 'default'} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => openRoster(championship.slug)} className={BTN_PRIMARY}>
                    {isOpen ? 'Hide students' : 'Enter students'}
                  </button>
                  <a href={`/championships/${championship.slug}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                    View details
                  </a>
                </div>

                {isOpen ? (
                  <div className={`mt-4 ${PANEL}`}>
                    {rosterLoading ? (
                      <p className={MUTED}>Loading students…</p>
                    ) : !roster ? null : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-black text-[#191970] dark:text-slate-100">
                              {roster.summary.eligible} of {roster.summary.total} can be entered
                            </p>
                            <p className={MUTED}>
                              {roster.summary.registered} already entered
                              {roster.summary.needsDateOfBirth ? ` • ${roster.summary.needsDateOfBirth} missing a date of birth` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={BTN_SECONDARY}
                              onClick={() => setSelected(new Set(selected.size === selectableIds.length ? [] : selectableIds))}
                              disabled={selectableIds.length === 0}
                            >
                              {selected.size === selectableIds.length && selectableIds.length > 0 ? 'Clear all' : 'Select all eligible'}
                            </button>
                            <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={submitting || selected.size === 0}>
                              {submitting ? 'Entering…' : `Enter ${selected.size || ''} student${selected.size === 1 ? '' : 's'}`.trim()}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {roster.students.length === 0 ? (
                            <p className={MUTED}>This school has no active students yet.</p>
                          ) : (
                            roster.students.map(student => (
                              <RosterRow key={student.id} student={student} checked={selected.has(student.id)} onToggle={toggle} />
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}

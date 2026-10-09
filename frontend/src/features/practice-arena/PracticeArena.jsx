import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MODES, TYPE_LABELS, buildQuiz, estimateXp, levelForXp, newAttemptId } from './engine';
import { loadHome, loadPack, packSavedAt, pendingAttempts, saveAttempt } from './practiceApi';
import { subscribe } from '../../shared/offline/outbox';
import { isOnline, requestPersistentStorage } from '../../shared/offline/offlineStore';
import QuizPlayer from './QuizPlayer';
import QuizResults from './QuizResults';

// Practice Arena: quizzes from the question bank (questions from the student's
// teachers across their classes so far, and Ndovera's bank), no AI involved.
// Works offline once a subject's questions are on the device.

const CARD_GRADIENTS = [
  'from-indigo-500 to-violet-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600', 'from-fuchsia-500 to-purple-600', 'from-lime-500 to-green-600', 'from-cyan-500 to-sky-600',
];

function GoalRing({ value, goal }) {
  const percent = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-16 w-16" role="meter" aria-label="Daily goal" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
        <motion.circle cx="32" cy="32" r={radius} fill="none" stroke="#fde047" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - percent / 100) }} transition={{ duration: 1 }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-black text-white">{percent >= 100 ? '✓' : `${percent}%`}</span>
    </div>
  );
}

function Hero({ profile, student, offline, waiting }) {
  const level = levelForXp(profile?.xp || 0);
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-5 text-white shadow-2xl md:p-7">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/15 text-center ring-2 ring-white/30">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Level</p><p className="text-3xl font-black leading-none">{profile?.level || 1}</p></div>
        </div>
        <div className="min-w-[12rem] flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{student?.className || 'Practice Arena'}{student?.level ? ` · practising up to ${student.level}` : ''}</p>
          <h2 className="text-2xl font-black md:text-3xl">{profile?.title || 'Rookie'} · {(profile?.xp || 0).toLocaleString()} XP</h2>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Progress to next level" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" initial={{ width: 0 }} animate={{ width: `${level.progress}%` }} transition={{ duration: 1 }} />
          </div>
          <p className="mt-1 text-xs text-white/75">{Math.max(0, level.next - (profile?.xp || 0))} XP to level {level.level + 1}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <motion.p animate={profile?.streak ? { scale: [1, 1.15, 1] } : {}} transition={{ repeat: Infinity, duration: 1.8 }} className="text-3xl" aria-hidden="true">{profile?.streak ? '🔥' : '🌱'}</motion.p>
            <p className="text-sm font-black">{profile?.streak || 0}-day streak</p>
          </div>
          <div className="text-center">
            <GoalRing value={profile?.todayXp || 0} goal={profile?.dailyGoal || 50} />
            <p className="mt-1 text-xs font-bold">{profile?.todayXp || 0}/{profile?.dailyGoal || 50} XP today</p>
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/15 px-3 py-1">🎯 {profile?.accuracy || 0}% accuracy</span>
        <span className="rounded-full bg-white/15 px-3 py-1">✅ {profile?.correct || 0} answered right</span>
        <span className="rounded-full bg-white/15 px-3 py-1">🏅 {(profile?.badges || []).filter(badge => badge.earned).length} badges</span>
        {offline ? <span className="rounded-full bg-amber-300 px-3 py-1 text-amber-950">📴 Offline — playing from this device</span> : null}
        {waiting ? <span className="rounded-full bg-white px-3 py-1 text-indigo-700">⏳ {waiting} quiz{waiting === 1 ? '' : 'zes'} waiting to sync</span> : null}
      </div>
    </section>
  );
}

function ModePicker({ subject, onStart, onClose, busy }) {
  const [custom, setCustom] = useState({ types: ['mcq', 'truefalse', 'shortanswer'], count: 15, minutes: 0 });
  const [mode, setMode] = useState('quick');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Practise ${subject.name}`}>
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-cyan-300">{subject.name}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Choose your challenge</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-1 text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">✕</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map(item => (
            <button key={item.key} type="button" onClick={() => setMode(item.key)} aria-pressed={mode === item.key}
              className={`rounded-2xl border-2 p-4 text-left transition ${mode === item.key ? 'border-indigo-500 bg-indigo-50 dark:border-cyan-400 dark:bg-cyan-400/10' : 'border-slate-200 hover:border-indigo-300 dark:border-white/10'}`}>
              <p className="text-2xl" aria-hidden="true">{item.icon}</p>
              <p className="font-black text-slate-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{item.blurb}</p>
            </button>
          ))}
        </div>
        {mode === 'custom' ? (
          <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <fieldset>
              <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Question types</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <label key={key} className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${custom.types.includes(key) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={custom.types.includes(key)} onChange={() => setCustom(current => ({ ...current, types: current.types.includes(key) ? current.types.filter(type => type !== key) : [...current.types, key] }))} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Questions
                <input type="number" min={5} max={50} value={custom.count} onChange={event => setCustom(current => ({ ...current, count: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-white/20 dark:bg-slate-900" />
              </label>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Timer (minutes, 0 = none)
                <input type="number" min={0} max={120} value={custom.minutes} onChange={event => setCustom(current => ({ ...current, minutes: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-white/20 dark:bg-slate-900" />
              </label>
            </div>
          </div>
        ) : null}
        <button type="button" disabled={busy} onClick={() => onStart(mode, custom)} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-4 text-lg font-black text-white shadow-lg disabled:opacity-60">
          {busy ? 'Getting your questions…' : 'Start ▶'}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function PracticeArena() {
  const [home, setHome] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('subjects');
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState(false);
  const [game, setGame] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [saved, setSaved] = useState({});
  const [waiting, setWaiting] = useState(0);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await loadHome();
      setHome(data);
      setError('');
      const stamps = {};
      for (const subject of data.subjects || []) stamps[subject.key] = await packSavedAt(subject.key);
      setSaved(stamps);
    } catch (loadError) {
      setError(loadError.message);
    }
    setWaiting(await pendingAttempts().catch(() => 0));
  }, []);

  useEffect(() => {
    requestPersistentStorage();
    refresh();
    // A quiz played offline syncs by itself; show the new totals when it does.
    const unsubscribe = subscribe(() => { pendingAttempts().then(count => { setWaiting(previous => { if (previous && count < previous) refresh(); return count; }); }).catch(() => null); });
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    return () => { unsubscribe(); window.removeEventListener('online', onOnline); };
  }, [refresh]);

  const start = useCallback(async (modeKey, custom) => {
    if (!picker) return;
    setBusy(true);
    try {
      const pack = await loadPack(picker.key);
      const quiz = buildQuiz(pack, modeKey, custom);
      if (!quiz.questions.length) {
        setNotice(modeKey === 'mistakes' ? 'No missed questions yet — try another mode.' : 'No questions of that kind for this subject yet. Try another mode.');
        return;
      }
      setSaved(current => ({ ...current, [picker.key]: pack.savedAt || Date.now() }));
      setGame({ quiz, subject: picker, custom, attemptId: newAttemptId() });
      setPicker(null);
      setOutcome(null);
    } catch (startError) {
      setNotice(startError.message);
    } finally {
      setBusy(false);
    }
  }, [picker]);

  const finish = useCallback(async ({ results, startedAt, finishedAt }) => {
    const current = game;
    if (!current) return;
    const percent = results.length ? Math.round((results.reduce((sum, result) => sum + result.credit, 0) / results.length) * 100) : 0;
    const base = { results, percent, xp: estimateXp(results, current.quiz.mode), subject: current.subject };
    setOutcome({ ...base, saving: true });
    setGame(null);
    if (!results.length) { setOutcome({ ...base, saved: false }); return; }
    const attempt = {
      id: current.attemptId, subjectKey: current.subject.key, subjectName: current.subject.name, mode: current.quiz.mode, startedAt, finishedAt,
      durationSec: Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
      answers: results.map(result => ({ questionId: result.questionId, response: result.response, selfRating: result.selfRating, timeMs: result.timeMs })),
    };
    try {
      const response = await saveAttempt(attempt);
      if (response.queued) {
        setOutcome({ ...base, queued: true });
        setWaiting(await pendingAttempts().catch(() => 0));
      } else {
        setOutcome({ ...base, saved: true, xp: response.attempt?.xp ?? base.xp, percent: response.attempt?.percent ?? percent, newBadges: response.newBadges, levelUp: response.levelUp, profile: response.profile });
        setHome(previous => (previous ? { ...previous, profile: response.profile } : previous));
      }
    } catch (saveError) {
      setOutcome({ ...base, saved: false });
      setNotice(saveError.message);
    }
  }, [game]);

  const download = useCallback(async subject => {
    try {
      const pack = await loadPack(subject.key);
      setSaved(current => ({ ...current, [subject.key]: pack.savedAt || Date.now() }));
      setNotice(`${subject.name}: ${pack.questions.length} questions saved for offline practice.`);
    } catch (downloadError) {
      setNotice(downloadError.message);
    }
  }, []);

  if (game) {
    return <QuizPlayer quiz={game.quiz} subjectName={game.subject.name} onFinish={finish} onExit={() => { if (window.confirm('Leave this quiz? Your answers so far will not be saved.')) setGame(null); }} />;
  }
  if (outcome) {
    return <QuizResults outcome={outcome} onBack={() => { setOutcome(null); refresh(); }} onPlayAgain={() => { const subject = outcome.subject; setOutcome(null); refresh(); if (subject) setPicker(subject); }} />;
  }

  const profile = home?.profile;
  const subjects = home?.subjects || [];
  return (
    <div className="space-y-5">
      {error && !home ? (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100" role="alert">{error}</div>
      ) : null}
      {home ? <Hero profile={profile} student={home.student} offline={home.offline || !isOnline()} waiting={waiting} /> : !error ? <div className="h-44 animate-pulse rounded-[2rem] bg-slate-200 dark:bg-white/10" /> : null}
      {notice ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100" role="status">
          <span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss">✕</button>
        </div>
      ) : null}

      {home ? (
        <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5" role="tablist">
          {[['subjects', '📚 Subjects'], ['badges', '🏅 Badges'], ['leaderboard', '🏆 Leaderboard']].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${tab === key ? 'bg-white text-indigo-700 shadow dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'}`}>{label}</button>
          ))}
        </div>
      ) : null}

      {home && tab === 'subjects' ? (
        subjects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject, index) => (
              <motion.article key={subject.key} whileHover={{ y: -4 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <div className={`bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} p-4 text-white`}>
                  <h3 className="text-lg font-black">{subject.name}</h3>
                  <p className="text-xs text-white/85">{subject.questions} questions{subject.levels ? ` · ${subject.levels}` : ''}</p>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="mb-1 flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>Mastery</span><span>{subject.mastery === null ? 'Not started' : `${subject.mastery}%`}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="meter" aria-label={`${subject.name} mastery`} aria-valuenow={subject.mastery || 0} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${subject.mastery || 0}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {subject.types?.objective ? <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-white/10">{subject.types.objective} objective</span> : null}
                    {subject.types?.written ? <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-white/10">{subject.types.written} short</span> : null}
                    {subject.types?.openEnded ? <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-white/10">{subject.types.openEnded} theory</span> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPicker(subject)} className="flex-1 rounded-2xl bg-slate-900 py-2.5 text-sm font-black text-white hover:bg-indigo-700 dark:bg-cyan-400 dark:text-black">Play ▶</button>
                    <button type="button" onClick={() => download(subject)} disabled={!isOnline()} title={saved[subject.key] ? 'Saved on this device — tap to refresh' : 'Save these questions for offline practice'}
                      className="rounded-2xl border border-slate-300 px-3 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-white/20 dark:text-slate-200">
                      {saved[subject.key] ? '📥 Offline ✓' : '📥 Save offline'}
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-white/20">
            <p className="text-4xl" aria-hidden="true">📚</p>
            <p className="mt-2 font-black text-slate-800 dark:text-white">No practice questions yet</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Questions from your teachers' assignments, notes and tests — and from Ndovera's bank — appear here automatically.</p>
          </div>
        )
      ) : null}

      {home && tab === 'badges' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(profile?.badges || []).map(badge => (
            <div key={badge.key} className={`flex items-center gap-3 rounded-2xl border p-4 ${badge.earned ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-400/40 dark:from-amber-400/10 dark:to-orange-400/10' : 'border-slate-200 opacity-60 grayscale dark:border-white/10'}`}>
              <span className="text-3xl" aria-hidden="true">{badge.icon}</span>
              <div><p className="font-black text-slate-900 dark:text-white">{badge.label}{badge.earned ? '' : ' 🔒'}</p><p className="text-xs text-slate-600 dark:text-slate-300">{badge.description}</p></div>
            </div>
          ))}
        </div>
      ) : null}

      {home && tab === 'leaderboard' ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
          <h3 className="mb-3 font-black text-slate-900 dark:text-white">This week in {home.student?.className || 'your class'}</h3>
          {(home.leaderboard?.entries || []).length ? (
            <ol className="space-y-2">
              {home.leaderboard.entries.map(entry => (
                <li key={`${entry.rank}-${entry.name}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${entry.you ? 'bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-500/15' : 'bg-slate-50 dark:bg-white/5'}`}>
                  <span className="w-8 text-center text-lg font-black">{['🥇', '🥈', '🥉'][entry.rank - 1] || entry.rank}</span>
                  <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">{entry.name}{entry.you ? ' (you)' : ''}</span>
                  <span className="text-sm font-black text-amber-600 dark:text-amber-300">{entry.xp} XP</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-slate-600 dark:text-slate-300">Nobody has practised this week yet — be first on the board!</p>}
        </section>
      ) : null}

      <AnimatePresence>{picker ? <ModePicker subject={picker} busy={busy} onClose={() => setPicker(null)} onStart={start} /> : null}</AnimatePresence>
    </div>
  );
}

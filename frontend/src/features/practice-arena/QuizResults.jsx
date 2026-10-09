import React from 'react';
import { motion } from 'framer-motion';
import RichContent from '../../shared/rich/RichContent';

function ScoreRing({ percent }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const color = percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <svg viewBox="0 0 128 128" className="h-36 w-36" role="img" aria-label={`Score ${percent}%`}>
      <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-200 dark:text-white/10" />
      <motion.circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" transform="rotate(-90 64 64)"
        strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - percent / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      <text x="64" y="72" textAnchor="middle" className="fill-slate-900 text-[26px] font-black dark:fill-white">{percent}%</text>
    </svg>
  );
}

function answerText(question) {
  if (question.type === 'mcq' || question.type === 'truefalse') return question.options?.[question.correctIndex];
  if (question.type === 'shortanswer' || question.type === 'fillgaps') return (question.accepted || []).join(' / ');
  if (question.type === 'crossmatching') return (question.pairs || []).map(pair => `${pair.left} → ${pair.right}`).join('; ');
  return question.modelAnswer;
}

export default function QuizResults({ outcome, onPlayAgain, onBack }) {
  const { results, percent, xp, saved, queued, newBadges = [], levelUp, profile } = outcome;
  const right = results.filter(result => result.correct).length;
  const headline = percent === 100 ? 'Perfect score! 💎' : percent >= 80 ? 'Outstanding! 🌟' : percent >= 50 ? 'Good work! 💪' : 'Keep going — every try counts 🌱';
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-center text-white shadow-2xl">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-8">
          <div className="rounded-full bg-white/95 p-2 text-slate-900"><ScoreRing percent={percent} /></div>
          <div>
            <h2 className="text-3xl font-black">{headline}</h2>
            <p className="mt-1 text-lg font-semibold text-white/90">{right} of {results.length} right</p>
            <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 inline-block rounded-full bg-amber-300 px-4 py-1.5 text-lg font-black text-amber-950">+{xp} XP</motion.p>
            {profile ? <p className="mt-2 text-sm text-white/80">🔥 {profile.streak}-day streak · Level {profile.level} {profile.title}</p> : null}
            <p className="mt-2 text-xs text-white/80">{queued ? '📴 Saved on this device — it will sync automatically when you are online.' : saved ? '✅ Saved to your progress.' : ''}</p>
          </div>
        </div>
      </motion.section>

      {levelUp ? (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="rounded-3xl border-2 border-amber-400 bg-amber-50 p-4 text-center dark:bg-amber-400/10">
          <p className="text-2xl font-black text-amber-700 dark:text-amber-200">⬆️ Level up! You reached level {levelUp.to} — {levelUp.title}</p>
        </motion.div>
      ) : null}

      {newBadges.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">New badges</h3>
          <div className="flex flex-wrap gap-3">
            {newBadges.map((badge, index) => (
              <motion.div key={badge.key} initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.2 + index * 0.15, type: 'spring' }} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-2 dark:from-amber-400/20 dark:to-orange-400/20">
                <span className="text-2xl" aria-hidden="true">{badge.icon}</span>
                <span><span className="block text-sm font-black text-slate-900 dark:text-white">{badge.label}</span><span className="block text-xs text-slate-600 dark:text-slate-300">{badge.description}</span></span>
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onPlayAgain} className="rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white shadow-lg hover:bg-indigo-700 dark:bg-cyan-400 dark:text-black">Play again</button>
        <button type="button" onClick={onBack} className="rounded-2xl border border-slate-300 px-6 py-3 font-black text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10">Back to the arena</button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Review your answers</h3>
        <ol className="space-y-3">
          {results.map((result, index) => (
            <li key={`${result.questionId}-${index}`} className={`rounded-2xl border-l-4 p-3 ${result.correct ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20' : result.credit > 0 ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-900/20' : 'border-rose-500 bg-rose-50/60 dark:bg-rose-900/20'}`}>
              <div className="text-sm font-semibold text-slate-900 dark:text-white"><span className="mr-1">{index + 1}.</span><RichContent text={result.question.prompt} inline /></div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{result.unanswered ? 'Not answered · ' : ''}Answer: <RichContent text={String(answerText(result.question) || '')} inline /></p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { listAmiChampionshipQuestions, moderateChampionshipQuestion } from './services/championshipApi';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, INPUT, LABEL, MUTED, PANEL } from './championshipUi';

// Ami's question moderation queue (championship.md sections 13–14).
//
// The AI screen is shown as evidence, not as a verdict: its classification and any issues it
// raised sit next to the question so a moderator can agree or disagree. Approving banks the
// question into the contributing school's bank; rejecting records a reason the school can see.

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Unscreened' },
  { key: 'ai_screened', label: 'Awaiting decision' },
  { key: 'approved', label: 'Approved' },
  { key: 'banked', label: 'Banked' },
  { key: 'rejected', label: 'Rejected' },
];

const VERDICT_TONE = {
  pass: 'bg-[#1a5c38] text-white',
  flag: 'bg-[#c9a96e] text-[#191970]',
  fail: 'bg-[#800020] text-[#b5e3f4]',
};

function QuestionCard({ submission, onDecide, busyId }) {
  const [note, setNote] = useState('');
  const busy = busyId === submission.id;
  const decided = ['approved', 'banked', 'rejected'].includes(submission.status);

  return (
    <article className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-bold text-[#191970] dark:text-slate-100">{submission.prompt}</p>
        {submission.aiVerdict ? (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${VERDICT_TONE[submission.aiVerdict] || VERDICT_TONE.flag}`}>
            AI: {submission.aiVerdict}
          </span>
        ) : (
          <span className="rounded-full bg-slate-400 px-3 py-1 text-xs font-bold text-white">Unscreened</span>
        )}
      </div>

      <p className={`mt-1 ${MUTED}`}>
        {[submission.subject, submission.classLevel, submission.topic, submission.difficulty].filter(Boolean).join(' • ') || 'Unclassified'}
      </p>

      {submission.options?.length ? (
        <ul className={`mt-3 grid gap-1 sm:grid-cols-2 ${BODY}`}>
          {submission.options.map((option, index) => (
            <li key={index} className={String(option) === String(submission.answer) ? 'font-bold text-[#1a5c38] dark:text-emerald-300' : ''}>
              {String.fromCharCode(65 + index)}. {option}
              {String(option) === String(submission.answer) ? ' ✓' : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${BODY}`}><span className={LABEL}>Answer</span> {String(submission.answer || '')}</p>
      )}

      {submission.aiReport?.issues?.length ? (
        <p className={`mt-3 ${MUTED}`}>
          <span className="font-bold text-[#800020] dark:text-rose-300">AI raised:</span> {submission.aiReport.issues.join('; ')}
        </p>
      ) : null}
      {submission.aiReport?.notes ? <p className={`mt-1 ${MUTED}`}>{submission.aiReport.notes}</p> : null}

      <p className={`mt-3 ${MUTED}`}>
        From {submission.submitterName || 'a school'} • {submission.tags?.length ? submission.tags.join(', ') : 'no usage tags'}
      </p>

      {decided ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${
          submission.status === 'rejected'
            ? 'bg-[#800020]/10 text-[#800020] dark:text-rose-300'
            : 'bg-[#1a5c38]/10 text-[#1a5c38] dark:text-emerald-300'
        }`}>
          {submission.status === 'banked' ? 'Approved and banked' : submission.status === 'approved' ? 'Approved — banking pending' : 'Rejected'}
          {submission.moderatorNote ? ` — ${submission.moderatorNote}` : ''}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            className={INPUT}
            placeholder="Note to the school (optional, required when rejecting)"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => onDecide(submission, 'approved', note)}>
              {busy ? 'Saving…' : 'Approve and bank'}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={busy || !note.trim()}
              onClick={() => onDecide(submission, 'rejected', note)}
              title={note.trim() ? '' : 'Add a note so the school knows why'}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function AmiQuestionModeration() {
  const [status, setStatus] = useState('ai_screened');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAmiChampionshipQuestions({ status });
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setError('');
    } catch (loadError) {
      setSubmissions([]);
      setError(loadError.message || 'Could not load the moderation queue.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function decide(submission, decision, note) {
    setBusyId(submission.id);
    setNotice('');
    setError('');
    try {
      const result = await moderateChampionshipQuestion(submission.id, decision, note);
      setNotice(
        decision === 'approved'
          ? (result?.banked ? 'Approved and added to the school question bank.' : 'Approved. Banking did not complete — it can be retried.')
          : 'Rejected. The school can see your note.',
      );
      await load();
    } catch (decideError) {
      setError(decideError.message || 'Could not save that decision.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Question moderation</h2>
          <p className={MUTED}>Questions contributed by schools. Nothing reaches the bank without a decision here.</p>
        </div>
        <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map(filter => (
          <button
            key={filter.key || 'all'}
            type="button"
            onClick={() => setStatus(filter.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              status === filter.key
                ? 'bg-[#800020] text-[#b5e3f4]'
                : 'border border-[#c9a96e]/50 bg-white/70 text-[#191970] dark:border-white/15 dark:bg-slate-900/50 dark:text-slate-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {notice ? <p className="mt-3 rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="mt-3 rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className={MUTED}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className={BODY}>Nothing in this queue.</p>
        ) : (
          submissions.map(submission => (
            <QuestionCard key={submission.id} submission={submission} onDecide={decide} busyId={busyId} />
          ))
        )}
      </div>
    </section>
  );
}

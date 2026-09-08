import React, { useCallback, useEffect, useState } from 'react';
import { getMyChampionshipSubmissions, submitChampionshipEntry } from './services/championshipApi';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, MUTED, PANEL, formatDate } from './championshipUi';

// Where a participant writes and submits an entry (championship.md section 15).
//
// Two deliberate choices here. Submitting again creates a new version rather than replacing the
// last one, because in a competition the record of what was sent and when is what an appeal
// turns on. And no score is shown back — section 9 keeps detailed marking private until
// results are released, and the AI report is advisory input for the review team, not a result.

export default function ChampionshipEntryWorkspace({ championship, stages = [] }) {
  const [submissions, setSubmissions] = useState([]);
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [stageId, setStageId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Only stages that actually take a written entry are offered.
  const writableStages = stages.filter(stage => ['judging', 'screening', 'round', 'preliminary', 'qualifier', 'final'].includes(stage.kind));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyChampionshipSubmissions(championship.slug);
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [championship.slug]);

  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await submitChampionshipEntry(championship.slug, {
        content,
        topic,
        stageId,
        kind: 'essay',
      });
      setNotice(`Entry received — version ${result?.submission?.version || 1}. Your review team will assess it after the stage closes.`);
      setContent('');
      await load();
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your entry.');
    } finally {
      setBusy(false);
    }
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className={PANEL}>
      <p className={LABEL}>Submit your entry</p>

      {notice ? <p className="mt-2 rounded-xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-3 py-2 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="mt-2 rounded-xl border border-[#800020]/40 bg-[#800020]/10 px-3 py-2 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      <form onSubmit={submit} className="mt-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Title or topic</span>
            <input value={topic} onChange={event => setTopic(event.target.value)} className={INPUT} placeholder="The title of your piece" />
          </label>
          {writableStages.length > 0 ? (
            <label className="block">
              <span className={LABEL}>Stage</span>
              <select value={stageId} onChange={event => setStageId(event.target.value)} className={INPUT}>
                <option value="">Select a stage</option>
                {writableStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <label className="mt-3 block">
          <span className={LABEL}>Your entry</span>
          <textarea
            value={content}
            onChange={event => setContent(event.target.value)}
            rows={12}
            className={INPUT}
            placeholder="Write your entry here. You can submit again before the stage closes — each submission is kept as a new version."
            required
          />
        </label>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className={MUTED}>{words} word{words === 1 ? '' : 's'}</p>
          <button type="submit" className={BTN_PRIMARY} disabled={busy || !content.trim()}>
            {busy ? 'Submitting…' : 'Submit entry'}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={LABEL}>What you have submitted</p>
          <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
        </div>

        {loading ? (
          <p className={`mt-2 ${MUTED}`}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className={`mt-2 ${BODY}`}>Nothing submitted yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {submissions.map(submission => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#c9a96e]/40 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <p className="font-bold text-[#191970] dark:text-slate-100">
                    {submission.topic || 'Untitled entry'} — version {submission.version}
                  </p>
                  <p className={MUTED}>
                    {submission.wordCount} words • submitted {formatDate(submission.submittedAt || submission.createdAt)}
                    {submission.anonymousCode ? ` • ${submission.anonymousCode}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-[#1a5c38]/15 px-3 py-1 text-xs font-bold text-[#1a5c38] dark:text-emerald-300">
                  Received
                </span>
              </div>
            ))}
          </div>
        )}
        <p className={`mt-3 ${MUTED}`}>
          Marks are not shown here. Entries are assessed after the stage closes and results are released by NDOVERA.
        </p>
      </div>
    </div>
  );
}

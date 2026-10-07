import React, { useCallback, useEffect, useRef, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { createPortal } from 'react-dom';
import AiAnswer from '../ai/AiAnswer';
import ExamDeliveryPanel, { defaultDelivery, deliveryPayload } from '../assessments/ExamDeliveryPanel';
import {
  STATUS_LABELS, STATUS_STYLES, decideSubmission, deleteSubmission, getSubmissionDetail, runAiReview,
  startSubmissionReview, submitSubmission, updateSubmission,
} from './submissionsApi';

const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';

const EVENT_LABELS = {
  created: 'Created', submitted: 'Submitted', resubmitted: 'Resubmitted', edited: 'Edited', revised_before_review: 'Revised before review',
  review_started: 'Review started', approved: 'Approved', returned: 'Returned for correction', ai_review: 'AI preliminary review run', deleted: 'Deleted',
};

export function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>{STATUS_LABELS[status] || status}</span>;
}

function Files({ files }) {
  if (!files?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <li key={index}><a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-1.5 text-xs font-semibold text-[#191970] hover:underline dark:bg-slate-900 dark:text-white">📎 {file.name}</a></li>
      ))}
    </ul>
  );
}

/**
 * One submission in full. `mode` is 'teacher' (the author's view) or 'review'
 * (Owner, HOS or a school-named reviewer). Opening work to review moves it to
 * Under Review, so the teacher can see it is being looked at.
 */
export default function SubmissionDetail({ id, mode = 'teacher', onClose, onChanged }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [review, setReview] = useState({ feedback: '', score: '' });
  // Exam papers from Ndovera: how the approved paper is written (print / CBT) and when.
  const [delivery, setDelivery] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  // Held in a ref so an inline onChanged from the parent cannot re-trigger loading.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    try {
      let data = await getSubmissionDetail(id);
      if (mode === 'review' && data.permissions.isReviewer && ['submitted', 'resubmitted'].includes(data.submission.status)) {
        await startSubmissionReview(id);
        data = await getSubmissionDetail(id);
        onChangedRef.current?.();
      }
      setState({ loading: false, error: '', data });
      if (data.examPaper) setDelivery(current => current || defaultDelivery(data.examPaper));
      setDraft({ title: data.submission.title, content: data.submission.content });
    } catch (err) {
      setState({ loading: false, error: err.message, data: null });
    }
  }, [id, mode]);

  useEffect(() => { load(); }, [load]);

  async function run(key, action, success) {
    setBusy(key); setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
      onChangedRef.current?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
    }
  }

  const body = (() => {
    if (state.loading) return <p role="status">Loading…</p>;
    if (state.error) return <p role="alert" className="font-semibold text-red-700">{state.error}</p>;
    const { submission, versions, events, permissions } = state.data;
    const ownerCanEdit = mode === 'teacher' && ['draft', 'returned', 'submitted', 'resubmitted'].includes(submission.status);
    const canSubmit = mode === 'teacher' && ['draft', 'returned'].includes(submission.status);
    const canDelete = mode === 'teacher' && (submission.status === 'draft' || (['submitted', 'resubmitted'].includes(submission.status) && submission.version <= 1 && !submission.reviewedAt));
    const reviewable = mode === 'review' && permissions.isReviewer && ['submitted', 'resubmitted', 'under_review'].includes(submission.status);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#191970] dark:text-slate-200">
          <StatusBadge status={submission.status} />
          <span>{submission.typeLabel} · {submission.className} · {submission.subjectName}{submission.periodLabel ? ` · ${submission.periodLabel}` : ''}</span>
          <span className="text-xs text-slate-500">{submission.sessionName}{submission.termName ? ` · ${submission.termName}` : ''} · {submission.teacherName} · version {submission.version || 0}</span>
        </div>

        {submission.feedback && (
          <section className={`rounded-2xl border-l-4 p-3 ${submission.status === 'approved' ? 'border-[#1a5c38] bg-[#e8f5ee]' : 'border-[#800000] bg-[#fdecea]'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">Reviewer feedback · {submission.reviewedByName}{submission.reviewedAt ? ` · ${new Date(submission.reviewedAt).toLocaleString()}` : ''}{submission.score != null ? ` · Score ${submission.score}/${permissions.maxScore}` : ''}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#191970]">{submission.feedback}</p>
          </section>
        )}

        {editing ? (
          <form onSubmit={event => { event.preventDefault(); run('save', () => updateSubmission(id, draft).then(() => setEditing(false)), 'Saved. Your changes are on record.'); }} className="space-y-2">
            <label className="block text-xs font-bold text-[#800020]">Title<input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className={FIELD} /></label>
            <label className="block text-xs font-bold text-[#800020]">Work<textarea rows={10} value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} className={FIELD} /></label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy === 'save'} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>Save changes</button>
              <button type="button" onClick={() => setEditing(false)} className={`${BTN} text-[#800020]`}>Cancel</button>
            </div>
          </form>
        ) : (
          <section className="space-y-2">
            <h3 className="text-lg font-bold text-[#800000] dark:text-white">{submission.title}</h3>
            {submission.content ? <div className="max-h-[40vh] overflow-auto rounded-2xl bg-white p-4 text-sm text-[#191970] dark:bg-slate-900 dark:text-slate-100"><RichContent text={submission.content} /></div> : null}
            <Files files={submission.files} />
          </section>
        )}

        {mode === 'teacher' && !editing && (
          <div className="flex flex-wrap gap-2">
            {ownerCanEdit && <button type="button" onClick={() => setEditing(true)} className={`${BTN} border border-[#c9a96e]/45 bg-white text-[#191970]`}>Edit</button>}
            {canSubmit && <button type="button" disabled={!!busy} onClick={() => run('submit', () => submitSubmission(id), submission.status === 'returned' ? 'Resubmitted as a new version.' : 'Submitted.')} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>{submission.status === 'returned' ? 'Resubmit' : 'Submit'}</button>}
            {canDelete && <button type="button" disabled={!!busy} onClick={() => run('delete', () => deleteSubmission(id).then(() => onClose()), 'Deleted.')} className={`${BTN} border border-red-300 text-red-700`}>Delete</button>}
          </div>
        )}

        {mode === 'review' && (
          <section aria-label="AI preliminary review" className="space-y-2 rounded-2xl border border-[#2447d8]/30 bg-[#eef1ff] p-3 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-xs font-bold uppercase tracking-[0.12em] text-[#2447d8]">AI preliminary review — advice for you, not a decision</p>
              {permissions.isReviewer && <button type="button" disabled={!!busy} onClick={() => run('ai', () => runAiReview(id), 'AI review ready.')} className={`${BTN} bg-[#2447d8] text-white`}>{busy === 'ai' ? 'Reviewing…' : submission.aiReview ? 'Run again' : 'Run AI review'}</button>}
            </div>
            {submission.aiReview ? (
              <>
                <AiAnswer text={submission.aiReview.text} />
                <p className="text-[11px] text-slate-500">Based on version {submission.aiReview.version} · {new Date(submission.aiReview.createdAt).toLocaleString()}. The AI reads only the text, not attached files.</p>
              </>
            ) : <p className="text-sm text-[#191970]">No AI review yet.</p>}
          </section>
        )}

        {reviewable && (
          <section aria-label="Your review" className="space-y-2 rounded-2xl border border-[#c9a96e]/45 bg-white p-3 dark:bg-slate-900">
            <label className="block text-xs font-bold text-[#800020]">Comment for the teacher<textarea rows={3} value={review.feedback} onChange={event => setReview(current => ({ ...current, feedback: event.target.value }))} className={FIELD} /></label>
            {permissions.reviewMode === 'score' && (
              <label className="block text-xs font-bold text-[#800020]">Score (out of {permissions.maxScore})<input type="number" min="0" max={permissions.maxScore} value={review.score} onChange={event => setReview(current => ({ ...current, score: event.target.value }))} className={FIELD} /></label>
            )}
            {state.data.examPaper && delivery && <ExamDeliveryPanel paper={state.data.examPaper} delivery={delivery} onChange={setDelivery} canSchedule={Boolean(permissions.canScheduleExam)} />}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => run('approve', () => decideSubmission(id, { decision: 'approve', ...review, ...(state.data.examPaper && delivery ? { delivery: deliveryPayload(delivery) } : {}) }), state.data.examPaper && delivery?.mode !== 'print' ? 'Approved and scheduled as a CBT.' : 'Approved.')} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>{state.data.examPaper && delivery?.mode !== 'print' ? 'Approve & schedule' : 'Approve'}</button>
              <button type="button" disabled={!!busy} onClick={() => run('return', () => decideSubmission(id, { decision: 'return', ...review }), 'Returned for correction.')} className={`${BTN} bg-[#800000] text-white`}>Return for correction</button>
            </div>
          </section>
        )}

        {message && <p role="status" className="text-sm font-semibold text-[#1a5c38]">{message}</p>}

        <section aria-label="Version history">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">Version history</h4>
          {versions.length === 0 ? <p className="text-sm text-slate-500">Not submitted yet.</p> : (
            <ol className="space-y-2">
              {versions.map(version => (
                <li key={version.version} className="rounded-xl bg-white p-3 text-sm text-[#191970] dark:bg-slate-900 dark:text-slate-200">
                  <p className="font-bold">Version {version.version} → {STATUS_LABELS[version.submittedStatus]}{version.outcome ? ` → ${STATUS_LABELS[version.outcome]}` : ''}</p>
                  <p className="text-xs text-slate-500">{new Date(version.submittedAt).toLocaleString()}{version.reviewedByName ? ` · reviewed by ${version.reviewedByName}` : ''}{version.score != null ? ` · ${version.score}` : ''}</p>
                  {version.feedback && <p className="mt-1 text-xs italic">“{version.feedback}”</p>}
                  <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold text-[#2447d8]">Show this version</summary><p className="mt-1 whitespace-pre-wrap text-xs">{version.content}</p><Files files={version.files} /></details>
                </li>
              ))}
            </ol>
          )}
        </section>
        <details>
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">Audit trail ({events.length})</summary>
          <ol className="mt-2 space-y-1 text-xs text-[#191970] dark:text-slate-300">
            {events.map((event, index) => <li key={index}>{new Date(event.createdAt).toLocaleString()} — {EVENT_LABELS[event.action] || event.action} by {event.actorName}{event.version ? ` (v${event.version})` : ''}</li>)}
          </ol>
        </details>
      </div>
    );
  })();

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-[#191970]/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Submission">
      <div className="w-full max-w-3xl rounded-3xl bg-[#b5e3f4] p-5 shadow-xl dark:bg-slate-950">
        <div className="mb-3 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]">Close</button></div>
        {body}
      </div>
    </div>,
    document.body,
  );
}

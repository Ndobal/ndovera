import React, { useEffect, useState } from 'react';
import { getMyReview, saveMyReview } from './showcaseApi';

// A person's own review of Ndovera, written from their dashboard. Ami reads it before it can
// appear on the home page. Students are shown by role and school, never by name.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const LABEL = 'block text-sm font-bold text-slate-800 dark:text-slate-100';
const STATUS = {
  pending: 'Waiting for Ndovera to read it.',
  approved: 'On the Ndovera home page.',
  rejected: 'Not chosen for the home page. Thank you for telling us: you can change it and send it again.',
};
const MAX = 400;

export default function MyReviewPage() {
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [showName, setShowName] = useState(false);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    getMyReview().then(result => {
      if (!current) return;
      setRole(result.role || '');
      if (result.review) {
        setStatus(result.review.status);
        setRating(result.review.rating);
        setBody(result.review.body);
        setShowName(result.review.showName);
      }
    }).catch(error => { if (current) setNotice(error.message); }).finally(() => { if (current) setLoaded(true); });
    return () => { current = false; };
  }, []);

  const send = async event => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const result = await saveMyReview({ rating, body, showName, consent });
      setStatus(result.review?.status || 'pending');
      setConsent(false);
      setNotice(result.message);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Your feedback</h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">Tell us how Ndovera works for you. Ndovera reads every review, and may choose yours for the home page.</p>
        {status ? <p className="mt-2 text-sm font-bold text-indigo-800 dark:text-indigo-200">{STATUS[status] || ''}</p> : null}
      </section>
      {notice ? <p role="status" className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100">{notice}</p> : null}
      {!loaded ? <p role="status" className="text-slate-700 dark:text-slate-200">Loading…</p> : (
        <form onSubmit={send} className={`${CARD} space-y-4`}>
          <label className={LABEL}>Rating
            <select className={FIELD} value={rating} onChange={event => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} out of 5</option>)}
            </select>
          </label>
          <label className={LABEL}>Your review
            <textarea className={FIELD} rows={4} maxLength={MAX} value={body} onChange={event => setBody(event.target.value)} />
          </label>
          <p className="text-xs text-slate-700 dark:text-slate-300">{body.length} of {MAX} characters</p>
          {role === 'student'
            ? <p className="text-sm text-slate-700 dark:text-slate-200">Your name stays private: the home page would say "Student" and your school.</p>
            : <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-100"><input type="checkbox" className="mt-1" checked={showName} onChange={event => setShowName(event.target.checked)} /> Show my name (otherwise only my role and school)</label>}
          <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-100"><input type="checkbox" className="mt-1" checked={consent} onChange={event => setConsent(event.target.checked)} /> Ndovera may show this review on its home page</label>
          <button type="submit" disabled={busy} className="rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? 'Sending…' : status ? 'Send my changes' : 'Send my review'}</button>
          {status === 'approved' ? <p className="text-xs text-slate-700 dark:text-slate-300">Changing an approved review takes it off the home page until Ndovera has read it again.</p> : null}
        </form>
      )}
    </div>
  );
}

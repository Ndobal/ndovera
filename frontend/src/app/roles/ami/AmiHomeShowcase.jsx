import React, { useCallback, useEffect, useState } from 'react';
import { getFeatureChanges, getReviews, getShowcaseSchools, saveFeatureChanges, setReviewStatus, setSchoolHidden } from '../../../features/showcase/showcaseApi';

// Ami chooses what the home page shows: which reviews pass, and any school to leave out.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'font-black text-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const TABS = [['pending', 'Waiting'], ['approved', 'On the home page'], ['rejected', 'Not chosen']];

const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);

/** New pages reach the public features list by themselves; these are for anything else. */
function FeatureChanges() {
  const [added, setAdded] = useState('');
  const [hidden, setHidden] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    getFeatureChanges().then(result => { setAdded((result.added || []).join('\n')); setHidden((result.hidden || []).join('\n')); }).catch(error => setMessage(error.message));
  }, []);
  const save = () => saveFeatureChanges({ added: lines(added), hidden: lines(hidden) }).then(() => setMessage('Saved. The features page shows this now.')).catch(error => setMessage(error.message));
  return (
    <section className={`${CARD} space-y-3`} aria-label="Features page">
      <h2 className={`text-lg ${HEADING}`}>Features page</h2>
      <p className={BODY}>New pages in school menus appear on the features page by themselves. Here you can add a name, or hide one. One per line.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Add these<textarea rows={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white" value={added} onChange={event => setAdded(event.target.value)} /></label>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Hide these<textarea rows={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white" value={hidden} onChange={event => setHidden(event.target.value)} /></label>
      </div>
      <button type="button" className={PRIMARY} onClick={save}>Save</button>
      {message ? <p role="status" className={BODY}>{message}</p> : null}
    </section>
  );
}

export default function AmiHomeShowcase() {
  const [status, setStatus] = useState('pending');
  const [reviews, setReviews] = useState(null);
  const [schools, setSchools] = useState(null);
  const [notice, setNotice] = useState('');
  const loadReviews = useCallback(() => getReviews(status).then(result => setReviews(result.reviews)).catch(error => setNotice(error.message)), [status]);
  const loadSchools = useCallback(() => getShowcaseSchools().then(result => setSchools(result.schools)).catch(error => setNotice(error.message)), []);
  useEffect(() => { loadReviews(); }, [loadReviews]);
  useEffect(() => { loadSchools(); }, [loadSchools]);
  const decide = (id, next) => setReviewStatus(id, next).then(loadReviews).catch(error => setNotice(error.message));
  const toggle = (id, hidden) => setSchoolHidden(id, hidden).then(loadSchools).catch(error => setNotice(error.message));

  return (
    <div className="space-y-5">
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      <FeatureChanges />
      <section className={`${CARD} space-y-3`} aria-label="Reviews">
        <h2 className={`text-lg ${HEADING}`}>Reviews</h2>
        <p className={BODY}>Only reviews you approve scroll on the home page. Changes can take up to an hour to show everywhere.</p>
        <div className="flex flex-wrap gap-2">
          {TABS.map(([key, label]) => <button key={key} type="button" aria-pressed={status === key} className={status === key ? PRIMARY : SECONDARY} onClick={() => setStatus(key)}>{label}</button>)}
        </div>
        {!reviews ? <p role="status" className={BODY}>Loading…</p> : reviews.length ? (
          <ul className="space-y-2">
            {reviews.map(review => (
              <li key={review.id} className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                <p className="text-sm font-bold text-[#7a4f00] dark:text-amber-300">{review.rating} out of 5</p>
                <p className="text-sm text-slate-900 dark:text-white">{review.body}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{review.name}{review.detail ? ` · ${review.detail}` : ''}</p>
                <div className="mt-2 flex gap-2">
                  {status !== 'approved' ? <button type="button" className={PRIMARY} onClick={() => decide(review.id, 'approved')}>Show on home page</button> : null}
                  {status !== 'rejected' ? <button type="button" className={SECONDARY} onClick={() => decide(review.id, 'rejected')}>{status === 'approved' ? 'Take off home page' : 'Do not show'}</button> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No reviews here.</p>}
      </section>
      <section className={`${CARD} space-y-3`} aria-label="Schools on the home page">
        <h2 className={`text-lg ${HEADING}`}>Schools on the home page</h2>
        <p className={BODY}>Active schools appear with their name and logo (the first 60 by name). Leave out a test school, or one that asked not to be listed.</p>
        {!schools ? <p role="status" className={BODY}>Loading…</p> : schools.length ? (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {schools.map(school => (
              <li key={school.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{school.name}{school.logoUrl ? '' : ' (no logo yet)'}{school.hidden ? ' · left out' : ''}</span>
                <button type="button" className={SECONDARY} onClick={() => toggle(school.id, !school.hidden)}>{school.hidden ? 'Show' : 'Leave out'}</button>
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No active schools yet.</p>}
      </section>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../config/apiBase';
import { getHomeShowcase } from './showcaseApi';
import './homeStrips.css';

// The home page's two strips, moving to the right: schools on Ndovera, and reviews Ami approved.
// The list repeats so the strip has no gap; the copies are hidden from screen readers.

const MIN_ITEMS = 10;

function repeated(items) {
  let list = items;
  while (list.length < MIN_ITEMS) list = [...list, ...items];
  return list;
}

function Strip({ label, seconds, children }) {
  return (
    <div className="ndv-strip" role="group" aria-label={label}>
      <div className="ndv-strip-track" style={{ animationDuration: `${seconds}s`, WebkitAnimationDuration: `${seconds}s` }}>
        {children}
      </div>
    </div>
  );
}

const logoSrc = url => (url.startsWith('/') ? getApiUrl(url) : url);

function School({ school, copy }) {
  return (
    <div aria-hidden={copy || undefined} className="ndv-strip-item flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-800">
      {school.logoUrl
        ? <img src={logoSrc(school.logoUrl)} alt="" loading="lazy" className="h-10 w-10 rounded-full bg-white object-contain" />
        : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#191970] text-sm font-black text-white">{school.name.charAt(0)}</span>}
      <span className="whitespace-nowrap text-sm font-bold text-[#191970] dark:text-white">{school.name}</span>
    </div>
  );
}

function Review({ review, copy }) {
  return (
    <figure aria-hidden={copy || undefined} className="ndv-strip-item w-72 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-800">
      <p className="text-sm font-bold text-[#7a4f00] dark:text-amber-300" aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}</p>
      <blockquote className="mt-1 whitespace-normal text-sm text-slate-800 dark:text-slate-100">{review.body}</blockquote>
      <figcaption className="mt-2 whitespace-normal text-xs font-bold text-[#191970] dark:text-white">{review.name}{review.detail ? <span className="font-semibold text-slate-700 dark:text-slate-300"> · {review.detail}</span> : null}</figcaption>
    </figure>
  );
}

export default function HomeStrips() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let current = true;
    getHomeShowcase().then(result => { if (current) setData(result); }).catch(() => null);
    return () => { current = false; };
  }, []);
  const schools = data?.schools || [];
  const reviews = data?.reviews || [];
  if (!schools.length && !reviews.length) return null;
  const schoolRow = repeated(schools);
  const reviewRow = repeated(reviews);
  return (
    <div className="space-y-8">
      {schools.length ? (
        <section aria-label="Schools using Ndovera" className="space-y-3">
          <h2 className="text-2xl font-black text-[#191970] dark:text-white">Schools on Ndovera</h2>
          <Strip label="Schools using Ndovera" seconds={Math.max(25, schoolRow.length * 4)}>
            {schoolRow.map((school, index) => <School key={`a${index}`} school={school} copy={index >= schools.length} />)}
            {schoolRow.map((school, index) => <School key={`b${index}`} school={school} copy />)}
          </Strip>
        </section>
      ) : null}
      {reviews.length ? (
        <section aria-label="What people say about Ndovera" className="space-y-3">
          <h2 className="text-2xl font-black text-[#191970] dark:text-white">What people say</h2>
          <Strip label="Reviews" seconds={Math.max(40, reviewRow.length * 8)}>
            {reviewRow.map((review, index) => <Review key={`a${index}`} review={review} copy={index >= reviews.length} />)}
            {reviewRow.map((review, index) => <Review key={`b${index}`} review={review} copy />)}
          </Strip>
        </section>
      ) : null}
    </div>
  );
}

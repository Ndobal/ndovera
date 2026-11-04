import React, { useEffect, useState } from 'react';
import { getPartnerToolkitMessages, getPartnerUpdates } from '../../../features/public/services/publicSiteApi';
import { CARD, BODY, MUTED, LABEL, BTN_PRIMARY, BTN_SECONDARY, PageHeader, Notice, EmptyState, naira } from './partnerUi';

// What's new for partners, and the messages they send to schools, carrying their own link and prices.

const TAG = 'rounded-full bg-[#1a5c38] px-2 py-0.5 text-[11px] font-bold text-white';
const PITCH = 'mt-3 whitespace-pre-wrap rounded-2xl border border-[#c9a96e]/40 bg-white p-4 text-sm text-[#191970] dark:bg-slate-900 dark:text-slate-200';

export function WhatsNewPage({ onSeen }) {
  const [updates, setUpdates] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getPartnerUpdates().then(result => { setUpdates(result.updates); if (onSeen) onSeen(); }).catch(err => setError(err.message));
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <PageHeader title="What's new" subtitle="New in Ndovera, and how to explain it to a school." />
      <Notice error={error} />
      {!updates && !error ? <p className={BODY}>Loading…</p> : null}
      {updates && !updates.length ? <EmptyState>No updates yet. New features will appear here.</EmptyState> : null}
      {(updates || []).map(item => (
        <article key={item.id} className={CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">{item.title}</h2>
            {item.isNew ? <span className={TAG}>New</span> : null}
          </div>
          <p className={MUTED}>{new Date(item.publishedAt).toLocaleDateString()}</p>
          <p className={`mt-2 whitespace-pre-wrap ${BODY}`}>{item.body}</p>
          {item.explain ? (
            <div className="mt-3">
              <p className={LABEL}>How to explain it to a school</p>
              <p className={`mt-1 whitespace-pre-wrap ${BODY}`}>{item.explain}</p>
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}

export const fillMessage = (body, { link, setupFee, perUser, code }) => String(body)
  .split('{link}').join(link || '')
  .split('{setupFee}').join(naira.format(setupFee || 0))
  .split('{perUser}').join(naira.format(perUser || 0))
  .split('{code}').join(code || '');

export function ToolkitMessages({ link, setupFee, perUser, code }) {
  const [messages, setMessages] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { getPartnerToolkitMessages().then(result => setMessages(result.messages)).catch(err => setNotice(err.message)); }, []);
  const copy = text => { if (navigator.clipboard) navigator.clipboard.writeText(text); setNotice('Copied to clipboard.'); };
  return (
    <section className={CARD} aria-label="Ready-to-send messages">
      <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Ready-to-send messages</h2>
      <p className={`mt-1 ${MUTED}`}>Each one already carries your link and your prices, so nothing is quoted wrongly.</p>
      <Notice notice={notice} />
      {!messages && !notice ? <p className={`mt-3 ${BODY}`}>Loading…</p> : null}
      {(messages || []).map(item => {
        const text = fillMessage(item.body, { link, setupFee, perUser, code });
        return (
          <div key={item.title} className="mt-5">
            <h3 className="text-sm font-black text-[#800020] dark:text-slate-100">{item.title}</h3>
            <pre className={PITCH}>{text}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(text)} className={BTN_PRIMARY}>Copy message</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>Send on WhatsApp</a>
            </div>
          </div>
        );
      })}
    </section>
  );
}

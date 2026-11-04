import React, { useEffect, useState } from 'react';
import { getPortalLink } from '../services/schoolApi';

// For a school with its own website: copy one link or one button, and its website opens the school's Ndovera portal.

const CARD = 'space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-white p-5 text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const BUTTON = 'rounded-xl bg-[#191970] px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-[#191970]';

export const portalButtonCode = url => `<a href="${url}" style="display:inline-block;padding:12px 24px;background:#191970;color:#ffffff;border-radius:10px;font-weight:700;font-family:Arial,sans-serif;text-decoration:none;">Student &amp; Parent Portal</a>`;

export default function PortalLinkPage() {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { getPortalLink().then(result => setUrl(result.url)).catch(err => setMessage(err.message)); }, []);
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => setMessage(`${what} copied.`)).catch(() => setMessage('Select it above and copy it.'));
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Use Ndovera with your own website</h1>
        <p className="text-sm">Keep your website as it is. Add one link to it, and students, parents and staff sign in to your school's portal from there.</p>
      </section>
      {message ? <p role="status" className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100">{message}</p> : null}
      {url ? (
        <>
          <section className={CARD} aria-label="Your portal link">
            <h2 className="font-black">The easy way: a link</h2>
            <p className="text-sm">Send this to whoever looks after your website, and ask them to add it to the menu as "Portal".</p>
            <input readOnly aria-label="Portal link" className={FIELD} value={url} />
            <button type="button" className={BUTTON} onClick={() => copy(url, 'Link')}>Copy link</button>
          </section>
          <section className={CARD} aria-label="A ready-made button">
            <h2 className="font-black">Or a ready-made button</h2>
            <p className="text-sm">Paste this into any page of your website. In WordPress or Wix, use a "Custom HTML" block.</p>
            <textarea readOnly aria-label="Button code" rows={4} className={FIELD} value={portalButtonCode(url)} />
            <button type="button" className={BUTTON} onClick={() => copy(portalButtonCode(url), 'Button code')}>Copy button</button>
          </section>
        </>
      ) : null}
    </div>
  );
}

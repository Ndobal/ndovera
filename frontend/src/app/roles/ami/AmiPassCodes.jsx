import React, { useCallback, useEffect, useState } from 'react';
import { getCodeBatch, getCodeBatches, makeCodes, stopCodes } from '../../../features/showcase/showcaseApi';
import { askConfirm } from '../../../shared/components/AppDialog';

// Free practice passes by one-time codes: each code gives one student one pass, until the
// date and time set here.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'font-black text-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const LABEL = 'block text-xs font-bold text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';

const when = value => (value ? new Date(value).toLocaleString() : '');
const iso = value => (value ? new Date(value).toISOString() : '');

function downloadCodes(batch) {
  const rows = ['code,pass,stops_working,used', ...batch.codes.map(item => [item.code, batch.bundleLabel, batch.expiresAt, item.usedAt].join(','))];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  link.download = `practice-codes-${batch.createdAt.slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AmiPassCodes() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ label: '', bundle: 'all', count: 10, expiresAt: '', passEndsAt: '' });
  const [fresh, setFresh] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getCodeBatches().then(setData).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  const make = async event => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const { batch } = await makeCodes({ ...form, count: Number(form.count), expiresAt: iso(form.expiresAt), passEndsAt: iso(form.passEndsAt) });
      setFresh(batch);
      await load();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const open = id => getCodeBatch(id).then(result => setFresh({ ...result.batch, codes: result.batch.codes.map(item => item.code), rows: result.batch.codes })).catch(error => setNotice(error.message));
  const download = id => getCodeBatch(id).then(result => downloadCodes(result.batch)).catch(error => setNotice(error.message));
  const stop = async batch => {
    if (!await askConfirm(`Stop all unused codes in "${batch.label || batch.bundleLabel}"? Passes already given stay.`)) return;
    stopCodes(batch.id).then(load).catch(error => setNotice(error.message));
  };

  return (
    <div className="space-y-5">
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      <form onSubmit={make} className={`${CARD} space-y-3`} aria-label="Make codes">
        <h2 className={`text-lg ${HEADING}`}>Make free pass codes</h2>
        <p className={BODY}>A pass with a choice (a subject, or JAMB's three subjects) lets the student choose when they use the code.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>Name, for your records<input className={FIELD} value={form.label} onChange={set('label')} /></label>
          <label className={LABEL}>Pass
            <select className={FIELD} value={form.bundle} onChange={set('bundle')}>{(data?.bundles || []).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          </label>
          <label className={LABEL}>How many codes (up to 500)<input type="number" min="1" max="500" className={FIELD} value={form.count} onChange={set('count')} /></label>
          <label className={LABEL}>Codes stop working at<input type="datetime-local" required className={FIELD} value={form.expiresAt} onChange={set('expiresAt')} /></label>
          <label className={LABEL}>Pass ends at (optional)<input type="datetime-local" className={FIELD} value={form.passEndsAt} onChange={set('passEndsAt')} /></label>
        </div>
        <p className={BODY}>Leave "Pass ends at" empty for the normal length: the term, or a year for an exam pass. Times are in this device's time zone.</p>
        <button type="submit" disabled={busy} className={PRIMARY}>{busy ? 'Making…' : 'Make codes'}</button>
      </form>
      {fresh ? (
        <section className={`${CARD} space-y-2`} aria-label="Codes">
          <h3 className={HEADING}>{fresh.label || fresh.bundleLabel || fresh.bundle}: {fresh.codes.length} codes</h3>
          <p className={BODY}>They stop working at {when(fresh.expiresAt)}.</p>
          <textarea readOnly aria-label="The codes" rows={6} className={`${FIELD} font-mono`} value={fresh.codes.join('\n')} />
        </section>
      ) : null}
      <section className={`${CARD} space-y-2`} aria-label="Code batches">
        <h3 className={HEADING}>Codes made</h3>
        {!data ? <p role="status" className={BODY}>Loading…</p> : data.batches.length ? (
          <ul className="space-y-2">
            {data.batches.map(batch => (
              <li key={batch.id} className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{batch.label || batch.bundleLabel} · {batch.bundleLabel}</p>
                <p className="text-xs text-slate-700 dark:text-slate-300">{batch.used} of {batch.total} used · {batch.cancelledAt ? 'stopped' : `until ${when(batch.expiresAt)}`}{batch.passEndsAt ? ` · pass ends ${when(batch.passEndsAt)}` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={SECONDARY} onClick={() => open(batch.id)}>Show codes</button>
                  <button type="button" className={SECONDARY} onClick={() => download(batch.id)}>Download</button>
                  {batch.cancelledAt ? null : <button type="button" className={SECONDARY} onClick={() => stop(batch)}>Stop unused codes</button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No codes yet.</p>}
      </section>
    </div>
  );
}

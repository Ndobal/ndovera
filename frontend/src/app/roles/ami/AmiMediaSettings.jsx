import React, { useCallback, useEffect, useState } from 'react';
import { getAmiMediaLimits, saveAmiMediaLimits, startYouTubeConnect } from '../../../features/public/services/publicSiteApi';

const PANEL = 'rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'w-full rounded-2xl border border-[#c9a96e]/40 bg-white px-4 py-2.5 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100';
const LABEL = 'text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-slate-400';

const SCHOOL_FIELDS = [
  { key: 'schoolMaxVideoMb', label: 'Video size (MB)', hint: 'Largest single video a school may upload.' },
  { key: 'schoolMaxImageMb', label: 'Image size (MB)', hint: 'Largest single image a school may upload.' },
  { key: 'schoolMaxVideosPerTenant', label: 'Videos per school', hint: 'How many videos a school may keep at once.' },
  { key: 'schoolMaxStorageMb', label: 'Storage per school (MB)', hint: 'Total R2 allowance across all their media.' },
];

const AMI_FIELDS = [
  { key: 'amiMaxVideoMb', label: 'Video size (MB)', hint: 'Largest video NDOVERA uploads to YouTube.' },
  { key: 'amiMaxVideosPerDay', label: 'Uploads per day', hint: 'YouTube allows about six a day before its quota runs out.' },
];

export default function AmiMediaSettings() {
  const [state, setState] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getAmiMediaLimits();
      setState(data);
      setForm(data.limits || {});
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Could not load media settings.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy('save'); setMessage(''); setError('');
    try {
      await saveAmiMediaLimits(form);
      setMessage('Media limits saved. They apply to the next upload.');
      await load();
    } catch (saveError) {
      setError(saveError?.message || 'Could not save media limits.');
    } finally {
      setBusy('');
    }
  }

  async function connectYouTube() {
    setBusy('connect'); setMessage(''); setError('');
    try {
      const result = await startYouTubeConnect();
      // Google's consent screen has to open in a real window, so hand off rather than fetch.
      window.location.href = result.authUrl;
    } catch (connectError) {
      setError(connectError?.message || 'Could not start the YouTube connection.');
      setBusy('');
    }
  }

  if (!state && !error) return <section className={PANEL}><p className="text-sm text-[#191970] dark:text-slate-300">Loading media settings...</p></section>;

  const youtube = state?.youtube || {};

  return (
    <div className="space-y-4">
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-[#800000] dark:text-slate-100">Central YouTube channel</p>
            <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
              NDOVERA videos upload here as unlisted. Schools never touch this connection — their media goes to NDOVERA storage instead.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            youtube.connected ? 'bg-[#1a5c38] text-[#b5e3f4]' : 'bg-[#800020] text-[#b5e3f4]'
          }`}>
            {youtube.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {youtube.connected ? (
          <p className="mt-3 text-sm text-[#191970] dark:text-slate-300">
            {youtube.channelTitle ? <>Channel: <strong>{youtube.channelTitle}</strong>. </> : null}
            {typeof state?.uploadedToday === 'number' ? `${state.uploadedToday} of ${form.amiMaxVideosPerDay || 0} uploads used in the last 24 hours.` : null}
          </p>
        ) : null}

        {!youtube.credentialsSet ? (
          <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-bold">Google credentials are not set yet.</p>
            <p className="mt-2">Set them on the API, then reload this page:</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black/70 p-3 text-xs text-emerald-200">npx wrangler secret put YOUTUBE_CLIENT_ID
npx wrangler secret put YOUTUBE_CLIENT_SECRET</pre>
            <p className="mt-2">Redirect URI to register in Google Cloud:</p>
            <code className="mt-1 block break-all rounded-lg bg-black/70 p-2 text-xs text-emerald-200">{youtube.redirectUri}</code>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={connectYouTube}
              disabled={busy === 'connect'}
              className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-60"
            >
              {busy === 'connect' ? 'Opening Google...' : youtube.connected ? 'Reconnect channel' : 'Connect YouTube'}
            </button>
            <p className="text-xs text-[#191970] dark:text-slate-400">
              Sign in with the Google account that owns the NDOVERA channel.
            </p>
          </div>
        )}
      </section>

      {message ? <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error}</div> : null}

      <form onSubmit={save} className={PANEL}>
        <p className="text-lg font-bold text-[#800000] dark:text-slate-100">Upload limits</p>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
          These apply immediately to every new upload. Existing media is not affected.
        </p>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#800020] dark:text-slate-400">Schools — NDOVERA storage</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SCHOOL_FIELDS.map(field => (
            <label key={field.key} className="block space-y-1">
              <span className={LABEL}>{field.label}</span>
              <input
                type="number" min="1" className={INPUT}
                value={form[field.key] ?? ''}
                onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
              />
              <span className="block text-xs text-[#4a5578] dark:text-slate-400">{field.hint}</span>
            </label>
          ))}
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#800020] dark:text-slate-400">NDOVERA — YouTube</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {AMI_FIELDS.map(field => (
            <label key={field.key} className="block space-y-1">
              <span className={LABEL}>{field.label}</span>
              <input
                type="number" min="1" className={INPUT}
                value={form[field.key] ?? ''}
                onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
              />
              <span className="block text-xs text-[#4a5578] dark:text-slate-400">{field.hint}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={busy === 'save'} className="mt-5 rounded-2xl bg-[#1a5c38] px-6 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
          {busy === 'save' ? 'Saving...' : 'Save limits'}
        </button>
      </form>
    </div>
  );
}

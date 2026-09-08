import React, { useEffect, useState } from 'react';
import { getSchoolLocation, saveSchoolLocation } from '../services/schoolApi';

const INPUT = 'mt-1 w-full rounded-2xl border border-[#c9a96e]/40 bg-white px-4 py-2.5 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38]/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-slate-400';

const FIELDS = [
  { key: 'country', label: 'Country', placeholder: 'Nigeria' },
  { key: 'state', label: 'State / Province / Region', placeholder: 'e.g. Enugu' },
  { key: 'localGovernmentArea', label: 'Local government area (or equivalent)', placeholder: 'e.g. Nsukka' },
  { key: 'city', label: 'City / Town', placeholder: 'e.g. Nsukka' },
  { key: 'addressLine', label: 'Street address', placeholder: 'e.g. 12 School Road' },
];

export default function SchoolLocationForm() {
  const [form, setForm] = useState({ country: '', state: '', localGovernmentArea: '', city: '', addressLine: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getSchoolLocation()
      .then(result => setForm(current => ({ ...current, ...(result?.location || {}) })))
      .catch(() => {});
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setNotice(''); setError('');
    try {
      await saveSchoolLocation(form);
      setNotice('School location saved.');
    } catch (e) {
      setError(e.message || 'Could not save the school location.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#800000] dark:text-slate-100">School location</h2>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
          Used on your public website and to match the growth partner representative covering your area.
          Leave blank if you would rather not publish an exact address — state and local government are the ones that matter for coverage.
        </p>
      </div>

      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-2.5 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-2.5 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(field => (
          <label key={field.key} className={field.key === 'addressLine' ? 'block sm:col-span-2' : 'block'}>
            <span className={LABEL}>{field.label}</span>
            <input
              className={INPUT}
              value={form[field.key] || ''}
              onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>

      <button type="submit" disabled={busy} className="rounded-2xl bg-[#1a5c38] px-6 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">
        {busy ? 'Saving…' : 'Save location'}
      </button>
    </form>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { getPlatformAnalytics } from '../services/tenantApi';

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className={`text-2xl font-black ${accent || 'text-white'}`}>{Number(value || 0).toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">{label}</p>
    </div>
  );
}

export default function AmiPlatformAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    getPlatformAnalytics()
      .then(res => { if (active) setData(res); })
      .catch(err => { if (active) setError(err.message || 'Could not load platform analytics.'); });
    return () => { active = false; };
  }, []);

  const totals = data?.totals || {};
  const schools = useMemo(() => {
    const list = data?.schools || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => `${s.schoolName || ''} ${s.ownerEmail || ''}`.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <section className="glass-surface rounded-3xl border border-white/10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">Platform Overview</p>
          <h2 className="mt-1 text-xl font-black text-white">Schools at a glance</h2>
          <p className="text-sm text-white/55">Counts only — no school's personal data is shown here.</p>
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search schools…" className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40" />
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Schools" value={totals.schools} />
        <Stat label="Active schools" value={totals.activeSchools} accent="text-emerald-300" />
        <Stat label="Active staff" value={totals.staffActive} accent="text-emerald-300" />
        <Stat label="Inactive staff" value={totals.staffInactive} accent="text-amber-300" />
        <Stat label="Active students" value={totals.studentsActive} accent="text-emerald-300" />
        <Stat label="Inactive students" value={totals.studentsInactive} accent="text-amber-300" />
      </div>

      <div className="mt-5 overflow-x-auto">
        {!data ? <p className="text-sm text-white/55">Loading…</p> : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-white/50">
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2 text-center">Active staff</th>
                <th className="px-3 py-2 text-center">Inactive staff</th>
                <th className="px-3 py-2 text-center">Active students</th>
                <th className="px-3 py-2 text-center">Inactive students</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(s => (
                <tr key={s.tenantId} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-white">{s.schoolName || 'School'}</p>
                    <p className="text-xs text-white/45">{s.ownerEmail || ''}</p>
                  </td>
                  <td className="px-3 py-2 text-center text-emerald-300">{s.staffActive}</td>
                  <td className="px-3 py-2 text-center text-amber-300">{s.staffInactive}</td>
                  <td className="px-3 py-2 text-center text-emerald-300">{s.studentsActive}</td>
                  <td className="px-3 py-2 text-center text-amber-300">{s.studentsInactive}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/60'}`}>{s.status || '—'}</span>
                  </td>
                </tr>
              ))}
              {!schools.length ? <tr><td colSpan={6} className="px-3 py-6 text-center text-white/50">No schools match your search.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

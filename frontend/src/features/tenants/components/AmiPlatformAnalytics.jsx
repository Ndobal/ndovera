import React, { useEffect, useMemo, useState } from 'react';
import {
  getPlatformAnalytics,
  getSchoolAccessGrants,
  requestSchoolAccess,
  openSchoolAccess,
  revokeSchoolAccessGrant,
} from '../services/tenantApi';
import { getStoredAuth, persistAuth } from '../../auth/services/authApi';

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
  const [grants, setGrants] = useState([]);
  const [busy, setBusy] = useState('');

  async function loadGrants() {
    try { const g = await getSchoolAccessGrants(); setGrants(g.grants || []); } catch { /* ignore */ }
  }

  useEffect(() => {
    let active = true;
    getPlatformAnalytics()
      .then(res => { if (active) setData(res); })
      .catch(err => { if (active) setError(err.message || 'Could not load platform analytics.'); });
    loadGrants();
    const t = setInterval(loadGrants, 15000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const grantByTenant = useMemo(() => {
    const map = {};
    for (const g of grants) {
      const cur = map[g.tenantId];
      // prefer an active/pending grant over older ones
      if (!cur || g.active || (g.status === 'pending' && cur.status !== 'pending')) map[g.tenantId] = g;
    }
    return map;
  }, [grants]);

  async function requestAccess(tenantId) {
    const reason = window.prompt('Reason for managing this school (the owner will see this):', 'Troubleshooting a reported issue');
    if (reason == null) return;
    setBusy(tenantId);
    try { await requestSchoolAccess(tenantId, reason); await loadGrants(); } catch (e) { setError(e.message || 'Could not request access.'); } finally { setBusy(''); }
  }

  async function openSchool(grant) {
    setBusy(grant.tenantId);
    try {
      const res = await openSchoolAccess(grant.id);
      const current = getStoredAuth();
      if (current?.token) window.localStorage.setItem('ami_return_token', current.token);
      persistAuth({ token: res.token, user: { role: 'owner', name: res.name, tenantId: res.tenantId } }, {});
      window.location.href = '/roles/owner';
    } catch (e) {
      setError(e.message || 'Could not open the school.');
      setBusy('');
    }
  }

  async function deactivate(grant) {
    setBusy(grant.tenantId);
    try { await revokeSchoolAccessGrant(grant.id); await loadGrants(); } catch (e) { setError(e.message || 'Could not deactivate.'); } finally { setBusy(''); }
  }

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
                <th className="px-3 py-2 text-center">Manage</th>
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
                  <td className="px-3 py-2 text-center">
                    {(() => {
                      const g = grantByTenant[s.tenantId];
                      if (g && g.active) {
                        return (
                          <div className="flex justify-center gap-1.5">
                            <button type="button" disabled={busy === s.tenantId} onClick={() => openSchool(g)} className="rounded-lg bg-[#1a5c38] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">Open</button>
                            <button type="button" disabled={busy === s.tenantId} onClick={() => deactivate(g)} className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-semibold text-white/70 disabled:opacity-50">Off</button>
                          </div>
                        );
                      }
                      if (g && g.status === 'pending') return <span className="text-xs text-amber-300">Awaiting owner</span>;
                      return <button type="button" disabled={busy === s.tenantId} onClick={() => requestAccess(s.tenantId)} className="rounded-lg border border-emerald-400/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 disabled:opacity-50">Request</button>;
                    })()}
                  </td>
                </tr>
              ))}
              {!schools.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-white/50">No schools match your search.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

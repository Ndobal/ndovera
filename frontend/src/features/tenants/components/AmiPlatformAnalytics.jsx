import React, { useEffect, useMemo, useState } from 'react';
import {
  getPlatformAnalytics,
  getSchoolAccessGrants,
  requestSchoolAccess,
  openSchoolAccess,
  revokeSchoolAccessGrant,
  completeSchoolAccess,
} from '../services/tenantApi';
import { getStoredAuth, persistAuth } from '../../auth/services/authApi';
import { askConfirm, askText } from '../../../shared/components/AppDialog';
import { FIELD, Panel, Pill, TD, TH } from '../../ami/AmiUi';

// Counts on the command-centre canvas: dark text on white cards in light mode, white on slate in dark.
function Stat({ label, value, tone = 'text-[#0b1f3a] dark:text-white' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{Number(value || 0).toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</p>
    </div>
  );
}

const GOOD = 'text-emerald-700 dark:text-emerald-300';
const WARN = 'text-amber-800 dark:text-amber-300';

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
    const reason = await askText('What do you need to do in this school? The owner sees this.', 'Set up classes and import students');
    if (reason == null || !reason.trim()) return;
    const hoursText = await askText('How many hours do you need? (1–168; the owner can change it)', '24');
    if (hoursText == null) return;
    const hours = Math.max(1, Math.min(168, Math.round(Number(hoursText) || 24)));
    setBusy(tenantId);
    try { await requestSchoolAccess(tenantId, reason.trim(), hours); await loadGrants(); } catch (e) { setError(e.message || 'Could not request access.'); } finally { setBusy(''); }
  }

  async function openSchool(grant) {
    setBusy(grant.tenantId);
    try {
      const res = await openSchoolAccess(grant.id);
      const current = getStoredAuth();
      if (current?.token) window.localStorage.setItem('ami_return_token', current.token);
      // The support session's grant and end time, for the banner (time left, task done, auto-return).
      window.localStorage.setItem('ami_support_grant', JSON.stringify({ id: grant.id, until: res.grantExpiresAt || res.expiresAt, school: grant.tenantId }));
      persistAuth({ token: res.token, user: { role: 'owner', name: res.name, tenantId: res.tenantId } }, {});
      window.location.href = '/roles/owner';
    } catch (e) {
      setError(e.message || 'Could not open the school.');
      setBusy('');
    }
  }

  async function complete(grant) {
    if (!await askConfirm('Mark this task done? Access to the school ends now; a new request is needed to continue.')) return;
    setBusy(grant.tenantId);
    try { await completeSchoolAccess(grant.id); await loadGrants(); } catch (e) { setError(e.message || 'Could not finish.'); } finally { setBusy(''); }
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
    <Panel
      title="Platform overview · schools at a glance"
      actions={<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search schools…" aria-label="Search schools" className={`${FIELD} w-56`} />}
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">Counts only — no school's personal data is shown here.</p>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Schools" value={totals.schools} />
        <Stat label="Active schools" value={totals.activeSchools} tone={GOOD} />
        <Stat label="Active staff" value={totals.staffActive} tone={GOOD} />
        <Stat label="Inactive staff" value={totals.staffInactive} tone={WARN} />
        <Stat label="Active students" value={totals.studentsActive} tone={GOOD} />
        <Stat label="Inactive students" value={totals.studentsInactive} tone={WARN} />
      </div>

      <div className="mt-5 overflow-x-auto">
        {!data ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading…</p> : (
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className={TH}>School</th>
                <th className={`${TH} text-center`}>Active staff</th>
                <th className={`${TH} text-center`}>Inactive staff</th>
                <th className={`${TH} text-center`}>Active students</th>
                <th className={`${TH} text-center`}>Inactive students</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-center`}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(s => (
                <tr key={s.tenantId} className="border-t border-slate-100 dark:border-white/5">
                  <td className={TD}>
                    <p className="font-semibold text-[#0b1f3a] dark:text-white">{s.schoolName || 'School'}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{s.ownerEmail || ''}</p>
                  </td>
                  <td className={`${TD} text-center font-bold tabular-nums ${GOOD}`}>{s.staffActive}</td>
                  <td className={`${TD} text-center font-bold tabular-nums ${WARN}`}>{s.staffInactive}</td>
                  <td className={`${TD} text-center font-bold tabular-nums ${GOOD}`}>{s.studentsActive}</td>
                  <td className={`${TD} text-center font-bold tabular-nums ${WARN}`}>{s.studentsInactive}</td>
                  <td className={`${TD} text-center`}>{s.status === 'active' ? <Pill tone="good">Active</Pill> : <Pill tone="info">{s.status || '—'}</Pill>}</td>
                  <td className={`${TD} text-center`}>
                    {(() => {
                      const g = grantByTenant[s.tenantId];
                      if (g && g.active) {
                        return (
                          <div className="flex justify-center gap-1.5">
                            <button type="button" disabled={busy === s.tenantId} onClick={() => openSchool(g)} className="rounded-lg bg-[#1a5c38] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50" title={g.expiresAt ? `Until ${new Date(g.expiresAt).toLocaleString()}` : ''}>Open</button>
                            <button type="button" disabled={busy === s.tenantId} onClick={() => complete(g)} className="rounded-lg bg-[#191970] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">Task done</button>
                            <button type="button" disabled={busy === s.tenantId} onClick={() => deactivate(g)} className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-800 disabled:opacity-50 dark:border-rose-400/40 dark:bg-slate-800 dark:text-rose-200">End</button>
                          </div>
                        );
                      }
                      if (g && g.status === 'pending') return <Pill tone="warn">Awaiting owner ({g.requestedHours}h asked)</Pill>;
                      return <button type="button" disabled={busy === s.tenantId} onClick={() => requestAccess(s.tenantId)} className="rounded-lg bg-[#1a5c38] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">Request access</button>;
                    })()}
                  </td>
                </tr>
              ))}
              {!schools.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-600 dark:text-slate-300">No schools match your search.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

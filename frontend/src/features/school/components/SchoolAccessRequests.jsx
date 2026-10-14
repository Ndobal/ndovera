import React, { useEffect, useState } from 'react';
import { getSchoolAccessRequests, decideSchoolAccessRequest, revokeSchoolAccessRequest } from '../services/schoolApi';

// Owner-facing panel: approve/deny/revoke NDOVERA support's requests to manage the school.
export default function SchoolAccessRequests() {
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState('');
  // How long to allow each pending request (starts at what support asked for).
  const [hours, setHours] = useState({});

  async function load() {
    try { const d = await getSchoolAccessRequests(); setRequests(d.requests || []); } catch { /* ignore */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  async function act(id, fn) {
    setBusy(id);
    try { await fn(); await load(); } catch { /* ignore */ } finally { setBusy(''); }
  }

  const visible = requests.filter(r => r.status === 'pending' || r.active);
  if (!visible.length) return null;

  return (
    <section className="rounded-3xl border border-amber-400/40 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-amber-950/30">
      <p className="text-sm font-black text-amber-800 dark:text-amber-200">NDOVERA support access requests</p>
      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/70">Approve only if you asked for help. Support then has full access to your school as its owner for the hours you choose. It ends when the time is up, when support marks the task done, or when you deactivate it — and every step is in the audit trail. To continue after that, support must ask again.</p>
      <div className="mt-3 space-y-2">
        {visible.map(r => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/40 bg-white/70 p-3 dark:bg-slate-900/40">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#14215b] dark:text-slate-100">{r.requesterName} requests access {r.active ? '(active)' : `(pending · ${r.requestedHours}h asked)`}</p>
              {r.reason ? <p className="text-xs text-[#4a5578] dark:text-slate-400">Reason: {r.reason}</p> : null}
              {r.active && r.expiresAt ? <p className="text-xs text-emerald-600">Active until {new Date(r.expiresAt).toLocaleString()}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              {r.status === 'pending' ? (
                <>
                  <select aria-label="How long" value={hours[r.id] || r.requestedHours || 24} onChange={event => setHours(current => ({ ...current, [r.id]: Number(event.target.value) }))} className="rounded-xl border border-amber-300 bg-white px-2 py-2 text-xs text-[#14215b]">
                    {[...new Set([1, 2, 4, 8, 24, 48, 72, 168, r.requestedHours || 24])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value < 24 ? `${value} hour${value === 1 ? '' : 's'}` : `${value / 24} day${value === 24 ? '' : 's'}`}</option>)}
                  </select>
                  <button type="button" disabled={busy === r.id} onClick={() => act(r.id, () => decideSchoolAccessRequest(r.id, 'approve', hours[r.id] || r.requestedHours || 24))} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busy === r.id} onClick={() => act(r.id, () => decideSchoolAccessRequest(r.id, 'deny'))} className="rounded-xl border border-[#800020]/40 px-4 py-2 text-xs font-semibold text-[#800020] disabled:opacity-50">Deny</button>
                </>
              ) : (
                <button type="button" disabled={busy === r.id} onClick={() => act(r.id, () => revokeSchoolAccessRequest(r.id))} className="rounded-xl bg-[#800020] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Deactivate</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

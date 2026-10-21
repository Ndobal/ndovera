import React, { useCallback, useEffect, useState } from 'react';
import { addShareholder, listShareholders, setShareholderActive } from '../tenants/services/tenantApi';
import { askConfirm } from '../../shared/components/AppDialog';
import { AmiPage, FIELD, Panel, Pill, PRIMARY, SECONDARY, TD, TH, shortDate } from './AmiUi';

// Shareholders sign in to read Ndovera's finances. They cannot send reminders, record
// payments or see inside schools. Ami adds them and can turn their access off.
export default function AmiShareholdersPage() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => listShareholders().then(result => setRows(result.shareholders || [])).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  async function add(event) {
    event.preventDefault();
    setBusy(true); setError(''); setIssued(null);
    try {
      const result = await addShareholder(form);
      setIssued({ ...result, name: form.name });
      setForm({ name: '', email: '' });
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function toggle(row) {
    const active = row.status !== 'active';
    if (!active && !(await askConfirm(`Turn off ${row.name}'s access? They will no longer be able to sign in to the finance view.`))) return;
    try { await setShareholderActive(row.email, active); load(); } catch (err) { setError(err.message); }
  }

  const signInUrl = `${window.location.origin}/login`;
  const message = issued?.temporaryPassword ? `Hello ${issued.name}, you now have read-only access to Ndovera's finances. Sign in at ${signInUrl} with ${issued.email} and the temporary password ${issued.temporaryPassword}. You will be asked to choose your own password.` : '';

  return (
    <AmiPage title="Shareholders" subtitle="Read-only access to Ndovera's finances: payments, balances, money out." crumbs={['Money', 'Shareholders']}>
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Add a shareholder">
          <form onSubmit={add} className="space-y-3">
            <label className="block text-xs font-bold uppercase text-slate-500">Full name<input className={FIELD} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label className="block text-xs font-bold uppercase text-slate-500">Email<input type="email" className={FIELD} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></label>
            <button type="submit" className={`${PRIMARY} w-full justify-center`} disabled={busy || !form.name.trim() || !form.email.trim()}>{busy ? 'Adding…' : 'Add shareholder'}</button>
            <p className="text-xs text-slate-500">They sign in with a temporary password and must choose their own. They see the Finance page only.</p>
          </form>
          {issued ? (
            <div className="mt-4 rounded-lg border border-[#c9a96e] bg-[#fff8ef] p-3 text-sm text-[#0b1f3a]">
              {issued.temporaryPassword ? (
                <>
                  <p className="font-bold">Temporary password for {issued.email}</p>
                  <p className="my-1 select-all rounded bg-white px-2 py-1 font-mono text-base">{issued.temporaryPassword}</p>
                  <p className="text-xs">Shown once. Send it privately:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a className={SECONDARY} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Share by WhatsApp</a>
                    <a className={SECONDARY} href={`mailto:${issued.email}?subject=${encodeURIComponent('Your Ndovera shareholder access')}&body=${encodeURIComponent(message)}`}>Send by email</a>
                  </div>
                </>
              ) : <p>{issued.email} already has their own password; access is turned on.</p>}
            </div>
          ) : null}
        </Panel>
        <Panel title="Shareholders" className="lg:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>Name</th><th className={TH}>Email</th><th className={TH}>Added</th><th className={TH}>Access</th><th className={TH}><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {(rows || []).map(row => (
                  <tr key={row.email} className="border-t border-slate-100 dark:border-white/5">
                    <td className={`${TD} font-semibold`}>{row.name}</td>
                    <td className={TD}>{row.email}</td>
                    <td className={TD}>{shortDate(row.createdAt)}</td>
                    <td className={TD}>{row.status === 'active' ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Off</Pill>}</td>
                    <td className={TD}><button type="button" className="text-xs font-bold text-[#191970] underline dark:text-indigo-200" onClick={() => toggle(row)}>{row.status === 'active' ? 'Turn off' : 'Turn on'}</button></td>
                  </tr>
                ))}
                {rows && !rows.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No shareholders yet.</td></tr> : null}
                {!rows ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AmiPage>
  );
}

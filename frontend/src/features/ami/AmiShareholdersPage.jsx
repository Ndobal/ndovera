import React, { useCallback, useEffect, useState } from 'react';
import { BanknotesIcon, ChartPieIcon, ReceiptPercentIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  addShareholder, declareProfitShare, getPlatformShares, listShareholders, payShareholderLine, recordShareEvent,
  saveSharePolicy, setShareholderActive, voidProfitShare, voidShareEvent,
} from '../tenants/services/tenantApi';
import { askConfirm, askText } from '../../shared/components/AppDialog';
import { AmiPage, FIELD, Panel, Pill, PRIMARY, SECONDARY, StatCard, TD, TH, monthLabel, naira, shortDate } from './AmiUi';

// Ndovera's shareholders: the share register (shares, capital paid, who holds what), the
// profit-sharing formula, profit shared from the profit and loss, what is due to each
// shareholder and what has been paid. Ami manages; shareholders read (`readOnly`).

const TABS = [['register', 'Share register'], ['profit', 'Profit sharing & payouts'], ['access', 'Sign-in access']];
const monthName = month => (month ? `${monthLabel(month)} ${String(month).slice(0, 4)}` : '—');
const period = (from, to) => (from === to ? monthName(from) : `${monthName(from)} – ${monthName(to)}`);
const lastFinishedMonth = () => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7); };

function ShareEventForm({ holders, onSaved }) {
  const [form, setForm] = useState({ kind: 'issue', email: '', name: '', toEmail: '', toName: '', shares: '', capital: '', occurredOn: new Date().toISOString().slice(0, 10), note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await recordShareEvent({ ...form, shares: Number(form.shares), capital: Number(form.capital || 0) });
      setForm(current => ({ ...current, email: '', name: '', toEmail: '', toName: '', shares: '', capital: '', note: '' }));
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const existing = form.kind !== 'issue';
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <select aria-label="Action" className={FIELD} value={form.kind} onChange={set('kind')}>
        <option value="issue">Issue new shares</option>
        <option value="transfer">Transfer shares</option>
        <option value="redeem">Redeem (buy back) shares</option>
      </select>
      {existing ? (
        <select aria-label="From shareholder" className={FIELD} value={form.email} onChange={set('email')}>
          <option value="">{form.kind === 'transfer' ? 'From…' : 'Shareholder…'}</option>
          {holders.map(holder => <option key={holder.email} value={holder.email}>{holder.name} ({holder.shares.toLocaleString()} shares)</option>)}
        </select>
      ) : (
        <>
          <input aria-label="Shareholder name" className={FIELD} placeholder="Shareholder's full name" value={form.name} onChange={set('name')} />
          <input aria-label="Shareholder email" type="email" className={FIELD} placeholder="Shareholder's email" value={form.email} onChange={set('email')} />
        </>
      )}
      {form.kind === 'transfer' ? (
        <>
          <input aria-label="To name" className={FIELD} placeholder="To: full name" value={form.toName} onChange={set('toName')} />
          <input aria-label="To email" type="email" className={FIELD} placeholder="To: email" value={form.toEmail} onChange={set('toEmail')} />
        </>
      ) : null}
      <input aria-label="Number of shares" type="number" min="1" step="1" className={FIELD} placeholder="Number of shares" value={form.shares} onChange={set('shares')} />
      {form.kind === 'issue' ? <input aria-label="Capital paid" type="number" min="0" className={FIELD} placeholder="Capital paid for them (₦)" value={form.capital} onChange={set('capital')} /> : null}
      <input aria-label="Date" type="date" className={FIELD} value={form.occurredOn} onChange={set('occurredOn')} />
      <input aria-label="Note" className={FIELD} placeholder="Note (optional)" value={form.note} onChange={set('note')} />
      <button type="submit" className={PRIMARY} disabled={busy || !form.email.trim() || !(Number(form.shares) > 0)}>{busy ? 'Saving…' : 'Record'}</button>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300 sm:col-span-2 lg:col-span-4">{error}</p> : null}
    </form>
  );
}

function AccessPanel() {
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
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 lg:col-span-3">{error}</p> : null}
      <div>
        <p className="mb-2 text-sm font-bold text-[#0b1f3a] dark:text-white">Give a shareholder sign-in access</p>
        <form onSubmit={add} className="space-y-3">
          <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Full name<input className={FIELD} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Email<input type="email" className={FIELD} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></label>
          <button type="submit" className={`${PRIMARY} w-full justify-center`} disabled={busy || !form.name.trim() || !form.email.trim()}>{busy ? 'Adding…' : 'Give access'}</button>
          <p className="text-xs text-slate-600 dark:text-slate-300">They sign in with a temporary password and must choose their own. They read Finance, Profit &amp; Loss and the share register; they change nothing.</p>
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
      </div>
      <div className="overflow-x-auto lg:col-span-2">
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
            {rows && !rows.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No shareholder has sign-in access yet.</td></tr> : null}
            {!rows ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">Loading…</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AmiShareholdersPage({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('register');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [policy, setPolicy] = useState(null);
  const [declare, setDeclare] = useState({ fromMonth: '', toMonth: lastFinishedMonth(), note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getPlatformShares().then(next => {
    setData(next); setError('');
    setPolicy({ retentionPct: String(next.policy.retentionPct), frequency: next.policy.frequency });
    setDeclare(current => ({ ...current, fromMonth: current.fromMonth || next.projection?.fromMonth || lastFinishedMonth() }));
  }).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);
  const canManage = Boolean(data?.canManage) && !readOnly;
  const done = message => { setNotice(message); load(); };
  const run = async (action, message) => { setError(''); setNotice(''); try { await action(); done(message); } catch (err) { setError(err.message); } };

  const register = data?.register || { holders: [], totalShares: 0, totalCapital: 0, problems: [] };
  const dueNow = (data?.dues || []).reduce((sum, row) => sum + row.due, 0);
  const dueOf = email => (data?.dues || []).find(row => row.email === email) || { declared: 0, paid: 0, due: 0, projected: 0 };
  const retention = Number(policy?.retentionPct ?? data?.policy?.retentionPct ?? 0);

  async function pay(line, dividend) {
    const left = Math.round((line.amount - line.paid) * 100) / 100;
    const amount = await askText(`Amount paid to ${line.name} for ${period(dividend.fromMonth, dividend.toMonth)} (up to ${naira(left, 2)})`, String(left));
    if (amount == null) return;
    const reference = await askText('Transfer reference (bank, date or receipt number)', '');
    if (reference == null || !reference.trim()) return;
    run(() => payShareholderLine(line.id, { amount: Number(amount), reference: reference.trim() }), `Payment to ${line.name} recorded.`);
  }

  async function makeDeclaration(event) {
    event.preventDefault();
    if (!(await askConfirm(`Share the profit for ${period(declare.fromMonth, declare.toMonth)}? ${retention}% is kept in the business and the rest is split by shares as the register stands today.`))) return;
    setBusy(true);
    await run(() => declareProfitShare(declare), 'Profit shared. Each shareholder\'s amount is now due for payout.');
    setBusy(false);
  }

  return (
    <AmiPage
      title={readOnly ? 'Shares & payouts' : 'Shareholders'}
      subtitle={readOnly ? 'The share register, the profit-sharing formula, and what is due to you.' : 'Share capital, who holds what, the profit-sharing formula, and what is due to each shareholder.'}
      crumbs={['Money', readOnly ? 'Shares & payouts' : 'Shareholders']}
      actions={<button type="button" className={SECONDARY} onClick={load}>Refresh</button>}
    >
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading the register…</p> : null}

      {data ? (
        <>
          {readOnly && data.mine ? (
            <Panel title="Your position">
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                {[['Your shares', `${(register.holders.find(row => row.email === data.mine.email)?.shares || 0).toLocaleString()} (${register.holders.find(row => row.email === data.mine.email)?.pct || 0}%)`],
                  ['Shared to you so far', naira(data.mine.declared)], ['Paid to you', naira(data.mine.paid)], ['Due to you now', naira(data.mine.due)]].map(([label, value]) => (
                  <div key={label}><p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{label}</p><p className="text-xl font-black tabular-nums text-[#0b1f3a] dark:text-white">{value}</p></div>
                ))}
              </div>
              {data.mine.projected ? <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">If the profit since the last share-out were shared today, your part would be about {naira(data.mine.projected)}. It is not due until Ndovera declares it.</p> : null}
            </Panel>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={BanknotesIcon} tone="navy" label="Share capital paid" value={naira(register.totalCapital)} hint={`${register.holders.length} shareholder${register.holders.length === 1 ? '' : 's'}`} />
            <StatCard icon={ChartPieIcon} tone="green" label="Shares in issue" value={register.totalShares.toLocaleString()} hint={register.totalShares ? `₦${(register.totalCapital / register.totalShares).toLocaleString('en-NG', { maximumFractionDigits: 2 })} paid per share on average` : 'No shares recorded yet'} />
            <StatCard icon={ReceiptPercentIcon} tone="gold" label="Profit kept in the business" value={`${data.policy.retentionPct}%`} hint={`${100 - data.policy.retentionPct}% shared · ${data.policy.frequency}`} />
            <StatCard icon={UserGroupIcon} tone="maroon" label="Due to shareholders now" value={naira(dueNow)} hint={`about ${naira(data.projection.distributable)} more since the last share-out`} />
          </div>

          <Panel bodyClassName="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10" role="tablist">
              {TABS.filter(([key]) => key !== 'access' || canManage).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === key ? 'bg-[#191970] text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'}`}>{label}</button>
              ))}
            </div>

            {tab === 'register' ? (
              <div className="space-y-4 p-4">
                {register.problems.length ? <p role="alert" className="rounded-lg bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">Some entries were not applied: {register.problems.join('; ')}.</p> : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-slate-50 dark:bg-white/5"><tr>
                      <th className={TH}>Shareholder</th><th className={`${TH} text-right`}>Shares</th><th className={`${TH} text-right`}>Stake</th><th className={`${TH} text-right`}>Capital paid</th>
                      <th className={`${TH} text-right`}>Profit shared</th><th className={`${TH} text-right`}>Paid out</th><th className={`${TH} text-right`}>Due now</th><th className={`${TH} text-right`}>Since last share-out*</th>
                    </tr></thead>
                    <tbody>
                      {register.holders.map(holder => {
                        const due = dueOf(holder.email);
                        return (
                          <tr key={holder.email} className={`border-t border-slate-100 dark:border-white/5 ${data.mine?.email === holder.email ? 'bg-[#c9a96e]/10' : ''}`}>
                            <td className={TD}><p className="font-bold text-[#191970] dark:text-indigo-200">{holder.name}</p><p className="text-xs text-slate-600 dark:text-slate-300">{holder.email}</p></td>
                            <td className={`${TD} text-right tabular-nums`}>{holder.shares.toLocaleString()}</td>
                            <td className={`${TD} text-right font-bold tabular-nums`}>{holder.pct}%</td>
                            <td className={`${TD} text-right tabular-nums`}>{naira(holder.capital)}</td>
                            <td className={`${TD} text-right tabular-nums`}>{naira(due.declared)}</td>
                            <td className={`${TD} text-right tabular-nums`}>{naira(due.paid)}</td>
                            <td className={`${TD} text-right font-black tabular-nums ${due.due > 0 ? 'text-[#800000] dark:text-rose-300' : ''}`}>{naira(due.due)}</td>
                            <td className={`${TD} text-right tabular-nums text-slate-700 dark:text-slate-200`}>{naira(due.projected)}</td>
                          </tr>
                        );
                      })}
                      {!register.holders.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No shares recorded yet.{canManage ? ' Issue the founding shares below.' : ''}</td></tr> : null}
                    </tbody>
                    {register.holders.length ? (
                      <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black dark:border-white/20 dark:bg-white/5"><tr>
                        <td className={TD}>Total</td><td className={`${TD} text-right tabular-nums`}>{register.totalShares.toLocaleString()}</td><td className={`${TD} text-right`}>100%</td><td className={`${TD} text-right tabular-nums`}>{naira(register.totalCapital)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{naira((data.dues || []).reduce((sum, row) => sum + row.declared, 0))}</td><td className={`${TD} text-right tabular-nums`}>{naira((data.dues || []).reduce((sum, row) => sum + row.paid, 0))}</td>
                        <td className={`${TD} text-right tabular-nums`}>{naira(dueNow)}</td><td className={`${TD} text-right tabular-nums`}>{naira(data.projection.distributable)}</td>
                      </tr></tfoot>
                    ) : null}
                  </table>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">* What each holder's part would be if the profit since the last share-out ({data.projection.fromMonth ? period(data.projection.fromMonth, data.projection.toMonth) : 'none yet'}) were shared today. It becomes due only when Ndovera declares it.</p>

                {canManage ? (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <p className="mb-2 text-sm font-bold text-[#0b1f3a] dark:text-white">Issue, transfer or redeem shares</p>
                    <ShareEventForm holders={register.holders} onSaved={() => done('Recorded in the register.')} />
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-sm font-bold text-[#0b1f3a] dark:text-white">Register history</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>Date</th><th className={TH}>What</th><th className={`${TH} text-right`}>Shares</th><th className={`${TH} text-right`}>Capital</th><th className={TH}>Note</th><th className={TH}>Recorded by</th>{canManage ? <th className={TH}><span className="sr-only">Void</span></th> : null}</tr></thead>
                      <tbody>
                        {(data.events || []).map(event => (
                          <tr key={event.id} className="border-t border-slate-100 dark:border-white/5">
                            <td className={`${TD} whitespace-nowrap tabular-nums`}>{shortDate(event.occurredOn)}</td>
                            <td className={TD}>{event.kind === 'issue' ? `Issued to ${event.name}` : event.kind === 'transfer' ? `${event.name} → ${event.counterpartyName || event.counterpartyEmail}` : `Redeemed from ${event.name}`}</td>
                            <td className={`${TD} text-right tabular-nums`}>{event.shares.toLocaleString()}</td>
                            <td className={`${TD} text-right tabular-nums`}>{event.capital ? naira(event.capital) : '—'}</td>
                            <td className={`${TD} text-xs`}>{event.note}</td>
                            <td className={`${TD} text-xs`}>{event.recordedBy}</td>
                            {canManage ? <td className={TD}><button type="button" className="text-xs font-bold text-rose-700 underline dark:text-rose-300" onClick={async () => { if (await askConfirm('Void this entry? It stays in the history, marked void, and the register is recounted.')) run(() => voidShareEvent(event.id), 'Entry voided.'); }}>Void</button></td> : null}
                          </tr>
                        ))}
                        {!data.events?.length ? <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">Nothing recorded yet.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'profit' ? (
              <div className="space-y-4 p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <p className="text-sm font-bold text-[#0b1f3a] dark:text-white">The profit-sharing formula</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                      <li>Net profit for the period = income − spending, from the Profit &amp; Loss.</li>
                      <li>Ndovera keeps <b>{retention}%</b> of it in the business.</li>
                      <li>The other <b>{100 - retention}%</b> is shared: each shareholder gets it × their shares ÷ all {register.totalShares.toLocaleString()} shares.</li>
                      <li>A period that made a loss shares nothing. Each period is shared once.</li>
                    </ol>
                    {canManage && policy ? (
                      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); run(() => saveSharePolicy({ retentionPct: Number(policy.retentionPct), frequency: policy.frequency }), 'Formula saved.'); }}>
                        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Kept in business (%)<input aria-label="Kept in business" type="number" min="0" max="100" className={`${FIELD} w-28`} value={policy.retentionPct} onChange={event => setPolicy(current => ({ ...current, retentionPct: event.target.value }))} /></label>
                        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">How often<select aria-label="How often" className={`${FIELD} w-36`} value={policy.frequency} onChange={event => setPolicy(current => ({ ...current, frequency: event.target.value }))}>{(data.frequencies || []).map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                        <button type="submit" className={SECONDARY}>Save formula</button>
                      </form>
                    ) : <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Profit is shared {data.policy.frequency}.{data.policy.updatedAt ? ` Last changed ${shortDate(data.policy.updatedAt)} by ${data.policy.updatedBy}.` : ''}</p>}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <p className="text-sm font-bold text-[#0b1f3a] dark:text-white">Since the last share-out</p>
                    {data.projection.fromMonth ? (
                      <>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{period(data.projection.fromMonth, data.projection.toMonth)}: net {data.projection.netProfit < 0 ? 'loss' : 'profit'} <b className="tabular-nums">{naira(data.projection.netProfit)}</b>. Kept {naira(data.projection.retained)} · to share <b className="tabular-nums">{naira(data.projection.distributable)}</b>.</p>
                        <ul className="mt-2 space-y-1 text-sm">{data.projection.lines.map(line => <li key={line.email} className="flex justify-between gap-2"><span>{line.name} · {line.pct}%</span><span className="font-bold tabular-nums">{naira(line.amount)}</span></li>)}</ul>
                      </>
                    ) : <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">No finished month to share yet.</p>}
                    {canManage ? (
                      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={makeDeclaration}>
                        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">From<input aria-label="From month" type="month" className={`${FIELD} w-40`} value={declare.fromMonth} onChange={event => setDeclare(current => ({ ...current, fromMonth: event.target.value }))} /></label>
                        <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">To<input aria-label="To month" type="month" className={`${FIELD} w-40`} value={declare.toMonth} max={lastFinishedMonth()} onChange={event => setDeclare(current => ({ ...current, toMonth: event.target.value }))} /></label>
                        <button type="submit" className={PRIMARY} disabled={busy || !declare.fromMonth || !declare.toMonth}>Share this profit</button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <p className="text-sm font-bold text-[#0b1f3a] dark:text-white">Profit shared and payouts</p>
                {(data.dividends || []).map(dividend => (
                  <div key={dividend.id} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-sm dark:bg-white/5">
                      <p><b>{period(dividend.fromMonth, dividend.toMonth)}</b> · net profit {naira(dividend.netProfit)} · kept {dividend.retentionPct}% ({naira(dividend.retained)}) · shared <b>{naira(dividend.distributable)}</b></p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">Declared {shortDate(dividend.declaredOn)} by {dividend.declaredBy}
                        {canManage && !dividend.lines.some(line => line.paid > 0) ? <> · <button type="button" className="font-bold text-rose-700 underline dark:text-rose-300" onClick={async () => { if (await askConfirm('Undo this share-out? Nothing of it has been paid yet.')) run(() => voidProfitShare(dividend.id), 'Share-out undone.'); }}>Undo</button></> : null}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead><tr><th className={TH}>Shareholder</th><th className={`${TH} text-right`}>Shares</th><th className={`${TH} text-right`}>Amount</th><th className={`${TH} text-right`}>Paid</th><th className={`${TH} text-right`}>Due</th><th className={TH}>Reference</th>{canManage ? <th className={TH}><span className="sr-only">Pay</span></th> : null}</tr></thead>
                        <tbody>
                          {dividend.lines.map(line => {
                            const left = Math.round((line.amount - line.paid) * 100) / 100;
                            return (
                              <tr key={line.id} className="border-t border-slate-100 dark:border-white/5">
                                <td className={`${TD} font-semibold`}>{line.name}</td>
                                <td className={`${TD} text-right tabular-nums`}>{line.shares.toLocaleString()} · {line.pct}%</td>
                                <td className={`${TD} text-right tabular-nums`}>{naira(line.amount, 2)}</td>
                                <td className={`${TD} text-right tabular-nums`}>{naira(line.paid, 2)}</td>
                                <td className={`${TD} text-right font-black tabular-nums`}>{left > 0 ? naira(left, 2) : <Pill tone="good">Paid</Pill>}</td>
                                <td className={`${TD} text-xs`}>{line.paidReference}{line.paidAt ? <span className="block text-slate-600 dark:text-slate-300">{shortDate(line.paidAt)}</span> : null}</td>
                                {canManage ? <td className={TD}>{left > 0 ? <button type="button" className="rounded-md bg-[#191970] px-2 py-1 text-xs font-bold text-white" onClick={() => pay(line, dividend)}>Record payout</button> : null}</td> : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {!data.dividends?.length ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 dark:border-white/15 dark:text-slate-300">No profit has been shared yet.</p> : null}
              </div>
            ) : null}

            {tab === 'access' && canManage ? <AccessPanel /> : null}
          </Panel>
        </>
      ) : null}
    </AmiPage>
  );
}

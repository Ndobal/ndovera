import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BanknotesIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { getPlatformFinance, recordPlatformLedger, sendPlatformReminders, voidPlatformLedger } from '../tenants/services/tenantApi';
import { askConfirm } from '../../shared/components/AppDialog';
import { AmiPage, FIELD, MoneyChart, Panel, Pill, PRIMARY, SchoolMark, SECONDARY, StatCard, TD, TermFeePill, TH, naira, shortDate } from './AmiUi';

// Ndovera's money: what schools paid (when, how much, by whom), what they owe, what went
// out, and reminders to owners. Ami manages; shareholders read (`readOnly`).

const TABS = [['schools', 'Schools & balances'], ['payments', 'Payments received'], ['out', 'Money out'], ['reminders', 'Reminders sent']];

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export function LedgerForm({ categories, onSaved }) {
  const [form, setForm] = useState({ kind: 'expense', category: '', amount: '', description: '', occurredOn: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = categories?.[form.kind] || [];
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await recordPlatformLedger({ ...form, amount: Number(form.amount), category: form.category || options[0] });
      setForm(current => ({ ...current, amount: '', description: '' }));
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <select aria-label="Kind" className={FIELD} value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value, category: '' }))}>
        <option value="expense">Money out (expense)</option><option value="income">Other money in</option>
      </select>
      <select aria-label="Category" className={FIELD} value={form.category || options[0] || ''} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
      <input aria-label="Amount" type="number" min="0" className={FIELD} placeholder="Amount (₦)" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} />
      <input aria-label="Date" type="date" className={FIELD} value={form.occurredOn} onChange={event => setForm(current => ({ ...current, occurredOn: event.target.value }))} />
      <input aria-label="What for" className={`${FIELD} lg:col-span-1`} placeholder="What for" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
      <button type="submit" className={PRIMARY} disabled={busy || !(Number(form.amount) > 0) || !form.description.trim()}>{busy ? 'Saving…' : 'Record'}</button>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700 sm:col-span-2 lg:col-span-6">{error}</p> : null}
    </form>
  );
}

export default function AmiFinancePage({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('schools');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [chosen, setChosen] = useState(() => new Set());
  const [busy, setBusy] = useState('');
  const [whatsappLinks, setWhatsappLinks] = useState([]);

  const load = useCallback(() => getPlatformFinance().then(next => { setData(next); setError(''); }).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);
  const canManage = Boolean(data?.canManage) && !readOnly;

  const schools = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.schools || []).filter(school => {
      if (text && !`${school.schoolName} ${school.ownerName} ${school.ownerEmail}`.toLowerCase().includes(text)) return false;
      if (filter === 'owing') return school.totalOwed > 0;
      if (filter === 'term') return school.currentTermFee && !['paid', 'unknown'].includes(school.currentTermFee.status);
      if (filter === 'overdue') return school.overdue > 0;
      return true;
    });
  }, [data, query, filter]);
  const payments = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.payments || []).filter(payment => !text || `${payment.schoolName} ${payment.reference} ${payment.recordedBy} ${payment.receiptNo}`.toLowerCase().includes(text));
  }, [data, query]);

  async function remind(tenantIds, channel) {
    if (channel === 'email' && !(await askConfirm(`Email a polite reminder with the pay link to ${tenantIds.length} school${tenantIds.length === 1 ? '' : 's'}? Schools already emailed today are skipped.`))) return;
    setBusy(`${channel}-${tenantIds.join(',')}`); setNotice(''); setError('');
    try {
      const result = await sendPlatformReminders({ tenantIds, channel });
      const skipped = result.results.filter(item => item.skipped);
      if (channel === 'whatsapp') {
        const links = result.results.filter(item => item.whatsappUrl);
        if (links.length === 1) window.open(links[0].whatsappUrl, '_blank', 'noopener,noreferrer');
        setWhatsappLinks(links);
        setNotice(`${links.length ? `WhatsApp ready for ${links.length} school${links.length === 1 ? '' : 's'}; press send in WhatsApp.` : 'No WhatsApp message prepared.'}${skipped.length ? ` Not sent: ${skipped.map(item => `${item.schoolName || item.tenantId} — ${item.skipped}`).join('; ')}.` : ''}`);
      } else {
        setNotice(`Reminder emailed to ${result.sent} school${result.sent === 1 ? '' : 's'}.${skipped.length ? ` Not sent: ${skipped.map(item => `${item.schoolName || item.tenantId} — ${item.skipped}`).join('; ')}.` : ''}`);
      }
      setChosen(new Set());
      load();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  const kpis = data?.kpis || {};
  const toggle = id => setChosen(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const owingVisible = schools.filter(school => school.outstanding > 0);

  return (
    <AmiPage
      title="Finance"
      subtitle={readOnly ? 'Ndovera\'s income, balances and spending (read-only).' : 'What schools paid, what they owe, money out, and reminders to school owners.'}
      crumbs={['Finance']}
      actions={<button type="button" className={SECONDARY} onClick={load}>Refresh</button>}
    >
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading the figures…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={ArrowTrendingUpIcon} tone="green" label="Ndovera has collected" value={naira(kpis.collectedAllTime)} hint={kpis.paymentsCount ? `${kpis.paymentsCount} payment${kpis.paymentsCount === 1 ? '' : 's'} from ${kpis.schoolsPaid || 0} school${kpis.schoolsPaid === 1 ? '' : 's'}` : 'No payment recorded yet'} />
            <StatCard icon={BanknotesIcon} tone="navy" label="Collected this year" value={naira(kpis.collectedThisYear)} hint={`${naira(kpis.collectedThisMonth)} this month · ${naira(kpis.collectedThisTerm)} this term`} />
            <StatCard icon={ExclamationTriangleIcon} tone="maroon" label="Schools owe Ndovera" value={naira(kpis.owedTotal)} hint={`${naira(kpis.outstanding)} invoiced · ${naira((kpis.owedDraft || 0) + (kpis.owedNotInvoiced || 0))} not yet invoiced`} />
            <StatCard icon={ScaleIcon} tone="gold" label="Net, all time" value={naira(kpis.netAllTime)} hint={`after ${naira((kpis.expenses || 0) + (kpis.partnerPayouts || 0))} out`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Money in and out · last 12 months" className="lg:col-span-2"><MoneyChart monthly={data.monthly} /></Panel>
            <Panel title="At a glance">
              <dl className="space-y-3 text-sm">
                {[
                  ['Owed on invoices sent', naira(kpis.outstanding)],
                  ['Of which overdue', naira(kpis.overdue)],
                  ['Owed on draft invoices (not sent)', naira(kpis.owedDraft)],
                  ['Owed, no invoice raised (estimate)', naira(kpis.owedNotInvoiced)],
                  ['Schools unpaid this term', kpis.schoolsUnpaidThisTerm || 0],
                  ['Other income', naira(kpis.otherIncome)],
                  ['Expenses', naira(kpis.expenses)],
                  ['Partner payouts', naira(kpis.partnerPayouts)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-white/5">
                    <dt className="text-slate-600 dark:text-slate-300">{label}</dt><dd className="font-black tabular-nums text-[#0b1f3a] dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Figures as of {new Date(data.generatedAt).toLocaleString()}.</p>
            </Panel>
          </div>

          <Panel bodyClassName="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10" role="tablist">
              {TABS.filter(([key]) => key !== 'reminders' || canManage).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === key ? 'bg-[#191970] text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>{label}</button>
              ))}
              <input type="search" aria-label="Search" placeholder="Search school, reference…" value={query} onChange={event => setQuery(event.target.value)} className={`${FIELD} ml-auto max-w-xs`} />
            </div>

            {tab === 'schools' ? (
              <div>
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  {[['all', 'All schools'], ['owing', 'With a balance'], ['overdue', 'Overdue'], ['term', 'Unpaid this term']].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === key ? 'bg-[#c9a96e] text-[#0b1f3a]' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{label}</button>
                  ))}
                  {canManage ? (
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button type="button" className={SECONDARY} disabled={!owingVisible.length} onClick={() => setChosen(new Set(owingVisible.map(school => school.tenantId)))}>Select all owing ({owingVisible.length})</button>
                      <button type="button" className={PRIMARY} disabled={!chosen.size || Boolean(busy)} onClick={() => remind([...chosen], 'email')}>Email reminders ({chosen.size})</button>
                      <button type="button" className={SECONDARY} disabled={!chosen.size || Boolean(busy)} onClick={() => remind([...chosen], 'whatsapp')}>WhatsApp ({chosen.size})</button>
                    </div>
                  ) : null}
                </div>
                {whatsappLinks.length > 1 ? (
                  <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <p className="mb-2 font-bold text-emerald-900">Open each WhatsApp message and press send:</p>
                    <div className="flex flex-wrap gap-2">{whatsappLinks.map(link => <a key={link.tenantId} href={link.whatsappUrl} target="_blank" rel="noopener noreferrer" className={SECONDARY}>{link.schoolName}</a>)}</div>
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-slate-50 dark:bg-white/5"><tr>
                      {canManage ? <th className={`${TH} w-10`}><span className="sr-only">Choose</span></th> : null}
                      <th className={TH}>School</th><th className={TH}>This term</th><th className={`${TH} text-right`}>Paid to Ndovera</th><th className={`${TH} text-right`}>Owes now</th><th className={TH}>Last payment</th>{canManage ? <th className={TH}>Last reminder</th> : null}{canManage ? <th className={TH}>Remind</th> : null}
                    </tr></thead>
                    <tbody>
                      {schools.map(school => (
                        <tr key={school.tenantId} className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                          {canManage ? <td className={TD}><input type="checkbox" aria-label={`Choose ${school.schoolName}`} checked={chosen.has(school.tenantId)} onChange={() => toggle(school.tenantId)} /></td> : null}
                          <td className={TD}>
                            <div className="flex items-center gap-3">
                              <SchoolMark name={school.schoolName} logoUrl={school.logoUrl} />
                              <div className="min-w-0"><p className="truncate font-bold text-[#191970] dark:text-indigo-200">{school.schoolName}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{school.ownerName} · {school.contactEmail}</p></div>
                            </div>
                          </td>
                          <td className={TD}>
                            <TermFeePill fee={school.currentTermFee} />
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{[school.currentTermFee?.term, school.currentTermFee?.session].filter(Boolean).join(', ')}{school.thisTerm ? <> · <b className="tabular-nums text-slate-700 dark:text-slate-200">{naira(school.thisTerm.amount)}</b></> : null}</p>
                            {school.thisTerm?.note ? <p className="text-xs text-slate-600 dark:text-slate-300">{school.thisTerm.note}</p> : null}
                          </td>
                          <td className={`${TD} text-right tabular-nums`}>{naira(school.paid)}{!school.paid ? <span className="block text-xs text-slate-600 dark:text-slate-300">nothing paid yet</span> : null}</td>
                          <td className={`${TD} text-right`}>
                            <p className={`font-black tabular-nums ${school.totalOwed > 0 ? 'text-[#800000] dark:text-rose-300' : ''}`}>{naira(school.totalOwed ?? school.outstanding)}</p>
                            {school.totalOwed > school.outstanding ? <p className="text-xs text-slate-600 dark:text-slate-300">{school.outstanding > 0 ? `${naira(school.outstanding)} invoiced · ` : ''}{naira(school.totalOwed - school.outstanding)} {school.thisTerm?.basis === 'draft' ? 'on a draft' : 'not invoiced'}</p> : null}
                            {school.daysOverdue > 0 ? <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{school.daysOverdue} days overdue</p> : null}
                          </td>
                          <td className={TD}>
                            {school.lastPayment ? (
                              <><p className="tabular-nums">{shortDate(school.lastPayment.at)} · <b>{naira(school.lastPayment.amount)}</b></p><p className="text-xs text-slate-600 dark:text-slate-300">{school.lastPayment.method} · {school.lastPayment.recordedBy}</p></>
                            ) : <span className="text-xs text-slate-600 dark:text-slate-300">No payment yet</span>}
                          </td>
                          {canManage ? <td className={TD}>{school.lastReminder ? <p className="text-xs">{shortDate(school.lastReminder.sentAt)} · {school.lastReminder.channel}<br /><span className="text-slate-600 dark:text-slate-300">by {school.lastReminder.sentBy}</span></p> : <span className="text-xs text-slate-600 dark:text-slate-300">—</span>}</td> : null}
                          {canManage ? (
                            <td className={TD}>
                              {school.outstanding > 0 ? (
                                <div className="flex gap-1">
                                  <button type="button" className="rounded-md bg-[#191970] px-2 py-1 text-xs font-bold text-white disabled:opacity-50" disabled={Boolean(busy)} onClick={() => remind([school.tenantId], 'email')}>Email</button>
                                  <button type="button" className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-50" disabled={Boolean(busy) || !school.ownerPhone} title={school.ownerPhone ? `WhatsApp ${school.ownerPhone}` : 'No owner phone on file'} onClick={() => remind([school.tenantId], 'whatsapp')}>WhatsApp</button>
                                </div>
                              ) : school.totalOwed > 0 ? <span className="text-xs text-slate-600 dark:text-slate-300">Send the invoice first</span> : <span className="text-xs text-slate-600 dark:text-slate-300">Nothing due</span>}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      {!schools.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No schools match.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                {canManage ? <p className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">Reminders go only for bills already raised or sent. A school with no invoice this term shows "Unpaid · no invoice": raise its bill under Billing &amp; Pricing first.</p> : null}
              </div>
            ) : null}

            {tab === 'payments' ? (
              <div>
                <div className="flex justify-end px-4 py-3">
                  <button type="button" className={SECONDARY} onClick={() => downloadCsv('ndovera-payments.csv', [['Date', 'School', 'What', 'Period', 'Amount (NGN)', 'Method', 'Recorded by', 'Reference', 'Receipt'], ...payments.map(payment => [payment.at, payment.schoolName, payment.kind, payment.period, payment.amount, payment.method, payment.recordedBy, payment.reference, payment.receiptNo])])}>Download CSV</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>Date</th><th className={TH}>School</th><th className={TH}>For</th><th className={`${TH} text-right`}>Amount</th><th className={TH}>Method</th><th className={TH}>Paid / recorded by</th><th className={TH}>Reference</th></tr></thead>
                    <tbody>
                      {payments.map(payment => (
                        <tr key={`${payment.id}-${payment.at}`} className="border-t border-slate-100 dark:border-white/5">
                          <td className={`${TD} whitespace-nowrap tabular-nums`}>{shortDate(payment.at)}</td>
                          <td className={`${TD} font-semibold`}>{payment.schoolName}</td>
                          <td className={TD}>{payment.kind}{payment.period ? <span className="block text-xs text-slate-600 dark:text-slate-300">{payment.period}</span> : null}</td>
                          <td className={`${TD} text-right font-black tabular-nums`}>{naira(payment.amount)}</td>
                          <td className={TD}>{payment.method}</td>
                          <td className={TD}>{payment.recordedBy}</td>
                          <td className={`${TD} text-xs text-slate-600 dark:text-slate-300`}>{payment.reference}{payment.receiptNo ? <span className="block">Receipt {payment.receiptNo}</span> : null}</td>
                        </tr>
                      ))}
                      {!payments.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No payments recorded yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tab === 'out' ? (
              <div className="space-y-4 p-4">
                {canManage ? (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <p className="mb-2 text-sm font-bold text-[#0b1f3a] dark:text-white">Record money out or other income</p>
                    <LedgerForm categories={data.categories} onSaved={() => { setNotice('Recorded.'); load(); }} />
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>Date</th><th className={TH}>Type</th><th className={TH}>Category</th><th className={TH}>What for</th><th className={`${TH} text-right`}>Amount</th><th className={TH}>Recorded by</th>{canManage ? <th className={TH}><span className="sr-only">Void</span></th> : null}</tr></thead>
                    <tbody>
                      {[
                        ...data.ledger.map(row => ({ ...row, type: row.kind === 'income' ? 'Other income' : 'Expense', date: row.occurredOn, who: row.recordedBy, voidable: true })),
                        ...data.payouts.map(payout => ({ id: payout.id, type: 'Partner payout', category: 'Growth partners', description: `${payout.partnerName}${payout.reference ? ` · ${payout.reference}` : ''}`, amount: payout.amount, date: payout.createdAt, who: 'Ndovera', voidable: false })),
                      ].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(row => (
                        <tr key={row.id} className="border-t border-slate-100 dark:border-white/5">
                          <td className={`${TD} whitespace-nowrap tabular-nums`}>{shortDate(row.date)}</td>
                          <td className={TD}><Pill tone={row.type === 'Other income' ? 'good' : 'info'}>{row.type}</Pill></td>
                          <td className={TD}>{row.category}</td>
                          <td className={TD}>{row.description}</td>
                          <td className={`${TD} text-right font-black tabular-nums`}>{naira(row.amount)}</td>
                          <td className={`${TD} text-xs`}>{row.who}</td>
                          {canManage ? <td className={TD}>{row.voidable ? <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={async () => { if (await askConfirm('Void this entry? It stays in the history, marked void.')) { await voidPlatformLedger(row.id).catch(err => setError(err.message)); load(); } }}>Void</button> : null}</td> : null}
                        </tr>
                      ))}
                      {!data.ledger.length && !data.payouts.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">Nothing recorded yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tab === 'reminders' && canManage ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>When</th><th className={TH}>School</th><th className={TH}>How</th><th className={TH}>By</th></tr></thead>
                  <tbody>
                    {data.reminders.map((reminder, index) => (
                      <tr key={`${reminder.tenantId}-${reminder.sentAt}-${index}`} className="border-t border-slate-100 dark:border-white/5">
                        <td className={`${TD} tabular-nums`}>{new Date(reminder.sentAt).toLocaleString()}</td><td className={TD}>{reminder.schoolName}</td><td className={`${TD} capitalize`}>{reminder.channel}</td><td className={TD}>{reminder.sentBy}</td>
                      </tr>
                    ))}
                    {!data.reminders.length ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No reminders sent yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>
        </>
      ) : null}
    </AmiPage>
  );
}

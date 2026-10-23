import React, { useCallback, useEffect, useState } from 'react';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, CalendarDaysIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { addRunningCost, getProfitAndLoss, stopRunningCost } from '../tenants/services/tenantApi';
import { askConfirm } from '../../shared/components/AppDialog';
import { LedgerForm } from './AmiFinancePage';
import { AmiPage, FIELD, MoneyChart, Panel, Pill, PRIMARY, SECONDARY, StatCard, TD, TH, monthLabel, naira } from './AmiUi';

// Ndovera's profit and loss: money in (term fees, onboarding, other income) against money out
// (one-off expenses, monthly running costs, partner payouts), month by month, with the analysis.
// Ami records the monthly running costs here; shareholders read (`readOnly`).

const thisMonth = () => new Date().toISOString().slice(0, 7);
const percent = value => (value === null || value === undefined ? '—' : `${value}%`);
const monthName = month => `${monthLabel(month)} ${String(month).slice(0, 4)}`;

function RunningCostForm({ categories, onSaved }) {
  const [form, setForm] = useState({ category: categories?.[0] || '', description: '', amount: '', startMonth: thisMonth() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await addRunningCost({ ...form, amount: Number(form.amount), category: form.category || categories?.[0] });
      setForm(current => ({ ...current, description: '', amount: '' }));
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <select aria-label="Category" className={FIELD} value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
        {(categories || []).map(option => <option key={option}>{option}</option>)}
      </select>
      <input aria-label="What for" className={FIELD} placeholder="What for (e.g. office rent)" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
      <input aria-label="Amount each month" type="number" min="0" className={FIELD} placeholder="Amount each month (₦)" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} />
      <input aria-label="First month" type="month" className={FIELD} value={form.startMonth} onChange={event => setForm(current => ({ ...current, startMonth: event.target.value }))} />
      <button type="submit" className={PRIMARY} disabled={busy || !(Number(form.amount) > 0) || !form.description.trim()}>{busy ? 'Saving…' : 'Add monthly cost'}</button>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300 sm:col-span-2 lg:col-span-5">{error}</p> : null}
    </form>
  );
}

export default function AmiProfitLossPage({ readOnly = false }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => getProfitAndLoss({ year: String(year) }).then(next => { setData(next); setError(''); }).catch(err => setError(err.message)), [year]);
  useEffect(() => { load(); }, [load]);
  const canManage = Boolean(data?.canManage) && !readOnly;
  const totals = data?.totals || {};
  const analysis = data?.analysis || {};
  const previous = data?.previousYear || null;
  const change = (now, before) => (before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / Math.abs(before)) * 100)}% on ${year - 1}` : `nothing recorded in ${year - 1}`);
  const months = (data?.months || []).filter(row => !row.future);

  async function stop(cost) {
    if (!(await askConfirm(`Stop "${cost.description}" after ${monthName(thisMonth())}? It stays counted in the months up to then.`))) return;
    try { await stopRunningCost(cost.id, thisMonth()); setNotice('Monthly cost stopped.'); load(); } catch (err) { setError(err.message); }
  }

  const facts = data ? [
    analysis.monthsCounted ? `${analysis.profitableMonths} of ${analysis.monthsCounted} month${analysis.monthsCounted === 1 ? '' : 's'} made a profit${analysis.lossMonths ? `, ${analysis.lossMonths} made a loss` : ''}.` : 'No month of this year has started yet.',
    `An average month brings in ${naira(analysis.averageMonthlyRevenue)} and spends ${naira(analysis.averageMonthlyExpense)}, leaving ${naira(analysis.averageMonthlyNet)}.`,
    analysis.expenseRatio !== null && analysis.expenseRatio !== undefined ? `Spending is ${analysis.expenseRatio}% of income.` : 'There is no income yet to compare spending against.',
    analysis.bestMonth ? `Best month: ${monthName(analysis.bestMonth.month)} (${naira(analysis.bestMonth.net)}). Weakest: ${monthName(analysis.worstMonth.month)} (${naira(analysis.worstMonth.net)}).` : '',
    data.categories?.[0] ? `Most money goes on ${data.categories[0].category}: ${naira(data.categories[0].amount)} (${data.categories[0].share}% of spending).` : '',
    `Monthly running costs today: ${naira(analysis.currentRunningCost)}.`,
    analysis.breakEvenStudentsPerTerm ? `To pay a year of today's running costs, Ndovera needs ${analysis.breakEvenStudentsPerTerm.toLocaleString()} paying students each term (at the average ${naira(analysis.averageRatePerStudent)} per student, 3 terms a year).` : '',
  ].filter(Boolean) : [];

  return (
    <AmiPage
      title="Profit & Loss"
      subtitle={readOnly ? 'Ndovera\'s income against its spending, month by month (read-only).' : 'Income against spending month by month. Add the monthly running costs here so every month is counted.'}
      crumbs={['Money', 'Profit & Loss']}
      actions={(
        <>
          <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Year{' '}
            <select aria-label="Year" className={`${FIELD} ml-1 w-auto`} value={year} onChange={event => setYear(Number(event.target.value))}>
              {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" className={SECONDARY} onClick={load}>Refresh</button>
        </>
      )}
    >
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Working out the figures…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={ArrowTrendingUpIcon} tone="green" label={`Income ${year}`} value={naira(totals.revenue)} hint={previous ? change(totals.revenue, previous.revenue) : ''} />
            <StatCard icon={ArrowTrendingDownIcon} tone="maroon" label={`Spending ${year}`} value={naira(totals.expenses)} hint={`${naira(totals.runningCosts)} of it monthly running costs`} />
            <StatCard icon={ScaleIcon} tone="gold" label={totals.net < 0 ? 'Net loss' : 'Net profit'} value={naira(totals.net)} hint={`Margin ${percent(totals.margin)}`} />
            <StatCard icon={CalendarDaysIcon} tone="navy" label="Running costs a month" value={naira(analysis.currentRunningCost)} hint={`${(data.recurring || []).filter(cost => cost.active).length} monthly costs`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={`Income and spending · ${year}`} className="lg:col-span-2">
              <MoneyChart monthly={(data.months || []).map(row => ({ month: row.month, collected: row.revenue, expenses: row.expenses, net: row.net }))} />
            </Panel>
            <Panel title="What the figures say">
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {facts.map(fact => <li key={fact} className="flex gap-2"><span aria-hidden="true" className="text-[#c9a96e]">●</span><span>{fact}</span></li>)}
              </ul>
            </Panel>
          </div>

          <Panel title={`Profit and loss statement · ${year}`} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 dark:bg-white/5"><tr>
                  <th className={TH}>Month</th><th className={`${TH} text-right`}>Term fees</th><th className={`${TH} text-right`}>Onboarding</th><th className={`${TH} text-right`}>Other income</th>
                  <th className={`${TH} text-right`}>Total income</th><th className={`${TH} text-right`}>Spending</th><th className={`${TH} text-right`}>Net</th><th className={`${TH} text-right`}>Margin</th>
                </tr></thead>
                <tbody>
                  {months.map(row => (
                    <tr key={row.month} className="border-t border-slate-100 dark:border-white/5">
                      <td className={`${TD} font-semibold`}>{monthName(row.month)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{naira(row.termFees)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{naira(row.onboarding)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{naira(row.otherIncome)}</td>
                      <td className={`${TD} text-right font-bold tabular-nums`}>{naira(row.revenue)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{naira(row.expenses)}</td>
                      <td className={`${TD} text-right font-black tabular-nums ${row.net < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{naira(row.net)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{percent(row.margin)}</td>
                    </tr>
                  ))}
                  {!months.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No month of {year} has started yet.</td></tr> : null}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black dark:border-white/20 dark:bg-white/5">
                  <tr>
                    <td className={TD}>Total {year}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.termFees)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.onboarding)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.otherIncome)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.revenue)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.expenses)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{naira(totals.net)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{percent(totals.margin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Where the money goes" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {(data.categories || []).map(row => (
                  <li key={row.category} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{row.category}</span><span className="font-black tabular-nums">{naira(row.amount)} <span className="font-semibold text-slate-600 dark:text-slate-300">· {row.share}%</span></span></div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-2 rounded-full bg-[#c0763a] dark:bg-[#c27f45]" style={{ width: `${Math.min(100, row.share)}%` }} /></div>
                  </li>
                ))}
                {!data.categories?.length ? <li className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No spending recorded for {year}.</li> : null}
              </ul>
            </Panel>

            <Panel title="Monthly running costs" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {(data.recurring || []).map(cost => (
                  <li key={cost.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{cost.description}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{cost.category} · from {monthName(cost.startMonth)}{cost.endMonth ? ` to ${monthName(cost.endMonth)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black tabular-nums">{naira(cost.amount)}/month</span>
                      {cost.active ? <Pill tone="good">Running</Pill> : <Pill tone="info">Stopped</Pill>}
                      {canManage && cost.active ? <button type="button" className="text-xs font-bold text-rose-700 underline dark:text-rose-300" onClick={() => stop(cost)}>Stop</button> : null}
                    </div>
                  </li>
                ))}
                {!data.recurring?.length ? <li className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">No monthly costs yet. Add rent, salaries, hosting and other costs that repeat every month.</li> : null}
              </ul>
            </Panel>
          </div>

          {canManage ? (
            <>
              <Panel title="Add a monthly running cost"><RunningCostForm categories={data.ledgerCategories?.expense} onSaved={() => { setNotice('Monthly cost added; it is counted from its first month.'); load(); }} /></Panel>
              <Panel title="Record a one-off expense or other income"><LedgerForm categories={data.ledgerCategories} onSaved={() => { setNotice('Recorded.'); load(); }} /></Panel>
            </>
          ) : null}
        </>
      ) : null}
    </AmiPage>
  );
}

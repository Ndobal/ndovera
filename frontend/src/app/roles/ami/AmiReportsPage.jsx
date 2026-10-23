import React, { useCallback, useEffect, useState } from 'react';
import { BanknotesIcon, BuildingOffice2Icon, ClipboardDocumentListIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { getAmiReportSummary } from '../../../features/tenants/services/tenantApi';
import { AmiPage, Panel, Pill, SECONDARY, StatCard, TD, TH, naira } from '../../../features/ami/AmiUi';

// The executive report: every figure is counted from Ndovera's records — schools, people,
// money in, owed and spent, and the last 30 days of recorded actions. Each part exports as CSV.

function downloadCsv(name, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: `ndovera-${name}-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  URL.revokeObjectURL(url);
}

function Facts({ rows }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm dark:divide-white/5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-2">
          <dt className="text-slate-700 dark:text-slate-200">{label}</dt><dd className="font-black tabular-nums text-[#0b1f3a] dark:text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AmiReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => getAmiReportSummary().then(next => { setData(next); setError(''); }).catch(err => setError(err.message || 'Could not build the report.')), []);
  useEffect(() => { load(); }, [load]);

  const schools = data?.schools || {};
  const people = data?.people || {};
  const finance = data?.finance || {};
  const activity = data?.activity || {};
  const financeRows = data ? [
    ['Collected, all time', naira(finance.collectedAllTime)],
    ['Collected this year', naira(finance.collectedThisYear)],
    ['Payments received', (finance.paymentsCount || 0).toLocaleString()],
    ['Schools owe in total', naira(finance.owedTotal)],
    ['· on invoices sent', naira(finance.owedInvoiced)],
    ['· of which overdue', naira(finance.overdue)],
    ['· on draft invoices', naira(finance.owedDraft)],
    ['· not yet invoiced (estimate)', naira(finance.owedNotInvoiced)],
    ['Income this year', naira(finance.revenueThisYear)],
    ['Spending this year', naira(finance.expensesThisYear)],
    [finance.netThisYear < 0 ? 'Net loss this year' : 'Net profit this year', naira(finance.netThisYear)],
    ['Margin this year', finance.marginThisYear === null || finance.marginThisYear === undefined ? '—' : `${finance.marginThisYear}%`],
  ] : [];
  const schoolRows = data ? [['Schools', schools.total], ['Active', schools.active], ['Suspended', schools.suspended], ['Waiting for approval', schools.pendingApproval], ['Onboarding not paid', schools.onboardingUnpaid]] : [];
  const peopleRows = data ? [['Active students', people.studentsActive], ['Inactive students', people.studentsInactive], ['Active staff', people.staffActive], ['Inactive staff', people.staffInactive], ['Parents', people.parents]].map(([label, value]) => [label, Number(value || 0).toLocaleString()]) : [];

  return (
    <AmiPage
      title="Reports"
      subtitle="Ndovera's position counted from the records: schools, people, money and recorded activity."
      crumbs={['Platform', 'Reports']}
      actions={<button type="button" className={SECONDARY} onClick={load}>Refresh</button>}
    >
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Counting the records…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={BuildingOffice2Icon} tone="navy" label="Schools" value={schools.total} hint={`${schools.active} active`} />
            <StatCard icon={UserGroupIcon} tone="green" label="Active students" value={Number(people.studentsActive || 0).toLocaleString()} hint={`${Number(people.staffActive || 0).toLocaleString()} active staff`} />
            <StatCard icon={BanknotesIcon} tone="gold" label="Collected, all time" value={naira(finance.collectedAllTime)} hint={`schools owe ${naira(finance.owedTotal)}`} />
            <StatCard icon={ClipboardDocumentListIcon} tone="maroon" label="Actions, last 30 days" value={Number(activity.total || 0).toLocaleString()} hint="recorded in the audit trail" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Money" actions={<button type="button" className={SECONDARY} onClick={() => downloadCsv('money', [['Figure', 'Value'], ...financeRows])}>Export</button>}><Facts rows={financeRows} /></Panel>
            <Panel title="Schools" actions={<button type="button" className={SECONDARY} onClick={() => downloadCsv('schools', [['School', 'Status', 'Students', 'Paid (NGN)', 'Owes (NGN)', 'This term'], ...(schools.list || []).map(row => [row.schoolName, row.status, row.students, row.paid, row.owed, row.thisTerm])])}>Export</button>}><Facts rows={schoolRows} /></Panel>
            <Panel title="People on Ndovera" actions={<button type="button" className={SECONDARY} onClick={() => downloadCsv('people', [['Figure', 'Count'], ...peopleRows])}>Export</button>}><Facts rows={peopleRows} /></Panel>
          </div>

          <Panel title="Schools: what each has paid and owes" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>School</th><th className={TH}>Status</th><th className={`${TH} text-right`}>Students</th><th className={`${TH} text-right`}>Paid to Ndovera</th><th className={`${TH} text-right`}>Owes now</th><th className={TH}>This term</th></tr></thead>
                <tbody>
                  {(schools.list || []).map(row => (
                    <tr key={row.tenantId} className="border-t border-slate-100 dark:border-white/5">
                      <td className={`${TD} font-semibold`}>{row.schoolName}</td>
                      <td className={TD}>{row.status === 'active' ? <Pill tone="good">Active</Pill> : <Pill tone="warn">{row.status || 'pending'}</Pill>}</td>
                      <td className={`${TD} text-right tabular-nums`}>{Number(row.students || 0).toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{naira(row.paid)}</td>
                      <td className={`${TD} text-right font-black tabular-nums ${row.owed > 0 ? 'text-[#800000] dark:text-rose-300' : ''}`}>{naira(row.owed)}</td>
                      <td className={`${TD} text-xs text-slate-600 dark:text-slate-300`}>{row.thisTerm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Most recorded actions · last 30 days" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {(activity.top || []).map(row => <li key={row.action} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span>{row.action}</span><b className="tabular-nums">{row.count.toLocaleString()}</b></li>)}
                {!activity.top?.length ? <li className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">No actions recorded in the last 30 days.</li> : null}
              </ul>
            </Panel>
            <Panel title="Access and security actions · last 30 days" bodyClassName="p-0">
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {(activity.security || []).map(row => <li key={row.action} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span>{row.action}</span><b className="tabular-nums">{row.count.toLocaleString()}</b></li>)}
                {!activity.security?.length ? <li className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">No password, access or closure actions in the last 30 days.</li> : null}
              </ul>
            </Panel>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">Counted {new Date(data.generatedAt).toLocaleString('en-GB')}. Details of each action are in the Audit Trail.</p>
        </>
      ) : null}
    </AmiPage>
  );
}

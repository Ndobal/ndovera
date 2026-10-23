import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BanknotesIcon, BuildingOffice2Icon, ExclamationTriangleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { getAmiTenants, getPlatformFinance } from '../tenants/services/tenantApi';
import SchoolAccessPanel from '../tenants/components/SchoolAccessPanel';
import { AmiPage, MoneyChart, Panel, Pill, SchoolMark, SECONDARY, StatCard, TermFeePill, naira, shortDate } from './AmiUi';

// Ndovera at a glance: schools, students, money in and owed, this term's unpaid schools,
// the latest payments and registrations, and what is waiting for approval.
export default function AmiOverview() {
  const [tenants, setTenants] = useState(null);
  const [summary, setSummary] = useState(null);
  const [finance, setFinance] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAmiTenants().then(result => { setTenants(result.tenants || []); setSummary(result.summary || null); }).catch(err => setError(err.message || 'Could not load schools.'));
    getPlatformFinance().then(setFinance).catch(() => setFinance(null));
  }, []);

  const students = (tenants || []).reduce((sum, tenant) => sum + Number(tenant.studentCount || 0), 0);
  const unpaid = (tenants || []).filter(tenant => tenant.status === 'active' && tenant.currentTermFee && !['paid', 'unknown'].includes(tenant.currentTermFee.status));
  const waiting = (tenants || []).filter(tenant => tenant.approvalStatus !== 'approved' || tenant.paymentStatus !== 'paid');
  const recent = [...(tenants || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6);
  const kpis = finance?.kpis || {};

  return (
    <AmiPage title="Dashboard" subtitle="Welcome to the Ndovera command centre." crumbs={['Dashboard']}>
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}. If your session expired, sign out and back in.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BuildingOffice2Icon} tone="navy" label="Schools" value={summary?.totalTenants ?? '—'} hint={`${summary?.activeTenants ?? 0} active`} />
        <StatCard icon={UserGroupIcon} tone="green" label="Students" value={tenants ? students.toLocaleString() : '—'} hint="on Ndovera" />
        <StatCard icon={BanknotesIcon} tone="gold" label="Ndovera has collected" value={finance ? naira(kpis.collectedAllTime) : '—'} hint={finance ? `${naira(kpis.collectedThisYear)} this year · ${naira(kpis.collectedThisMonth)} this month` : ''} />
        <StatCard icon={ExclamationTriangleIcon} tone="maroon" label="Schools owe Ndovera" value={finance ? naira(kpis.owedTotal ?? kpis.outstanding) : '—'} hint={finance ? `${naira(kpis.outstanding)} invoiced · ${unpaid.length} school${unpaid.length === 1 ? '' : 's'} unpaid this term` : ''} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Money in and out · last 12 months" className="lg:col-span-2" actions={<Link to="/roles/ami/finance" className="text-xs font-bold text-[#191970] underline dark:text-indigo-200">Open Finance</Link>}>
          {finance ? <MoneyChart monthly={finance.monthly} /> : <p className="text-sm text-slate-600 dark:text-slate-300">Loading…</p>}
        </Panel>
        <Panel title="Unpaid this term" actions={<Link to="/roles/ami/finance" className="text-xs font-bold text-[#191970] underline dark:text-indigo-200">Remind</Link>} bodyClassName="p-0">
          <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {unpaid.map(tenant => (
              <li key={tenant.id} className="flex items-center gap-3 px-4 py-2.5">
                <SchoolMark name={tenant.schoolName} logoUrl={tenant.logoUrl} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tenant.schoolName}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{tenant.currentTermFee.term} {tenant.currentTermFee.session}</p></div>
                <TermFeePill fee={tenant.currentTermFee} />
              </li>
            ))}
            {tenants && !unpaid.length ? <li className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">Every active school has paid this term.</li> : null}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Latest payments" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {(finance?.payments || []).slice(0, 6).map(payment => (
              <li key={`${payment.id}-${payment.at}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold">{payment.schoolName}</p><p className="text-xs text-slate-600 dark:text-slate-300">{shortDate(payment.at)} · {payment.method}</p></div>
                <p className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">{naira(payment.amount)}</p>
              </li>
            ))}
            {finance && !finance.payments.length ? <li className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">No payments yet.</li> : null}
          </ul>
        </Panel>
        <Panel title="New schools" actions={<Link to="/roles/ami/tenants" className="text-xs font-bold text-[#191970] underline dark:text-indigo-200">All schools</Link>} bodyClassName="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {recent.map(tenant => (
              <li key={tenant.id} className="flex items-center gap-3 px-4 py-2.5">
                <SchoolMark name={tenant.schoolName} logoUrl={tenant.logoUrl} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tenant.schoolName}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{shortDate(tenant.createdAt)} · {Number(tenant.studentCount || 0)} students</p></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Waiting for you" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {waiting.slice(0, 6).map(tenant => (
              <li key={tenant.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-semibold">{tenant.schoolName}</span>
                <span className="flex shrink-0 gap-1">{tenant.approvalStatus !== 'approved' ? <Pill tone="warn">Approval</Pill> : null}{tenant.paymentStatus !== 'paid' ? <Pill tone="warn">Onboarding</Pill> : null}</span>
              </li>
            ))}
            {tenants && !waiting.length ? <li className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">Nothing waiting.</li> : null}
          </ul>
          {waiting.length ? <div className="border-t border-slate-100 p-3 dark:border-white/5"><Link to="/roles/ami/tenants" className={SECONDARY}>Review in Schools</Link></div> : null}
        </Panel>
      </div>

      <Panel title="Open a school's dashboard"><SchoolAccessPanel /></Panel>
    </AmiPage>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { getAmiAuditLogs } from '../../../features/tenants/services/tenantApi';
import { AmiPage, FIELD, Panel, PRIMARY, SECONDARY, TD, TH } from '../../../features/ami/AmiUi';

// Every recorded action on Ndovera, newest first: when, who, what, and to which school or
// person. Searchable by words and dates; exportable as CSV.
const PAGE_SIZE = 25;

export default function AmiAuditsPage() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [truncated, setTruncated] = useState(false);

  const load = useCallback((next = filters) => {
    setError('');
    return getAmiAuditLogs({ ...next, limit: '500' })
      .then(result => { setLogs(result.logs || []); setTruncated(Boolean(result.truncated)); setPage(1); })
      .catch(err => { setLogs([]); setError(err.message || 'Could not load the audit trail.'); });
  }, [filters]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCsv() {
    const rows = [['When', 'Who', 'Action', 'School / record', 'Details'], ...(logs || []).map(entry => [entry.timestamp, entry.actor, entry.action, entry.target, entry.detail])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `ndovera-audit-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const shown = (logs || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil((logs || []).length / PAGE_SIZE));
  const set = key => event => setFilters(current => ({ ...current, [key]: event.target.value }));

  return (
    <AmiPage title="Audit Trail" subtitle="Every recorded action on Ndovera: who did what, when, and to which school or record." crumbs={['Platform', 'Audit Trail']}>
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      <Panel>
        <form className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto_auto]" onSubmit={event => { event.preventDefault(); load(); }}>
          <input aria-label="Search" className={FIELD} placeholder="Search action, school, person…" value={filters.search} onChange={set('search')} />
          <input aria-label="From date" type="date" className={FIELD} value={filters.from} onChange={set('from')} />
          <input aria-label="To date" type="date" className={FIELD} value={filters.to} onChange={set('to')} />
          <button type="submit" className={PRIMARY}>Search</button>
          <button type="button" className={SECONDARY} onClick={() => { const cleared = { search: '', from: '', to: '' }; setFilters(cleared); load(cleared); }}>Clear</button>
        </form>
      </Panel>

      <Panel
        title={logs ? `${logs.length.toLocaleString()} entr${logs.length === 1 ? 'y' : 'ies'}${truncated ? ' (latest 500 — narrow the dates to see older ones)' : ''}` : 'Entries'}
        actions={<button type="button" className={SECONDARY} disabled={!logs?.length} onClick={exportCsv}>Export CSV</button>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>When</th><th className={TH}>Who</th><th className={TH}>Action</th><th className={TH}>School / record</th><th className={TH}>Details</th></tr></thead>
            <tbody>
              {shown.map(entry => (
                <tr key={entry.id} className="border-t border-slate-100 align-top dark:border-white/5">
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB') : '—'}</td>
                  <td className={`${TD} font-semibold`}>{entry.actor}</td>
                  <td className={`${TD} font-bold text-[#191970] dark:text-indigo-200`}>{entry.action}</td>
                  <td className={TD}>{entry.target || '—'}</td>
                  <td className={`${TD} max-w-md break-words text-xs text-slate-600 dark:text-slate-300`}>{entry.detail}</td>
                </tr>
              ))}
              {logs && !logs.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-600 dark:text-slate-300">No recorded actions match.</td></tr> : null}
              {!logs ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-600 dark:text-slate-300">Loading the audit trail…</td></tr> : null}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <button type="button" className={SECONDARY} disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Page {page} of {pages}</span>
            <button type="button" className={SECONDARY} disabled={page === pages} onClick={() => setPage(current => Math.min(pages, current + 1))}>Next</button>
          </div>
        ) : null}
      </Panel>
    </AmiPage>
  );
}

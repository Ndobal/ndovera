import React, { useMemo } from 'react';

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/25 dark:bg-[#1a001d]/80 dark:text-[#bf00ff]';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

export default function PayrollAccountDetailsPanel({
  rows,
  loading,
  monthLabel,
  onRowFieldChange,
  onPersistRow,
  savingRowId,
  canEdit,
}) {
  const totalNetPay = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row?.net ?? row?.computedNet ?? 0), 0),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#800000] dark:text-[#0000ff]">Staff Account Details</h3>
            <p className="mt-2 max-w-3xl text-sm text-[#191970] dark:text-[#39ff14]">
              Keep each staff member&apos;s salary account information here so payroll notes and monthly printouts always pull the latest bank details.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={BADGE}>{monthLabel}</span>
            <span className={BADGE}>{rows.length} staff rows</span>
            <span className={BADGE}>Total net pay {formatNaira(totalNetPay)}</span>
          </div>
        </div>
      </div>

      <div className={CARD}>
        {loading ? (
          <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Loading payroll account rows...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">No payroll rows are available for account details.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead>
                <tr>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">S/N</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Staff Name</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Role</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Bank Name</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Account Name</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Account Number</th>
                  <th className="border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`account-details-row-${row.id}`} className="bg-white/35 hover:bg-white/60 dark:bg-[#120014]/55 dark:hover:bg-[#1a0020]">
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">{index + 1}</td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">
                      <p className="font-semibold text-[#191970] dark:text-white">{row.name}</p>
                      <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{row.displayId}</p>
                    </td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">
                      <p className="font-semibold capitalize text-[#191970] dark:text-white">{row.role}</p>
                    </td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">
                      <input
                        type="text"
                        value={row.bankName || ''}
                        disabled={!canEdit}
                        onChange={(event) => onRowFieldChange(row.id, 'bankName', event.target.value)}
                        onBlur={() => onPersistRow(row.id)}
                        placeholder="Bank name"
                        className={INPUT}
                      />
                    </td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">
                      <input
                        type="text"
                        value={row.accountName || ''}
                        disabled={!canEdit}
                        onChange={(event) => onRowFieldChange(row.id, 'accountName', event.target.value)}
                        onBlur={() => onPersistRow(row.id)}
                        placeholder="Account name"
                        className={INPUT}
                      />
                    </td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15">
                      <input
                        type="text"
                        value={row.accountNumber || ''}
                        disabled={!canEdit}
                        onChange={(event) => onRowFieldChange(row.id, 'accountNumber', event.target.value)}
                        onBlur={() => onPersistRow(row.id)}
                        placeholder="Account number"
                        className={INPUT}
                      />
                      <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{savingRowId === row.id ? 'Saving...' : 'Blur to save'}</p>
                    </td>
                    <td className="border border-[#c9a96e]/30 p-2 align-top font-bold text-[#1a5c38] dark:border-[#00ffff]/15 dark:text-[#00ffff]">
                      {formatNaira(row.net ?? row.computedNet ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

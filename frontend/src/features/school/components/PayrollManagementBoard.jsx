import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approvePayroll,
  getBranding,
  getPayroll,
  getPayrollHistory,
  getPayrollSettings,
  getPeople,
  savePayrollSettings,
  submitPayroll,
  updatePayrollStaff,
} from '../services/schoolApi';

const TABS = ['Payroll Sheet', 'Payslips', 'History', 'Settings'];
const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const OUTLINE_BTN = 'rounded-2xl border border-[#800020]/30 bg-white/60 px-5 py-2.5 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/25 dark:bg-[#1a001d]/80 dark:text-[#bf00ff]';
const TH = 'border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white';
const TD = 'border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function formatPeriod(period) {
  if (!period) {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  const [year, month] = String(period).split('-').map(Number);
  if (!year || !month) {
    return period;
  }

  return new Date(year, month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

function rowGross(staffRow) {
  return (
    Number(staffRow?.basicSalary || 0) +
    Number(staffRow?.housingAllowance || 0) +
    Number(staffRow?.transportAllowance || 0) +
    Number(staffRow?.bonus || 0)
  );
}

function rowManualDeductions(staffRow) {
  return (
    Number(staffRow?.tax || 0) +
    Number(staffRow?.pension || 0) +
    Number(staffRow?.otherDeduction || 0)
  );
}

function rowTotalDeductions(staffRow) {
  return rowManualDeductions(staffRow) + Number(staffRow?.autoLateDeduction || 0);
}

function rowNet(staffRow) {
  return rowGross(staffRow) - rowTotalDeductions(staffRow);
}

function findLateChargeSummary(person, lateChargeSummaries = []) {
  const identifiers = new Set([
    String(person?.id || '').trim().toLowerCase(),
    String(person?.email || '').trim().toLowerCase(),
    String(person?.displayId || '').trim().toLowerCase(),
  ].filter(Boolean));

  return lateChargeSummaries.find(summary => identifiers.has(String(summary?.staffId || '').trim().toLowerCase())) || { amount: 0, count: 0 };
}

function buildPayrollRows(people, payrollEntries, settings, lateChargeSummaries = []) {
  const payrollMap = (payrollEntries || []).reduce((map, entry) => {
    const staffId = String(entry?.staffId || entry?.id || '').trim();
    if (staffId) {
      map[staffId] = entry;
    }
    return map;
  }, {});

  return (people || [])
    .filter((person) => !['student', 'parent'].includes(String(person?.role || '').toLowerCase()))
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
    .map((person) => {
      const entry = payrollMap[String(person?.id || '')] || {};
      const gross = Number(entry?.gross || 0);
      const manualDeductions = Number((entry?.manualDeductions ?? entry?.deductions) || 0);
      const lateChargeSummary = findLateChargeSummary(person, lateChargeSummaries);
      const housingAllowanceDefault = Number(settings?.housingAllowance || 0);
      const transportAllowanceDefault = Number(settings?.transportAllowance || 0);
      const totalAllowanceDefault = housingAllowanceDefault + transportAllowanceDefault;

      const housingAllowance = gross >= totalAllowanceDefault ? housingAllowanceDefault : 0;
      const transportAllowance = gross >= totalAllowanceDefault ? transportAllowanceDefault : 0;
      const bonus = 0;
      const basicSalary = Math.max(gross - housingAllowance - transportAllowance - bonus, 0);

      const taxRate = Number(settings?.taxRate || 0);
      const pensionRate = Number(settings?.pensionRate || 0);
      const projectedTax = Math.round((gross * taxRate) / 100);
      const tax = Math.min(projectedTax, manualDeductions);
      const projectedPension = Math.round((gross * pensionRate) / 100);
      const pension = Math.min(projectedPension, Math.max(manualDeductions - tax, 0));
      const otherDeduction = Math.max(manualDeductions - tax - pension, 0);

      return {
        id: String(person?.id || ''),
        displayId: person?.displayId || person?.id || '-',
        name: person?.name || person?.displayId || person?.id || 'Staff',
        role: person?.role || 'staff',
        basicSalary,
        housingAllowance,
        transportAllowance,
        bonus,
        tax,
        pension,
        otherDeduction,
        autoLateDeduction: Number((entry?.autoLateDeductions ?? lateChargeSummary.amount) || 0),
        lateChargeCount: Number((entry?.lateChargeCount ?? lateChargeSummary.count) || 0),
        status: entry?.status || 'Ready',
      };
    });
}

function PayslipModal({ branding, monthLabel, staffRow, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className={`${CARD} w-full max-w-2xl`} id="payroll-payslip-print">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">{branding?.schoolName || 'School Payroll'}</h3>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Payslip for {monthLabel}</p>
          </div>
          <span className={BADGE}>{staffRow.status}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={INNER}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Staff Name</p>
            <p className="mt-2 text-lg font-bold text-[#191970] dark:text-white">{staffRow.name}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Staff ID</p>
            <p className="mt-2 font-semibold text-[#191970] dark:text-white">{staffRow.displayId}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Role</p>
            <p className="mt-2 font-semibold capitalize text-[#191970] dark:text-white">{staffRow.role}</p>
          </div>

          <div className={INNER}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Net Pay</p>
            <p className="mt-3 text-3xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(rowNet(staffRow))}</p>
            <p className="mt-4 text-sm text-[#191970] dark:text-[#39ff14]">Gross {formatNaira(rowGross(staffRow))}</p>
            <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Deductions {formatNaira(rowTotalDeductions(staffRow))}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={INNER}>
            <p className="text-sm font-bold text-[#800000] dark:text-[#0000ff]">Earnings</p>
            <div className="mt-4 space-y-3 text-sm text-[#191970] dark:text-white">
              <div className="flex items-center justify-between"><span>Basic Salary</span><span>{formatNaira(staffRow.basicSalary)}</span></div>
              <div className="flex items-center justify-between"><span>Housing Allowance</span><span>{formatNaira(staffRow.housingAllowance)}</span></div>
              <div className="flex items-center justify-between"><span>Transport Allowance</span><span>{formatNaira(staffRow.transportAllowance)}</span></div>
              <div className="flex items-center justify-between"><span>Bonus</span><span>{formatNaira(staffRow.bonus)}</span></div>
              <div className="border-t border-[#c9a96e]/30 pt-3 font-bold text-[#800000] dark:text-[#0000ff]"><div className="flex items-center justify-between"><span>Gross Pay</span><span>{formatNaira(rowGross(staffRow))}</span></div></div>
            </div>
          </div>

          <div className={INNER}>
            <p className="text-sm font-bold text-[#800000] dark:text-[#0000ff]">Deductions</p>
            <div className="mt-4 space-y-3 text-sm text-[#191970] dark:text-white">
              <div className="flex items-center justify-between"><span>Tax</span><span>{formatNaira(staffRow.tax)}</span></div>
              <div className="flex items-center justify-between"><span>Pension</span><span>{formatNaira(staffRow.pension)}</span></div>
              <div className="flex items-center justify-between"><span>Other</span><span>{formatNaira(staffRow.otherDeduction)}</span></div>
              <div className="flex items-center justify-between"><span>Lateness Charges</span><span>{formatNaira(staffRow.autoLateDeduction)}</span></div>
              {staffRow.lateChargeCount > 0 ? <p className="text-xs text-[#800020] dark:text-[#bf00ff]">Applied from {staffRow.lateChargeCount} late sign-in record{staffRow.lateChargeCount === 1 ? '' : 's'}.</p> : null}
              <div className="border-t border-[#c9a96e]/30 pt-3 font-bold text-[#800000] dark:text-[#0000ff]"><div className="flex items-center justify-between"><span>Total Deductions</span><span>{formatNaira(rowTotalDeductions(staffRow))}</span></div></div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => window.print()} className={BTN}>Print Payslip</button>
          <button onClick={onClose} className={OUTLINE_BTN}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PayrollManagementBoard({ canApprove = false }) {
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [settingsForm, setSettingsForm] = useState({
    housingAllowance: 0,
    transportAllowance: 0,
    taxRate: 7.5,
    pensionRate: 8,
  });
  const [branding, setBranding] = useState(null);
  const [approved, setApproved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadBoard() {
      setLoading(true);

      try {
        const [peopleResult, payrollResult, historyResult, settingsResult, brandingResult] = await Promise.all([
          getPeople(),
          getPayroll(),
          getPayrollHistory(),
          getPayrollSettings(),
          getBranding(),
        ]);

        if (ignore) {
          return;
        }

        const nextSettings = {
          housingAllowance: 0,
          transportAllowance: 0,
          taxRate: 7.5,
          pensionRate: 8,
          ...(settingsResult?.settings || {}),
        };

        setSettingsForm(nextSettings);
        setRows(buildPayrollRows(peopleResult?.people || [], payrollResult?.payroll || [], nextSettings, payrollResult?.lateChargeSummaries || []));
        setHistory(historyResult?.history || []);
        setBranding(brandingResult?.branding || null);
        setApproved(Boolean(payrollResult?.approved));
        setSubmitted(Boolean(payrollResult?.submitted));
        setPeriod(payrollResult?.period || new Date().toISOString().slice(0, 7));
      } catch (error) {
        if (!ignore) {
          showToast(error.message || 'Could not load payroll.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadBoard();

    return () => {
      ignore = true;
    };
  }, [canApprove, showToast]);

  function updateRowField(staffId, field, value) {
    const numericFields = new Set([
      'basicSalary',
      'housingAllowance',
      'transportAllowance',
      'bonus',
      'tax',
      'pension',
      'otherDeduction',
    ]);
    const nextValue = numericFields.has(field) ? Number(value || 0) : value;

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === staffId
          ? {
              ...row,
              [field]: nextValue,
            }
          : row,
      ),
    );
  }

  async function persistRow(staffId) {
    const targetRow = rows.find((row) => row.id === staffId);
    if (!targetRow) {
      return;
    }

    setSavingRowId(staffId);

    try {
      await updatePayrollStaff(staffId, {
        gross: rowGross(targetRow),
        deductions: rowManualDeductions(targetRow),
        status: targetRow.status,
      });
      showToast(`Saved ${targetRow.name}.`);
    } catch (error) {
      showToast(error.message || 'Could not save payroll row.');
    } finally {
      setSavingRowId('');
    }
  }

  async function handleApprovalAction() {
    const confirmation = canApprove
      ? 'Approve payroll for this period?'
      : 'Submit payroll for owner approval?';

    if (!window.confirm(confirmation)) {
      return;
    }

    setActionBusy(canApprove ? 'approve' : 'submit');

    try {
      if (canApprove) {
        await approvePayroll();
        setApproved(true);
        showToast('Payroll approved.');
      } else {
        await submitPayroll();
        setSubmitted(true);
        showToast('Payroll submitted for owner approval.');
      }
    } catch (error) {
      showToast(error.message || 'Could not complete payroll action.');
    } finally {
      setActionBusy('');
    }
  }

  async function saveSettings() {
    setSavingSettings(true);

    try {
      await savePayrollSettings(settingsForm);
      showToast('Payroll settings saved.');
    } catch (error) {
      showToast(error.message || 'Could not save payroll settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  const monthLabel = formatPeriod(period);
  const payrollTotals = useMemo(() => {
    return rows.reduce(
      (totals, row) => {
        totals.gross += rowGross(row);
        totals.manualDeductions += rowManualDeductions(row);
        totals.autoLateDeductions += Number(row.autoLateDeduction || 0);
        totals.deductions += rowTotalDeductions(row);
        totals.net += rowNet(row);
        totals.count += 1;
        return totals;
      },
      { gross: 0, manualDeductions: 0, autoLateDeductions: 0, deductions: 0, net: 0, count: 0 },
    );
  }, [rows]);

  const inputsLocked = approved || (!canApprove && submitted);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] shadow-xl dark:bg-[#00ffff] dark:text-black">
          {toast}
        </div>
      ) : null}

      <div className={CARD}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Payroll Management</h2>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
              Use the same spreadsheet-style flow as fees: break down earnings, review deductions, and print payslips.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={BADGE}>{monthLabel}</span>
            {submitted && !canApprove ? <span className={BADGE}>Pending Owner Approval</span> : null}
            {approved ? <span className={BADGE}>Approved</span> : null}
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={BADGE}>Owner</span>
          <span className={BADGE}>Head Of School</span>
          <span className={BADGE}>Accountant</span>
          {canApprove ? <span className={BADGE}>Owner Approval Desk</span> : <span className={BADGE}>Submission Desk</span>}
        </div>
      </div>

      <div className={CARD}>
        <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Payroll behavior</p>
        <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
          Editing earnings or manual deductions recalculates gross and net. Lateness charges now flow in automatically from staff attendance late sign-ins for the current month.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((label, index) => (
          <button
            key={label}
            onClick={() => setTab(index)}
            className={index === tab ? BTN : OUTLINE_BTN}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className={CARD}>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total Gross</p>
              <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{formatNaira(payrollTotals.gross)}</h3>
            </div>
            <div className={CARD}>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total Deductions</p>
              <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(payrollTotals.deductions)}</h3>
            </div>
            <div className={CARD}>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total Net Pay</p>
              <h3 className="mt-3 text-3xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(payrollTotals.net)}</h3>
            </div>
            <div className={CARD}>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Staff Count</p>
              <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{payrollTotals.count}</h3>
            </div>
          </div>

          <div className={CARD}>
            {loading ? (
              <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Loading payroll sheet...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">No staff payroll rows found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[2200px] w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH}>S/N</th>
                      <th className={TH}>Staff ID</th>
                      <th className={TH}>Staff Name</th>
                      <th className={TH}>Role</th>
                      <th className={TH}>Basic Salary</th>
                      <th className={TH}>Housing</th>
                      <th className={TH}>Transport</th>
                      <th className={TH}>Bonus</th>
                      <th className={TH}>Gross</th>
                      <th className={TH}>Tax</th>
                      <th className={TH}>Pension</th>
                      <th className={TH}>Other Deductions</th>
                      <th className={TH}>Late Charges</th>
                      <th className={TH}>Total Deductions</th>
                      <th className={TH}>Net Pay</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id} className="bg-white/35 hover:bg-white/60 dark:bg-[#120014]/55 dark:hover:bg-[#1a0020]">
                        <td className={TD}>{index + 1}</td>
                        <td className={TD}>{row.displayId}</td>
                        <td className={TD}>
                          <p className="font-semibold text-[#191970] dark:text-white">{row.name}</p>
                        </td>
                        <td className={TD}>
                          <p className="font-semibold capitalize text-[#191970] dark:text-white">{row.role}</p>
                        </td>
                        {[
                          'basicSalary',
                          'housingAllowance',
                          'transportAllowance',
                          'bonus',
                        ].map((field) => (
                          <td key={`${row.id}-${field}`} className={TD}>
                            <input
                              type="number"
                              value={row[field]}
                              disabled={inputsLocked}
                              onChange={(event) => updateRowField(row.id, field, event.target.value)}
                              onBlur={() => persistRow(row.id)}
                              className={INPUT}
                            />
                          </td>
                        ))}
                        <td className={`${TD} font-bold text-[#800000] dark:text-[#0000ff]`}>{formatNaira(rowGross(row))}</td>
                        {['tax', 'pension', 'otherDeduction'].map((field) => (
                          <td key={`${row.id}-${field}`} className={TD}>
                            <input
                              type="number"
                              value={row[field]}
                              disabled={inputsLocked}
                              onChange={(event) => updateRowField(row.id, field, event.target.value)}
                              onBlur={() => persistRow(row.id)}
                              className={INPUT}
                            />
                          </td>
                        ))}
                        <td className={TD}>
                          <p className="font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(row.autoLateDeduction)}</p>
                          {row.lateChargeCount > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{row.lateChargeCount} late mark{row.lateChargeCount === 1 ? '' : 's'}</p> : <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Auto</p>}
                        </td>
                        <td className={`${TD} font-bold text-[#800000] dark:text-[#ff6bff]`}>{formatNaira(rowTotalDeductions(row))}</td>
                        <td className={`${TD} font-bold text-[#1a5c38] dark:text-[#00ffff]`}>{formatNaira(rowNet(row))}</td>
                        <td className={TD}>
                          <select
                            value={row.status}
                            disabled={inputsLocked}
                            onChange={(event) => updateRowField(row.id, 'status', event.target.value)}
                            onBlur={() => persistRow(row.id)}
                            className={INPUT}
                          >
                            <option value="Ready">Ready</option>
                            <option value="Hold">Hold</option>
                            <option value="Paid">Paid</option>
                          </select>
                          <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">
                            {savingRowId === row.id ? 'Saving...' : 'Blur to save'}
                          </p>
                        </td>
                        <td className={TD}>
                          <button onClick={() => setSelectedPayslip(row)} className={BTN}>Payslip</button>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-[#f0d090] font-bold dark:bg-[#220022]">
                      <td colSpan={8} className={TD}>TOTAL</td>
                      <td className={TD}>{formatNaira(payrollTotals.gross)}</td>
                      <td className={TD}>-</td>
                      <td className={TD}>-</td>
                      <td className={TD}>{formatNaira(payrollTotals.manualDeductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.autoLateDeductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.deductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.net)}</td>
                      <td className={TD}>-</td>
                      <td className={TD}>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            onClick={handleApprovalAction}
            disabled={actionBusy !== '' || approved || (!canApprove && submitted)}
            className={`${BTN} w-full py-4 text-base`}
          >
            {approved
              ? 'Payroll Approved'
              : canApprove
                ? actionBusy === 'approve'
                  ? 'Approving...'
                  : 'Approve Payroll'
                : submitted
                  ? 'Pending Owner Approval'
                  : actionBusy === 'submit'
                    ? 'Submitting...'
                    : 'Submit For Owner Approval'}
          </button>
        </div>
      ) : null}

      {tab === 1 ? (
        <div className={CARD}>
          <h3 className="text-xl font-bold text-[#800000] dark:text-[#0000ff]">Payslips - {monthLabel}</h3>
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div key={`payslip-${row.id}`} className={`${INNER} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
                <div>
                  <p className="text-lg font-bold text-[#191970] dark:text-white">{row.name}</p>
                  <p className="mt-1 text-sm capitalize text-[#800020] dark:text-[#bf00ff]">{row.role} · {row.displayId}</p>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Net pay {formatNaira(rowNet(row))}</p>
                  {row.autoLateDeduction > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Includes {formatNaira(row.autoLateDeduction)} lateness charge{row.lateChargeCount === 1 ? '' : 's'}.</p> : null}
                </div>
                <button onClick={() => setSelectedPayslip(row)} className={BTN}>View Payslip</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 2 ? (
        <div className={CARD}>
          <h3 className="text-xl font-bold text-[#800000] dark:text-[#0000ff]">Payroll History</h3>
          {history.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">No payroll history yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {history.map((entry, index) => (
                <div key={`${entry.period || entry.month || index}`} className={`${INNER} flex flex-col gap-2 md:flex-row md:items-center md:justify-between`}>
                  <div>
                    <p className="text-lg font-bold text-[#191970] dark:text-white">{formatPeriod(entry.period || entry.month)}</p>
                    <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Total net {formatNaira(entry.totalNet)}</p>
                  </div>
                  <span className={BADGE}>{entry.status || 'draft'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 3 ? (
        <div className={CARD}>
          <h3 className="text-xl font-bold text-[#800000] dark:text-[#0000ff]">Payroll Settings</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ['Housing Allowance (₦)', 'housingAllowance'],
              ['Transport Allowance (₦)', 'transportAllowance'],
              ['Tax Rate (%)', 'taxRate'],
              ['Pension Rate (%)', 'pensionRate'],
            ].map(([label, key]) => (
              <label key={key} className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
                {label}
                <input
                  type="number"
                  value={settingsForm[key]}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      [key]: Number(event.target.value || 0),
                    }))
                  }
                  className={`${INPUT} mt-2`}
                />
              </label>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={saveSettings} disabled={savingSettings} className={BTN}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      ) : null}

      {selectedPayslip ? (
        <PayslipModal
          branding={branding}
          monthLabel={monthLabel}
          staffRow={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
        />
      ) : null}
    </div>
  );
}

export default PayrollManagementBoard;
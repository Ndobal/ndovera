import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredAuth } from '../../auth/services/authApi';
import {
  approvePayroll,
  getBranding,
  getPayroll,
  getPayrollHistory,
  getPayrollNote,
  getPayrollSettings,
  getWebsiteSections,
  savePayrollNote,
  savePayrollSettings,
  submitPayroll,
  updatePayrollStaff,
} from '../services/schoolApi';
import PayrollAccountDetailsPanel from './PayrollAccountDetailsPanel';
import PayrollBankNotePanel from './PayrollBankNotePanel';

const TABS = ['Payroll Sheet', 'Payslips', 'Account Details', 'Payroll Notes', 'History', 'Settings'];
const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const OUTLINE_BTN = 'rounded-2xl border border-[#800020]/30 bg-white/60 px-5 py-2.5 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]';
const ICON_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#800020]/30 bg-white/80 text-lg font-bold text-[#800020] transition-colors hover:bg-white dark:border-[#00ffff]/30 dark:bg-[#120014]/85 dark:text-[#00ffff] dark:hover:bg-[#1f0022]';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/25 dark:bg-[#1a001d]/80 dark:text-[#bf00ff]';
const TH = 'border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white';
const TD = 'border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15';

const DEFAULT_PAYROLL_SETTINGS = {
  housingAllowance: 0,
  transportAllowance: 0,
  taxRate: 7.5,
  pensionRate: 8,
  earningColumns: [
    { key: 'basicSalary', label: 'Basic Salary', fixed: true },
    { key: 'housingAllowance', label: 'Housing Allowance', fixed: true },
    { key: 'transportAllowance', label: 'Transport Allowance', fixed: true },
    { key: 'bonus', label: 'Bonus', fixed: true },
  ],
  deductionColumns: [
    { key: 'tax', label: 'Income Tax', fixed: true },
    { key: 'pension', label: 'Pension', fixed: true },
    { key: 'otherDeduction', label: 'Other Deductions', fixed: true },
  ],
};

const DEFAULT_EARNING_LABELS = new Map(DEFAULT_PAYROLL_SETTINGS.earningColumns.map(column => [column.key, column.label]));
const DEFAULT_DEDUCTION_LABELS = new Map(DEFAULT_PAYROLL_SETTINGS.deductionColumns.map(column => [column.key, column.label]));
const PAYROLL_IMPORT_FIELDS = [
  { field: 'staffId', labels: ['Staff ID', 'Staff Id', 'Employee ID', 'Staff Number', 'ID'] },
  { field: 'staffName', labels: ['Staff Name', 'Employee Name', 'Name'] },
  { field: 'role', labels: ['Role', 'Staff Role'] },
  { field: 'employmentCategory', labels: ['Employment Category', 'Employment Type', 'Category'] },
  { field: 'paymentStatus', labels: ['Status', 'Payment Status'] },
  { field: 'bankName', labels: ['Bank Name'] },
  { field: 'accountName', labels: ['Account Name'] },
  { field: 'accountNumber', labels: ['Account Number', 'Acct Number'] },
];

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeColumnKey(value, fallback) {
  return String(value || fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function normalizeColumnLabel(value, fallback) {
  return String(value || fallback || '').trim().slice(0, 80) || fallback;
}

function normalizeColumnList(values, defaults, prefix) {
  const defaultMap = new Map(defaults.map(column => [column.key, column]));
  const rawValues = Array.isArray(values) ? values : [];
  const usedKeys = new Set();

  const normalizedDefaults = defaults.map(defaultColumn => {
    const match = rawValues.find(column => normalizeColumnKey(column?.key || column?.label, defaultColumn.key) === defaultColumn.key) || {};
    usedKeys.add(defaultColumn.key);
    return {
      key: defaultColumn.key,
      label: normalizeColumnLabel(match.label, defaultColumn.label),
      fixed: true,
    };
  });

  const customColumns = rawValues
    .map((column, index) => {
      const key = normalizeColumnKey(column?.key || column?.label, `${prefix}_${index + 1}`);
      if (!key || usedKeys.has(key) || defaultMap.has(key)) return null;
      usedKeys.add(key);
      return {
        key,
        label: normalizeColumnLabel(column?.label, key),
        fixed: false,
      };
    })
    .filter(Boolean);

  return [...normalizedDefaults, ...customColumns];
}

function normalizePayrollSettings(settings = {}) {
  return {
    ...DEFAULT_PAYROLL_SETTINGS,
    ...settings,
    earningColumns: normalizeColumnList(settings?.earningColumns, DEFAULT_PAYROLL_SETTINGS.earningColumns, 'earning'),
    deductionColumns: normalizeColumnList(settings?.deductionColumns, DEFAULT_PAYROLL_SETTINGS.deductionColumns, 'deduction'),
  };
}

function normalizeNumericMap(value = {}) {
  return Object.entries(value || {}).reduce((accumulator, [key, rawValue]) => {
    const normalizedKey = normalizeColumnKey(key, key);
    if (!normalizedKey) return accumulator;
    accumulator[normalizedKey] = Number(rawValue || 0);
    return accumulator;
  }, {});
}

function sumNumericMap(values = {}) {
  return Object.values(values || {}).reduce((sum, value) => sum + (Number(value || 0) || 0), 0);
}

function extractContactInfo(sections = []) {
  const contactSection = (sections || []).find(section => String(section?.section_key || '') === 'contact');
  const metadata = parseMetadata(contactSection?.metadata);
  return {
    address: String(metadata.address || '').trim(),
    phone: String(metadata.phone || '').trim(),
    email: String(metadata.email || '').trim(),
  };
}

function getRowEarningValue(staffRow, columnKey) {
  return columnKey === 'basicSalary'
    ? Number(staffRow?.basicSalary || 0)
    : Number(staffRow?.allowancesMap?.[columnKey] || 0);
}

function getRowDeductionValue(staffRow, columnKey) {
  return Number(staffRow?.deductionsMap?.[columnKey] || 0);
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

function buildDefaultPayrollNoteText(period) {
  return `Please process payroll for ${formatPeriod(period)} and credit each listed staff account with the corresponding net pay for the month.`;
}

function rowGross(staffRow) {
  return Number(staffRow?.basicSalary || 0) + sumNumericMap(staffRow?.allowancesMap || {});
}

function rowManualDeductions(staffRow) {
  return sumNumericMap(staffRow?.deductionsMap || {});
}

function rowTotalDeductions(staffRow) {
  return rowManualDeductions(staffRow) + Number(staffRow?.autoAttendanceDeduction ?? (Number(staffRow?.autoLateDeduction || 0) + Number(staffRow?.autoAbsenceDeduction || 0)));
}

function rowNet(staffRow) {
  return rowGross(staffRow) - rowTotalDeductions(staffRow);
}

function buildPayrollRows(payrollEntries = []) {
  return [...payrollEntries]
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
    .map((entry) => {
      const allowancesMap = normalizeNumericMap({
        ...(entry?.allowancesMap || {}),
        housingAllowance: entry?.housingAllowance,
        transportAllowance: entry?.transportAllowance,
        bonus: entry?.bonus,
      });
      const deductionsMap = normalizeNumericMap({
        ...(entry?.deductionsMap || {}),
        tax: entry?.tax,
        pension: entry?.pension,
        otherDeduction: entry?.otherDeduction,
      });

      return {
        id: String(entry?.staffId || entry?.id || ''),
        displayId: entry?.displayId || entry?.email || '-',
        name: entry?.name || entry?.displayId || entry?.email || 'Staff',
        role: entry?.primaryRole || entry?.role || 'staff',
        employmentCategory: entry?.employmentCategory || 'support',
        basicSalary: Number(entry?.basicSalary || 0),
        housingAllowance: Number(allowancesMap.housingAllowance || 0),
        transportAllowance: Number(allowancesMap.transportAllowance || 0),
        bonus: Number(allowancesMap.bonus || 0),
        tax: Number(deductionsMap.tax || 0),
        pension: Number(deductionsMap.pension || 0),
        otherDeduction: Number(deductionsMap.otherDeduction || 0),
        allowancesMap,
        deductionsMap,
        autoLateDeduction: Number(entry?.autoLateDeductions || 0),
        autoAbsenceDeduction: Number(entry?.autoAbsenceDeductions || 0),
        autoAttendanceDeduction: Number(entry?.autoAttendanceDeductions || (Number(entry?.autoLateDeductions || 0) + Number(entry?.autoAbsenceDeductions || 0))),
        lateChargeCount: Number(entry?.lateChargeCount || 0),
        absenceChargeCount: Number(entry?.absenceChargeCount || 0),
        approvedAbsenceDays: Number(entry?.approvedAbsenceDays || 0),
        expectedAttendanceDays: Number(entry?.expectedAttendanceDays || 0),
        recordedAttendanceDays: Number(entry?.recordedAttendanceDays || 0),
        status: entry?.status || 'Ready',
        paymentStatus: String(entry?.paymentStatus || 'pending').toLowerCase(),
        bankName: String(entry?.bankName || ''),
        accountName: String(entry?.accountName || ''),
        accountNumber: String(entry?.accountNumber || ''),
      };
    });
}

function buildPayslipEarnings(staffRow, settings) {
  return settings.earningColumns
    .map(column => ({ key: column.key, label: column.label, amount: getRowEarningValue(staffRow, column.key) }))
    .filter(entry => entry.amount > 0 || entry.key === 'basicSalary');
}

function buildPayslipDeductions(staffRow, settings) {
  return [
    ...settings.deductionColumns.map(column => ({ key: column.key, label: column.label, amount: getRowDeductionValue(staffRow, column.key) })),
    { key: 'lateCharges', label: 'Lateness Charges', amount: Number(staffRow?.autoLateDeduction || 0) },
    { key: 'absenceCharges', label: 'Absenteeism Charges', amount: Number(staffRow?.autoAbsenceDeduction || 0) },
  ].filter(entry => entry.amount > 0);
}

function normalizeImportToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function readImportedText(value) {
  return String(value ?? '').trim();
}

function readImportedNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const sanitizedValue = String(value).replace(/,/g, '').trim();
  if (!sanitizedValue) {
    return null;
  }

  const parsedValue = Number(sanitizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeOptionValue(value, allowedValues = []) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  return allowedValues.includes(normalizedValue) ? normalizedValue : '';
}

async function loadSpreadsheetModule() {
  return import('xlsx');
}

function downloadBlob(blob, filename) {
  if (typeof window === 'undefined') {
    return;
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(downloadUrl);
}

function buildPayrollTemplateColumns(settings) {
  return [
    { kind: 'field', field: 'displayId', label: 'Staff ID' },
    { kind: 'field', field: 'name', label: 'Staff Name' },
    { kind: 'field', field: 'role', label: 'Role' },
    { kind: 'field', field: 'employmentCategory', label: 'Employment Category' },
    { kind: 'field', field: 'paymentStatus', label: 'Status' },
    { kind: 'field', field: 'bankName', label: 'Bank Name' },
    { kind: 'field', field: 'accountName', label: 'Account Name' },
    { kind: 'field', field: 'accountNumber', label: 'Account Number' },
    ...settings.earningColumns.map(column => ({ kind: 'earning', key: column.key, label: column.label })),
    ...settings.deductionColumns.map(column => ({ kind: 'deduction', key: column.key, label: column.label })),
  ];
}

function buildPayrollImportLookup(settings) {
  const lookup = new Map();

  const register = (label, descriptor) => {
    const token = normalizeImportToken(label);
    if (!token || lookup.has(token)) {
      return;
    }

    lookup.set(token, descriptor);
  };

  PAYROLL_IMPORT_FIELDS.forEach(({ field, labels }) => {
    labels.forEach(label => register(label, { kind: 'field', field }));
  });

  settings.earningColumns.forEach((column) => {
    const descriptor = { kind: 'earning', key: column.key };
    register(column.label, descriptor);
    register(column.key, descriptor);
    register(DEFAULT_EARNING_LABELS.get(column.key), descriptor);
  });

  settings.deductionColumns.forEach((column) => {
    const descriptor = { kind: 'deduction', key: column.key };
    register(column.label, descriptor);
    register(column.key, descriptor);
    register(DEFAULT_DEDUCTION_LABELS.get(column.key), descriptor);
  });

  return lookup;
}

async function readPayrollWorkbook(file, settings) {
  const XLSX = await loadSpreadsheetModule();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The selected workbook has no sheets.');
  }

  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: false,
  });

  if (!sheetRows.length) {
    throw new Error('The selected workbook is empty.');
  }

  const lookup = buildPayrollImportLookup(settings);
  const headerDescriptors = sheetRows[0].map(header => lookup.get(normalizeImportToken(header)) || null);
  const recognizedColumns = headerDescriptors.filter(Boolean).length;

  if (!recognizedColumns) {
    throw new Error('No recognised payroll headings were found. Download the payroll template and use those headings.');
  }

  return sheetRows
    .slice(1)
    .map((cells) => {
      const importedRow = {
        staffId: '',
        staffName: '',
        employmentCategory: '',
        paymentStatus: '',
        bankName: '',
        accountName: '',
        accountNumber: '',
        earnings: {},
        deductions: {},
      };

      headerDescriptors.forEach((descriptor, index) => {
        if (!descriptor) {
          return;
        }

        const cellValue = cells[index];

        if (descriptor.kind === 'field') {
          const textValue = readImportedText(cellValue);
          if (!textValue) {
            return;
          }

          if (descriptor.field === 'paymentStatus') {
            importedRow.paymentStatus = textValue;
            return;
          }

          importedRow[descriptor.field] = textValue;
          return;
        }

        const numericValue = readImportedNumber(cellValue);
        if (numericValue === null) {
          return;
        }

        if (descriptor.kind === 'earning') {
          importedRow.earnings[descriptor.key] = numericValue;
          return;
        }

        importedRow.deductions[descriptor.key] = numericValue;
      });

      return importedRow;
    })
    .filter(importedRow => importedRow.staffId || importedRow.staffName);
}

function applyImportedPayrollRow(row, importedRow) {
  const allowancesMap = { ...row.allowancesMap };
  const deductionsMap = { ...row.deductionsMap };

  Object.entries(importedRow.earnings || {}).forEach(([key, value]) => {
    allowancesMap[key] = Number(value || 0);
  });

  Object.entries(importedRow.deductions || {}).forEach(([key, value]) => {
    deductionsMap[key] = Number(value || 0);
  });

  const nextEmploymentCategory = normalizeOptionValue(importedRow.employmentCategory, ['academic', 'administrative', 'support', 'contract']) || row.employmentCategory;
  const nextPaymentStatus = normalizeOptionValue(importedRow.paymentStatus, ['pending', 'processing', 'paid', 'failed']) || row.paymentStatus;

  return {
    ...row,
    employmentCategory: nextEmploymentCategory,
    paymentStatus: nextPaymentStatus,
    bankName: importedRow.bankName || row.bankName,
    accountName: importedRow.accountName || row.accountName,
    accountNumber: importedRow.accountNumber || row.accountNumber,
    basicSalary: Object.prototype.hasOwnProperty.call(importedRow.earnings || {}, 'basicSalary')
      ? Number(importedRow.earnings.basicSalary || 0)
      : row.basicSalary,
    allowancesMap,
    housingAllowance: Number(allowancesMap.housingAllowance || 0),
    transportAllowance: Number(allowancesMap.transportAllowance || 0),
    bonus: Number(allowancesMap.bonus || 0),
    deductionsMap,
    tax: Number(deductionsMap.tax || 0),
    pension: Number(deductionsMap.pension || 0),
    otherDeduction: Number(deductionsMap.otherDeduction || 0),
  };
}

function buildPayrollRowPayload(targetRow) {
  return {
    basicSalary: Number(targetRow.basicSalary || 0),
    housingAllowance: Number(targetRow.housingAllowance || 0),
    transportAllowance: Number(targetRow.transportAllowance || 0),
    bonus: Number(targetRow.bonus || 0),
    allowancesMap: targetRow.allowancesMap,
    tax: Number(targetRow.tax || 0),
    pension: Number(targetRow.pension || 0),
    otherDeduction: Number(targetRow.otherDeduction || 0),
    deductionsMap: targetRow.deductionsMap,
    deductions: rowManualDeductions(targetRow),
    status: targetRow.status,
    paymentStatus: targetRow.paymentStatus,
    employmentCategory: targetRow.employmentCategory,
    bankName: targetRow.bankName,
    accountName: targetRow.accountName,
    accountNumber: targetRow.accountNumber,
  };
}

function PayslipModal({ branding, monthLabel, staffRow, settings, contactInfo, onClose }) {
  const earnings = buildPayslipEarnings(staffRow, settings);
  const deductions = buildPayslipDeductions(staffRow, settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className={`${CARD} relative w-full max-w-3xl overflow-hidden`} id="payroll-payslip-print">
        {branding?.logoUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08] dark:opacity-[0.10]">
            <img src={branding.logoUrl} alt="School watermark" className="h-72 w-72 object-contain" />
          </div>
        ) : null}

        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-[#c9a96e]/35 pb-5">
          <div className="flex items-start gap-4">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding?.schoolName || 'School'} logo`} className="h-20 w-20 rounded-3xl border border-[#c9a96e]/40 bg-white/70 object-cover p-2" />
            ) : null}
            <div>
              <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">{branding?.schoolName || 'School Payroll'}</h3>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Payslip for {monthLabel}</p>
              {contactInfo?.address ? <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">{contactInfo.address}</p> : null}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#800020] dark:text-[#bf00ff]">
                {contactInfo?.phone ? <span>{contactInfo.phone}</span> : null}
                {contactInfo?.email ? <span>{contactInfo.email}</span> : null}
                {branding?.website ? <span>{branding.website}</span> : null}
              </div>
            </div>
          </div>
          <span className={BADGE}>{staffRow.paymentStatus || staffRow.status}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={INNER}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Staff Name</p>
            <p className="mt-2 text-lg font-bold text-[#191970] dark:text-white">{staffRow.name}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Staff ID</p>
            <p className="mt-2 font-semibold text-[#191970] dark:text-white">{staffRow.displayId}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Role</p>
            <p className="mt-2 font-semibold capitalize text-[#191970] dark:text-white">{staffRow.role}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Employment Category</p>
            <p className="mt-2 font-semibold capitalize text-[#191970] dark:text-white">{staffRow.employmentCategory}</p>
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
              {earnings.map(entry => (
                <div key={entry.key} className="flex items-center justify-between"><span>{entry.label}</span><span>{formatNaira(entry.amount)}</span></div>
              ))}
              <div className="border-t border-[#c9a96e]/30 pt-3 font-bold text-[#800000] dark:text-[#0000ff]"><div className="flex items-center justify-between"><span>Gross Pay</span><span>{formatNaira(rowGross(staffRow))}</span></div></div>
            </div>
          </div>

          <div className={INNER}>
            <p className="text-sm font-bold text-[#800000] dark:text-[#0000ff]">Deductions</p>
            <div className="mt-4 space-y-3 text-sm text-[#191970] dark:text-white">
              {deductions.map(entry => (
                <div key={entry.key} className="flex items-center justify-between"><span>{entry.label}</span><span>{formatNaira(entry.amount)}</span></div>
              ))}
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
  const [settingsForm, setSettingsForm] = useState(() => normalizePayrollSettings(DEFAULT_PAYROLL_SETTINGS));
  const [branding, setBranding] = useState(null);
  const [contactInfo, setContactInfo] = useState({ address: '', phone: '', email: '' });
  const [approved, setApproved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [importingSheet, setImportingSheet] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [payrollNoteDraft, setPayrollNoteDraft] = useState('');
  const [payrollNotesByPeriod, setPayrollNotesByPeriod] = useState({});
  const [selectedNotePeriod, setSelectedNotePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loadingPayrollNote, setLoadingPayrollNote] = useState(false);
  const [savingPayrollNote, setSavingPayrollNote] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimeoutRef = useRef(null);
  const importInputRef = useRef(null);
  const currentUser = useMemo(() => getStoredAuth()?.user || null, []);
  const currentUserRole = String(currentUser?.role || currentUser?.primaryRole || '').trim().toLowerCase();
  const canEditPayrollSettings = ['owner', 'hos'].includes(currentUserRole);

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
        const [payrollResult, historyResult, settingsResult, brandingResult, websiteSectionsResult, noteResult] = await Promise.all([
          getPayroll(),
          getPayrollHistory(),
          getPayrollSettings(),
          getBranding(),
          getWebsiteSections(),
          getPayrollNote(),
        ]);

        if (ignore) {
          return;
        }

        const nextSettings = normalizePayrollSettings(payrollResult?.settings || settingsResult?.settings || DEFAULT_PAYROLL_SETTINGS);
        const nextPeriod = payrollResult?.period || new Date().toISOString().slice(0, 7);
        const savedCurrentNote = noteResult?.note || null;

        setSettingsForm(nextSettings);
        setRows(buildPayrollRows(payrollResult?.payroll || []));
        setHistory(historyResult?.history || []);
        setBranding(brandingResult?.branding || null);
        setContactInfo(extractContactInfo(websiteSectionsResult?.sections || []));
        setApproved(Boolean(payrollResult?.approved));
        setSubmitted(Boolean(payrollResult?.submitted));
        setPeriod(nextPeriod);
        setSelectedNotePeriod(nextPeriod);
        setPayrollNotesByPeriod(savedCurrentNote ? { [nextPeriod]: savedCurrentNote } : {});
        setPayrollNoteDraft(savedCurrentNote?.noteText || buildDefaultPayrollNoteText(nextPeriod));
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

  useEffect(() => {
    if (selectedNotePeriod !== period) {
      return;
    }

    const currentNote = payrollNotesByPeriod[period] || null;
    setPayrollNoteDraft(currentNote?.noteText || buildDefaultPayrollNoteText(period));
  }, [payrollNotesByPeriod, period, selectedNotePeriod]);

  useEffect(() => {
    let ignore = false;

    async function loadSelectedPayrollNote() {
      if (!selectedNotePeriod || selectedNotePeriod === period) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(payrollNotesByPeriod, selectedNotePeriod)) {
        return;
      }

      const selectedHistory = history.find((entry) => entry.period === selectedNotePeriod);
      if (!selectedHistory?.hasPayrollNote) {
        setPayrollNotesByPeriod((current) => ({ ...current, [selectedNotePeriod]: null }));
        return;
      }

      setLoadingPayrollNote(true);
      try {
        const noteResult = await getPayrollNote(selectedNotePeriod);
        if (ignore) return;
        setPayrollNotesByPeriod((current) => ({ ...current, [selectedNotePeriod]: noteResult?.note || null }));
      } catch (error) {
        if (!ignore) {
          showToast(error.message || 'Could not load payroll notes.');
        }
      } finally {
        if (!ignore) {
          setLoadingPayrollNote(false);
        }
      }
    }

    loadSelectedPayrollNote();

    return () => {
      ignore = true;
    };
  }, [history, payrollNotesByPeriod, period, selectedNotePeriod, showToast]);

  function updateRowField(staffId, field, value) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === staffId ? { ...row, [field]: value } : row)),
    );
  }

  function updateRowAmount(staffId, kind, columnKey, value) {
    const nextValue = Number(value || 0);

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== staffId) return row;

        if (kind === 'earning') {
          if (columnKey === 'basicSalary') {
            return { ...row, basicSalary: nextValue };
          }

          const allowancesMap = { ...row.allowancesMap, [columnKey]: nextValue };
          return {
            ...row,
            allowancesMap,
            housingAllowance: Number(allowancesMap.housingAllowance || 0),
            transportAllowance: Number(allowancesMap.transportAllowance || 0),
            bonus: Number(allowancesMap.bonus || 0),
          };
        }

        const deductionsMap = { ...row.deductionsMap, [columnKey]: nextValue };
        return {
          ...row,
          deductionsMap,
          tax: Number(deductionsMap.tax || 0),
          pension: Number(deductionsMap.pension || 0),
          otherDeduction: Number(deductionsMap.otherDeduction || 0),
        };
      }),
    );
  }

  function updateColumnLabel(kind, key, label) {
    setSettingsForm((current) => ({
      ...current,
      [kind]: current[kind].map(column => (column.key === key ? { ...column, label } : column)),
    }));
  }

  function addCustomColumn(kind) {
    const prefix = kind === 'earningColumns' ? 'earning' : 'deduction';
    const label = kind === 'earningColumns' ? 'New Earning' : 'New Deduction';
    const key = `${prefix}_${Date.now()}`;
    setSettingsForm((current) => ({
      ...current,
      [kind]: [...current[kind], { key, label, fixed: false }],
    }));
  }

  async function persistRow(staffId) {
    const targetRow = rows.find((row) => row.id === staffId);
    if (!targetRow) {
      return;
    }

    setSavingRowId(staffId);

    try {
      await updatePayrollStaff(staffId, buildPayrollRowPayload(targetRow));
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
    if (!canEditPayrollSettings) {
      showToast('Only the owner or head of school can save payroll headings.');
      return;
    }

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

  async function handleSavePayrollNote() {
    if (!submitted && !approved) {
      showToast('Submit payroll before saving payroll notes for this month.');
      return;
    }

    setSavingPayrollNote(true);

    try {
      const noteResult = await savePayrollNote({
        period,
        noteText: payrollNoteDraft,
        rows: rows.map((row) => ({
          id: row.id,
          staffId: row.id,
          displayId: row.displayId,
          name: row.name,
          role: row.role,
          employmentCategory: row.employmentCategory,
          bankName: row.bankName,
          accountName: row.accountName,
          accountNumber: row.accountNumber,
          net: rowNet(row),
        })),
      });

      if (noteResult?.note) {
        setPayrollNotesByPeriod((current) => ({ ...current, [period]: noteResult.note }));
        setHistory((currentHistory) => {
          const nextEntry = {
            period,
            totalNet: payrollTotals.net,
            status: approved ? 'approved' : submitted ? 'submitted' : 'draft',
            hasPayrollNote: true,
            payrollNoteSavedAt: noteResult.note.savedAt,
            payrollNotePreparedBy: noteResult.note.preparedByName,
          };

          const existingIndex = currentHistory.findIndex((entry) => entry.period === period);
          if (existingIndex === -1) {
            return [nextEntry, ...currentHistory];
          }

          return currentHistory.map((entry, index) => (index === existingIndex ? { ...entry, ...nextEntry } : entry));
        });
      }

      showToast('Payroll notes saved for this month.');
    } catch (error) {
      showToast(error.message || 'Could not save payroll notes.');
    } finally {
      setSavingPayrollNote(false);
    }
  }

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const XLSX = await loadSpreadsheetModule();
      const templateColumns = buildPayrollTemplateColumns(settingsForm);
      const templateRows = rows.map((row) => templateColumns.map((column) => {
        if (column.kind === 'field') {
          return row[column.field] ?? '';
        }

        if (column.kind === 'earning') {
          return getRowEarningValue(row, column.key);
        }

        return getRowDeductionValue(row, column.key);
      }));

      const fallbackTemplateRow = templateColumns.map((column) => {
        if (column.kind === 'field') {
          if (column.field === 'employmentCategory') return 'support';
          if (column.field === 'paymentStatus') return 'pending';
          return '';
        }

        return 0;
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          templateColumns.map(column => column.label),
          ...(templateRows.length ? templateRows : [fallbackTemplateRow]),
        ]),
        'Payroll Template',
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          ['Ndovera Payroll Template'],
          ['Period', period],
          [],
          ['How to use'],
          ['1. Keep Staff ID unchanged so imported rows match the right staff records.'],
          ['2. Update only editable columns in the Payroll Template sheet.'],
          ['3. Gross, late charges, total deductions, and net pay are recalculated automatically after import.'],
          ['4. If you rename earning or deduction headings, download a fresh template before importing again.'],
          ['5. Upload accepts .xlsx, .xls, and .csv files.'],
        ]),
        'Instructions',
      );

      const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      downloadBlob(
        new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `ndovera_payroll_template_${period}.xlsx`,
      );
      showToast('Payroll Excel template downloaded.');
    } catch (error) {
      showToast(error.message || 'Could not download the payroll template.');
    }
  }, [period, rows, settingsForm, showToast]);

  const inputsLocked = approved || (!canApprove && submitted);

  const handleImportSheet = useCallback(async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    if (inputsLocked) {
      showToast('Payroll is locked for this month. Unlock the sheet before importing another spreadsheet.');
      return;
    }

    setImportingSheet(true);

    try {
      const importedRows = await readPayrollWorkbook(selectedFile, settingsForm);

      if (!importedRows.length) {
        throw new Error('No payroll rows were found in the uploaded spreadsheet.');
      }

      const rowsByStaffId = new Map(rows.map(row => [normalizeImportToken(row.displayId || row.id), row]));
      const rowsByName = new Map(rows.map(row => [normalizeImportToken(row.name), row]));
      const updatedRowsById = new Map();
      let matchedRows = 0;
      let skippedRows = 0;

      importedRows.forEach((importedRow) => {
        const matchedRow = rowsByStaffId.get(normalizeImportToken(importedRow.staffId))
          || rowsByName.get(normalizeImportToken(importedRow.staffName));

        if (!matchedRow) {
          skippedRows += 1;
          return;
        }

        updatedRowsById.set(matchedRow.id, applyImportedPayrollRow(matchedRow, importedRow));
        matchedRows += 1;
      });

      if (!matchedRows) {
        throw new Error('No uploaded rows matched the current payroll. Download the current template and keep the Staff ID column unchanged.');
      }

      const mergedRows = rows.map(row => updatedRowsById.get(row.id) || row);
      setRows(mergedRows);

      for (const updatedRow of mergedRows) {
        if (!updatedRowsById.has(updatedRow.id)) {
          continue;
        }

        await updatePayrollStaff(updatedRow.id, buildPayrollRowPayload(updatedRow));
      }

      showToast(
        `Imported ${matchedRows} payroll row${matchedRows === 1 ? '' : 's'}${skippedRows ? `, skipped ${skippedRows} unmatched row${skippedRows === 1 ? '' : 's'}` : ''}.`,
      );
    } catch (error) {
      showToast(error.message || 'Could not import the payroll spreadsheet.');
    } finally {
      setImportingSheet(false);
    }
  }, [inputsLocked, rows, settingsForm, showToast]);

  const monthLabel = formatPeriod(period);
  const payrollTotals = useMemo(() => {
    return rows.reduce(
      (totals, row) => {
        totals.gross += rowGross(row);
        totals.manualDeductions += rowManualDeductions(row);
        totals.autoLateDeductions += Number(row.autoLateDeduction || 0);
        totals.autoAbsenceDeductions += Number(row.autoAbsenceDeduction || 0);
        totals.deductions += rowTotalDeductions(row);
        totals.net += rowNet(row);
        totals.count += 1;
        settingsForm.earningColumns.forEach(column => {
          totals.earnings[column.key] = (totals.earnings[column.key] || 0) + getRowEarningValue(row, column.key);
        });
        settingsForm.deductionColumns.forEach(column => {
          totals.deductionsByKey[column.key] = (totals.deductionsByKey[column.key] || 0) + getRowDeductionValue(row, column.key);
        });
        return totals;
      },
      { gross: 0, manualDeductions: 0, autoLateDeductions: 0, autoAbsenceDeductions: 0, deductions: 0, net: 0, count: 0, earnings: {}, deductionsByKey: {} },
    );
  }, [rows, settingsForm]);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] shadow-xl dark:bg-[#00ffff] dark:text-black">
          {toast}
        </div>
      ) : null}

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
              <div className="max-h-[70vh] overflow-auto overscroll-contain rounded-2xl border border-[#c9a96e]/25 dark:border-[#00ffff]/15">
                <table className="min-w-[2200px] w-full text-sm">
                  <thead>
                    <tr>
                      <th className={`${TH} sticky top-0 z-20`}>S/N</th>
                      <th className={`${TH} sticky top-0 z-20`}>Staff ID</th>
                      <th className={`${TH} sticky top-0 z-20`}>Staff Name</th>
                      <th className={`${TH} sticky top-0 z-20`}>Role</th>
                      <th className={`${TH} sticky top-0 z-20`}>Employment Category</th>
                      {settingsForm.earningColumns.map((column, index) => (
                        <th key={`earning-head-${column.key}`} className={`${TH} sticky top-0 z-20`}>
                          {canEditPayrollSettings ? (
                            <div className="min-w-[140px] space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  {index === 0 ? <span className="block text-[10px] uppercase tracking-[0.16em] text-[#f5deb3]">Earnings</span> : null}
                                  <span className="block text-[10px] uppercase tracking-[0.16em] text-[#f5deb3]/80">{column.fixed ? 'Standard' : 'Custom'} earning</span>
                                </div>
                                {index === 0 ? (
                                  <button type="button" onClick={() => addCustomColumn('earningColumns')} className={ICON_BTN} title="Add earning heading" aria-label="Add earning heading">+</button>
                                ) : null}
                              </div>
                              <input
                                type="text"
                                value={column.label}
                                onChange={(event) => updateColumnLabel('earningColumns', column.key, event.target.value)}
                                className="w-full rounded-lg border border-[#c9a96e]/40 bg-[#fff8ea] px-2 py-1.5 text-xs font-semibold text-[#800020] outline-none"
                              />
                            </div>
                          ) : column.label}
                        </th>
                      ))}
                      <th className={`${TH} sticky top-0 z-20`}>Gross</th>
                      {settingsForm.deductionColumns.map((column, index) => (
                        <th key={`deduction-head-${column.key}`} className={`${TH} sticky top-0 z-20`}>
                          {canEditPayrollSettings ? (
                            <div className="min-w-[140px] space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  {index === 0 ? <span className="block text-[10px] uppercase tracking-[0.16em] text-[#f5deb3]">Deductions</span> : null}
                                  <span className="block text-[10px] uppercase tracking-[0.16em] text-[#f5deb3]/80">{column.fixed ? 'Standard' : 'Custom'} deduction</span>
                                </div>
                                {index === 0 ? (
                                  <button type="button" onClick={() => addCustomColumn('deductionColumns')} className={ICON_BTN} title="Add deduction heading" aria-label="Add deduction heading">+</button>
                                ) : null}
                              </div>
                              <input
                                type="text"
                                value={column.label}
                                onChange={(event) => updateColumnLabel('deductionColumns', column.key, event.target.value)}
                                className="w-full rounded-lg border border-[#c9a96e]/40 bg-[#fff8ea] px-2 py-1.5 text-xs font-semibold text-[#800020] outline-none"
                              />
                            </div>
                          ) : column.label}
                        </th>
                      ))}
                      <th className={`${TH} sticky top-0 z-20`}>Late Charges</th>
                      <th className={`${TH} sticky top-0 z-20`}>Absence Charges</th>
                      <th className={`${TH} sticky top-0 z-20`}>Total Deductions</th>
                      <th className={`${TH} sticky top-0 z-20`}>Net Pay</th>
                      <th className={`${TH} sticky top-0 z-20`}>Status</th>
                      <th className={`${TH} sticky top-0 z-20`}>Payslip</th>
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
                        <td className={TD}>
                          <select
                            value={row.employmentCategory}
                            disabled={inputsLocked}
                            onChange={(event) => updateRowField(row.id, 'employmentCategory', event.target.value)}
                            onBlur={() => persistRow(row.id)}
                            className={INPUT}
                          >
                            <option value="academic">Academic</option>
                            <option value="administrative">Administrative</option>
                            <option value="support">Support</option>
                            <option value="contract">Contract</option>
                          </select>
                        </td>
                        {settingsForm.earningColumns.map((column) => (
                          <td key={`${row.id}-${column.key}`} className={TD}>
                            <input
                              type="number"
                              value={getRowEarningValue(row, column.key)}
                              disabled={inputsLocked}
                              onChange={(event) => updateRowAmount(row.id, 'earning', column.key, event.target.value)}
                              onBlur={() => persistRow(row.id)}
                              className={INPUT}
                            />
                          </td>
                        ))}
                        <td className={`${TD} font-bold text-[#800000] dark:text-[#0000ff]`}>{formatNaira(rowGross(row))}</td>
                        {settingsForm.deductionColumns.map((column) => (
                          <td key={`${row.id}-${column.key}`} className={TD}>
                            <input
                              type="number"
                              value={getRowDeductionValue(row, column.key)}
                              disabled={inputsLocked}
                              onChange={(event) => updateRowAmount(row.id, 'deduction', column.key, event.target.value)}
                              onBlur={() => persistRow(row.id)}
                              className={INPUT}
                            />
                          </td>
                        ))}
                        <td className={TD}>
                          <p className="font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(row.autoLateDeduction)}</p>
                          {row.lateChargeCount > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{row.lateChargeCount} late mark{row.lateChargeCount === 1 ? '' : 's'}</p> : <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Auto</p>}
                        </td>
                        <td className={TD}>
                          <p className="font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(row.autoAbsenceDeduction)}</p>
                          {row.absenceChargeCount > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{row.absenceChargeCount} unauthorized absence day{row.absenceChargeCount === 1 ? '' : 's'}</p> : <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Auto</p>}
                        </td>
                        <td className={`${TD} font-bold text-[#800000] dark:text-[#ff6bff]`}>{formatNaira(rowTotalDeductions(row))}</td>
                        <td className={`${TD} font-bold text-[#1a5c38] dark:text-[#00ffff]`}>{formatNaira(rowNet(row))}</td>
                        <td className={TD}>
                          <select
                            value={row.paymentStatus}
                            disabled={inputsLocked}
                            onChange={(event) => updateRowField(row.id, 'paymentStatus', event.target.value)}
                            onBlur={() => persistRow(row.id)}
                            className={INPUT}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
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
                      <td colSpan={5} className={TD}>TOTAL</td>
                      {settingsForm.earningColumns.map(column => (
                        <td key={`earning-total-${column.key}`} className={TD}>{formatNaira(payrollTotals.earnings[column.key] || 0)}</td>
                      ))}
                      <td className={TD}>{formatNaira(payrollTotals.gross)}</td>
                      {settingsForm.deductionColumns.map(column => (
                        <td key={`deduction-total-${column.key}`} className={TD}>{formatNaira(payrollTotals.deductionsByKey[column.key] || 0)}</td>
                      ))}
                      <td className={TD}>{formatNaira(payrollTotals.autoLateDeductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.autoAbsenceDeductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.deductions)}</td>
                      <td className={TD}>{formatNaira(payrollTotals.net)}</td>
                      <td className={TD}>-</td>
                      <td className={TD}>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 border-t border-[#c9a96e]/30 pt-4 dark:border-[#00ffff]/15">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                  Download the Excel template, update your own payroll offline, then upload it back here. Gross pay, late charges, total deductions, and net pay are recalculated automatically after import.
                </p>
                <div className="flex flex-wrap gap-3">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,text/csv"
                    onChange={handleImportSheet}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={loading || importingSheet}
                    className={OUTLINE_BTN}
                  >
                    Download Excel Template
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={loading || importingSheet || inputsLocked}
                    className={OUTLINE_BTN}
                  >
                    {importingSheet ? 'Importing Payroll...' : 'Upload Payroll Excel'}
                  </button>
                  {canEditPayrollSettings ? (
                    <button type="button" onClick={saveSettings} disabled={savingSettings} className={BTN}>
                      {savingSettings ? 'Saving Headings...' : 'Save Heading Changes'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleApprovalAction}
            disabled={importingSheet || actionBusy !== '' || approved || (!canApprove && submitted)}
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
                  <p className="mt-1 text-sm capitalize text-[#800020] dark:text-[#bf00ff]">{row.role} · {row.employmentCategory} · {row.displayId}</p>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Net pay {formatNaira(rowNet(row))}</p>
                  {row.autoLateDeduction > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Includes {formatNaira(row.autoLateDeduction)} lateness charge{row.lateChargeCount === 1 ? '' : 's'}.</p> : null}
                  {row.autoAbsenceDeduction > 0 ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Includes {formatNaira(row.autoAbsenceDeduction)} absenteeism charge across {row.absenceChargeCount} unauthorized absence day{row.absenceChargeCount === 1 ? '' : 's'}.</p> : null}
                </div>
                <button onClick={() => setSelectedPayslip(row)} className={BTN}>View Payslip</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 2 ? (
        <PayrollAccountDetailsPanel
          rows={rows.map(row => ({ ...row, net: rowNet(row) }))}
          loading={loading}
          monthLabel={monthLabel}
          onRowFieldChange={updateRowField}
          onPersistRow={persistRow}
          savingRowId={savingRowId}
          canEdit={!inputsLocked}
        />
      ) : null}

      {tab === 3 ? (
        <PayrollBankNotePanel
          rows={selectedNotePeriod === period
            ? rows.map(row => ({ ...row, net: rowNet(row) }))
            : (payrollNotesByPeriod[selectedNotePeriod]?.rows || [])}
          loading={selectedNotePeriod === period ? loading : loadingPayrollNote}
          monthLabel={formatPeriod(selectedNotePeriod)}
          branding={branding}
          contactInfo={contactInfo}
          noteText={selectedNotePeriod === period ? payrollNoteDraft : (payrollNotesByPeriod[selectedNotePeriod]?.noteText || '')}
          onNoteChange={setPayrollNoteDraft}
          canEdit={selectedNotePeriod === period && (submitted || approved)}
          canExport={selectedNotePeriod === period ? Boolean((submitted || approved) && rows.length) : Boolean(payrollNotesByPeriod[selectedNotePeriod]?.rows?.length)}
          currentUser={currentUser}
          showToast={showToast}
          onSaveNote={handleSavePayrollNote}
          savingNote={savingPayrollNote}
          preparedByName={selectedNotePeriod === period ? payrollNotesByPeriod[period]?.preparedByName : payrollNotesByPeriod[selectedNotePeriod]?.preparedByName}
          preparedByRole={selectedNotePeriod === period ? payrollNotesByPeriod[period]?.preparedByRole : payrollNotesByPeriod[selectedNotePeriod]?.preparedByRole}
          savedAt={selectedNotePeriod === period ? payrollNotesByPeriod[period]?.savedAt : payrollNotesByPeriod[selectedNotePeriod]?.savedAt}
          isReferenceView={selectedNotePeriod !== period}
          onReturnToCurrent={() => setSelectedNotePeriod(period)}
        />
      ) : null}

      {tab === 4 ? (
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
                    {entry.payrollNoteSavedAt ? <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Payroll notes saved by {entry.payrollNotePreparedBy || 'Authorized Officer'} on {new Date(entry.payrollNoteSavedAt).toLocaleString()}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={BADGE}>{entry.status || 'draft'}</span>
                    {entry.hasPayrollNote ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNotePeriod(entry.period);
                          setTab(3);
                        }}
                        className={OUTLINE_BTN}
                      >
                        Open Payroll Note
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 5 ? (
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
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className={INNER}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#800000] dark:text-[#0000ff]">Earning Headings</p>
                  <p className="mt-1 text-xs text-[#191970] dark:text-[#39ff14]">Rename the standard columns and add more earning columns for this school.</p>
                </div>
                <button type="button" onClick={() => addCustomColumn('earningColumns')} className={OUTLINE_BTN}>Add Earning</button>
              </div>
              <div className="mt-4 space-y-3">
                {settingsForm.earningColumns.map(column => (
                  <label key={`earning-setting-${column.key}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">
                    {column.fixed ? 'Standard Heading' : 'Custom Heading'}
                    <input
                      type="text"
                      value={column.label}
                      onChange={(event) => updateColumnLabel('earningColumns', column.key, event.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className={INNER}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#800000] dark:text-[#0000ff]">Deduction Headings</p>
                  <p className="mt-1 text-xs text-[#191970] dark:text-[#39ff14]">Rename deduction headings and add extra deduction columns for custom school policy.</p>
                </div>
                <button type="button" onClick={() => addCustomColumn('deductionColumns')} className={OUTLINE_BTN}>Add Deduction</button>
              </div>
              <div className="mt-4 space-y-3">
                {settingsForm.deductionColumns.map(column => (
                  <label key={`deduction-setting-${column.key}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">
                    {column.fixed ? 'Standard Heading' : 'Custom Heading'}
                    <input
                      type="text"
                      value={column.label}
                      onChange={(event) => updateColumnLabel('deductionColumns', column.key, event.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </label>
                ))}
              </div>
            </div>
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
          settings={settingsForm}
          contactInfo={contactInfo}
          onClose={() => setSelectedPayslip(null)}
        />
      ) : null}
    </div>
  );
}

export default PayrollManagementBoard;

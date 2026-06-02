import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  ReceiptPercentIcon,
  InboxArrowDownIcon,
  AdjustmentsHorizontalIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import FeeReceiptDialog from './FeeReceiptDialog';
import {
  approveFeePaymentClaim,
  getBranding,
  getFeePaymentClaims,
  getFeeReceipts,
  getClasses,
  getFeesConfig,
  getFeesLedger,
  getFeesPaymentDetails,
  getSession,
  getPeople,
  issueFeeReceipt,
  markFeePaid,
  rejectFeePaymentClaim,
  saveFeesConfigSnapshot,
  saveFeesPaymentDetails,
} from '../services/schoolApi';

const DEFAULT_FEE_COLUMNS = [
  'Tuition',
  'Welfare',
  'PTA',
  'Lesson',
  'Toiletories',
  'Club',
  'Transport',
  'Speech & Prize',
  'Uniforms',
  'Books',
];

const PAYMENT_STATUS_FILTERS = [
  { value: 'all', label: 'All payment states' },
  { value: 'paid', label: 'Fully Paid' },
  { value: 'partial', label: 'Partly Paid' },
  { value: 'unpaid', label: 'Not Paid At All' },
];

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const OUTLINE_BTN = 'rounded-2xl border border-[#800020]/30 bg-white/60 px-5 py-2.5 text-sm font-semibold text-[#800020] transition-colors hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff] dark:hover:bg-[#1f0022]';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-2 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const BADGE = 'inline-flex items-center rounded-full border border-[#800020]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/25 dark:bg-[#1a001d]/80 dark:text-[#bf00ff]';
const TH = 'border border-[#c9a96e]/30 bg-[#800020] p-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#f5deb3] dark:border-[#00ffff]/20 dark:bg-[#0000ff]/25 dark:text-white';
const TD = 'border border-[#c9a96e]/30 p-2 align-top dark:border-[#00ffff]/15';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function isInternalUserId(value) {
  return /^user_\d{10,}_[a-z0-9]+$/i.test(String(value || '').trim());
}

function getReadableStudentId(displayId, fallbackId = '') {
  const normalizedDisplayId = String(displayId || '').trim();
  if (normalizedDisplayId) {
    return normalizedDisplayId;
  }

  const normalizedFallback = String(fallbackId || '').trim();
  if (!normalizedFallback || isInternalUserId(normalizedFallback)) {
    return 'Not assigned';
  }

  return normalizedFallback;
}

function formatReceiptDateTime(value) {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatReceiptPaymentType(value) {
  const normalized = String(value || 'cash').replace(/-/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function escapeReceiptHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeReceiptFilePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '_')
    .slice(0, 80);
}

async function buildReceiptExportDocument(receipt, fallbackBranding = {}) {
  const schoolName = receipt.schoolName || fallbackBranding.schoolName || 'NDOVERA School';
  const schoolLogoUrl = receipt.schoolLogoUrl || fallbackBranding.logoUrl || '';
  const studentIdLabel = getReadableStudentId(receipt.studentDisplayId, receipt.studentId);
  const qrDataUrl = receipt.verificationUrl
    ? await QRCode.toDataURL(receipt.verificationUrl, {
        margin: 1,
        width: 176,
        color: { dark: '#800000', light: '#f5deb3' },
      }).catch(() => '')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeReceiptHtml(receipt.receiptNo || 'School Fee Receipt')}</title>
  <style>
    body { margin: 0; padding: 32px; background: #f5deb3; color: #191970; font-family: 'Segoe UI', sans-serif; }
    .card { max-width: 960px; margin: 0 auto; background: rgba(255,255,255,0.55); border: 1px solid rgba(128,0,32,0.15); border-radius: 28px; padding: 28px; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; gap: 16px; align-items: flex-start; }
    .logo { width: 88px; height: 88px; object-fit: contain; border-radius: 24px; background: white; border: 1px solid rgba(128,0,0,0.15); padding: 8px; }
    .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #800020; }
    h1 { margin: 10px 0 0; color: #800000; font-size: 28px; }
    .subtitle { margin-top: 10px; font-size: 14px; }
    .pill { display: inline-block; margin-left: 8px; padding: 8px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
    .pill-status { border: 1px solid rgba(128,0,32,0.2); background: rgba(255,255,255,0.75); color: #800020; }
    .pill-number { background: #1a5c38; color: #f5deb3; }
    .grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px; margin-top: 24px; }
    .details { display: grid; gap: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border-radius: 18px; background: rgba(255,248,240,0.85); border: 1px solid rgba(201,169,110,0.25); }
    .label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #800020; }
    .value { font-size: 14px; font-weight: 700; text-align: right; }
    .summary { border-radius: 22px; background: rgba(255,248,240,0.85); border: 1px solid rgba(201,169,110,0.25); padding: 20px; }
    .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 0 0 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(201,169,110,0.3); }
    .summary-row:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
    .summary-value { font-size: 22px; font-weight: 800; }
    .green { color: #1a5c38; }
    .red { color: #800000; }
    .verification { margin-top: 20px; border-radius: 18px; background: rgba(240,208,144,0.75); border: 1px solid rgba(201,169,110,0.25); padding: 16px; text-align: center; }
    .qr { width: 144px; height: 144px; object-fit: contain; background: white; border-radius: 18px; padding: 8px; border: 1px solid rgba(201,169,110,0.3); }
    .footer { margin-top: 24px; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,0.55); border: 1px dashed rgba(128,0,32,0.25); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #800020; }
    @media print { body { padding: 0; } .card { border: 0; background: transparent; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        ${schoolLogoUrl ? `<img class="logo" src="${escapeReceiptHtml(schoolLogoUrl)}" alt="${escapeReceiptHtml(schoolName)} logo" />` : ''}
        <div>
          <div class="eyebrow">${escapeReceiptHtml(schoolName)}</div>
          <h1>Official School Fees Receipt</h1>
          <div class="subtitle">Verification-ready payment receipt.</div>
        </div>
      </div>
      <div>
        <span class="pill pill-status">${escapeReceiptHtml(receipt.statusAfter || receipt.status || 'Recorded')}</span>
        <span class="pill pill-number">${escapeReceiptHtml(receipt.receiptNo || 'Receipt')}</span>
      </div>
    </div>
    <div class="grid">
      <div class="details">
        <div class="row"><span class="label">Receipt number</span><span class="value">${escapeReceiptHtml(receipt.receiptNo || '')}</span></div>
        <div class="row"><span class="label">Date issued</span><span class="value">${escapeReceiptHtml(formatReceiptDateTime(receipt.recordedAt || receipt.date))}</span></div>
        <div class="row"><span class="label">Student</span><span class="value">${escapeReceiptHtml(receipt.studentName || receipt.name || '')}</span></div>
        <div class="row"><span class="label">Student ID</span><span class="value">${escapeReceiptHtml(studentIdLabel)}</span></div>
        <div class="row"><span class="label">Class</span><span class="value">${escapeReceiptHtml(receipt.className || 'Not assigned')}</span></div>
        <div class="row"><span class="label">Session</span><span class="value">${escapeReceiptHtml(receipt.sessionName || 'Current session')}</span></div>
        <div class="row"><span class="label">Term</span><span class="value">${escapeReceiptHtml(receipt.termName || 'Current term')}</span></div>
        <div class="row"><span class="label">Payment method</span><span class="value">${escapeReceiptHtml(formatReceiptPaymentType(receipt.paymentType))}</span></div>
        <div class="row"><span class="label">Reference</span><span class="value">${escapeReceiptHtml(receipt.paymentReference || receipt.reference || 'School office entry')}</span></div>
        <div class="row"><span class="label">Receipt type</span><span class="value">${escapeReceiptHtml(receipt.receiptKind || 'issued')}</span></div>
        ${receipt.reissuedFromReceiptNo ? `<div class="row"><span class="label">Reissued from</span><span class="value">${escapeReceiptHtml(receipt.reissuedFromReceiptNo)}</span></div>` : ''}
      </div>
      <div class="summary">
        <div class="eyebrow">Payment Summary</div>
        <div style="margin-top: 16px;">
          <div class="summary-row"><span>Expected Fees</span><span class="summary-value red">${escapeReceiptHtml(formatNaira(receipt.feeAmount || receipt.expected))}</span></div>
          <div class="summary-row"><span>Amount Paid</span><span class="summary-value green">${escapeReceiptHtml(formatNaira(receipt.amount || receipt.amountPaid))}</span></div>
          <div class="summary-row"><span>Total Paid To Date</span><span class="summary-value">${escapeReceiptHtml(formatNaira(receipt.amountPaidAfter || receipt.amountPaid))}</span></div>
          <div class="summary-row"><span>Balance After Payment</span><span class="summary-value red">${escapeReceiptHtml(formatNaira(receipt.balanceAfter || receipt.balance))}</span></div>
        </div>
        ${qrDataUrl ? `<div class="verification"><div class="eyebrow">Receipt verification</div><img class="qr" src="${qrDataUrl}" alt="Receipt verification QR code" /><div style="margin-top: 12px; font-size: 12px; font-weight: 700;">Scan to verify online</div><div style="margin-top: 8px; font-size: 11px; color: #800020; word-break: break-all;">${escapeReceiptHtml(receipt.verificationUrl || '')}</div></div>` : ''}
      </div>
    </div>
    <div class="footer">This receipt reflects a recorded school fee payment and should be retained for school record verification.</div>
  </div>
</body>
</html>`;
}

function createEmptyPaymentDetails() {
  return {
    bankName: '',
    accountName: '',
    accountNumber: '',
    paymentInstructions: '',
    paymentReferenceHint: '',
  };
}

function getClaimStatusLabel(status) {
  const normalizedStatus = String(status || 'pending').toLowerCase();
  if (normalizedStatus === 'verified') return 'Verified';
  if (normalizedStatus === 'rejected') return 'Rejected';
  return 'Pending';
}

function getDefaultSessionLabel() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function inferSection(className = '') {
  const normalized = String(className).toLowerCase();
  if (normalized.includes('jhs') || normalized.includes('jss') || normalized.includes('junior')) {
    return 'Junior Secondary';
  }
  if (normalized.includes('sss') || normalized.includes('senior')) {
    return 'Senior Secondary';
  }
  if (normalized.includes('grade') || normalized.includes('primary')) {
    return 'Primary';
  }
  return 'General';
}

function createConfigLookup(configs) {
  return (configs || []).reduce((lookup, config) => {
    const feeType = String(config?.feeType || config?.fee_type || '').trim();
    if (!feeType) {
      return lookup;
    }

    const classKey = String(config?.classId || config?.class_id || '').trim() || '__all__';
    const lookupKey = `${classKey}::${feeType.toLowerCase()}`;

    if (lookup[lookupKey] === undefined) {
      lookup[lookupKey] = Number(config?.amount || 0);
    }

    return lookup;
  }, {});
}

function filterConfigsForPeriod(configs = [], sessionName = '', termName = '') {
  const normalizedSession = String(sessionName || '').trim().toLowerCase();
  const normalizedTerm = String(termName || '').trim().toLowerCase();

  if (!normalizedSession && !normalizedTerm) {
    return configs;
  }

  const exact = configs.filter((config) => {
    const configSession = String(config?.session || '').trim().toLowerCase();
    const configTerm = String(config?.term || '').trim().toLowerCase();
    if (!configSession || configSession !== normalizedSession) {
      return false;
    }
    if (!normalizedTerm) {
      return true;
    }
    return !configTerm || configTerm === normalizedTerm;
  });

  if (exact.length) {
    return exact;
  }

  const legacy = configs.filter((config) => !String(config?.session || '').trim() && !String(config?.term || '').trim());
  return legacy.length ? legacy : configs;
}

function createFeeColumns(configs) {
  const configuredColumns = (configs || [])
    .map((config) => String(config?.feeType || config?.fee_type || '').trim())
    .filter(Boolean);

  return Array.from(new Set([...configuredColumns, ...DEFAULT_FEE_COLUMNS]));
}

function getConfiguredFeeAmount(classId, feeName, lookup) {
  const classKey = String(classId || '').trim() || '__all__';
  const exact = lookup[`${classKey}::${feeName.toLowerCase()}`];

  if (exact !== undefined) {
    return Number(exact || 0);
  }

  return Number(lookup[`__all__::${feeName.toLowerCase()}`] || 0);
}

function buildStudentRows({ students, ledger, classes, feeColumns, configs }) {
  const classNameById = (classes || []).reduce((map, classItem) => {
    const label = `${classItem.name}${classItem.arm ? ` ${classItem.arm}` : ''}`;
    map[String(classItem.id)] = label;
    return map;
  }, {});

  const ledgerMap = (ledger || []).reduce((map, entry) => {
    const entryId = String(entry?.studentId || entry?.id || '').trim();
    if (entryId) {
      map[entryId] = entry;
    }
    return map;
  }, {});

  const feeLookup = createConfigLookup(configs);
  const roster = {};

  (students || [])
    .filter((person) => String(person?.role || '').toLowerCase() === 'student')
    .forEach((person) => {
      const studentId = String(person?.id || person?.email || '').trim();
      if (!studentId) {
        return;
      }

      const classId = String(person?.classId || '').trim();
      roster[studentId] = {
        id: studentId,
        displayId: String(person?.displayId || '').trim(),
        name: person?.name || person?.displayId || studentId,
        classId,
        className: classNameById[classId] || 'Unassigned',
      };
    });

  (ledger || []).forEach((entry) => {
    const studentId = String(entry?.studentId || entry?.id || '').trim();
    if (!studentId) {
      return;
    }

    roster[studentId] = {
      id: studentId,
      displayId: String(entry?.displayId || roster[studentId]?.displayId || '').trim(),
      name: entry?.name || roster[studentId]?.name || studentId,
      classId: String(entry?.classId || roster[studentId]?.classId || '').trim(),
      className:
        entry?.className ||
        roster[studentId]?.className ||
        classNameById[String(entry?.classId || roster[studentId]?.classId || '').trim()] ||
        'Unassigned',
    };
  });

  return Object.values(roster)
    .sort((left, right) => {
      const leftClass = String(left.className || '');
      const rightClass = String(right.className || '');
      if (leftClass !== rightClass) {
        return leftClass.localeCompare(rightClass);
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    })
    .map((student) => {
      const entry = ledgerMap[student.id] || null;
      const fees = feeColumns.reduce((map, feeName) => {
        map[feeName] = getConfiguredFeeAmount(student.classId, feeName, feeLookup);
        return map;
      }, {});

      const configuredTotal = feeColumns.reduce(
        (sum, feeName) => sum + Number(fees[feeName] || 0),
        0,
      );

      if (configuredTotal === 0 && Number(entry?.feeAmount || 0) > 0) {
        fees.Tuition = Number(entry?.feeAmount || 0);
      }

      const appliedTotal = feeColumns.reduce(
        (sum, feeName) => sum + Number(fees[feeName] || 0),
        0,
      );

      const recordedAmountPaid = Number(entry?.amountPaid || 0);
      const carryOver = Math.max(Number(entry?.feeAmount || 0) - appliedTotal, 0);

      return {
        id: student.id,
        displayId: student.displayId,
        name: student.name,
        classId: student.classId,
        className: student.className,
        section: inferSection(student.className),
        outstanding: carryOver,
        discount: 0,
        amountPaid: recordedAmountPaid,
        recordedAmountPaid,
        remark:
          entry?.status === 'Paid'
            ? 'Paid'
            : entry?.status === 'Partial'
              ? 'Part Payment'
              : '',
        fees,
      };
    });
}

function buildFeeSnapshotPayload({ students, feeColumns, sessionLabel, currentTerm }) {
  const payloads = [];
  const seen = new Set();

  students.forEach((student) => {
    feeColumns.forEach((feeName, index) => {
      const classKey = String(student.classId || '').trim() || '__all__';
      const uniqueKey = `${classKey}::${String(feeName || '').toLowerCase()}`;
      if (seen.has(uniqueKey)) {
        return;
      }

      seen.add(uniqueKey);
      payloads.push({
        feeType: feeName,
        classId: student.classId || '',
        amount: Number(student?.fees?.[feeName] || 0),
        sortOrder: index,
      });
    });
  });

  return {
    session: sessionLabel,
    term: currentTerm,
    configs: payloads,
  };
}

function formatAutoSaveTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function FeesManagementBoard({ initialFinanceTab = 'fees' }) {
  const [feeColumns, setFeeColumns] = useState(DEFAULT_FEE_COLUMNS);
  const [students, setStudents] = useState([]);
  const [configArchive, setConfigArchive] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [branding, setBranding] = useState(null);
  const [sessionLabel, setSessionLabel] = useState(getDefaultSessionLabel());
  const [currentTerm, setCurrentTerm] = useState('');
  const [sessionHistory, setSessionHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [paymentSavingId, setPaymentSavingId] = useState('');
  const [receiptIssuingId, setReceiptIssuingId] = useState('');
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [toast, setToast] = useState('');
  const [dirty, setDirty] = useState(false);
  const [lastTemplateSavedAt, setLastTemplateSavedAt] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [feesExpanded, setFeesExpanded] = useState(true);
  const [feesOverviewOpen, setFeesOverviewOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [paymentDetailsForm, setPaymentDetailsForm] = useState(createEmptyPaymentDetails());
  const [claims, setClaims] = useState([]);
  const [paymentDetailsSaving, setPaymentDetailsSaving] = useState(false);
  const [claimSavingId, setClaimSavingId] = useState('');
  const toastTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const templateInputRef = useRef(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const financeView = ['fees', 'channels', 'claims'].includes(initialFinanceTab) ? initialFinanceTab : 'fees';

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimeoutRef.current);
      window.clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);

    try {
      const [ledgerResult, configResult, classResult, peopleResult, receiptResult, paymentDetailsResult, claimResult, sessionResult, brandingResult] = await Promise.all([
        getFeesLedger(),
        getFeesConfig(),
        getClasses(),
        getPeople(),
        getFeeReceipts(),
        getFeesPaymentDetails(),
        getFeePaymentClaims(),
        getSession(),
        getBranding(),
      ]);

      const allConfigs = configResult?.configs || [];
      const currentSession = sessionResult?.session || configResult?.currentSession || null;
      const activeConfigs = filterConfigsForPeriod(allConfigs, currentSession?.session, currentSession?.term);
      const columns = createFeeColumns(activeConfigs);
      const nextStudents = buildStudentRows({
        students: peopleResult?.people || [],
        ledger: ledgerResult?.ledger || [],
        classes: classResult?.classes || [],
        feeColumns: columns,
        configs: activeConfigs,
      });

      const persistedSession = activeConfigs.find((config) => String(config?.session || '').trim())?.session;

      setFeeColumns(columns);
      setStudents(nextStudents);
      setConfigArchive(allConfigs);
      setSessionLabel(String(currentSession?.session || persistedSession || getDefaultSessionLabel()));
      setCurrentTerm(String(currentSession?.term || ''));
      setSessionHistory(sessionResult?.history || []);
      setReceipts(receiptResult?.receipts || []);
      setBranding(brandingResult?.branding || null);
      setPaymentDetailsForm(paymentDetailsResult?.paymentDetails || createEmptyPaymentDetails());
      setClaims((claimResult?.claims || []).map(claim => ({ ...claim, reviewNote: claim.verificationNote || '' })));
      setDirty(false);
    } catch (error) {
      showToast(error.message || 'Could not load fees.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const calculateTotal = useCallback(
    (student) =>
      feeColumns.reduce(
        (sum, feeName) => sum + Number(student?.fees?.[feeName] || 0),
        0,
      ),
    [feeColumns],
  );

  const expectedAmount = useCallback(
    (student) => {
      const total = calculateTotal(student) + Number(student?.outstanding || 0);
      const tuition = Number(student?.fees?.Tuition || 0);
      const tuitionDiscount = tuition * (Number(student?.discount || 0) / 100);
      return Math.max(total - tuitionDiscount, 0);
    },
    [calculateTotal],
  );

  const balance = useCallback(
    (student) => expectedAmount(student) - Number(student?.amountPaid || 0),
    [expectedAmount],
  );

  const getStatus = useCallback((student) => {
    if (balance(student) <= 0 && Number(student?.amountPaid || 0) > 0) {
      return 'Paid';
    }
    if (Number(student?.amountPaid || 0) > 0) {
      return 'Partial';
    }
    return 'Unpaid';
  }, [balance]);

  const pendingClaims = useMemo(
    () => claims.filter(claim => String(claim?.status || '').toLowerCase() === 'pending'),
    [claims],
  );

  const recentClaims = useMemo(
    () => claims.slice(0, 8),
    [claims],
  );

  const latestReceiptByStudent = useMemo(() => {
    const map = new Map();
    receipts.forEach((receipt) => {
      const studentId = String(receipt?.studentId || '').trim();
      if (!studentId || map.has(studentId)) {
        return;
      }
      map.set(studentId, receipt);
    });
    return map;
  }, [receipts]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = String(studentSearch || '').trim().toLowerCase();

    return students.filter((student) => {
      if (statusFilter !== 'all' && String(getStatus(student)).toLowerCase() !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        student?.name,
        student?.displayId,
        student?.publicStudentId,
        student?.id,
        student?.className,
        student?.section,
      ].map(value => String(value || '').trim().toLowerCase()).join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [getStatus, statusFilter, studentSearch, students]);

  const getReceiptState = useCallback((student) => {
    const latestReceipt = latestReceiptByStudent.get(student.id) || null;
    const paidAmount = Number(student?.amountPaid || 0);
    if (paidAmount <= 0) {
      return { key: 'none', label: 'Issue Receipt', disabled: true, latestReceipt };
    }

    if (!latestReceipt) {
      return { key: 'issue', label: 'Issue Receipt', disabled: false, latestReceipt };
    }

    const currentExpected = expectedAmount(student);
    const currentBalance = Math.max(currentExpected - paidAmount, 0);
    const hasNewPayment = paidAmount > Number(latestReceipt.amountPaidAfter || 0);
    const snapshotChanged = !hasNewPayment && (
      Number(currentExpected || 0) !== Number(latestReceipt.feeAmount || 0)
      || Number(currentBalance || 0) !== Number(latestReceipt.balanceAfter || 0)
      || String(getStatus(student) || '') !== String(latestReceipt.statusAfter || '')
      || String(sessionLabel || '') !== String(latestReceipt.sessionName || '')
      || String(currentTerm || '') !== String(latestReceipt.termName || '')
      || String(branding?.schoolName || '') !== String(latestReceipt.schoolName || '')
      || String(branding?.logoUrl || '') !== String(latestReceipt.schoolLogoUrl || '')
    );

    if (hasNewPayment) {
      return { key: 'issue', label: 'Issue Receipt', disabled: false, latestReceipt };
    }

    if (snapshotChanged) {
      return { key: 'reissue', label: 'Reissue Receipt', disabled: false, latestReceipt };
    }

    return { key: 'issued', label: 'Issued', disabled: false, latestReceipt };
  }, [branding?.logoUrl, branding?.schoolName, currentTerm, expectedAmount, getStatus, latestReceiptByStudent, sessionLabel]);

  const actionableReceiptStudents = useMemo(
    () => filteredStudents.filter((student) => {
      const receiptState = getReceiptState(student);
      return receiptState.key === 'issue' || receiptState.key === 'reissue';
    }),
    [filteredStudents, getReceiptState],
  );

  const downloadableReceipts = useMemo(() => {
    const seen = new Set();
    return filteredStudents.reduce((collection, student) => {
      const receipt = latestReceiptByStudent.get(student.id);
      if (!receipt || seen.has(receipt.id)) {
        return collection;
      }
      seen.add(receipt.id);
      collection.push(receipt);
      return collection;
    }, []);
  }, [filteredStudents, latestReceiptByStudent]);

  const pastSessionGroups = useMemo(() => {
    if (sessionHistory.length) {
      return sessionHistory.filter((entry) => String(entry?.session || '') !== String(sessionLabel || ''));
    }

    const grouped = new Map();
    configArchive.forEach((config) => {
      const configSession = String(config?.session || '').trim();
      const configTerm = String(config?.term || '').trim();
      if (!configSession || configSession === String(sessionLabel || '')) {
        return;
      }
      if (!grouped.has(configSession)) {
        grouped.set(configSession, { session: configSession, terms: [] });
      }
      const entry = grouped.get(configSession);
      if (configTerm && !entry.terms.some((termItem) => termItem.term === configTerm)) {
        entry.terms.push({ term: configTerm });
      }
    });
    return Array.from(grouped.values());
  }, [configArchive, sessionHistory, sessionLabel]);

  function updateFee(studentId, feeName, value) {
    const nextValue = Number(value || 0);
    const target = students.find((student) => student.id === studentId);
    if (!target) {
      return;
    }

    const targetClassKey = String(target.classId || target.id);

    setStudents((currentStudents) =>
      currentStudents.map((student) => {
        const classKey = String(student.classId || student.id);
        if (classKey !== targetClassKey) {
          return student;
        }

        return {
          ...student,
          fees: {
            ...student.fees,
            [feeName]: nextValue,
          },
        };
      }),
    );
    setDirty(true);
  }

  function updateField(studentId, field, value) {
    const numericFields = new Set(['outstanding', 'discount', 'amountPaid']);
    const nextValue = numericFields.has(field) ? Number(value || 0) : value;

    setStudents((currentStudents) =>
      currentStudents.map((student, studentIndex) =>
        student.id === studentId
          ? {
              ...student,
              [field]: nextValue,
            }
          : student,
      ),
    );
  }

  function addNewColumn() {
    const heading = window.prompt('Enter new fee heading');
    const trimmedHeading = String(heading || '').trim();

    if (!trimmedHeading) {
      return;
    }

    if (feeColumns.includes(trimmedHeading)) {
      showToast('That fee heading already exists.');
      return;
    }

    const seed = window.prompt(`Enter a starting amount for ${trimmedHeading}`, '0');
    if (seed === null) {
      return;
    }

    const nextValue = Number(seed || 0);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      showToast('Enter a valid amount.');
      return;
    }

    setFeeColumns((currentColumns) => [...currentColumns, trimmedHeading]);
    setStudents((currentStudents) =>
      currentStudents.map((student) => ({
        ...student,
        fees: {
          ...student.fees,
          [trimmedHeading]: nextValue,
        },
      })),
    );
    setDirty(true);
  }

  function renameFeeColumn(feeName) {
    const nextHeading = window.prompt('Rename fee heading', feeName);
    const trimmedHeading = String(nextHeading || '').trim();

    if (!trimmedHeading || trimmedHeading === feeName) {
      return;
    }

    if (feeColumns.includes(trimmedHeading)) {
      showToast('That fee heading already exists.');
      return;
    }

    setFeeColumns((currentColumns) => currentColumns.map((column) => (column === feeName ? trimmedHeading : column)));
    setStudents((currentStudents) => currentStudents.map((student) => {
      const nextFees = { ...student.fees };
      nextFees[trimmedHeading] = Number(nextFees[feeName] || 0);
      delete nextFees[feeName];
      return { ...student, fees: nextFees };
    }));
    setDirty(true);
  }

  function removeFeeColumn(feeName) {
    if (!window.confirm(`Remove ${feeName} from the active fee template?`)) {
      return;
    }

    setFeeColumns((currentColumns) => currentColumns.filter((column) => column !== feeName));
    setStudents((currentStudents) => currentStudents.map((student) => {
      const nextFees = { ...student.fees };
      delete nextFees[feeName];
      return { ...student, fees: nextFees };
    }));
    setDirty(true);
  }

  function applyFeesToAll() {
    const headingResponse = window.prompt(
      'Which fee heading should be applied to all students?',
      feeColumns[0] || 'Tuition',
    );
    const heading = String(headingResponse || '').trim();

    if (!heading) {
      return;
    }

    const amountResponse = window.prompt(`Set ${heading} fee for all students`, '0');
    if (amountResponse === null) {
      return;
    }

    const nextValue = Number(amountResponse || 0);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      showToast('Enter a valid amount.');
      return;
    }

    setFeeColumns((currentColumns) =>
      currentColumns.includes(heading) ? currentColumns : [...currentColumns, heading],
    );
    setStudents((currentStudents) =>
      currentStudents.map((student) => ({
        ...student,
        fees: {
          ...student.fees,
          [heading]: nextValue,
        },
      })),
    );
    setDirty(true);
  }

  const persistTemplateSnapshot = useCallback(async ({ silent = false } = {}) => {
    if (students.length === 0) {
      if (!silent) {
        showToast('No students found to save.');
      }
      return false;
    }

    if (!sessionLabel || !currentTerm) {
      if (!silent) {
        showToast('Set the current session and term in school settings before saving fee headings.');
      }
      return false;
    }

    setSavingTemplate(true);

    try {
      const snapshotPayload = buildFeeSnapshotPayload({
        students,
        feeColumns,
        sessionLabel,
        currentTerm,
      });

      const response = await saveFeesConfigSnapshot(snapshotPayload);
      const nextConfigs = response?.configs || [];

      setConfigArchive((currentConfigs) => [
        ...nextConfigs,
        ...currentConfigs.filter((config) => !(String(config?.session || '') === String(sessionLabel || '') && String(config?.term || '') === String(currentTerm || ''))),
      ]);
      setDirty(false);
      setLastTemplateSavedAt(new Date().toISOString());
      if (!silent) {
        showToast('Fee template saved.');
      }
      return true;
    } catch (error) {
      if (!silent) {
        showToast(error.message || 'Could not save fee template.');
      }
      return false;
    } finally {
      setSavingTemplate(false);
    }
  }, [currentTerm, feeColumns, sessionLabel, showToast, students]);

  async function saveTemplate() {
    await persistTemplateSnapshot({ silent: false });
  }

  useEffect(() => {
    window.clearTimeout(autoSaveTimeoutRef.current);

    if (!dirty || loading || savingTemplate) {
      return undefined;
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      persistTemplateSnapshot({ silent: true });
    }, 1200);

    return () => {
      window.clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [dirty, loading, persistTemplateSnapshot, savingTemplate]);

  async function persistPaymentDetails() {
    setPaymentDetailsSaving(true);
    try {
      const result = await saveFeesPaymentDetails(paymentDetailsForm);
      setPaymentDetailsForm(result?.paymentDetails || paymentDetailsForm);
      showToast('School payment details saved.');
    } catch (error) {
      showToast(error.message || 'Could not save payment details.');
    } finally {
      setPaymentDetailsSaving(false);
    }
  }

  function updateClaimReviewNote(claimId, reviewNote) {
    setClaims(currentClaims => currentClaims.map(claim => (
      claim.id === claimId
        ? { ...claim, reviewNote }
        : claim
    )));
  }

  async function reviewClaim(claimId, action) {
    const targetClaim = claims.find(claim => claim.id === claimId);
    if (!targetClaim) {
      return;
    }

    setClaimSavingId(`${claimId}:${action}`);
    try {
      if (action === 'approve') {
        await approveFeePaymentClaim(claimId, { verificationNote: targetClaim.reviewNote || '' });
        showToast('Payment claim approved. Issue the receipt from the fees ledger when ready.');
      } else {
        await rejectFeePaymentClaim(claimId, { verificationNote: targetClaim.reviewNote || '' });
        showToast('Payment claim rejected.');
      }
      await loadBoard();
    } catch (error) {
      showToast(error.message || 'Could not review payment claim.');
    } finally {
      setClaimSavingId('');
    }
  }

  async function persistAmountPaid(studentId) {
    const target = students.find((student) => student.id === studentId);
    if (!target) {
      return;
    }

    const nextAmount = Number(target.amountPaid || 0);
    const recordedAmount = Number(target.recordedAmountPaid || 0);

    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      showToast('Enter a valid payment amount.');
      setStudents((currentStudents) =>
        currentStudents.map((student) =>
          student.id === studentId
            ? {
                ...student,
                amountPaid: recordedAmount,
              }
            : student,
        ),
      );
      return;
    }

    if (nextAmount < recordedAmount) {
      showToast('Recorded payments can only be increased from this screen.');
      setStudents((currentStudents) =>
        currentStudents.map((student) =>
          student.id === studentId
            ? {
                ...student,
                amountPaid: recordedAmount,
              }
            : student,
        ),
      );
      return;
    }

    if (nextAmount === recordedAmount) {
      return;
    }

    setPaymentSavingId(studentId);

    try {
      const result = await markFeePaid(studentId, {
        amount: nextAmount - recordedAmount,
        paymentType: 'cash',
        feeAmount: expectedAmount(target),
      });

      setStudents((currentStudents) =>
        currentStudents.map((student) => {
          if (student.id !== studentId) {
            return student;
          }

          const updatedStudent = {
            ...student,
            amountPaid: nextAmount,
            recordedAmountPaid: nextAmount,
          };

          return {
            ...updatedStudent,
            remark:
              getStatus(updatedStudent) === 'Paid'
                ? 'Paid'
                : student.remark || 'Part Payment',
          };
        }),
      );
      if (result?.receipt) {
        setReceipts(currentReceipts => [result.receipt, ...currentReceipts.filter(receipt => receipt.id !== result.receipt.id)]);
      }
      showToast('Payment recorded. Use Issue Receipt when you are ready to release the receipt.');
    } catch (error) {
      setStudents((currentStudents) =>
        currentStudents.map((student) =>
          student.id === studentId
            ? {
                ...student,
                amountPaid: recordedAmount,
              }
            : student,
        ),
      );
      showToast(error.message || 'Could not record payment.');
    } finally {
      setPaymentSavingId('');
    }
  }

  async function handleIssueReceipt(student) {
    const receiptState = getReceiptState(student);
    if (receiptState.key === 'none') {
      showToast('Record a payment before issuing a receipt.');
      return;
    }

    if (receiptState.key === 'issued') {
      setSelectedReceipt(receiptState.latestReceipt || null);
      setReceiptModal(Boolean(receiptState.latestReceipt));
      return;
    }

    setReceiptIssuingId(student.id);
    try {
      const response = await issueFeeReceipt(student.id);
      if (response?.receipt) {
        setReceipts((currentReceipts) => [response.receipt, ...currentReceipts.filter((receipt) => receipt.id !== response.receipt.id)]);
        setSelectedReceipt(response.receipt);
        setReceiptModal(true);
        showToast(response.action === 'reissued'
          ? `Receipt ${response.receipt.receiptNo} reissued.`
          : response.action === 'already-issued'
            ? `Receipt ${response.receipt.receiptNo} is already current.`
            : `Receipt ${response.receipt.receiptNo} issued.`);
        return;
      }

      showToast(response?.message || 'Receipt state checked.');
    } catch (error) {
      showToast(error.message || 'Could not issue receipt.');
    } finally {
      setReceiptIssuingId('');
    }
  }

  async function handleBulkIssueReceipts() {
    if (!actionableReceiptStudents.length) {
      showToast('No pending or stale receipts are available for bulk issue.');
      return;
    }

    setBulkIssuing(true);
    try {
      const results = await Promise.allSettled(actionableReceiptStudents.map((student) => issueFeeReceipt(student.id)));
      const mergedReceipts = [];
      let issuedCount = 0;
      let skippedCount = 0;

      results.forEach((result) => {
        if (result.status !== 'fulfilled') {
          skippedCount += 1;
          return;
        }

        const payload = result.value;
        if (payload?.receipt) {
          mergedReceipts.push(payload.receipt);
        }

        if (payload?.action === 'issued' || payload?.action === 'reissued') {
          issuedCount += 1;
        } else {
          skippedCount += 1;
        }
      });

      if (mergedReceipts.length) {
        setReceipts((currentReceipts) => [
          ...mergedReceipts,
          ...currentReceipts.filter((receipt) => !mergedReceipts.some((nextReceipt) => nextReceipt.id === receipt.id)),
        ]);
      }

      showToast(`Bulk receipt run completed: ${issuedCount} issued${skippedCount ? `, ${skippedCount} skipped` : ''}.`);
    } catch (error) {
      showToast(error.message || 'Could not bulk issue receipts.');
    } finally {
      setBulkIssuing(false);
    }
  }

  async function handleBulkDownloadReceipts() {
    if (!downloadableReceipts.length) {
      showToast('No issued receipts are available for download in the current view.');
      return;
    }

    setBulkDownloading(true);
    try {
      const folderName = sanitizeReceiptFilePart(`${branding?.schoolName || 'receipts'}_${sessionLabel || 'session'}_${currentTerm || 'term'}`) || 'school_receipts';
      const documents = await Promise.all(downloadableReceipts.map(async (receipt) => ({
        name: `${sanitizeReceiptFilePart(receipt.studentName || receipt.studentDisplayId || receipt.studentId || 'student') || 'student'}_${sanitizeReceiptFilePart(receipt.receiptNo || 'receipt') || 'receipt'}.html`,
        content: await buildReceiptExportDocument(receipt, branding || {}),
      })));

      if (typeof window.showDirectoryPicker === 'function') {
        const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const receiptsDirectory = await rootHandle.getDirectoryHandle(folderName, { create: true });

        for (const documentFile of documents) {
          const fileHandle = await receiptsDirectory.getFileHandle(documentFile.name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(documentFile.content);
          await writable.close();
        }

        showToast(`Saved ${documents.length} receipts into ${folderName}.`);
        return;
      }

      const zip = new JSZip();
      const directory = zip.folder(folderName);
      documents.forEach((documentFile) => {
        directory.file(documentFile.name, documentFile.content);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${folderName}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Downloaded ${documents.length} receipts as ${folderName}.zip.`);
    } catch (error) {
      if (error?.name === 'AbortError') {
        showToast('Bulk receipt download cancelled.');
      } else {
        showToast(error.message || 'Could not bulk download receipts.');
      }
    } finally {
      setBulkDownloading(false);
    }
  }

  // ── Per-student fee template: download a spreadsheet, fill each learner's fees + amount paid, re-upload ──
  function handleDownloadFeeTemplate() {
    if (!students.length) {
      showToast('No students found to build a template.');
      return;
    }

    const rows = students.map((student) => {
      const row = {
        'Student ID': getReadableStudentId(student.displayId, student.id),
        'Student Name': student.name || '',
        Class: student.className || '',
      };
      feeColumns.forEach((feeName) => {
        row[feeName] = Number(student?.fees?.[feeName] || 0);
      });
      row['Amount Paid'] = Number(student?.amountPaid || 0);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fees');
    const filePart = sanitizeReceiptFilePart(`${branding?.schoolName || 'fees'}_${sessionLabel || 'session'}_${currentTerm || 'term'}`) || 'fees_template';
    XLSX.writeFile(workbook, `${filePart}_template.xlsx`);
    showToast('Fee template downloaded. Fill each learner\'s fees and amount paid, then upload it back.');
  }

  function findStudentForRow(row) {
    const id = String(row['Student ID'] || row['StudentID'] || '').trim().toLowerCase();
    const name = String(row['Student Name'] || row['Name'] || '').trim().toLowerCase();
    return students.find((student) => {
      const candidateIds = [student.displayId, student.id, getReadableStudentId(student.displayId, student.id)]
        .map((value) => String(value || '').trim().toLowerCase());
      if (id && candidateIds.includes(id)) return true;
      if (name && String(student.name || '').trim().toLowerCase() === name) return true;
      return false;
    }) || null;
  }

  async function handleUploadFeeTemplate(event) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingTemplate(true);
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

        const updates = [];
        rows.forEach((row) => {
          const student = findStudentForRow(row);
          if (!student) return;
          const nextFees = { ...student.fees };
          feeColumns.forEach((feeName) => {
            if (row[feeName] !== undefined && row[feeName] !== '') {
              nextFees[feeName] = Number(row[feeName] || 0);
            }
          });
          const uploadedPaidRaw = row['Amount Paid'] ?? row['AmountPaid'] ?? student.amountPaid;
          const uploadedPaid = Number(uploadedPaidRaw || 0);
          updates.push({ id: student.id, fees: nextFees, amountPaid: uploadedPaid });
        });

        if (!updates.length) {
          showToast('No matching students were found in the uploaded file.');
          return;
        }

        // Reflect the per-student fees + payments in the grid.
        setStudents((currentStudents) => currentStudents.map((student) => {
          const update = updates.find((item) => item.id === student.id);
          if (!update) return student;
          return { ...student, fees: update.fees, amountPaid: update.amountPaid };
        }));
        setDirty(true);

        // Persist payments (and each student's expected fee) into the ledger.
        let recorded = 0;
        for (const update of updates) {
          const student = students.find((item) => item.id === update.id);
          const recordedPaid = Number(student?.recordedAmountPaid || 0);
          const delta = Number(update.amountPaid || 0) - recordedPaid;
          const expected = feeColumns.reduce((sum, feeName) => sum + Number(update.fees[feeName] || 0), 0) + Number(student?.outstanding || 0);
          if (delta > 0) {
            try {
              await markFeePaid(update.id, { amount: delta, paymentType: 'cash', feeAmount: expected });
              recorded += 1;
            } catch {
              // continue with the rest of the roster
            }
          }
        }

        showToast(`Template imported for ${updates.length} student(s)${recorded ? `, ${recorded} payment update(s) recorded` : ''}. Review, then use Bulk Issue Receipts.`);
        await loadBoard();
      } catch (error) {
        showToast(error.message || 'Could not read the uploaded template.');
      } finally {
        setUploadingTemplate(false);
      }
    }
    if (templateInputRef.current) templateInputRef.current.value = '';
  }

  const columnTotals = useMemo(() => {
    const totals = feeColumns.reduce((map, feeName) => ({ ...map, [feeName]: 0 }), {});

    filteredStudents.forEach((student) => {
      feeColumns.forEach((feeName) => {
        totals[feeName] = Number(totals[feeName] || 0) + Number(student?.fees?.[feeName] || 0);
      });
    });

    totals.outstanding = filteredStudents.reduce(
      (sum, student) => sum + Number(student?.outstanding || 0),
      0,
    );
    totals.total = filteredStudents.reduce((sum, student) => sum + calculateTotal(student), 0);
    totals.expected = filteredStudents.reduce((sum, student) => sum + expectedAmount(student), 0);
    totals.paid = filteredStudents.reduce((sum, student) => sum + Number(student?.amountPaid || 0), 0);
    totals.balance = filteredStudents.reduce((sum, student) => sum + balance(student), 0);
    return totals;
  }, [balance, calculateTotal, expectedAmount, feeColumns, filteredStudents]);

  const stickyStats = [
    { label: 'Total Paid', value: formatNaira(columnTotals.paid), Icon: BanknotesIcon, tint: 'text-emerald-600', chip: 'bg-emerald-500/15' },
    { label: 'Outstanding', value: formatNaira(columnTotals.balance), Icon: ExclamationTriangleIcon, tint: 'text-rose-600', chip: 'bg-rose-500/15' },
    { label: 'Students', value: String(filteredStudents.length), Icon: UsersIcon, tint: 'text-indigo-600', chip: 'bg-indigo-500/15' },
    { label: 'Receipts Pending', value: String(actionableReceiptStudents.length), Icon: ReceiptPercentIcon, tint: 'text-amber-600', chip: 'bg-amber-500/15' },
    { label: 'Live Claims', value: String(pendingClaims.length), Icon: InboxArrowDownIcon, tint: 'text-sky-600', chip: 'bg-sky-500/15' },
  ];

  const stickyTh = `${TH} sticky top-0 z-20`;
  const tableShellClass = tableFullscreen
    ? 'hidden lg:block fixed inset-0 z-[60] overflow-auto bg-[#fff4df] p-4 dark:bg-[#1a0014]'
    : 'hidden lg:block max-h-[70vh] overflow-auto overscroll-contain rounded-2xl border border-[#c9a96e]/25 dark:border-[#00ffff]/15';
  const tableClass = tableFullscreen ? 'w-full text-sm ndv-fit-table' : 'min-w-[2300px] w-full text-sm';

  function buildInvoiceText(student) {
    const lines = [
      `${branding?.schoolName || 'School'} — Fee Invoice`,
      `Student: ${student.name}${student.className ? ` (${student.className})` : ''}`,
      [sessionLabel && `Session ${sessionLabel}`, currentTerm && `Term ${currentTerm}`].filter(Boolean).join(' • '),
      '',
      ...feeColumns.filter((feeName) => Number(student.fees?.[feeName] || 0) > 0).map((feeName) => `${feeName}: ${formatNaira(student.fees[feeName])}`),
      Number(student.outstanding || 0) > 0 ? `Brought forward: ${formatNaira(student.outstanding)}` : '',
      `Total: ${formatNaira(calculateTotal(student) + Number(student.outstanding || 0))}`,
      Number(student.discount || 0) > 0 ? `Discount: ${student.discount}%` : '',
      `Expected: ${formatNaira(expectedAmount(student))}`,
      `Paid: ${formatNaira(student.amountPaid)}`,
      `Balance: ${formatNaira(balance(student))}`,
      '',
      balance(student) > 0 ? 'Kindly complete the outstanding fee. Thank you.' : 'Fees fully paid. Thank you.',
    ].filter((line) => line !== '');
    return lines.join('\n');
  }

  function shareInvoiceWhatsApp(student) {
    const raw = String(student.parentPhone || student.guardianPhone || student.phone || '').replace(/[^\d+]/g, '');
    let digits = raw.replace(/\+/g, '');
    if (raw && !raw.startsWith('+') && digits.startsWith('0')) digits = `234${digits.slice(1)}`;
    const text = encodeURIComponent(buildInvoiceText(student));
    const url = digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const claimQueuePanel = (
    <div className={CARD}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Payment Claim Queue</h3>
          <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
            Review and verify parent payment claims before receipts are issued.
          </p>
        </div>
        <span className={BADGE}>{pendingClaims.length} Pending</span>
      </div>

      <div className="mt-5 space-y-4">
        {!recentClaims.length ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">No payment claims have been submitted yet.</p> : null}
        {recentClaims.map(claim => (
          <article key={claim.id} className={`${INNER} space-y-4`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-lg font-bold text-[#191970] dark:text-white">{claim.studentName} • {formatNaira(claim.amount)}</p>
                <p className="text-sm text-[#191970] dark:text-[#39ff14]">{claim.claimantName || 'Parent'} • {claim.paymentMethod || 'bank-transfer'} • {claim.paidAt || claim.claimedAt || 'Recently submitted'}</p>
                <div className="flex flex-wrap gap-2">
                  <span className={BADGE}>{claim.className || 'No class assigned'}</span>
                  <span className={BADGE}>{claim.paymentReference || 'No reference supplied'}</span>
                  {claim.receiptNo ? <span className={BADGE}>Receipt {claim.receiptNo}</span> : null}
                </div>
                {claim.paymentNote ? <p className="text-sm text-[#191970] dark:text-[#39ff14]">{claim.paymentNote}</p> : null}
                {claim.verificationNote && String(claim.status || '').toLowerCase() !== 'pending' ? <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Finance note: {claim.verificationNote}</p> : null}
              </div>
              <span className={BADGE}>{getClaimStatusLabel(claim.status)}</span>
            </div>

            {String(claim.status || '').toLowerCase() === 'pending' ? (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <input
                  value={claim.reviewNote || ''}
                  onChange={(event) => updateClaimReviewNote(claim.id, event.target.value)}
                  className={INPUT}
                  placeholder="Optional finance note for the parent"
                />
                <button onClick={() => reviewClaim(claim.id, 'approve')} disabled={Boolean(claimSavingId)} className={BTN}>
                  {claimSavingId === `${claim.id}:approve` ? 'Approving...' : 'Approve Claim'}
                </button>
                <button onClick={() => reviewClaim(claim.id, 'reject')} disabled={Boolean(claimSavingId)} className={OUTLINE_BTN}>
                  {claimSavingId === `${claim.id}:reject` ? 'Rejecting...' : 'Reject Claim'}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={CARD}>
        <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Loading fees management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{'@media print { body * { visibility: hidden; } #fees-receipt-print, #fees-receipt-print * { visibility: visible; } #fees-receipt-print { position: absolute; inset: 0; margin: 0; padding: 32px; width: 100%; background: #f5deb3; } } .ndv-fit-table { min-width: 0 !important; width: 100% !important; table-layout: fixed; } .ndv-fit-table th, .ndv-fit-table td { padding: 2px 4px !important; font-size: 10px !important; } .ndv-fit-table input, .ndv-fit-table select, .ndv-fit-table button { font-size: 10px !important; padding: 1px 3px !important; } .ndv-fit-table .min-w-\\[160px\\] { min-width: 0 !important; }'}</style>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] shadow-xl dark:bg-[#00ffff] dark:text-black">
          {toast}
        </div>
      ) : null}

      <div className="sticky top-[72px] z-30 -mx-1 rounded-2xl border border-[#c9a96e]/40 bg-[#f5deb3]/95 p-2.5 shadow-sm backdrop-blur dark:border-[#00ffff]/20 dark:bg-[#800000]/80">
        <div className="flex items-center gap-2 overflow-x-auto">
          {stickyStats.map((item) => {
            const Icon = item.Icon;
            return (
              <article key={item.label} className="flex shrink-0 items-center gap-2.5 rounded-xl border border-[#c9a96e]/30 bg-white/55 px-3 py-2 dark:border-[#00ffff]/15 dark:bg-[#1f0022]/70">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.chip}`}>
                  <Icon className={`h-4 w-4 ${item.tint}`} />
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#800020] dark:text-[#bf00ff]">{item.label}</p>
                  <p className="text-sm font-black text-[#800000] dark:text-white">{item.value}</p>
                </div>
              </article>
            );
          })}
          {financeView === 'fees' ? (
            <button
              onClick={() => setControlsOpen((current) => !current)}
              className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${controlsOpen ? 'border-transparent bg-[#800020] text-[#f5deb3]' : 'border-[#800020]/30 bg-white/60 text-[#800020] hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff]'}`}
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              {controlsOpen ? 'Hide Tools' : 'Fee Tools'}
            </button>
          ) : null}
        </div>
      </div>

      {financeView === 'channels' ? (
        <div className={CARD}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Parent Payment Channels</h3>
              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
                Publish the school account details parents use before they submit the “I have paid” verification claim.
              </p>
            </div>
            <button onClick={persistPaymentDetails} disabled={paymentDetailsSaving} className={BTN}>
              {paymentDetailsSaving ? 'Saving...' : 'Save Payment Details'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Bank Name
              <input value={paymentDetailsForm.bankName} onChange={(event) => setPaymentDetailsForm(current => ({ ...current, bankName: event.target.value }))} className={`${INPUT} mt-2`} />
            </label>
            <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Account Name
              <input value={paymentDetailsForm.accountName} onChange={(event) => setPaymentDetailsForm(current => ({ ...current, accountName: event.target.value }))} className={`${INPUT} mt-2`} />
            </label>
            <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Account Number
              <input value={paymentDetailsForm.accountNumber} onChange={(event) => setPaymentDetailsForm(current => ({ ...current, accountNumber: event.target.value }))} className={`${INPUT} mt-2`} />
            </label>
            <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Reference Hint
              <input value={paymentDetailsForm.paymentReferenceHint} onChange={(event) => setPaymentDetailsForm(current => ({ ...current, paymentReferenceHint: event.target.value }))} className={`${INPUT} mt-2`} placeholder="e.g. Student name + teller no." />
            </label>
            <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff] md:col-span-2 xl:col-span-4">Payment Instructions
              <textarea value={paymentDetailsForm.paymentInstructions} onChange={(event) => setPaymentDetailsForm(current => ({ ...current, paymentInstructions: event.target.value }))} rows={3} className={`${INPUT} mt-2 min-h-[110px] resize-y`} placeholder="Explain how parents should pay and what proof or reference they should include." />
            </label>
          </div>
        </div>
      ) : null}

      {financeView === 'claims' ? claimQueuePanel : null}

      {financeView === 'fees' ? (
        <>
          {controlsOpen ? (
          <div className={CARD}>
            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => setFeesOverviewOpen((current) => !current)} className={feesOverviewOpen ? BTN : OUTLINE_BTN}>
                {feesOverviewOpen ? 'Hide Fee Overview' : 'Open Fee Overview'}
              </button>
              <button onClick={() => setFeesExpanded((current) => !current)} className={OUTLINE_BTN}>
                {feesExpanded ? 'Collapse Fee Table' : 'Open Fee Table'}
              </button>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Fees Ledger</h3>
                <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
                  Manage the active fee headings, record current payments, and issue receipts for the selected school period.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={BADGE}>Showing {filteredStudents.length} of {students.length} students</span>
                  <span className={BADGE}>Session {sessionLabel || 'Not set'}</span>
                  <span className={BADGE}>Term {currentTerm || 'Not set'}</span>
                  <span className={BADGE}>{dirty ? 'Unsaved fee changes' : lastTemplateSavedAt ? `Saved ${formatAutoSaveTime(lastTemplateSavedAt)}` : 'No saved fee snapshot yet'}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
                Search Students
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search by student name or ID"
                  className={`${INPUT} mt-2`}
                />
              </label>
              <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
                  Payment Status Filter
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={`${INPUT} mt-2`}
                  >
                    {PAYMENT_STATUS_FILTERS.map((filterOption) => (
                      <option key={filterOption.value} value={filterOption.value}>{filterOption.label}</option>
                    ))}
                  </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={applyFeesToAll} className={BTN}>Apply Fee To All</button>
              <button onClick={addNewColumn} className={OUTLINE_BTN}>Add Fee Heading</button>
              <button onClick={saveTemplate} disabled={savingTemplate} className={BTN}>
                {savingTemplate ? 'Saving...' : dirty ? 'Save Template *' : 'Save Template'}
              </button>
              <button onClick={handleDownloadFeeTemplate} className={OUTLINE_BTN}>Download Template</button>
              <button onClick={() => templateInputRef.current?.click()} disabled={uploadingTemplate} className={OUTLINE_BTN}>
                {uploadingTemplate ? 'Importing...' : 'Upload Filled Template'}
              </button>
              <input
                ref={templateInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUploadFeeTemplate}
              />
              <button onClick={handleBulkIssueReceipts} disabled={bulkIssuing || !actionableReceiptStudents.length} className={BTN}>
                {bulkIssuing ? 'Issuing Receipts...' : `Bulk Issue Receipts (${actionableReceiptStudents.length})`}
              </button>
              <button onClick={handleBulkDownloadReceipts} disabled={bulkDownloading || !downloadableReceipts.length} className={OUTLINE_BTN}>
                {bulkDownloading ? 'Preparing Download...' : `Bulk Download Receipts (${downloadableReceipts.length})`}
              </button>
            </div>
          </div>
          ) : null}

          {feesOverviewOpen ? (
          <div className={CARD}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Fee Overview</h3>
                <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
                  The finance board follows the current school session and term from settings. Open this panel when you need the period summary, then close it to focus on the table.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={BADGE}>Current Session: {sessionLabel || 'Not set'}</span>
                <span className={BADGE}>Current Term: {currentTerm || 'Not set'}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className={INNER}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Active Period</p>
                <h4 className="mt-3 text-2xl font-black text-[#800000] dark:text-white">{sessionLabel || 'No current session'}</h4>
                <p className="mt-2 text-sm font-semibold text-[#191970] dark:text-[#39ff14]">{currentTerm || 'No current term set'}</p>
                <p className="mt-3 text-sm font-semibold text-[#191970] dark:text-[#39ff14]">Showing {filteredStudents.length} of {students.length} students in the current filtered view.</p>
                <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">{dirty ? 'Unsaved fee changes are waiting for a template save.' : lastTemplateSavedAt ? `Template last saved ${formatAutoSaveTime(lastTemplateSavedAt)}.` : 'No saved fee snapshot yet.'}</p>
                <p className="mt-3 text-sm text-[#191970] dark:text-[#39ff14]">
                  Update the active period from school settings when the school moves to a new session or term.
                </p>
              </div>

              <div className="space-y-3">
                {!pastSessionGroups.length ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">No past sessions have been recorded yet.</p> : null}
                {pastSessionGroups.map((entry) => (
                  <details key={entry.session} className={`${INNER} group`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#800000] dark:text-white">{entry.session}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">
                          {entry.terms?.length || 0} {entry.terms?.length === 1 ? 'term' : 'terms'}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff] group-open:rotate-180">Open</span>
                    </summary>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(entry.terms || []).map((termItem) => (
                        <span key={`${entry.session}-${termItem.term || 'term'}`} className={BADGE}>{termItem.term || 'Recorded term'}</span>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {feesExpanded ? (
            <>
              <div className={CARD}>
                {!filteredStudents.length ? (
                  <div className={`${INNER} text-sm font-semibold text-[#800020] dark:text-[#bf00ff]`}>
                    No students match the current search or payment filter.
                  </div>
                ) : null}

                {filteredStudents.length ? (
                <div className="space-y-4 lg:hidden">
                  {filteredStudents.map((student) => {
                    const receiptState = getReceiptState(student);
                    return (
                      <article key={student.id} className={`${INNER} space-y-4`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-bold text-[#800000] dark:text-white">{student.name}</h4>
                              <span className={BADGE}>{getReadableStudentId(student.displayId, student.id)}</span>
                            </div>
                            <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">{student.className || 'Unassigned'} • {student.section}</p>
                            <p className="mt-2 text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Current balance {formatNaira(balance(student))}</p>
                          </div>
                          <span className={BADGE}>{getStatus(student)}</span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Outstanding
                            <input
                              type="number"
                              value={student.outstanding}
                              onChange={(event) => updateField(student.id, 'outstanding', event.target.value)}
                              className={`${INPUT} mt-2`}
                            />
                          </label>
                          <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Discount %
                            <input
                              type="number"
                              value={student.discount}
                              onChange={(event) => updateField(student.id, 'discount', event.target.value)}
                              className={`${INPUT} mt-2`}
                            />
                          </label>
                          <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Amount Paid
                            <input
                              type="number"
                              value={student.amountPaid}
                              onChange={(event) => updateField(student.id, 'amountPaid', event.target.value)}
                              onBlur={() => persistAmountPaid(student.id)}
                              disabled={paymentSavingId === student.id}
                              className={`${INPUT} mt-2`}
                            />
                            <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{paymentSavingId === student.id ? 'Saving payment...' : 'Blur to record payment'}</p>
                          </label>
                          <label className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Remark
                            <input
                              value={student.remark}
                              onChange={(event) => updateField(student.id, 'remark', event.target.value)}
                              placeholder={getStatus(student)}
                              className={`${INPUT} mt-2`}
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {feeColumns.map((feeName) => (
                            <label key={`${student.id}-${feeName}`} className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">{feeName}
                              <input
                                type="number"
                                value={student.fees?.[feeName] || 0}
                                onChange={(event) => updateFee(student.id, feeName, event.target.value)}
                                className={`${INPUT} mt-2`}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-[#c9a96e]/30 bg-white/45 p-3 dark:border-[#00ffff]/15 dark:bg-[#120014]/65">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total</p>
                            <p className="mt-2 text-lg font-bold text-[#800000] dark:text-white">{formatNaira(calculateTotal(student))}</p>
                          </div>
                          <div className="rounded-2xl border border-[#c9a96e]/30 bg-white/45 p-3 dark:border-[#00ffff]/15 dark:bg-[#120014]/65">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Expected</p>
                            <p className="mt-2 text-lg font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(expectedAmount(student))}</p>
                          </div>
                          <div className="rounded-2xl border border-[#c9a96e]/30 bg-white/45 p-3 dark:border-[#00ffff]/15 dark:bg-[#120014]/65">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Balance</p>
                            <p className={`mt-2 text-lg font-bold ${balance(student) <= 0 ? 'text-[#1a5c38] dark:text-[#00ffff]' : 'text-[#800000] dark:text-[#ff6bff]'}`}>{formatNaira(balance(student))}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={() => handleIssueReceipt(student)}
                            disabled={receiptState.disabled || receiptIssuingId === student.id || bulkIssuing}
                            className={`w-full ${receiptState.key === 'issued' ? OUTLINE_BTN : BTN}`}
                          >
                            {receiptIssuingId === student.id
                              ? receiptState.key === 'reissue' ? 'Reissuing...' : 'Issuing...'
                              : receiptState.label}
                          </button>
                          <button onClick={() => shareInvoiceWhatsApp(student)} className="w-full rounded-2xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5b]">
                            Send Invoice on WhatsApp
                          </button>
                          <p className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                            {receiptState.latestReceipt ? `Latest: ${receiptState.latestReceipt.receiptNo}` : 'No official receipt yet.'}
                          </p>
                        </div>
                      </article>
                    );
                  })}

                  <section className={`${INNER} grid gap-3 sm:grid-cols-2`}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Visible Total Paid</p>
                      <p className="mt-2 text-xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(columnTotals.paid)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Visible Balance</p>
                      <p className="mt-2 text-xl font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(columnTotals.balance)}</p>
                    </div>
                  </section>
                </div>
                ) : null}

                <div className="hidden lg:flex justify-end mb-2">
                  <button type="button" onClick={() => setTableFullscreen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#800020]/30 bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#800020] hover:bg-white dark:border-[#bf00ff]/40 dark:bg-[#120014]/80 dark:text-[#bf00ff]">
                    <ArrowsPointingOutIcon className="h-4 w-4" /> Fit to Screen
                  </button>
                </div>
                <div className={tableShellClass}>
                  {tableFullscreen ? (
                    <div className="sticky top-0 z-[70] mb-2 flex justify-end">
                      <button type="button" onClick={() => setTableFullscreen(false)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#f5deb3]">
                        <ArrowsPointingInIcon className="h-4 w-4" /> Exit Full Screen
                      </button>
                    </div>
                  ) : null}
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={stickyTh}>S/N</th>
                        <th className={stickyTh}>Student ID</th>
                        <th className={stickyTh}>Student Name</th>
                        <th className={stickyTh}>Class</th>
                        <th className={stickyTh}>Outstanding</th>
                        {feeColumns.map((feeName) => (
                          <th key={feeName} className={stickyTh}>
                            <div className="flex min-w-[160px] items-center justify-between gap-2">
                              <span>{feeName}</span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => renameFeeColumn(feeName)} className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-white/10">
                                  Edit
                                </button>
                                <button type="button" onClick={() => removeFeeColumn(feeName)} className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-white/10">
                                  Remove
                                </button>
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className={stickyTh}>Total</th>
                        <th className={stickyTh}>Discount %</th>
                        <th className={stickyTh}>Expected Amount</th>
                        <th className={stickyTh}>Amount Paid</th>
                        <th className={stickyTh}>Balance</th>
                        <th className={stickyTh}>Remark</th>
                        <th className={stickyTh}>Receipt</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredStudents.map((student, index) => {
                        const receiptState = getReceiptState(student);
                        return (
                          <tr key={student.id} className="bg-white/35 hover:bg-white/60 dark:bg-[#120014]/55 dark:hover:bg-[#1a0020]">
                            <td className={TD}>{index + 1}</td>
                            <td className={TD}>{getReadableStudentId(student.displayId, student.id)}</td>
                            <td className={TD}>
                              <div className="min-w-[220px]">
                                <p className="font-semibold text-[#191970] dark:text-white">{student.name}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#800020] dark:text-[#bf00ff]">{student.section}</p>
                              </div>
                            </td>
                            <td className={TD}>
                              <div>
                                <p className="font-semibold text-[#191970] dark:text-white">{student.className}</p>
                                <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">Class template</p>
                              </div>
                            </td>
                            <td className={TD}>
                              <input
                                type="number"
                                value={student.outstanding}
                                onChange={(event) => updateField(student.id, 'outstanding', event.target.value)}
                                className={INPUT}
                              />
                            </td>
                            {feeColumns.map((feeName) => (
                              <td key={`${student.id}-${feeName}`} className={TD}>
                                <input
                                  type="number"
                                  value={student.fees?.[feeName] || 0}
                                  onChange={(event) => updateFee(student.id, feeName, event.target.value)}
                                  className={INPUT}
                                />
                              </td>
                            ))}
                            <td className={`${TD} font-bold text-[#800000] dark:text-[#0000ff]`}>{formatNaira(calculateTotal(student))}</td>
                            <td className={TD}>
                              <input
                                type="number"
                                value={student.discount}
                                onChange={(event) => updateField(student.id, 'discount', event.target.value)}
                                className={INPUT}
                              />
                            </td>
                            <td className={`${TD} font-bold text-[#1a5c38] dark:text-[#00ffff]`}>{formatNaira(expectedAmount(student))}</td>
                            <td className={TD}>
                              <input
                                type="number"
                                value={student.amountPaid}
                                onChange={(event) => updateField(student.id, 'amountPaid', event.target.value)}
                                onBlur={() => persistAmountPaid(student.id)}
                                disabled={paymentSavingId === student.id}
                                className={INPUT}
                              />
                              <p className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">
                                {paymentSavingId === student.id ? 'Saving payment...' : 'Blur to record payment'}
                              </p>
                            </td>
                            <td className={`${TD} font-bold ${balance(student) <= 0 ? 'text-[#1a5c38] dark:text-[#00ffff]' : 'text-[#800000] dark:text-[#ff6bff]'}`}>
                              {formatNaira(balance(student))}
                            </td>
                            <td className={TD}>
                              <input
                                value={student.remark}
                                onChange={(event) => updateField(student.id, 'remark', event.target.value)}
                                placeholder={getStatus(student)}
                                className={INPUT}
                              />
                            </td>
                            <td className={TD}>
                              <div className="min-w-[170px] space-y-2">
                                <button
                                  onClick={() => handleIssueReceipt(student)}
                                  disabled={receiptState.disabled || receiptIssuingId === student.id || bulkIssuing}
                                  className={receiptState.key === 'issued' ? OUTLINE_BTN : BTN}
                                >
                                  {receiptIssuingId === student.id
                                    ? receiptState.key === 'reissue' ? 'Reissuing...' : 'Issuing...'
                                    : receiptState.label}
                                </button>
                                <button onClick={() => shareInvoiceWhatsApp(student)} title="Send invoice on WhatsApp" className="rounded-2xl bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1ebe5b]">
                                  WhatsApp
                                </button>
                                {receiptState.latestReceipt ? (
                                  <p className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                                    Latest: {receiptState.latestReceipt.receiptNo}
                                  </p>
                                ) : (
                                  <p className="text-xs text-[#800020] dark:text-[#bf00ff]">No official receipt yet.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      <tr className="bg-[#f0d090] font-bold dark:bg-[#220022]">
                        <td colSpan={4} className={TD}>TOTAL</td>
                        <td className={TD}>{formatNaira(columnTotals.outstanding)}</td>
                        {feeColumns.map((feeName) => (
                          <td key={`total-${feeName}`} className={TD}>{formatNaira(columnTotals[feeName])}</td>
                        ))}
                        <td className={TD}>{formatNaira(columnTotals.total)}</td>
                        <td className={TD}>-</td>
                        <td className={TD}>{formatNaira(columnTotals.expected)}</td>
                        <td className={TD}>{formatNaira(columnTotals.paid)}</td>
                        <td className={TD}>{formatNaira(columnTotals.balance)}</td>
                        <td className={TD}>-</td>
                        <td className={TD}>-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <FeeReceiptDialog
        receipt={selectedReceipt}
        isOpen={receiptModal && Boolean(selectedReceipt)}
        onClose={() => { setReceiptModal(false); setSelectedReceipt(null); }}
        printId="fees-receipt-print"
        title="School Finance Copy Receipt"
        subtitle="Official school fees receipt generated from the finance ledger."
      />
    </div>
  );
}

export default FeesManagementBoard;
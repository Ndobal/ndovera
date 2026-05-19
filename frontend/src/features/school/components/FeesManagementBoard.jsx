import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FeeReceiptPrintCard from './FeeReceiptPrintCard';
import {
  approveFeePaymentClaim,
  getFeePaymentClaims,
  getFeeReceipts,
  getClasses,
  getFeesConfig,
  getFeesLedger,
  getFeesPaymentDetails,
  getPeople,
  markFeePaid,
  rejectFeePaymentClaim,
  saveFeesConfig,
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

function FeesManagementBoard() {
  const [feeColumns, setFeeColumns] = useState(DEFAULT_FEE_COLUMNS);
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [sessionLabel, setSessionLabel] = useState(getDefaultSessionLabel());
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [paymentSavingId, setPaymentSavingId] = useState('');
  const [receiptModal, setReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [toast, setToast] = useState('');
  const [dirty, setDirty] = useState(false);
  const [paymentDetailsForm, setPaymentDetailsForm] = useState(createEmptyPaymentDetails());
  const [claims, setClaims] = useState([]);
  const [paymentDetailsSaving, setPaymentDetailsSaving] = useState(false);
  const [claimSavingId, setClaimSavingId] = useState('');
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

  const loadBoard = useCallback(async () => {
    setLoading(true);

    try {
      const [ledgerResult, configResult, classResult, peopleResult, receiptResult, paymentDetailsResult, claimResult] = await Promise.all([
        getFeesLedger(),
        getFeesConfig(),
        getClasses(),
        getPeople(),
        getFeeReceipts(),
        getFeesPaymentDetails(),
        getFeePaymentClaims(),
      ]);

      const configs = configResult?.configs || [];
      const columns = createFeeColumns(configs);
      const nextStudents = buildStudentRows({
        students: peopleResult?.people || [],
        ledger: ledgerResult?.ledger || [],
        classes: classResult?.classes || [],
        feeColumns: columns,
        configs,
      });

      const persistedSession = configs.find((config) => String(config?.session || '').trim())?.session;

      setFeeColumns(columns);
      setStudents(nextStudents);
      setSessionLabel(persistedSession || getDefaultSessionLabel());
      setReceipts(receiptResult?.receipts || []);
      setPaymentDetailsForm(paymentDetailsResult?.paymentDetails || createEmptyPaymentDetails());
      setClaims((claimResult?.claims || []).map(claim => ({ ...claim, reviewNote: claim.verificationNote || '' })));
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

  const filteredStudents = useMemo(() => {
    if (statusFilter === 'all') {
      return students;
    }

    return students.filter((student) => String(getStatus(student)).toLowerCase() === statusFilter);
  }, [getStatus, statusFilter, students]);

  function updateFee(index, feeName, value) {
    const nextValue = Number(value || 0);
    const target = students[index];
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

  function updateField(index, field, value) {
    const numericFields = new Set(['outstanding', 'discount', 'amountPaid']);
    const nextValue = numericFields.has(field) ? Number(value || 0) : value;

    setStudents((currentStudents) =>
      currentStudents.map((student, studentIndex) =>
        studentIndex === index
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

  async function saveTemplate() {
    if (students.length === 0) {
      showToast('No students found to save.');
      return;
    }

    setSavingTemplate(true);

    try {
      const payloads = [];
      const seen = new Set();

      students.forEach((student) => {
        feeColumns.forEach((feeName) => {
          const classKey = String(student.classId || '').trim() || '__all__';
          const uniqueKey = `${classKey}::${feeName.toLowerCase()}`;

          if (seen.has(uniqueKey)) {
            return;
          }

          seen.add(uniqueKey);
          payloads.push({
            feeType: feeName,
            classId: student.classId || '',
            amount: Number(student.fees?.[feeName] || 0),
            session: sessionLabel,
          });
        });
      });

      await Promise.all(payloads.map((payload) => saveFeesConfig(payload)));
      setDirty(false);
      showToast('Fee template saved.');
    } catch (error) {
      showToast(error.message || 'Could not save fee template.');
    } finally {
      setSavingTemplate(false);
    }
  }

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
        const response = await approveFeePaymentClaim(claimId, { verificationNote: targetClaim.reviewNote || '' });
        if (response?.receipt) {
          setReceipts(currentReceipts => [response.receipt, ...currentReceipts.filter(receipt => receipt.id !== response.receipt.id)]);
          setSelectedReceipt(response.receipt);
          setReceiptModal(true);
        }
        showToast(`Payment claim approved${response?.receipt?.receiptNo ? ` and receipt ${response.receipt.receiptNo} issued.` : '.'}`);
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
        setSelectedReceipt(result.receipt);
        setReceiptModal(true);
      }
      showToast(`Payment recorded${result?.receipt?.receiptNo ? ` and receipt ${result.receipt.receiptNo} issued.` : '.'}`);
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

  function issueReceipt(student) {
    const latestReceipt = receipts.find(receipt => receipt.studentId === student.id);
    if (!latestReceipt) {
      showToast('No official receipt has been recorded for this student yet. Record a payment or approve a payment claim first.');
      return;
    }

    setSelectedReceipt(latestReceipt);
    setReceiptModal(true);
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

  if (loading) {
    return (
      <div className={CARD}>
        <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Loading fees management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{'@media print { body * { visibility: hidden; } #fees-receipt-print, #fees-receipt-print * { visibility: visible; } #fees-receipt-print { position: absolute; inset: 0; margin: 0; padding: 32px; width: 100%; background: #f5deb3; } }'}</style>

      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] shadow-xl dark:bg-[#00ffff] dark:text-black">
          {toast}
        </div>
      ) : null}

      <div className={CARD}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">School Fees Management</h2>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
              Configure fee headings by class, review each student ledger, and print receipts from one board.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[180px] text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
              Session
              <input
                value={sessionLabel}
                onChange={(event) => setSessionLabel(event.target.value)}
                className={`${INPUT} mt-2`}
                placeholder="e.g. 2026/2027"
              />
            </label>
            <label className="min-w-[220px] text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
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
            <button onClick={applyFeesToAll} className={BTN}>Apply Fee To All</button>
            <button onClick={addNewColumn} className={OUTLINE_BTN}>Add Fee Heading</button>
            <button onClick={saveTemplate} disabled={savingTemplate} className={BTN}>
              {savingTemplate ? 'Saving...' : dirty ? 'Save Template *' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={BADGE}>Owner</span>
          <span className={BADGE}>Head Of School</span>
          <span className={BADGE}>Accountant</span>
          <span className={BADGE}>Owner Override</span>
        </div>
      </div>

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

      <div className={CARD}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Payment Claim Queue</h3>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
              Approve verified parent claims to issue the receipt automatically and push the ledger forward, or reject with a finance note.
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
                    {claimSavingId === `${claim.id}:approve` ? 'Approving...' : 'Approve & Issue Receipt'}
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

      <div className={CARD}>
        <p className="text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">Template behavior</p>
        <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">
          Editing a fee cell updates that student&apos;s class template locally. Use Save Template to persist those fee headings and amounts for the session.
        </p>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="min-w-[2300px] w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>S/N</th>
                <th className={TH}>Student ID</th>
                <th className={TH}>Student Name</th>
                <th className={TH}>Class</th>
                <th className={TH}>Outstanding</th>
                {feeColumns.map((feeName) => (
                  <th key={feeName} className={TH}>{feeName}</th>
                ))}
                <th className={TH}>Total</th>
                <th className={TH}>Discount %</th>
                <th className={TH}>Expected Amount</th>
                <th className={TH}>Amount Paid</th>
                <th className={TH}>Balance</th>
                <th className={TH}>Remark</th>
                <th className={TH}>Receipt</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student, index) => (
                <tr key={student.id} className="bg-white/35 hover:bg-white/60 dark:bg-[#120014]/55 dark:hover:bg-[#1a0020]">
                  <td className={TD}>{index + 1}</td>
                  <td className={TD}>{student.displayId || student.id}</td>
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
                      onChange={(event) => updateField(index, 'outstanding', event.target.value)}
                      className={INPUT}
                    />
                  </td>
                  {feeColumns.map((feeName) => (
                    <td key={`${student.id}-${feeName}`} className={TD}>
                      <input
                        type="number"
                        value={student.fees?.[feeName] || 0}
                        onChange={(event) => updateFee(index, feeName, event.target.value)}
                        className={INPUT}
                      />
                    </td>
                  ))}
                  <td className={`${TD} font-bold text-[#800000] dark:text-[#0000ff]`}>{formatNaira(calculateTotal(student))}</td>
                  <td className={TD}>
                    <input
                      type="number"
                      value={student.discount}
                      onChange={(event) => updateField(index, 'discount', event.target.value)}
                      className={INPUT}
                    />
                  </td>
                  <td className={`${TD} font-bold text-[#1a5c38] dark:text-[#00ffff]`}>{formatNaira(expectedAmount(student))}</td>
                  <td className={TD}>
                    <input
                      type="number"
                      value={student.amountPaid}
                      onChange={(event) => updateField(index, 'amountPaid', event.target.value)}
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
                      onChange={(event) => updateField(index, 'remark', event.target.value)}
                      placeholder={getStatus(student)}
                      className={INPUT}
                    />
                  </td>
                  <td className={TD}>
                    <button onClick={() => issueReceipt(student)} className={BTN}>Receipt</button>
                  </td>
                </tr>
              ))}

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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className={CARD}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total Expected</p>
          <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{formatNaira(columnTotals.expected)}</h3>
        </div>
        <div className={CARD}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Total Paid</p>
          <h3 className="mt-3 text-3xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{formatNaira(columnTotals.paid)}</h3>
        </div>
        <div className={CARD}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Outstanding Balance</p>
          <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#ff6bff]">{formatNaira(columnTotals.balance)}</h3>
        </div>
        <div className={CARD}>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Students Count</p>
          <h3 className="mt-3 text-3xl font-bold text-[#800000] dark:text-[#0000ff]">{filteredStudents.length}</h3>
        </div>
      </div>

      {receiptModal && selectedReceipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-4xl space-y-4">
            <FeeReceiptPrintCard
              receipt={selectedReceipt}
              printId="fees-receipt-print"
              title="School Finance Copy Receipt"
              subtitle="Official school fees receipt generated from the finance ledger."
            />

            <div className="flex flex-wrap gap-3">
              <button onClick={() => window.print()} className={BTN}>Print Receipt</button>
              <button onClick={() => { setReceiptModal(false); setSelectedReceipt(null); }} className={OUTLINE_BTN}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FeesManagementBoard;
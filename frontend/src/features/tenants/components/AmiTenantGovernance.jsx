import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AmiPlatformAnalytics from './AmiPlatformAnalytics';
import SchoolAccessPanel from './SchoolAccessPanel';
import {
  approveTenant,
  endDiscountCode,
  getAmiTenants,
  initiateTenantPayment,
  markCurrentTermPaid,
  markTenantAsPaid,
  resetTenantOwnerPassword,
  getTenantAwardCandidates,
  restoreTenant,
  suspendTenant,
  upsertTenantAward,
  updateTenantDomain,
  updateTenantPricing,
  setTenantRate,
  rolloutTenantRate,
  generateTermBills,
  getAmiTermBills,
  markTermBillPaid,
  prepareSchoolInvoice,
  previewSchoolInvoice,
  sendSchoolInvoice,
  setSchoolContactEmailAsAmi,
  upsertDiscountCode,
  verifyTenantPayment,
} from '../services/tenantApi';
import { askConfirm, askText } from '../../../shared/components/AppDialog';
import { BuildingOffice2Icon, ClockIcon, DocumentDuplicateIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PlusIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AmiPage, FIELD, Panel, Pill, PRIMARY, SchoolMark, SECONDARY, StatCard, TD, TermFeePill, TH } from '../../ami/AmiUi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const initialDiscountState = {
  code: '',
  name: '',
  description: '',
  setupFeeNaira: 35000,
  studentFeeNaira: 500,
  planScope: 'growth,custom',
  endsAt: '',
  active: true,
};

const currentAwardMonth = new Date().toISOString().slice(0, 7);
const AWARD_OPTIONS = [
  { value: 'most-active-staff', label: 'Most Active Staff' },
  { value: 'most-active-student', label: 'Most Active Student' },
  { value: 'most-punctual-staff', label: 'Most Punctual Staff' },
  { value: 'attendance-champion-student', label: 'Attendance Champion Student' },
  { value: 'consistency-star-staff', label: 'Consistency Star' },
  { value: 'birthday-spotlight', label: 'Birthday Spotlight' },
  { value: 'custom-award', label: 'Custom Award' },
];

function defaultAwardTitle(awardKey) {
  return AWARD_OPTIONS.find(option => option.value === awardKey)?.label || 'School Recognition Award';
}

function buildDefaultAwardForm() {
  return {
    awardKey: 'most-active-staff',
    awardTitle: defaultAwardTitle('most-active-staff'),
    description: '',
    periodMonth: currentAwardMonth,
    userId: '',
  };
}

function buildDefaultDomainForm(tenant = null) {
	return {
		websiteDomain: String(tenant?.websiteDomain || '').trim(),
		customDomainFeeNaira: Number(tenant?.metadata?.customDomainFeeNaira || 0),
		customDomainNotes: String(tenant?.metadata?.customDomainNotes || '').trim(),
	};
}

function buildAwardAvatar(recipient) {
  const seed = encodeURIComponent(recipient?.name || recipient?.displayId || recipient?.userId || recipient?.role || 'Ndovera');
  return recipient?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function statusClass(status) {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'accent-emerald';
    case 'pending_approval':
    case 'approved_pending_payment':
      return 'accent-amber';
    case 'suspended':
    case 'failed':
      return 'accent-rose';
    default:
      return 'accent-indigo';
  }
}

export default function AmiTenantGovernance({ sectionKey = 'overview' }) {
  const location = useLocation();
  const [governanceData, setGovernanceData] = useState(null);
  const [discountForm, setDiscountForm] = useState(initialDiscountState);
  const [pricingForm, setPricingForm] = useState({
    customPlanSetupFeeNaira: 50000,
    growthSetupFeeNaira: 50000,
    growthStudentFeeNaira: 1000,
    growthFeatures: '',
    customFeatures: '',
    partnerMinSetupFeeNaira: 25000,
    partnerMinStudentFeeNaira: 500,
    calculatorDefaultUsers: 250,
  });
  const [awardForms, setAwardForms] = useState({});
  const [lazyAwardCandidates, setLazyAwardCandidates] = useState({});

  async function loadAwardCandidates(tenantId) {
    if (!tenantId || lazyAwardCandidates[tenantId]) return;
    try {
      const res = await getTenantAwardCandidates(tenantId);
      setLazyAwardCandidates(prev => ({ ...prev, [tenantId]: res?.candidates || [] }));
    } catch { /* ignore — dropdown just stays empty */ }
  }
  const [domainForms, setDomainForms] = useState({});
  const [rateForms, setRateForms] = useState({});
  const [rolloutFeeNaira, setRolloutFeeNaira] = useState('');
  const [termBills, setTermBills] = useState([]);
  const [billPeriod, setBillPeriod] = useState({ session: '', term: '', termStartDate: '', tenantId: '' });
  // Invoicing one school: a draft until Ami presses Send.
  const [invoiceForm, setInvoiceForm] = useState({ tenantId: '', onboardingFee: '', includeTermCharge: true, contactEmail: '' });
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [openTenantId, setOpenTenantId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const paymentRef = new URLSearchParams(location.search).get('payment_ref');

  const loadGovernanceData = async () => {
    try {
      const data = await getAmiTenants();
      setGovernanceData(data);
      setError('');
    } catch (loadError) {
      const msg = loadError.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('request failed')) {
        setError('Session expired or insufficient permissions. Please log out and log back in as AMI.');
      } else {
        setError(msg || 'Unable to load tenant governance data.');
      }
    }
  };

  useEffect(() => {
    loadGovernanceData();
  }, []);

  const pricingConfig = governanceData?.pricingConfig;

  useEffect(() => {
    if (!pricingConfig) return;
    const growth = pricingConfig.plans?.growth;
    const custom = pricingConfig.plans?.custom;
    const toNaira = cents => (typeof cents === 'number' ? cents / 100 : '');

    setPricingForm({
      customPlanSetupFeeNaira: typeof pricingConfig.customPlanSetupFee === 'number' ? pricingConfig.customPlanSetupFee : 50000,
      growthSetupFeeNaira: toNaira(growth?.setupFeeCents),
      growthStudentFeeNaira: toNaira(growth?.studentFeeCents),
      growthFeatures: (growth?.features || []).join('\n'),
      customFeatures: (custom?.features || []).join('\n'),
      partnerMinSetupFeeNaira: toNaira(pricingConfig.partnerMinSetupFeeCents),
      partnerMinStudentFeeNaira: toNaira(pricingConfig.partnerMinStudentFeeCents),
      calculatorDefaultUsers: pricingConfig.calculatorDefaultUsers || 250,
    });
  }, [pricingConfig]);

  useEffect(() => {
    if (!paymentRef) {
      return undefined;
    }

    let cancelled = false;

    const runVerification = async () => {
      setBusyAction('verify-payment');
      try {
        const result = await verifyTenantPayment(paymentRef);
        if (!cancelled) {
          setNotice(result.verified ? 'Flutterwave payment verified and tenant state updated.' : 'Payment is still pending.');
          await loadGovernanceData();
        }
      } catch (verificationError) {
        if (!cancelled) {
          setError(verificationError.message || 'Unable to verify payment.');
        }
      } finally {
        if (!cancelled) {
          setBusyAction('');
        }
      }
    };

    runVerification();
    return () => {
      cancelled = true;
    };
  }, [paymentRef]);

  const [ownerReset, setOwnerReset] = useState(null);

  const handleResetOwnerPassword = async tenant => {
    setBusyAction(`reset-owner-${tenant.id}`);
    setError('');
    setNotice('');
    setOwnerReset(null);
    try {
      const result = await resetTenantOwnerPassword({ tenantId: tenant.id, email: tenant.ownerEmail });
      setOwnerReset({ tenantId: tenant.id, ...result });
      setNotice(
        result.emailed
          ? `Reset link emailed to ${result.email}. You can also share it via WhatsApp below.`
          : `Reset link generated for ${result.email}. Email could not be sent automatically — share the link via WhatsApp below.`,
      );
    } catch (resetError) {
      setError(resetError.message || 'Could not reset owner password.');
    } finally {
      setBusyAction('');
    }
  };

  const runAction = async (actionKey, callback) => {
    setBusyAction(actionKey);
    setError('');
    setNotice('');

    try {
      await callback();
      await loadGovernanceData();
    } catch (actionError) {
      setError(actionError.message || 'Action failed.');
    } finally {
      setBusyAction('');
    }
  };

  const handleDiscountChange = event => {
    const { name, value, type, checked } = event.target;
    setDiscountForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : (name.includes('Naira') ? Number(value) : value),
    }));
  };

  const handleSaveDiscount = async event => {
    event.preventDefault();
    await runAction('save-discount', async () => {
      await upsertDiscountCode({
        ...discountForm,
        code: discountForm.code.trim().toUpperCase(),
        name: discountForm.name || discountForm.code.trim().toUpperCase(),
        endsAt: discountForm.endsAt || null,
      });
      setNotice(`Discount code ${discountForm.code.trim().toUpperCase()} saved.`);
      setDiscountForm(initialDiscountState);
    });
  };

  const handlePricingChange = event => {
    const { name, value } = event.target;
    setPricingForm(current => ({
      ...current,
      [name]: Number(value),
    }));
  };

  const handleDomainFormChange = (tenant, event) => {
    const { name, value, type } = event.target;
    setDomainForms(current => ({
      ...current,
      [tenant.id]: {
        ...(current[tenant.id] || buildDefaultDomainForm(tenant)),
        [name]: type === 'number' ? Number(value) : value,
      },
    }));
  };

  const handleAwardFormChange = (tenantId, event) => {
    const { name, value } = event.target;
    setAwardForms(current => {
      const existing = current[tenantId] || buildDefaultAwardForm();
      const next = {
        ...existing,
        [name]: value,
      };

      if (name === 'awardKey') {
        next.awardTitle = value === 'custom-award' ? existing.awardTitle || 'School Recognition Award' : defaultAwardTitle(value);
      }

      return {
        ...current,
        [tenantId]: next,
      };
    });
  };

  const loadTermBills = async () => {
    try {
      const result = await getAmiTermBills();
      setTermBills(result.bills || []);
    } catch { /* panel just stays empty */ }
  };

  useEffect(() => { loadTermBills(); }, []);

  const handleGenerateTermBills = async event => {
    event.preventDefault();
    if (!await askConfirm('Raise this term\'s bill for every active school? Schools already billed for the period are skipped.')) return;
    await runAction('generate-bills', async () => {
      const result = await generateTermBills({
        session: billPeriod.session.trim(),
        term: billPeriod.term.trim(),
        termStartDate: billPeriod.termStartDate.trim(),
        tenantId: billPeriod.tenantId.trim(),
      });
      setNotice(result.created.length
        ? `Raised ${result.created.length} bill(s): ${result.created.map(b => `${b.schoolName} ${currencyFormatter.format(b.amount)} (grace to ${new Date(b.graceUntil).toLocaleDateString()})`).join('; ')}. Skipped ${result.skipped.length}.`
        : `No bills raised. Skipped ${result.skipped.length}: ${result.skipped.map(s => `${s.schoolName} — ${s.reason}`).join('; ')}`);
      await loadTermBills();
    });
  };

  const pickInvoiceSchool = tenantId => {
    const tenant = (governanceData?.tenants || []).find(item => item.id === tenantId);
    setInvoiceForm(current => ({ ...current, tenantId, contactEmail: tenant?.contactEmail || tenant?.metadata?.contactEmail || '' }));
  };

  const handleSaveContactEmail = async () => {
    if (!invoiceForm.tenantId) return;
    await runAction('contact-email', async () => {
      const result = await setSchoolContactEmailAsAmi(invoiceForm.tenantId, invoiceForm.contactEmail.trim());
      setNotice(`Ndovera will now write to ${result.sendsTo} for this school. Its sign-up email is unchanged for signing in.`);
    });
  };

  const handlePrepareInvoice = async event => {
    event.preventDefault();
    if (!invoiceForm.tenantId) { setError('Choose a school.'); return; }
    await runAction('prepare-invoice', async () => {
      const result = await prepareSchoolInvoice(invoiceForm.tenantId, { onboardingFee: Number(invoiceForm.onboardingFee || 0), includeTermCharge: invoiceForm.includeTermCharge });
      setNotice(`Draft invoice ${result.bill.invoiceNo} prepared: ${currencyFormatter.format(result.bill.amount)}. Nothing has been sent. Preview it, then press Send (it will go to ${result.sendTo || 'the school'}).`);
      await loadTermBills();
    });
  };

  const handlePreviewInvoice = async bill => {
    await runAction(`preview-${bill.id}`, async () => {
      const result = await previewSchoolInvoice(bill.id);
      setInvoicePreview({ bill, html: result.html, sendTo: result.sendTo, payUrl: result.payUrl });
    });
  };

  const handleSendInvoice = async bill => {
    const first = !bill.sentAt;
    if (!await askConfirm(first
      ? `Send invoice ${bill.invoiceNo || ''} for ${currencyFormatter.format(bill.amount)} now? The school gets 30 days from today to pay; after that its Owner, HoS and ICT accounts are locked until paid.`
      : 'Send this invoice again as a reminder? The due date does not change.')) return;
    await runAction(`send-${bill.id}`, async () => {
      const result = await sendSchoolInvoice(bill.id);
      setNotice(`Invoice emailed to ${result.sentTo}. Due ${new Date(result.dueAt).toLocaleDateString()}. Pay link: ${result.payUrl}`);
      setInvoicePreview(null);
      await loadTermBills();
    });
  };

  const handleCopyPayLink = async bill => {
    const url = `${window.location.origin}/invoice/${bill.payToken}`;
    try { await navigator.clipboard.writeText(url); setNotice(`Pay link copied: ${url}`); } catch { setNotice(`Pay link: ${url}`); }
  };

  const handleMarkBillPaid = async bill => {
    if (!await askConfirm(`Record ${currencyFormatter.format(bill.amount)} as paid for ${bill.session} ${bill.term}?`)) return;
    await runAction(`bill-${bill.id}`, async () => {
      await markTermBillPaid(bill.id);
      setNotice('Term bill recorded as paid.');
      await loadTermBills();
    });
  };

  const updateRateForm = (tenantId, field, value) => {
    setRateForms(current => ({ ...current, [tenantId]: { ...(current[tenantId] || {}), [field]: value } }));
  };

  const saveTenantRate = async tenant => {
    const form = rateForms[tenant.id] || {};
    const studentFeeNaira = Number(form.studentFeeNaira);
    const setupFeeNaira = Number(form.setupFeeNaira);
    if (!studentFeeNaira && !setupFeeNaira) {
      setError('Enter a per-user fee or an onboarding fee for this school.');
      return;
    }

    await runAction(`rate-${tenant.id}`, async () => {
      const result = await setTenantRate(tenant.id, {
        ...(studentFeeNaira ? { studentFeeNaira } : {}),
        ...(setupFeeNaira ? { setupFeeNaira } : {}),
      });
      setRateForms(current => ({ ...current, [tenant.id]: {} }));
      setNotice(result.applied
        ? `${tenant.schoolName} now pays the new rate.`
        : `${tenant.schoolName} keeps its current rate until its next term (or ${new Date(result.effectiveFrom).toLocaleDateString()}).`);
    });
  };

  const handleRateRollout = async event => {
    event.preventDefault();
    const studentFeeNaira = Number(rolloutFeeNaira);
    if (!studentFeeNaira) { setError('Enter the new per-user fee to roll out.'); return; }
    if (!await askConfirm(`Roll out ${currencyFormatter.format(studentFeeNaira)} per active user to every school on a lower rate? Each school keeps its current rate until its next term.`)) return;

    await runAction('rate-rollout', async () => {
      const result = await rolloutTenantRate({ studentFeeNaira });
      setNotice(`Queued for ${result.queued.length} school(s); ${result.skipped.length} already at or above this rate. Each lands on that school's next term.`);
    });
  };

  const handleSavePricing = async event => {
    event.preventDefault();
    // One feature per line, so features can be added or removed without a deployment.
    const toFeatures = value => String(value || '').split('\n').map(line => line.trim()).filter(Boolean);

    await runAction('save-pricing', async () => {
      await updateTenantPricing({
        customPlanSetupFeeNaira: Number(pricingForm.customPlanSetupFeeNaira) || undefined,
        partnerMinSetupFeeNaira: Number(pricingForm.partnerMinSetupFeeNaira) || undefined,
        partnerMinStudentFeeNaira: Number(pricingForm.partnerMinStudentFeeNaira) || undefined,
        calculatorDefaultUsers: Number(pricingForm.calculatorDefaultUsers) || undefined,
        plans: {
          growth: {
            setupFeeNaira: Number(pricingForm.growthSetupFeeNaira) || undefined,
            studentFeeNaira: Number(pricingForm.growthStudentFeeNaira) || undefined,
            features: toFeatures(pricingForm.growthFeatures),
          },
          custom: {
            setupFeeNaira: Number(pricingForm.customPlanSetupFeeNaira) || undefined,
            studentFeeNaira: Number(pricingForm.growthStudentFeeNaira) || undefined,
            features: toFeatures(pricingForm.customFeatures),
          },
        },
      });
      setNotice('Pricing updated. The pricing page and registration now use these values.');
    });
  };

  const tenants = governanceData?.tenants || [];
  const discountCodes = governanceData?.discountCodes || [];
  const tenantAwards = governanceData?.tenantAwards || [];
  const awardCandidatesByTenantId = { ...(governanceData?.awardCandidatesByTenantId || {}), ...lazyAwardCandidates };
  const summary = governanceData?.summary;

  // ── One school's controls (opened from the Schools table) ────────────────────
  const renderTenantManager = tenant => {
              const awardCandidates = awardCandidatesByTenantId[tenant.id] || [];
              const awardForm = awardForms[tenant.id] || buildDefaultAwardForm();
              const domainForm = domainForms[tenant.id] || buildDefaultDomainForm(tenant);
              const defaultDomain = `${tenant.requestedSubdomain}.ndovera.com`;
              const usingCustomDomain = Boolean(tenant.websiteDomain && tenant.websiteDomain !== defaultDomain);
              const recentAwards = tenantAwards.filter(award => award.tenantId === tenant.id).slice(0, 4);

              return (
                <div key={tenant.id} className="rounded-3xl border border-white/10 bg-slate-900/20 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{tenant.schoolName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{tenant.ownerName} • {tenant.ownerEmail}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tenant.websiteDomain} • {tenant.studentCount} students • {tenant.planKey}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`micro-label ${statusClass(tenant.status)}`}>{tenant.status}</span>
                      <span className={`micro-label ${statusClass(tenant.paymentStatus)}`}>Onboarding: {tenant.paymentStatus}</span>
                      {tenant.currentTermFee && tenant.currentTermFee.status !== 'unknown' ? (
                        <span className={`micro-label ${tenant.currentTermFee.status === 'paid' ? 'accent-cyan' : 'accent-rose'}`}>
                          {tenant.currentTermFee.term} {tenant.currentTermFee.session}: {tenant.currentTermFee.status === 'paid' ? 'paid' : tenant.currentTermFee.status === 'not_invoiced' ? 'not paid (no invoice sent)' : tenant.currentTermFee.status === 'overdue' ? 'overdue' : 'not paid'}
                        </span>
                      ) : null}
                      <span className={`micro-label ${statusClass(tenant.approvalStatus)}`}>Approval: {tenant.approvalStatus}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4">
                      <p className="micro-label neon-subtle">Setup Fee</p>
                      <p className="mt-2 text-slate-800 dark:text-slate-100 font-semibold">{currencyFormatter.format(tenant.setupFee)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4">
                      <p className="micro-label neon-subtle">Student Fee / Term</p>
                      <p className="mt-2 text-slate-800 dark:text-slate-100 font-semibold">{currencyFormatter.format(tenant.studentFeePerTerm)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4">
                      <p className="micro-label neon-subtle">Discount Code</p>
                      <p className="mt-2 text-slate-800 dark:text-slate-100 font-semibold">{tenant.discountCode || 'None'}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 p-4 space-y-3">
                    <div>
                      <p className="micro-label neon-subtle">This School&apos;s Rate</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        This school keeps its own agreed rate. A reduction applies immediately; an increase waits for its next term.
                      </p>
                      {tenant.pendingRate ? (
                        <p className="mt-2 text-xs font-semibold text-amber-500">
                          Pending: {currencyFormatter.format(tenant.pendingRate.studentFeePerTerm)} / user, from {new Date(tenant.pendingRate.effectiveFrom).toLocaleDateString()} or its next term, whichever is first.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_200px] gap-3">
                      <input
                        type="number" min="0" placeholder={`Per user / term (now ${currencyFormatter.format(tenant.studentFeePerTerm || 0)})`}
                        value={(rateForms[tenant.id] || {}).studentFeeNaira || ''}
                        onChange={event => updateRateForm(tenant.id, 'studentFeeNaira', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <input
                        type="number" min="0" placeholder="Onboarding fee (optional)"
                        value={(rateForms[tenant.id] || {}).setupFeeNaira || ''}
                        onChange={event => updateRateForm(tenant.id, 'setupFeeNaira', event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button type="button" onClick={() => saveTenantRate(tenant)} disabled={busyAction === `rate-${tenant.id}`}
                        className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                        {busyAction === `rate-${tenant.id}` ? 'Saving...' : 'Set school rate'}
                      </button>
                    </div>
                  </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="micro-label neon-subtle">Tenant Website Domain</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set a custom tenant domain here. The default subdomain stays available as a fallback alias.</p>
            </div>
            <span className={`micro-label ${usingCustomDomain ? 'accent-cyan' : 'accent-indigo'}`}>{usingCustomDomain ? 'Custom Domain Live' : 'Default Subdomain Live'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <input
              name="websiteDomain"
              value={domainForm.websiteDomain}
              onChange={event => handleDomainFormChange(tenant, event)}
              placeholder={defaultDomain}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <input
              name="customDomainFeeNaira"
              type="number"
              min="0"
              value={domainForm.customDomainFeeNaira}
              onChange={event => handleDomainFormChange(tenant, event)}
              placeholder="Custom domain fee"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <textarea
            name="customDomainNotes"
            value={domainForm.customDomainNotes}
            onChange={event => handleDomainFormChange(tenant, event)}
            placeholder="DNS notes, registrar details, or the fee rationale for this tenant"
            className="w-full min-h-[84px] rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-900/20 p-3">
              <p className="micro-label neon-subtle">Current Public Host</p>
              <p className="mt-2 text-slate-900 dark:text-amber-50 font-semibold break-all">{tenant.websiteDomain || defaultDomain}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/20 p-3">
              <p className="micro-label neon-subtle">Fallback Alias</p>
              <p className="mt-2 text-slate-900 dark:text-amber-50 font-semibold break-all">{defaultDomain}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Custom domains still need DNS pointing and Cloudflare custom-domain routing outside this form. Leave the domain blank to restore the default subdomain.</p>
            <button
              type="button"
              onClick={() => runAction(`domain-${tenant.id}`, async () => {
                await updateTenantDomain(tenant.id, domainForm);
                setNotice(`${tenant.schoolName} domain settings updated.`);
              })}
              disabled={busyAction === `domain-${tenant.id}`}
              className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              {busyAction === `domain-${tenant.id}` ? 'Saving Domain...' : 'Save Domain Setup'}
            </button>
          </div>
          </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => runAction(`pay-${tenant.id}`, async () => {
                        const result = await initiateTenantPayment({ tenantId: tenant.id });
                        window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer');
                        setNotice(`Flutterwave checkout opened for ${tenant.schoolName}.`);
                      })}
                      disabled={busyAction === `pay-${tenant.id}`}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {busyAction === `pay-${tenant.id}` ? 'Opening...' : 'Open Flutterwave Checkout'}
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(`mark-paid-${tenant.id}`, async () => {
                        await markTenantAsPaid(tenant.id);
                        setNotice(`${tenant.schoolName} marked as paid.`);
                      })}
                      disabled={busyAction === `mark-paid-${tenant.id}` || tenant.paymentStatus === 'paid'}
                      className="rounded-2xl border border-amber-400/40 px-4 py-3 font-semibold text-amber-700 dark:text-amber-200 disabled:opacity-40"
                    >
                      {busyAction === `mark-paid-${tenant.id}` ? 'Marking...' : 'Mark Onboarding Paid'}
                    </button>
                    {tenant.currentTermFee && !['paid', 'unknown'].includes(tenant.currentTermFee.status) ? (
                      <button
                        type="button"
                        onClick={() => runAction(`term-paid-${tenant.id}`, async () => {
                          const period = `${tenant.currentTermFee.term} ${tenant.currentTermFee.session}`;
                          const reference = await askText(`How did ${tenant.schoolName} pay for ${period}? (e.g. bank transfer reference)`, '');
                          if (reference === null) return;
                          await markCurrentTermPaid(tenant.id, { reference: reference || 'ami-recorded' });
                          setNotice(`${tenant.schoolName}: ${period} marked as paid.`);
                        })}
                        disabled={busyAction === `term-paid-${tenant.id}`}
                        className="rounded-2xl border border-cyan-400/40 px-4 py-3 font-semibold text-cyan-700 dark:text-cyan-200 disabled:opacity-40"
                      >
                        {busyAction === `term-paid-${tenant.id}` ? 'Marking...' : `Mark ${tenant.currentTermFee.term} Paid`}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => runAction(`approve-${tenant.id}`, async () => {
                        await approveTenant(tenant.id, 'Approved from Ami tenant governance.');
                        setNotice(`${tenant.schoolName} approved.`);
                      })}
                      disabled={busyAction === `approve-${tenant.id}` || tenant.approvalStatus === 'approved'}
                      className="rounded-2xl border border-emerald-400/40 px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-200 disabled:opacity-40"
                    >
                      Approve School
                    </button>
                    {tenant.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={() => runAction(`restore-${tenant.id}`, async () => {
                          await restoreTenant(tenant.id);
                          setNotice(`${tenant.schoolName} restored.`);
                        })}
                        disabled={busyAction === `restore-${tenant.id}`}
                        className="rounded-2xl border border-indigo-400/40 px-4 py-3 font-semibold text-indigo-700 dark:text-indigo-200 disabled:opacity-40"
                      >
                        Restore Tenant
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => runAction(`suspend-${tenant.id}`, async () => {
                          await suspendTenant(tenant.id);
                          setNotice(`${tenant.schoolName} suspended.`);
                        })}
                        disabled={busyAction === `suspend-${tenant.id}`}
                        className="rounded-2xl border border-rose-400/40 px-4 py-3 font-semibold text-rose-700 dark:text-rose-200 disabled:opacity-40"
                      >
                        Suspend Tenant
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResetOwnerPassword(tenant)}
                      disabled={busyAction === `reset-owner-${tenant.id}`}
                      className="rounded-2xl border border-sky-400/40 px-4 py-3 font-semibold text-sky-700 dark:text-sky-200 disabled:opacity-40"
                    >
                      {busyAction === `reset-owner-${tenant.id}` ? 'Generating Link...' : 'Reset Owner Password'}
                    </button>
                  </div>

                  {ownerReset && ownerReset.tenantId === tenant.id ? (
                    <div className="rounded-2xl border border-sky-400/40 bg-sky-50/70 p-4 text-sm dark:bg-sky-950/30">
                      <p className="font-semibold text-sky-800 dark:text-sky-200">
                        Password reset link for {ownerReset.name || ownerReset.email}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-600 dark:text-slate-300">{ownerReset.resetUrl}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {ownerReset.emailed ? 'Emailed to the owner. ' : 'Email not sent — share manually. '}
                        Link is valid for 30 minutes; the owner sets a new password and signs in.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={ownerReset.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-emerald-400/50 px-4 py-2 font-semibold text-emerald-700 dark:text-emerald-200"
                        >
                          Share via WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(ownerReset.resetUrl); setNotice('Reset link copied to clipboard.'); }}
                          className="rounded-2xl border border-slate-400/40 px-4 py-2 font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setOwnerReset(null)}
                          className="rounded-2xl border border-slate-400/30 px-4 py-2 font-semibold text-slate-500"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="micro-label neon-subtle">Attach Monthly Award</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Select a school user and attach an AMI-managed highlight for the month.</p>
                        </div>
                        <span className="micro-label accent-indigo">{awardForm.periodMonth || currentAwardMonth}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select name="awardKey" value={awardForm.awardKey} onChange={event => handleAwardFormChange(tenant.id, event)} className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100">
                          {AWARD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <input name="periodMonth" type="month" value={awardForm.periodMonth} onChange={event => handleAwardFormChange(tenant.id, event)} className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100" />
                      </div>
                      <select name="userId" value={awardForm.userId} onFocus={() => loadAwardCandidates(tenant.id)} onChange={event => handleAwardFormChange(tenant.id, event)} className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100">
                        <option value="">{awardCandidates.length ? 'Select award recipient' : 'Loading recipients…'}</option>
                        {awardCandidates.map(candidate => <option key={candidate.userId} value={candidate.userId}>{candidate.name} • {candidate.role || 'user'}</option>)}
                      </select>
                      <input name="awardTitle" value={awardForm.awardTitle} onChange={event => handleAwardFormChange(tenant.id, event)} placeholder="Award title" className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                      <textarea name="description" value={awardForm.description} onChange={event => handleAwardFormChange(tenant.id, event)} placeholder="Why this award matters for the school this month" className="w-full min-h-[84px] rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                      <button
                        type="button"
                        onClick={() => runAction(`award-${tenant.id}`, async () => {
                          await upsertTenantAward(tenant.id, awardForm);
                          setNotice(`${awardForm.awardTitle || 'Award'} attached to ${tenant.schoolName}.`);
                          setAwardForms(current => ({
                            ...current,
                            [tenant.id]: {
                              ...buildDefaultAwardForm(),
                              awardKey: awardForm.awardKey,
                              awardTitle: awardForm.awardKey === 'custom-award' ? 'School Recognition Award' : defaultAwardTitle(awardForm.awardKey),
                              periodMonth: awardForm.periodMonth || currentAwardMonth,
                            },
                          }));
                        })}
                        disabled={busyAction === `award-${tenant.id}` || !awardForm.userId}
                        className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {busyAction === `award-${tenant.id}` ? 'Attaching...' : 'Attach Award'}
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="micro-label neon-subtle">Recent School Awards</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Latest AMI-attached recognitions for this tenant.</p>
                        </div>
                        <span className="micro-label accent-emerald">{recentAwards.length}</span>
                      </div>
                      <div className="space-y-3">
                        {recentAwards.length ? recentAwards.map(award => (
                          <div key={award.id} className="rounded-2xl border border-white/10 bg-slate-900/20 p-3 flex items-start gap-3">
                            <img src={buildAwardAvatar(award.recipient)} alt={award.recipient?.name || award.awardTitle} className="h-12 w-12 rounded-2xl object-cover border border-white/10 bg-white/70" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900 dark:text-amber-50">{award.awardTitle}</p>
                                <span className="micro-label accent-indigo">{award.periodMonth}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-700 dark:text-amber-100">{award.recipient?.name} • {award.recipient?.role || 'user'}</p>
                              {award.description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{award.description}</p> : null}
                            </div>
                          </div>
                        )) : <p className="text-sm text-slate-500 dark:text-slate-400">No awards attached for this school yet.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
  };

  const billingPanels = (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Plan Pricing</h2>
            <form onSubmit={handleSavePricing} className="space-y-3">
              <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-blue-50">Live commercial values</p>
                <p className="mt-2">These are the prices the public pricing page, the registration form, and every quote use. Saving takes effect immediately — no deployment needed.</p>
                {pricingConfig?.updatedAt && (
                  <p className="mt-2 text-xs text-orange-600 dark:text-orange-50">Updated: {new Date(pricingConfig.updatedAt).toLocaleString()}</p>
                )}
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Growth Plan (Standard)</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Onboarding fee (NGN)</span>
                  <input name="growthSetupFeeNaira" type="number" min="1" value={pricingForm.growthSetupFeeNaira} onChange={handlePricingChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Per active user / term (NGN)</span>
                  <input name="growthStudentFeeNaira" type="number" min="1" value={pricingForm.growthStudentFeeNaira} onChange={handlePricingChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Growth features (one per line)</span>
                <textarea name="growthFeatures" value={pricingForm.growthFeatures} onChange={handlePricingChange}
                  className="w-full min-h-[110px] rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              </label>

              <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Custom Plan (Ami Priced)</p>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Custom onboarding fee (NGN)</span>
                <input name="customPlanSetupFeeNaira" type="number" min="1" value={pricingForm.customPlanSetupFeeNaira} onChange={handlePricingChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Custom features (one per line)</span>
                <textarea name="customFeatures" value={pricingForm.customFeatures} onChange={handlePricingChange}
                  className="w-full min-h-[110px] rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              </label>

              <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Growth Partner Discount Floors</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">The lowest a partner may price their own registration code.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Min onboarding fee (NGN)</span>
                  <input name="partnerMinSetupFeeNaira" type="number" min="1" value={pricingForm.partnerMinSetupFeeNaira} onChange={handlePricingChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Min per-user fee (NGN)</span>
                  <input name="partnerMinStudentFeeNaira" type="number" min="1" value={pricingForm.partnerMinStudentFeeNaira} onChange={handlePricingChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Calculator starting user count</span>
                <input name="calculatorDefaultUsers" type="number" min="1" value={pricingForm.calculatorDefaultUsers} onChange={handlePricingChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              </label>

              <button type="submit" disabled={busyAction === 'save-pricing'} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'save-pricing' ? 'Saving...' : 'Update Pricing'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saving here changes what <strong>new</strong> schools pay. Existing schools keep their agreed rate — use the rollout below to move them.
              </p>
            </form>
          </section>

          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Roll Out A New Rate</h2>
            <form onSubmit={handleRateRollout} className="space-y-3">
              <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4 text-sm text-slate-600 dark:text-slate-300">
                <p>Queues a new per-user fee for every school currently on a lower rate. Each school keeps what it pays now until it starts its next term — or at most five months (a term runs up to four months, plus at least one month of holiday), whichever comes first.</p>
              </div>
              <input
                type="number" min="1" value={rolloutFeeNaira} onChange={event => setRolloutFeeNaira(event.target.value)}
                placeholder="New per active user fee (NGN)"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button type="submit" disabled={busyAction === 'rate-rollout'} className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'rate-rollout' ? 'Queueing...' : 'Queue rate for existing schools'}
              </button>
            </form>
          </section>

          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Term Billing</h2>
            <form onSubmit={handleGenerateTermBills} className="space-y-3">
              <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4 text-sm text-slate-600 dark:text-slate-300">
                <p>Bills each active school for its active users at its own agreed rate. Grace runs to mid-term (two months from the term start). After that, owner, HoS, ICT manager, and ICT accounts lose dashboard access until the bill is settled — the school website stays live.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={billPeriod.session} onChange={e => setBillPeriod(c => ({ ...c, session: e.target.value }))} placeholder="Session (blank = each school's own)"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                <input value={billPeriod.term} onChange={e => setBillPeriod(c => ({ ...c, term: e.target.value }))} placeholder="Term (blank = each school's own)"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Term start date — grace runs two months from here (blank = the school&apos;s recorded start)</span>
                <input type="date" value={billPeriod.termStartDate} onChange={e => setBillPeriod(c => ({ ...c, termStartDate: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">Bill one school only (leave as All for every active school)</span>
                <select value={billPeriod.tenantId} onChange={e => setBillPeriod(c => ({ ...c, tenantId: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100">
                  <option value="">All active schools</option>
                  {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.schoolName}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busyAction === 'generate-bills'} className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'generate-bills' ? 'Raising...' : 'Raise this term\'s bills'}
              </button>
            </form>

            <form onSubmit={handlePrepareInvoice} className="mt-6 space-y-3 rounded-3xl border-2 border-[#c9a96e]/60 bg-[#fff8ef] p-4 text-[#191970] dark:bg-slate-900/40 dark:text-slate-100">
              <h3 className="text-lg font-black text-[#800000] dark:text-amber-200">Invoice one school</h3>
              <p className="text-xs">Prepares a draft on Ndovera&apos;s letterhead: an onboarding fee (optional) plus this term&apos;s active students × the school&apos;s rate. <b>Nothing is sent until you press Send.</b> The school then has 30 days to pay by the link (Flutterwave); the receipt is emailed automatically once Flutterwave confirms.</p>
              <select value={invoiceForm.tenantId} onChange={e => pickInvoiceSchool(e.target.value)} aria-label="School to invoice"
                className="w-full rounded-2xl border border-[#c9a96e]/60 bg-white px-4 py-3 text-[#191970] dark:bg-slate-900 dark:text-amber-100">
                <option value="">Choose a school…</option>
                {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.schoolName}</option>)}
              </select>
              {invoiceForm.tenantId ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold">Communication email (invoices, receipts and notices go here; the sign-up email stays for signing in)</span>
                    <div className="flex gap-2">
                      <input type="email" value={invoiceForm.contactEmail} onChange={e => setInvoiceForm(c => ({ ...c, contactEmail: e.target.value }))} placeholder="e.g. accounts@school.com"
                        className="min-w-0 flex-1 rounded-2xl border border-[#c9a96e]/60 bg-white px-4 py-2 text-[#191970] dark:bg-slate-900 dark:text-amber-100" />
                      <button type="button" onClick={handleSaveContactEmail} disabled={busyAction === 'contact-email'} className="rounded-2xl bg-[#191970] px-4 py-2 text-sm font-bold text-[#c9a96e] disabled:opacity-60">
                        {busyAction === 'contact-email' ? 'Saving…' : 'Save email'}
                      </button>
                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold">Onboarding fee owed (₦, 0 if none)</span>
                    <input type="number" min="0" value={invoiceForm.onboardingFee} onChange={e => setInvoiceForm(c => ({ ...c, onboardingFee: e.target.value }))} placeholder="e.g. 50000"
                      className="w-full rounded-2xl border border-[#c9a96e]/60 bg-white px-4 py-2 text-[#191970] dark:bg-slate-900 dark:text-amber-100" />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={invoiceForm.includeTermCharge} onChange={e => setInvoiceForm(c => ({ ...c, includeTermCharge: e.target.checked }))} />
                    Include this term&apos;s per-student charge (active students × the school&apos;s rate)
                  </label>
                  <button type="submit" disabled={busyAction === 'prepare-invoice'} className="w-full rounded-2xl bg-[#800020] px-4 py-3 font-bold text-[#b5e3f4] disabled:opacity-60">
                    {busyAction === 'prepare-invoice' ? 'Preparing…' : 'Prepare draft invoice'}
                  </button>
                </>
              ) : null}
            </form>

            {invoicePreview ? (
              <div className="mt-4 rounded-3xl border-2 border-[#c9a96e] bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[#191970]">
                  <p className="flex-1">Preview: will go to <b>{invoicePreview.sendTo || 'no email on file'}</b></p>
                  {invoicePreview.bill.status !== 'paid' ? (
                    <button type="button" onClick={() => handleSendInvoice(invoicePreview.bill)} disabled={busyAction === `send-${invoicePreview.bill.id}`} className="rounded-xl bg-[#1a5c38] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                      {busyAction === `send-${invoicePreview.bill.id}` ? 'Sending…' : invoicePreview.bill.sentAt ? 'Send reminder' : 'Send invoice'}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setInvoicePreview(null)} className="rounded-xl bg-[#800020] px-3 py-2 text-xs font-bold text-[#b5e3f4]">Close</button>
                </div>
                <iframe title="Invoice preview" srcDoc={invoicePreview.html} className="h-[640px] w-full rounded-2xl border-0" />
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {termBills.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No term bills raised yet.</p> : null}
              {termBills.slice(0, 12).map(bill => {
                const overdue = bill.status !== 'paid' && bill.graceUntil && new Date(bill.graceUntil) <= new Date();
                return (
                  <div key={bill.id} className="rounded-2xl border border-white/10 bg-slate-900/20 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{tenants.find(tenant => tenant.id === bill.tenantId)?.schoolName || 'School'} • {bill.session} {bill.term} • {currencyFormatter.format(bill.amount)}</p>
                        {bill.invoiceNo ? <p className="text-xs text-slate-500 dark:text-slate-400">{bill.invoiceNo}{bill.onboardingCents ? ` • includes onboarding ${currencyFormatter.format(bill.onboardingCents / 100)}` : ''}{bill.sentAt ? ` • sent ${new Date(bill.sentAt).toLocaleDateString()} to ${bill.sentTo}` : ' • not sent'}{bill.receiptNo ? ` • receipt ${bill.receiptNo}` : ''}</p> : null}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {bill.billableUsers} users × {currencyFormatter.format(bill.ratePerUser)}
                          {bill.graceUntil ? ` • grace to ${new Date(bill.graceUntil).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`micro-label ${bill.status === 'paid' ? 'accent-cyan' : overdue ? 'accent-rose' : 'accent-indigo'}`}>
                          {bill.status === 'paid' ? 'paid' : bill.status === 'draft' ? 'draft' : overdue ? 'overdue' : 'unpaid'}
                        </span>
                        <button type="button" onClick={() => handlePreviewInvoice(bill)} disabled={busyAction === `preview-${bill.id}`}
                          className="rounded-xl bg-[#191970] px-3 py-2 text-xs font-bold text-[#c9a96e] disabled:opacity-60">Preview</button>
                        {bill.status !== 'paid' ? (
                          <button type="button" onClick={() => handleSendInvoice(bill)} disabled={busyAction === `send-${bill.id}`}
                            className="rounded-xl bg-[#1a5c38] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                            {busyAction === `send-${bill.id}` ? 'Sending…' : bill.sentAt ? 'Remind' : 'Send'}
                          </button>
                        ) : null}
                        {bill.payToken && bill.sentAt && bill.status !== 'paid' ? (
                          <button type="button" onClick={() => handleCopyPayLink(bill)} className="rounded-xl bg-[#c9a96e] px-3 py-2 text-xs font-bold text-[#191970]">Copy pay link</button>
                        ) : null}
                        {bill.status !== 'paid' ? (
                          <button type="button" onClick={() => handleMarkBillPaid(bill)} disabled={busyAction === `bill-${bill.id}`}
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-60">
                            {busyAction === `bill-${bill.id}` ? 'Saving...' : 'Mark paid'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Discount Codes</h2>
            <form onSubmit={handleSaveDiscount} className="space-y-3">
              <input name="code" value={discountForm.code} onChange={handleDiscountChange} required placeholder="CODE"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              <input name="name" value={discountForm.name} onChange={handleDiscountChange} placeholder="Display name"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              <textarea name="description" value={discountForm.description} onChange={handleDiscountChange} placeholder="Discount description"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 min-h-[80px] text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              <div className="grid grid-cols-2 gap-3">
                <input name="setupFeeNaira" type="number" value={discountForm.setupFeeNaira} onChange={handleDiscountChange} placeholder="Setup fee (NGN)"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                <input name="studentFeeNaira" type="number" value={discountForm.studentFeeNaira} onChange={handleDiscountChange} placeholder="Student fee / term"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              </div>
              <input name="planScope" value={discountForm.planScope} onChange={handleDiscountChange} placeholder="growth,custom"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              <input name="endsAt" type="datetime-local" value={discountForm.endsAt} onChange={handleDiscountChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100" />
              <label className="flex items-center gap-2 text-sm text-slate-900 dark:text-amber-100">
                <input name="active" type="checkbox" checked={discountForm.active} onChange={handleDiscountChange} />
                Active now
              </label>
              <button type="submit" disabled={busyAction === 'save-discount'} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'save-discount' ? 'Saving...' : 'Save Discount Code'}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {discountCodes.map(dc => (
                <div key={dc.code} className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4 text-sm text-slate-700 dark:text-amber-100">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900 dark:text-amber-50">{dc.code}</p>
                    <span className={`micro-label ${dc.active ? 'accent-emerald' : 'accent-slate'}`}>{dc.active ? 'active' : 'ended'}</span>
                  </div>
                  <p className="mt-2">{dc.description}</p>
                  <p className="mt-2">Setup: {dc.setupFee ? currencyFormatter.format(dc.setupFee) : 'unchanged'}</p>
                  <p className="mt-1">Student: {dc.studentFeePerTerm ? currencyFormatter.format(dc.studentFeePerTerm) : 'unchanged'}</p>
                  {dc.active && (
                    <button type="button" onClick={() => runAction(`end-${dc.code}`, async () => { await endDiscountCode(dc.code); setNotice(`${dc.code} ended.`); })}
                      disabled={busyAction === `end-${dc.code}`}
                      className="mt-3 rounded-2xl border border-rose-400/40 px-3 py-2 font-semibold text-rose-700 dark:text-rose-200 disabled:opacity-40">
                      End Code
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
    </div>
  );

  const shell = (title, subtitle, crumbs, children, actions = null) => (
    <AmiPage title={title} subtitle={subtitle} crumbs={crumbs} actions={actions}>
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {busyAction ? <p role="status" className="text-xs font-bold text-amber-700">Working…</p> : null}
      {children}
    </AmiPage>
  );

  // ── BILLING & PRICING ────────────────────────────────────────────────────────
  if (sectionKey === 'billing') {
    return shell('Billing & Pricing', 'Plan prices, rate changes, term bills, invoices and discount codes.', ['Schools', 'Billing & Pricing'], <div className="ami-legacy space-y-6">{billingPanels}</div>);
  }

  // ── SCHOOLS ──────────────────────────────────────────────────────────────────
  const studentTotal = tenants.reduce((sum, tenant) => sum + Number(tenant.studentCount || 0), 0);
  const searchText = schoolQuery.trim().toLowerCase();
  const visibleSchools = tenants.filter(tenant => {
    if (searchText && !`${tenant.schoolName} ${tenant.ownerName} ${tenant.ownerEmail} ${tenant.requestedSubdomain} ${tenant.id}`.toLowerCase().includes(searchText)) return false;
    if (schoolFilter === 'active') return tenant.status === 'active';
    if (schoolFilter === 'pending') return tenant.approvalStatus !== 'approved' || tenant.paymentStatus !== 'paid';
    if (schoolFilter === 'unpaid') return tenant.currentTermFee && !['paid', 'unknown'].includes(tenant.currentTermFee.status);
    if (schoolFilter === 'suspended') return tenant.status === 'suspended';
    return true;
  });
  const openTenant = tenants.find(tenant => tenant.id === openTenantId) || null;
  const copyId = async id => { try { await navigator.clipboard.writeText(id); setNotice(`School ID ${id} copied.`); } catch { setNotice(`School ID: ${id}`); } };

  return shell('Schools', 'Every school on Ndovera: status, students, this term\'s fee, and its controls.', ['Schools'], (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BuildingOffice2Icon} tone="navy" label="Schools" value={summary?.totalTenants ?? 0} hint={`${summary?.activeTenants ?? 0} active`} />
        <StatCard icon={UserGroupIcon} tone="green" label="Students" value={studentTotal.toLocaleString()} hint="across all schools" />
        <StatCard icon={ClockIcon} tone="gold" label="Awaiting approval or onboarding" value={(summary?.pendingApproval ?? 0) + (summary?.pendingPayments ?? 0)} hint={`${summary?.pendingApproval ?? 0} approval · ${summary?.pendingPayments ?? 0} onboarding`} />
        <StatCard icon={ExclamationTriangleIcon} tone="maroon" label="Unpaid this term" value={summary?.termFeesUnpaid ?? 0} hint="schools" />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <label className="relative min-w-[16rem] flex-1 sm:max-w-sm">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" aria-label="Search schools" placeholder="Search school, owner, ID…" value={schoolQuery} onChange={event => setSchoolQuery(event.target.value)} className={`${FIELD} pl-9`} />
          </label>
          {[['all', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['unpaid', 'Unpaid this term'], ['suspended', 'Suspended']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setSchoolFilter(key)} className={`rounded-full px-3 py-1 text-xs font-bold ${schoolFilter === key ? 'bg-[#191970] text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{label}</button>
          ))}
          <a href="/register-school" target="_blank" rel="noopener noreferrer" className={`${PRIMARY} ml-auto`}><PlusIcon className="h-4 w-4" aria-hidden="true" />Register a school</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50 dark:bg-white/5"><tr>
              <th className={TH}>School</th><th className={TH}>School ID</th><th className={TH}>Students</th><th className={TH}>Plan &amp; rate</th><th className={TH}>Status</th><th className={TH}>This term</th><th className={TH}><span className="sr-only">Manage</span></th>
            </tr></thead>
            <tbody>
              {visibleSchools.map(tenant => (
                <tr key={tenant.id} className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                  <td className={TD}>
                    <button type="button" onClick={() => setOpenTenantId(tenant.id)} className="flex items-center gap-3 text-left">
                      <SchoolMark name={tenant.schoolName} logoUrl={tenant.logoUrl} />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-[#191970] hover:underline dark:text-indigo-200">{tenant.schoolName}</span>
                        <span className="block truncate text-xs text-slate-500">{tenant.ownerName} · {tenant.ownerEmail}</span>
                      </span>
                    </button>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {tenant.requestedSubdomain || tenant.id}
                      <button type="button" onClick={() => copyId(tenant.id)} aria-label={`Copy ${tenant.schoolName} ID`} title="Copy school ID" className="text-slate-400 hover:text-[#191970]"><DocumentDuplicateIcon className="h-4 w-4" /></button>
                    </span>
                  </td>
                  <td className={`${TD} tabular-nums`}><span className="inline-flex items-center gap-1.5"><UserGroupIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />{Number(tenant.studentCount || 0).toLocaleString()}</span></td>
                  <td className={TD}><span className="capitalize">{tenant.planKey}</span><span className="block text-xs text-slate-500">{currencyFormatter.format(tenant.studentFeePerTerm || 0)} / student / term</span></td>
                  <td className={TD}>
                    <div className="flex flex-col items-start gap-1">
                      {tenant.status === 'active' ? <Pill tone="good">Active</Pill> : tenant.status === 'suspended' ? <Pill tone="bad">Suspended</Pill> : <Pill tone="warn">{String(tenant.status || 'pending').replace(/_/g, ' ')}</Pill>}
                      {tenant.paymentStatus !== 'paid' ? <Pill tone="warn">Onboarding unpaid</Pill> : null}
                      {tenant.approvalStatus !== 'approved' ? <Pill tone="warn">Needs approval</Pill> : null}
                    </div>
                  </td>
                  <td className={TD}><TermFeePill fee={tenant.currentTermFee} /><span className="mt-0.5 block text-xs text-slate-500">{[tenant.currentTermFee?.term, tenant.currentTermFee?.session].filter(Boolean).join(', ')}</span></td>
                  <td className={`${TD} text-right`}><button type="button" onClick={() => setOpenTenantId(tenant.id)} className={SECONDARY}>Manage</button></td>
                </tr>
              ))}
              {!visibleSchools.length ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">{tenants.length ? 'No schools match.' : 'No schools registered yet.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-white/10">{visibleSchools.length} of {tenants.length} schools</p>
      </Panel>

      <Panel title="Open a school's dashboard"><SchoolAccessPanel /></Panel>
      <AmiPlatformAnalytics />

      {openTenant ? (
        <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-label={`Manage ${openTenant.schoolName}`} onClick={() => setOpenTenantId('')}>
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-[#eef1f6] shadow-2xl dark:bg-slate-950" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-slate-900">
              <SchoolMark name={openTenant.schoolName} logoUrl={openTenant.logoUrl} />
              <div className="min-w-0 flex-1"><p className="truncate font-black text-[#0b1f3a] dark:text-white">{openTenant.schoolName}</p><p className="truncate text-xs text-slate-500">{openTenant.websiteDomain}</p></div>
              <button type="button" onClick={() => setOpenTenantId('')} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            {error ? <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
            {notice ? <p role="status" className="mx-5 mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
            <div className="ami-legacy p-5">{renderTenantManager(openTenant)}</div>
          </div>
        </div>
      ) : null}
    </>
  ));
}

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  approveTenant,
  endDiscountCode,
  getAmiTenants,
  initiateTenantPayment,
  markTenantAsPaid,
  restoreTenant,
  suspendTenant,
  upsertTenantAward,
  updateTenantDomain,
  updateTenantPricing,
  upsertDiscountCode,
  verifyTenantPayment,
} from '../services/tenantApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
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
  const [pricingForm, setPricingForm] = useState({ customPlanSetupFeeNaira: 50000 });
  const [awardForms, setAwardForms] = useState({});
  const [domainForms, setDomainForms] = useState({});
  const [busyAction, setBusyAction] = useState('');
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

  useEffect(() => {
    const nextValue = governanceData?.pricingConfig?.customPlanSetupFee;
    if (typeof nextValue === 'number') {
      setPricingForm({ customPlanSetupFeeNaira: nextValue });
    }
  }, [governanceData?.pricingConfig?.customPlanSetupFee]);

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

  const handleSavePricing = async event => {
    event.preventDefault();
    await runAction('save-pricing', async () => {
      await updateTenantPricing({
        customPlanSetupFeeNaira: pricingForm.customPlanSetupFeeNaira,
      });
      setNotice('Custom onboarding fee updated.');
    });
  };

  const tenants = governanceData?.tenants || [];
  const payments = governanceData?.payments || [];
  const discountCodes = governanceData?.discountCodes || [];
  const tenantAwards = governanceData?.tenantAwards || [];
  const awardCandidatesByTenantId = governanceData?.awardCandidatesByTenantId || {};
  const summary = governanceData?.summary;

  const headerSection = (
    <section className="glass-surface rounded-3xl p-6 border border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="micro-label neon-subtle">Ami Tenant Governance</p>
          <h1 className="text-3xl command-title neon-title mt-2">
            {sectionKey === 'overview' ? 'Platform Overview' : 'Manage Tenants'}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            {sectionKey === 'overview'
              ? 'Live platform stats — active schools, pending approvals, payments and discount codes.'
              : 'Review school registrations, create discount codes, launch Flutterwave checkout links, and approve or suspend tenants.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {busyAction && <span className="micro-label accent-amber">Working...</span>}
        </div>
      </div>
      {(error || notice) && (
        <div className="mt-5 space-y-3">
          {error && <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-200">{error}</div>}
          {notice && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-100">{notice}</div>}
        </div>
      )}
    </section>
  );

  const statCards = (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Tenants</p><p className="mt-2 text-2xl command-title text-rose-500 dark:text-red-400">{summary?.totalTenants ?? 0}</p></div>
      <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Active</p><p className="mt-2 text-2xl command-title text-emerald-600 dark:text-green-300">{summary?.activeTenants ?? 0}</p></div>
      <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Pending Approval</p><p className="mt-2 text-2xl command-title text-blue-600 dark:text-blue-400">{summary?.pendingApproval ?? 0}</p></div>
      <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Pending Payments</p><p className="mt-2 text-2xl command-title text-rose-500 dark:text-red-400">{summary?.pendingPayments ?? 0}</p></div>
      <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Active Codes</p><p className="mt-2 text-2xl command-title text-emerald-600 dark:text-green-300">{summary?.activeDiscountCodes ?? 0}</p></div>
    </section>
  );

  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  if (sectionKey === 'overview') {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {headerSection}
        {statCards}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Recent Tenants snapshot */}
          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Recent Registrations</h2>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {tenants.length ? tenants.slice(0, 8).map(tenant => (
                <div key={tenant.id} className="rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{tenant.schoolName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{tenant.ownerEmail} • {tenant.planKey}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`micro-label ${statusClass(tenant.status)}`}>{tenant.status}</span>
                    <span className={`micro-label ${statusClass(tenant.approvalStatus)}`}>{tenant.approvalStatus}</span>
                  </div>
                </div>
              )) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">No tenant registrations yet.</p>
              )}
            </div>
          </section>

          {/* Payment Feed */}
          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Payment Feed</h2>
            <div className="space-y-3 text-sm max-h-[360px] overflow-y-auto pr-1">
              {payments.length ? payments.map(payment => (
                <div key={payment.txRef} className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-800 dark:text-slate-100 font-semibold truncate">{payment.txRef}</p>
                    <span className={`micro-label ${statusClass(payment.status)}`}>{payment.status}</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{currencyFormatter.format(payment.amount)} • {payment.planKey}</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">{payment.studentCount} students</p>
                </div>
              )) : <p className="text-slate-500 dark:text-slate-400">No onboarding payments yet.</p>}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ── TENANTS ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {headerSection}
      {statCards}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* Tenant Queue */}
        <section className="glass-surface rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl command-title neon-title">Tenant Queue</h2>
            <p className="text-sm text-purple-600 dark:text-purple-300">Approve after payment, or approve early and wait for payment to activate.</p>
          </div>
          <div className="space-y-4">
            {tenants.length ? tenants.map(tenant => {
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
                      <span className={`micro-label ${statusClass(tenant.paymentStatus)}`}>Payment: {tenant.paymentStatus}</span>
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
                      {busyAction === `mark-paid-${tenant.id}` ? 'Marking...' : 'Mark as Paid'}
                    </button>
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
                  </div>

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
                      <select name="userId" value={awardForm.userId} onChange={event => handleAwardFormChange(tenant.id, event)} className="w-full rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-slate-900 dark:text-amber-100">
                        <option value="">Select award recipient</option>
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
            }) : <p className="text-slate-500 dark:text-slate-400">No tenant registrations yet.</p>}
          </div>
        </section>

        {/* Right column: Pricing + Discount Codes */}
        <div className="space-y-6">
          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Plan Pricing</h2>
            <form onSubmit={handleSavePricing} className="space-y-3">
              <div className="rounded-2xl bg-slate-900/20 dark:bg-slate-900/30 p-4 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-blue-50">Custom Plan Onboarding Fee</p>
                <p className="mt-2">This onboarding fee is Ami-managed and can be changed at any time before schools pay.</p>
                {governanceData?.pricingConfig?.updatedAt && (
                  <p className="mt-2 text-xs text-orange-600 dark:text-orange-50">Updated: {new Date(governanceData.pricingConfig.updatedAt).toLocaleString()}</p>
                )}
              </div>
              <input
                name="customPlanSetupFeeNaira"
                type="number"
                min="1"
                value={pricingForm.customPlanSetupFeeNaira}
                onChange={handlePricingChange}
                placeholder="Custom onboarding fee (NGN)"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/20 dark:bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button type="submit" disabled={busyAction === 'save-pricing'} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'save-pricing' ? 'Saving...' : 'Update Custom Pricing'}
              </button>
            </form>
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
      </div>
    </div>
  );
}
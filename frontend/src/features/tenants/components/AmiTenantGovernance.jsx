import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  approveTenant,
  endDiscountCode,
  getAmiTenants,
  initiateTenantPayment,
  restoreTenant,
  suspendTenant,
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
      setError(loadError.message || 'Unable to load tenant governance data.');
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
  const summary = governanceData?.summary;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="micro-label neon-subtle">Ami Tenant Governance</p>
            <h1 className="text-3xl command-title neon-title mt-2">Manage Tenant Controls And States</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Review school registrations, create multiple live discount codes, launch Flutterwave checkout links, and approve or suspend tenants.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="micro-label accent-indigo">Section: {sectionKey}</span>
            {busyAction && <span className="micro-label accent-amber">Working...</span>}
          </div>
        </div>

        {(error || notice) && (
          <div className="mt-5 space-y-3">
            {error && <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
            {notice && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Tenants</p><p className="mt-2 text-2xl command-title text-red-400">{summary?.totalTenants ?? 0}</p></div>
        <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Active</p><p className="mt-2 text-2xl command-title text-green-300">{summary?.activeTenants ?? 0}</p></div>
        <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Pending Approval</p><p className="mt-2 text-2xl command-title text-blue-500">{summary?.pendingApproval ?? 0}</p></div>
        <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Pending Payments</p><p className="mt-2 text-2xl command-title text-red-400">{summary?.pendingPayments ?? 0}</p></div>
        <div className="glass-surface rounded-3xl p-5"><p className="micro-label neon-subtle">Active Codes</p><p className="mt-2 text-2xl command-title text-green-300">{summary?.activeDiscountCodes ?? 0}</p></div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="glass-surface rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl command-title neon-title">Tenant Queue</h2>
            <p className="text-sm text-purple-600 dark:text-purple-300">Approve after payment, or approve early and wait for payment to activate.
</p>
          </div>
          <div className="space-y-4">
            {tenants.length ? tenants.map(tenant => (
              <div key={tenant.id} className="rounded-3xl border border-white/10 bg-slate-900/20 p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{tenant.schoolName}</p>
                    <p className="text-sm text-slate-400">{tenant.ownerName} • {tenant.ownerEmail}</p>
                    <p className="text-sm text-slate-400 mt-1">{tenant.websiteDomain} • {tenant.studentCount} students • {tenant.planKey}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`micro-label ${statusClass(tenant.status)}`}>{tenant.status}</span>
                    <span className={`micro-label ${statusClass(tenant.paymentStatus)}`}>Payment: {tenant.paymentStatus}</span>
                    <span className={`micro-label ${statusClass(tenant.approvalStatus)}`}>Approval: {tenant.approvalStatus}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-900/30 p-4">
                    <p className="micro-label neon-subtle">Setup Fee</p>
                    <p className="mt-2 text-slate-100 font-semibold">{currencyFormatter.format(tenant.setupFee)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/30 p-4">
                    <p className="micro-label neon-subtle">Student Fee / Subsequent Term</p>
                    <p className="mt-2 text-slate-100 font-semibold">{currencyFormatter.format(tenant.studentFeePerTerm)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/30 p-4">
                    <p className="micro-label neon-subtle">Discount</p>
                    <p className="mt-2 text-slate-100 font-semibold">{tenant.discountCode || 'None'}</p>
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
                    onClick={() => runAction(`approve-${tenant.id}`, async () => {
                      await approveTenant(tenant.id, 'Approved from Ami tenant governance.');
                      setNotice(`${tenant.schoolName} approved.`);
                    })}
                    disabled={busyAction === `approve-${tenant.id}` || tenant.approvalStatus === 'approved'}
                    className="rounded-2xl border border-emerald-400/40 px-4 py-3 font-semibold text-emerald-200 disabled:opacity-40"
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
                      className="rounded-2xl border border-indigo-400/40 px-4 py-3 font-semibold text-indigo-200 disabled:opacity-40"
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
                      className="rounded-2xl border border-rose-400/40 px-4 py-3 font-semibold text-rose-200 disabled:opacity-40"
                    >
                      Suspend Tenant
                    </button>
                  )}
                </div>
              </div>
            )) : <p className="text-slate-400">No tenant registrations yet.</p>}
          </div>
        </section>

        <div className="space-y-6">
          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Plan Pricing</h2>
            <form onSubmit={handleSavePricing} className="space-y-3">
              <div className="rounded-2xl bg-slate-900/30 p-4 text-sm text-slate-300">
                <p className="font-semibold text-blue-50">Custom Plan Onboarding Fee</p>
                <p className="mt-2">This onboarding fee is Ami-managed and can be changed at any time before schools pay.</p>
                {governanceData?.pricingConfig?.updatedAt && (
                  <p className="mt-2 text-xs text-orange-50">Updated: {new Date(governanceData.pricingConfig.updatedAt).toLocaleString()}</p>
                )}
              </div>
              <input
                name="customPlanSetupFeeNaira"
                type="number"
                min="1"
                value={pricingForm.customPlanSetupFeeNaira}
                onChange={handlePricingChange}
                placeholder="Custom onboarding fee (NGN)"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3"
              />
              <button type="submit" disabled={busyAction === 'save-pricing'} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
                {busyAction === 'save-pricing' ? 'Saving...' : 'Update Custom Pricing'}
              </button>
            </form>
          </section>

          <section className="glass-surface rounded-3xl p-6 border border-white/10">
  <h2 className="text-xl command-title neon-title mb-4 text-black">
    Discount Codes
  </h2>

  <form onSubmit={handleSaveDiscount} className="space-y-3">
    <input
      name="code"
      value={discountForm.code}
      onChange={handleDiscountChange}
      required
      placeholder="CODE"
      className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black placeholder:text-slate-500"
    />

    <input
      name="name"
      value={discountForm.name}
      onChange={handleDiscountChange}
      placeholder="Display name"
      className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black placeholder:text-slate-500"
    />

    <textarea
      name="description"
      value={discountForm.description}
      onChange={handleDiscountChange}
      placeholder="Discount description"
      className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 min-h-[96px] text-black placeholder:text-slate-500"
    />

    <div className="grid grid-cols-2 gap-3">
      <input
        name="setupFeeNaira"
        type="number"
        value={discountForm.setupFeeNaira}
        onChange={handleDiscountChange}
        placeholder="Setup fee (NGN)"
        className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black placeholder:text-slate-500"
      />

      <input
        name="studentFeeNaira"
        type="number"
        value={discountForm.studentFeeNaira}
        onChange={handleDiscountChange}
        placeholder="Student fee / term (NGN)"
        className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black placeholder:text-slate-500"
      />
    </div>

    <input
      name="planScope"
      value={discountForm.planScope}
      onChange={handleDiscountChange}
      placeholder="growth,custom"
      className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black placeholder:text-slate-500"
    />

    <input
      name="endsAt"
      type="datetime-local"
      value={discountForm.endsAt}
      onChange={handleDiscountChange}
      className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-black"
    />

    <label className="flex items-center gap-2 text-sm text-black">
      <input
        name="active"
        type="checkbox"
        checked={discountForm.active}
        onChange={handleDiscountChange}
      />
      Active now
    </label>

    <button
      type="submit"
      disabled={busyAction === 'save-discount'}
      className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
    >
      {busyAction === 'save-discount' ? 'Saving...' : 'Save Discount Code'}
    </button>
  </form>

  <div className="mt-5 space-y-3">
    {discountCodes.map((discountCode) => (
      <div
        key={discountCode.code}
        className="rounded-2xl bg-slate-900/30 p-4 text-sm text-black"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-black">
            {discountCode.code}
          </p>

          <span
            className={`micro-label ${
              discountCode.active ? 'accent-emerald' : 'accent-slate'
            }`}
          >
            {discountCode.active ? 'active' : 'ended'}
          </span>
        </div>

        <p className="mt-2 text-black">{discountCode.description}</p>

        <p className="mt-2 text-black">
          Setup:{' '}
          {discountCode.setupFee
            ? currencyFormatter.format(discountCode.setupFee)
            : 'unchanged'}
        </p>

        <p className="mt-1 text-black">
          Student:{' '}
          {discountCode.studentFeePerTerm
            ? currencyFormatter.format(discountCode.studentFeePerTerm)
            : 'unchanged'}
        </p>

        {discountCode.active && (
          <button
            type="button"
            onClick={() =>
              runAction(`end-${discountCode.code}`, async () => {
                await endDiscountCode(discountCode.code);
                setNotice(`${discountCode.code} ended.`);
              })
            }
            disabled={busyAction === `end-${discountCode.code}`}
            className="mt-3 rounded-2xl border border-rose-400/40 px-3 py-2 font-semibold text-black disabled:opacity-40"
          >
            End Code
          </button>
        )}
      </div>
    ))}
  </div>
</section>

          <section className="glass-surface rounded-3xl p-6 border border-white/10">
            <h2 className="text-xl command-title neon-title mb-4">Payment Feed</h2>
            <div className="space-y-3 text-sm text-slate-300 max-h-[420px] overflow-y-auto pr-1">
              {payments.length ? payments.map(payment => (
                <div key={payment.txRef} className="rounded-2xl bg-slate-900/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-100 font-semibold">{payment.txRef}</p>
                    <span className={`micro-label ${statusClass(payment.status)}`}>{payment.status}</span>
                  </div>
                  <p className="mt-2">{currencyFormatter.format(payment.amount)} • {payment.planKey}</p>
                  <p className="mt-1">{payment.studentCount} students</p>
                </div>
              )) : <p className="text-red-500">No onboarding payments yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
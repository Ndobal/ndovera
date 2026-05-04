import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyTenant, initiateTenantPayment, verifyTenantPayment } from '../services/tenantApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function statusClass(status) {
  switch (status) {
    case 'active':
    case 'paid':
    case 'approved':
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

export default function OwnerTenantConsole({ authUser = null, sectionKey = 'overview' }) {
  const location = useLocation();
  const [tenantData, setTenantData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const paymentRef = new URLSearchParams(location.search).get('payment_ref');

  const loadTenant = async () => {
    setIsLoading(true);
    try {
      const data = await getMyTenant();
      setTenantData(data);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load tenant data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, []);

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
          setNotice(result.verified ? 'Payment verified successfully.' : 'Payment is still pending verification.');
          await loadTenant();
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

  const handleOpenCheckout = async () => {
    setBusyAction('payment');
    setError('');
    setNotice('');

    try {
      const result = await initiateTenantPayment();
      window.location.href = result.checkoutUrl;
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to start payment.');
      setBusyAction('');
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading tenant workspace...</div>;
  }

  if (error && !tenantData) {
    return <div className="p-8 text-rose-300">{error}</div>;
  }

  const tenant = tenantData?.tenant;
  const quote = tenantData?.quote;
  const payments = tenantData?.payments || [];
  const latestPayment = payments[0] || null;
  const dashboardActive = tenant?.status === 'active';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="micro-label neon-subtle">Owner Tenant Workspace</p>
            <h1 className="text-3xl command-title neon-title mt-2">{tenant?.schoolName || authUser?.schoolName || 'School Onboarding'}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Owner access stays limited until payment is confirmed and Ami approval is completed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`micro-label ${statusClass(tenant?.status)}`}>Tenant: {tenant?.status || 'unknown'}</span>
            <span className={`micro-label ${statusClass(tenant?.paymentStatus)}`}>Payment: {tenant?.paymentStatus || 'unknown'}</span>
            <span className={`micro-label ${statusClass(tenant?.approvalStatus)}`}>Approval: {tenant?.approvalStatus || 'unknown'}</span>
            <span className={`micro-label ${statusClass(tenant?.websiteStatus)}`}>Website: {tenant?.websiteStatus || 'inactive'}</span>
          </div>
        </div>

        {(error || notice) && (
          <div className="mt-5 space-y-3">
            {error && <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
            {notice && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
          </div>
        )}

        {!dashboardActive && (
          <div className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 space-y-3">
            <p className="text-lg font-semibold text-black">Owner dashboard is locked until onboarding is complete.</p>
            <ol className="space-y-2 text-sm text-black list-decimal list-inside">
              <li>Pay the onboarding invoice through Flutterwave.</li>
              <li>Wait for Ami to approve the tenant.</li>
              <li>Once both are done, {tenant?.websiteDomain || 'your school subdomain'} becomes active.</li>
            </ol>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenCheckout}
                disabled={busyAction === 'payment'}
                className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyAction === 'payment' ? 'Opening Checkout...' : 'Pay With Flutterwave'}
              </button>
              {paymentRef && (
                <button
                  type="button"
                  onClick={() => verifyTenantPayment(paymentRef).then(loadTenant).catch(verificationError => setError(verificationError.message || 'Unable to verify payment.'))}
                  disabled={busyAction === 'verify-payment'}
                  className="rounded-2xl border border-slate-300/40 px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
                >
                  {busyAction === 'verify-payment' ? 'Verifying...' : 'Verify Return Payment'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-surface rounded-3xl p-5">
          <p className="micro-label neon-subtle">Plan</p>
          <p className="mt-2 text-2xl command-title text-black dark:text-slate-100">{quote?.planName || tenant?.planKey || 'Unknown'}</p>
        </div>
        <div className="glass-surface rounded-3xl p-5">
          <p className="micro-label neon-subtle">Setup Fee</p>
          <p className="mt-2 text-2xl command-title text-black dark:text-slate-100">{quote ? currencyFormatter.format(quote.setupFee) : '-'}</p>
        </div>
        <div className="glass-surface rounded-3xl p-5">
          <p className="micro-label neon-subtle">Student Billing / Subsequent Term</p>
          <p className="mt-2 text-2xl command-title text-black dark:text-slate-100">{quote ? currencyFormatter.format(quote.studentFeePerTerm) : '-'}</p>
        </div>
        <div className="glass-surface rounded-3xl p-5">
          <p className="micro-label neon-subtle">Subdomain</p>
          <p className="mt-2 text-xl command-title text-black dark:text-slate-100">{tenant?.websiteDomain || 'pending.ndovera.com'}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass-surface rounded-3xl p-6 border border-white/10">
          <h2 className="text-xl command-title neon-title mb-4">{sectionKey === 'finance' ? 'Payment Readiness' : sectionKey === 'schools' ? 'Website Activation' : sectionKey === 'approvals' ? 'Approval Control' : 'Onboarding Status'}</h2>
          {sectionKey === 'schools' ? (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Reserved Domain</p>
                <p className="mt-2 text-slate-100 font-semibold">{tenant?.websiteDomain}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Website State</p>
                <p className="mt-2 text-slate-100 font-semibold">{tenant?.websiteStatus}</p>
                <p className="mt-2">The school site only becomes active once payment is verified and Ami approves the tenant.</p>
              </div>
            </div>
          ) : sectionKey === 'finance' ? (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-emerald-400/20 bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Current Invoice</p>
                <p className="mt-2 text-2xl command-title text-slate-100">{quote ? currencyFormatter.format(quote.totalDueNow) : '-'}</p>
                <p className="mt-2">Only the onboarding fee is due now. Student billing starts from the subsequent term.</p>
                {quote?.discountApplied && <p className="mt-2 text-indigo-300">Discount applied: {quote.discountCode}</p>}
              </div>
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Subsequent Term Billing</p>
                <p className="mt-2 text-slate-100 font-semibold">{quote ? currencyFormatter.format(quote.nextTermStudentBilling) : '-'}</p>
                <p className="mt-2">{quote?.studentCount || tenant?.studentCount || 0} students x {quote ? currencyFormatter.format(quote.studentFeePerTerm) : '-'} billed from the subsequent term.</p>
              </div>
              {latestPayment && (
                <div className="rounded-2xl bg-slate-900/30 p-4">
                  <p className="micro-label neon-subtle">Latest Payment</p>
                  <p className="mt-2 text-slate-100 font-semibold">{latestPayment.txRef}</p>
                  <p className="mt-1">Status: {latestPayment.status}</p>
                </div>
              )}
            </div>
          ) : sectionKey === 'approvals' ? (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Approval State</p>
                <p className="mt-2 text-slate-100 font-semibold">{tenant?.approvalStatus}</p>
                <p className="mt-2">Ami must approve the tenant before owner tools and the school website unlock.</p>
              </div>
              {tenant?.approvalNote && (
                <div className="rounded-2xl bg-slate-900/30 p-4">
                  <p className="micro-label neon-subtle">Approval Note</p>
                  <p className="mt-2 text-slate-100">{tenant.approvalNote}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Owner Email</p>
                <p className="mt-2 text-[#800020] dark:text-slate-100 font-semibold">{tenant?.ownerEmail}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">Student Count</p>
                <p className="mt-2 text-[#800020] dark:text-slate-100 font-semibold">{tenant?.studentCount}</p>
              </div>
            </div>
          )}
        </section>

        <section className="glass-surface rounded-3xl p-6 border border-white/10">
          <h2 className="text-xl command-title neon-title mb-4">Payment Timeline</h2>
          <div className="space-y-3">
            {payments.length ? payments.map(payment => (
              <div key={payment.txRef} className="rounded-2xl bg-slate-900/30 p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[#800020] dark:text-slate-100 font-semibold">{payment.txRef}</p>
                  <span className={`micro-label ${statusClass(payment.status)}`}>{payment.status}</span>
                </div>
                <p className="mt-2 text-[#800020] dark:text-slate-300">Amount: {currencyFormatter.format(payment.amount)}</p>
                <p className="mt-1 text-[#800020] dark:text-slate-300">Created: {new Date(payment.createdAt).toLocaleString()}</p>
                {payment.paidAt && <p className="mt-1 text-[#800020] dark:text-slate-300">Paid: {new Date(payment.paidAt).toLocaleString()}</p>}
              </div>
            )) : <p className="text-slate-400">No payment attempts yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantPricing, registerSchool } from '../services/tenantApi';

const initialFormState = {
  schoolName: '',
  requestedSubdomain: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  password: '',
  confirmPassword: '',
  planKey: 'growth',
  studentCount: 120,
  discountCode: 'NDO35K500',
};

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export default function SchoolRegistrationPage() {
  const [formState, setFormState] = useState(initialFormState);
  const [pricing, setPricing] = useState({ plans: [], discountCodes: [], quote: null });
  const [pricingError, setPricingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registrationResult, setRegistrationResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadPricing = async () => {
      try {
        const data = await getTenantPricing({
          planKey: formState.planKey,
          studentCount: formState.studentCount,
          discountCode: formState.discountCode,
        });

        if (!cancelled) {
          setPricing(data);
          setPricingError('');
        }
      } catch (error) {
        if (!cancelled) {
          setPricingError(error.message || 'Unable to load pricing.');
        }
      }
    };

    loadPricing();
    return () => {
      cancelled = true;
    };
  }, [formState.planKey, formState.studentCount, formState.discountCode]);

  const handleChange = event => {
    const { name, value } = event.target;

    setFormState(current => ({
      ...current,
      [name]: name === 'studentCount' ? Number(value) : value,
      ...(name === 'schoolName' && !current.requestedSubdomain
        ? { requestedSubdomain: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
        : {}),
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitError('');

    if (formState.password !== formState.confirmPassword) {
      setSubmitError('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerSchool({
        schoolName: formState.schoolName,
        requestedSubdomain: formState.requestedSubdomain,
        ownerName: formState.ownerName,
        ownerEmail: formState.ownerEmail,
        ownerPhone: formState.ownerPhone,
        password: formState.password,
        planKey: formState.planKey,
        studentCount: formState.studentCount,
        discountCode: formState.discountCode,
      });

      setRegistrationResult(result);
    } catch (error) {
      setSubmitError(error.message || 'Unable to register school.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quote = pricing.quote;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-surface rounded-3xl border border-white/10 p-8 shadow-2xl">
          <p className="micro-label neon-subtle mb-2">School Onboarding</p>
          <h1 className="text-4xl command-title neon-title">Launch Your School On NDOVERA</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-2xl">
            Register your school, reserve your subdomain, create the owner account, and move into payment plus Ami approval.
          </p>

          {registrationResult ? (
            <div className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 space-y-3">
              <h2 className="text-2xl command-title neon-title">Registration Saved</h2>
              <p className="text-slate-700 dark:text-slate-200">
                {registrationResult.tenant?.schoolName} has been registered with the owner account {registrationResult.tenant?.ownerEmail}.
              </p>
              <p className="text-slate-700 dark:text-slate-200">
                Next step: sign in as the owner, pay the onboarding amount, and wait for Ami approval before the owner dashboard becomes active.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link to="/login" className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">
                  Go To Login
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationResult(null);
                    setFormState(initialFormState);
                  }}
                  className="rounded-2xl border border-slate-300/40 px-4 py-3 font-semibold text-slate-700 dark:text-slate-200"
                >
                  Register Another School
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="block space-y-2 md:col-span-2">
                <span className="micro-label">School Name</span>
                <input name="schoolName" value={formState.schoolName} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" placeholder="Royal Crest College" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Requested Subdomain</span>
                <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3">
                  <input name="requestedSubdomain" value={formState.requestedSubdomain} onChange={handleChange} required className="w-full bg-transparent outline-none" placeholder="royalcrest" />
                  <span className="text-sm text-slate-500">.ndovera.com</span>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Plan</span>
                <select name="planKey" value={formState.planKey} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3">
                  {pricing.plans.map(plan => (
                    <option key={plan.key} value={plan.key}>{plan.label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Owner Full Name</span>
                <input name="ownerName" value={formState.ownerName} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" placeholder="School owner name" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Owner Email</span>
                <input name="ownerEmail" type="email" value={formState.ownerEmail} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" placeholder="owner@school.com" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Owner Phone</span>
                <input name="ownerPhone" value={formState.ownerPhone} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" placeholder="08012345678" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Projected Students</span>
                <input name="studentCount" type="number" min="1" value={formState.studentCount} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Discount Code</span>
                <input name="discountCode" value={formState.discountCode} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" placeholder="NDO35K500" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Password</span>
                <input name="password" type="password" value={formState.password} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" />
              </label>

              <label className="block space-y-2">
                <span className="micro-label">Confirm Password</span>
                <input name="confirmPassword" type="password" value={formState.confirmPassword} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3" />
              </label>

              {submitError && (
                <div className="md:col-span-2 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {submitError}
                </div>
              )}

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60">
                  {isSubmitting ? 'Registering...' : 'Register School'}
                </button>
                <Link to="/login" className="rounded-2xl border border-slate-300/40 px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Back To Login
                </Link>
              </div>
            </form>
          )}
        </section>

        <aside className="space-y-6">
          <section className="glass-surface rounded-3xl border border-white/10 p-6 shadow-2xl">
            <p className="micro-label neon-subtle mb-2">Live Pricing</p>
            <h2 className="text-2xl command-title neon-title">Growth And Custom</h2>

            {pricingError ? (
              <p className="mt-4 text-rose-300">{pricingError}</p>
            ) : (
              <div className="mt-5 space-y-4">
                {pricing.plans.map(plan => (
                  <div key={plan.key} className={`rounded-2xl border p-4 ${plan.key === formState.planKey ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-slate-900/20'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-100">{plan.label}</p>
                        <p className="text-sm text-slate-400">{plan.description}</p>
                      </div>
                      {plan.requiresManualReview && <span className="micro-label accent-amber">Manual Review</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-slate-900/30 p-3">
                        <p className="micro-label neon-subtle">Setup</p>
                        <p className="mt-1 text-slate-100 font-semibold">{currencyFormatter.format(plan.setupFee)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-900/30 p-3">
                        <p className="micro-label neon-subtle">Per Student / Term</p>
                        <p className="mt-1 text-slate-100 font-semibold">{currencyFormatter.format(plan.studentFeePerTerm)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-surface rounded-3xl border border-white/10 p-6 shadow-2xl">
            <p className="micro-label neon-subtle mb-2">Current Quote</p>
            {quote ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-900/30 p-4">
                  <p className="text-sm text-slate-400">Plan</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">{quote.planName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-900/30 p-4">
                    <p className="text-sm text-slate-400">Setup Fee</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">{currencyFormatter.format(quote.setupFee)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/30 p-4">
                    <p className="text-sm text-slate-400">Student Fee / Term</p>
                    <p className="mt-1 text-lg font-semibold text-slate-100">{currencyFormatter.format(quote.studentFeePerTerm)}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-sm text-slate-400">Total Due At Onboarding</p>
                  <p className="mt-1 text-2xl command-title text-slate-100">{currencyFormatter.format(quote.totalDueNow)}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {quote.studentCount} students x {currencyFormatter.format(quote.studentFeePerTerm)} first-term billing plus setup fee.
                  </p>
                </div>
                {quote.discountApplied && (
                  <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4">
                    <p className="micro-label accent-indigo">Discount Active</p>
                    <p className="mt-2 text-slate-100 font-semibold">{quote.discountCode}</p>
                    <p className="mt-1 text-sm text-slate-400">{quote.discountSnapshot?.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400">Select a plan and student count to preview pricing.</p>
            )}
          </section>

          <section className="glass-surface rounded-3xl border border-white/10 p-6 shadow-2xl">
            <p className="micro-label neon-subtle mb-2">Active Discount Codes</p>
            <div className="space-y-3">
              {pricing.discountCodes?.length ? pricing.discountCodes.map(discountCode => (
                <div key={discountCode.code} className="rounded-2xl bg-slate-900/20 p-4">
                  <p className="text-slate-100 font-semibold">{discountCode.code}</p>
                  <p className="mt-1 text-sm text-slate-400">{discountCode.description}</p>
                </div>
              )) : <p className="text-slate-400">No active discount codes.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
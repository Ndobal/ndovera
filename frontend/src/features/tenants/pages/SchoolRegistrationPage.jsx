import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTenantPricing, registerSchoolAndPay, verifyPublicTenantPayment } from '../services/tenantApi';

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
  discountCode: '',
};

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function isValidRegistrationEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function PasswordField({ label, name, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block space-y-2">
      <span className="micro-label">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 px-4 py-3 pr-20"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}

export default function SchoolRegistrationPage() {
  const location = useLocation();
  const paymentRef = useMemo(() => new URLSearchParams(location.search).get('payment_ref'), [location.search]);
  const [formState, setFormState] = useState(initialFormState);
  const [pricing, setPricing] = useState({ plans: [], quote: null, pricingConfig: null });
  const [pricingError, setPricingError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  useEffect(() => {
    if (!paymentRef) {
      return undefined;
    }

    let cancelled = false;

    const verifyPayment = async () => {
      setIsVerifyingPayment(true);
      setSubmitError('');

      try {
        const result = await verifyPublicTenantPayment(paymentRef);
        if (!cancelled) {
          setPaymentResult(result);
          setCurrentStep(2);
        }
      } catch (error) {
        if (!cancelled) {
          setSubmitError(error.message || 'Unable to verify the returned payment.');
        }
      } finally {
        if (!cancelled) {
          setIsVerifyingPayment(false);
        }
      }
    };

    verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [paymentRef]);

  const validateAccountStep = () => {
    const schoolName = formState.schoolName.trim();
    const ownerName = formState.ownerName.trim();
    const ownerEmail = formState.ownerEmail.trim();
    const requestedSubdomain = formState.requestedSubdomain.trim();
    const password = formState.password;

    if (!schoolName || !ownerName || !ownerEmail || !requestedSubdomain || !password) {
      return 'School name, subdomain, owner name, owner email, and password are required.';
    }

    if (!isValidRegistrationEmail(ownerEmail)) {
      return 'Enter a valid owner email address.';
    }

    if (requestedSubdomain.length < 3) {
      return 'Choose a subdomain with at least 3 characters.';
    }

    if (password !== formState.confirmPassword) {
      return 'Password confirmation does not match.';
    }

    return '';
  };

  const validatePricingStep = () => {
    if (!formState.planKey) {
      return 'Select a pricing plan.';
    }

    if (formState.studentCount <= 0) {
      return 'Projected students must be greater than 0.';
    }

    if (!pricing.quote) {
      return 'The pricing preview is not ready yet.';
    }

    return '';
  };

  const handleChange = event => {
    const { name, value } = event.target;

    if (submitError) {
      setSubmitError('');
    }

    if (paymentResult) {
      setPaymentResult(null);
    }

    setFormState(current => ({
      ...current,
      [name]: name === 'studentCount' ? Number(value) : value,
      ...(name === 'schoolName' && !current.requestedSubdomain
        ? { requestedSubdomain: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
        : {}),
    }));
  };

  const handleProceedToPay = event => {
    event.preventDefault();
    const stepError = validateAccountStep();

    if (stepError) {
      setSubmitError(stepError);
      return;
    }

    setSubmitError('');
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePayNow = async () => {
    const accountError = validateAccountStep();
    if (accountError) {
      setSubmitError(accountError);
      setCurrentStep(1);
      return;
    }

    const pricingStepError = validatePricingStep();
    if (pricingStepError) {
      setSubmitError(pricingStepError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await registerSchoolAndPay({
        schoolName: formState.schoolName.trim(),
        requestedSubdomain: formState.requestedSubdomain.trim(),
        ownerName: formState.ownerName.trim(),
        ownerEmail: formState.ownerEmail.trim(),
        ownerPhone: formState.ownerPhone.trim(),
        password: formState.password,
        planKey: formState.planKey,
        studentCount: formState.studentCount,
        discountCode: formState.discountCode.trim(),
      });

      window.location.href = result.checkoutUrl;
    } catch (error) {
      setSubmitError(error.message || 'Unable to open Flutterwave checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quote = pricing.quote;
  const selectedPlan = pricing.plans.find(plan => plan.key === formState.planKey) || null;
  const paymentConfirmed = paymentResult?.verified || paymentResult?.payment?.status === 'paid';

  if (paymentConfirmed) {
    return (
      <div className="min-h-screen bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-emerald-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Onboarding Payment Confirmed</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">Your School Payment Has Been Received</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {paymentResult?.tenant?.schoolName} has been created successfully. The owner account is ready, the onboarding fee has been paid, and the school is now waiting for Ami approval before the dashboard and website become active.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Owner Email</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{paymentResult?.tenant?.ownerEmail}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reserved Domain</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{paymentResult?.tenant?.websiteDomain}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Onboarding Fee Paid</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{currencyFormatter.format(paymentResult?.payment?.amount || 0)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
              <p className="mt-3 text-lg font-semibold text-emerald-700">Awaiting Ami Approval</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700">
              Go To Login
            </Link>
            <button
              type="button"
              onClick={() => {
                setPaymentResult(null);
                setFormState(initialFormState);
                setCurrentStep(1);
                window.history.replaceState({}, '', '/register-school');
              }}
              className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Register Another School
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_38%,#ecfdf5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">School Onboarding</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">Register Your School And Pay Onboarding In Two Steps</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Please provide the right details.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {[1, 2].map(step => {
                const isActive = currentStep === step;
                const isComplete = currentStep > step;
                return (
                  <div
                    key={step}
                    className={`rounded-2xl border px-4 py-3 ${isActive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : isComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Step {step}</p>
                    <p className="mt-1 text-sm font-semibold">{step === 1 ? 'School Details' : 'Pricing And Payment'}</p>
                  </div>
                );
              })}
            </div>

            {isVerifyingPayment && (
              <div className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sky-700">
                Verifying your returned Flutterwave payment. Please wait.
              </div>
            )}

            {paymentResult && !paymentConfirmed && (
              <div className={`mt-8 rounded-3xl border px-5 py-4 ${paymentResult.payment?.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <p className="font-semibold">Payment status: {paymentResult.payment?.status || 'unknown'}</p>
                <p className="mt-2 text-sm leading-6">
                  {paymentResult.payment?.status === 'pending'
                    ? 'Flutterwave has not confirmed this payment yet. If you completed payment, wait a moment and refresh this page. If not, you can sign in later as the owner to retry payment.'
                    : 'The school account was created, but the payment was not confirmed yet.'}
                </p>
              </div>
            )}

            {submitError && (
              <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">
                {submitError}
              </div>
            )}

            {currentStep === 1 ? (
              <form onSubmit={handleProceedToPay} className="mt-8 grid gap-5 md:grid-cols-2">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">School Name</span>
                  <input name="schoolName" value={formState.schoolName} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="Royal Crest College" />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Requested Subdomain</span>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">
                    <input name="requestedSubdomain" value={formState.requestedSubdomain} onChange={handleChange} required className="w-full bg-transparent text-slate-900 outline-none" placeholder="royalcrest" />
                    <span className="text-sm font-medium text-slate-500">.ndovera.com</span>
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Owner Full Name</span>
                  <input name="ownerName" value={formState.ownerName} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="School owner name" />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Owner Email</span>
                  <input name="ownerEmail" type="email" autoComplete="email" value={formState.ownerEmail} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="owner@school.com" />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Owner Phone</span>
                  <input name="ownerPhone" value={formState.ownerPhone} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="08012345678" />
                </label>

                <PasswordField
                  label="Password"
                  name="password"
                  value={formState.password}
                  onChange={handleChange}
                  visible={showPassword}
                  onToggle={() => setShowPassword(current => !current)}
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirm Password"
                  name="confirmPassword"
                  value={formState.confirmPassword}
                  onChange={handleChange}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword(current => !current)}
                  autoComplete="new-password"
                />

                <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                  <button type="submit" className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700">
                    Proceed To Pay
                  </button>
                  <Link to="/login" className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
                    Back To Login
                  </Link>
                </div>
              </form>
            ) : (
              <div className="mt-8 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step 1 Complete</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-900">School:</span> {formState.schoolName}</p>
                    <p><span className="font-semibold text-slate-900">Owner:</span> {formState.ownerName}</p>
                    <p><span className="font-semibold text-slate-900">Email:</span> {formState.ownerEmail}</p>
                    <p><span className="font-semibold text-slate-900">Subdomain:</span> {formState.requestedSubdomain}.ndovera.com</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pricing Plan</span>
                    <select name="planKey" value={formState.planKey} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                      {pricing.plans.map(plan => (
                        <option key={plan.key} value={plan.key}>{plan.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Projected Students</span>
                    <input name="studentCount" type="number" min="1" value={formState.studentCount} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </label>

                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Discount Code</span>
                    <input name="discountCode" value={formState.discountCode} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="Enter discount code if you have one" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button type="button" onClick={() => setCurrentStep(1)} className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
                    Back To Details
                  </button>
                  <button type="button" onClick={handlePayNow} disabled={isSubmitting || !quote} className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? 'Opening Flutterwave...' : 'Pay Now'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">How It Works</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">1. Register your school</p>
                  <p className="mt-2">Create the owner account and reserve the school subdomain.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">2. Review pricing and pay</p>
                  <p className="mt-2">Choose Growth or Custom, apply any discount code, and continue to Flutterwave.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">3. Wait for Ami approval</p>
                  <p className="mt-2">The dashboard and website unlock after the onboarding fee is paid and Ami approves the tenant.</p>
                </div>
              </div>
            </section>

            {currentStep === 2 && (
              <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Pricing Preview</p>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Review Before Paying</h2>

                {pricingError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{pricingError}</p>
                ) : selectedPlan && quote ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{selectedPlan.label}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{selectedPlan.description}</p>
                        </div>
                        {selectedPlan.manualPricing && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Ami Priced</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Onboarding Fee Due Now</p>
                        <p className="mt-3 text-xl font-bold text-slate-950">{currencyFormatter.format(quote.totalDueNow)}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student Fee / Subsequent Term</p>
                        <p className="mt-3 text-xl font-bold text-slate-950">{currencyFormatter.format(quote.studentFeePerTerm)}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subsequent Term Billing</p>
                      <p className="mt-3 text-xl font-bold text-slate-950">{currencyFormatter.format(quote.nextTermStudentBilling)}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {quote.studentCount} students x {currencyFormatter.format(quote.studentFeePerTerm)} billed from the subsequent term.
                      </p>
                    </div>

                    {quote.discountApplied && (
                      <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Discount Applied</p>
                        <p className="mt-3 text-lg font-semibold">{quote.discountCode}</p>
                        <p className="mt-2 text-sm leading-6 text-indigo-700">{quote.discountSnapshot?.description}</p>
                      </div>
                    )}

                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm leading-7 text-slate-600">
                        Only the onboarding fee is charged on Flutterwave now. Student billing starts from the subsequent term.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Choose a plan to preview the current onboarding fee.</p>
                )}
              </section>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
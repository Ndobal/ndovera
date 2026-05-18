import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CommandPageShell from '../shared/components/CommandPageShell';
import {
  getAiAccess,
  initiateAiTopUp,
  saveAiBillingSettings,
  verifyAiTopUp,
} from '../features/ai/services/aiTutorApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

function AITutor() {
  const location = useLocation();
  const paymentRef = useMemo(() => new URLSearchParams(location.search).get('ai_payment_ref'), [location.search]);

  const [accessPayload, setAccessPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    scope: 'tenant',
    billingModel: 'individual',
    dailyFreeRequests: 50,
    pricePerCreditNaira: 0,
  });
  const [schoolCreditQuantity, setSchoolCreditQuantity] = useState(50);

  const access = accessPayload?.access || null;
  const management = useMemo(() => accessPayload?.management || {}, [accessPayload]);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      setLoading(true);
      try {
        const data = await getAiAccess();
        if (!active) return;
        setAccessPayload(data);
        setPolicyForm(current => ({
          ...current,
          scope: data.management?.role === 'ami' ? current.scope : 'tenant',
          billingModel: data.access?.policy?.billingModel || 'individual',
          dailyFreeRequests: data.access?.policy?.dailyFreeRequests || 50,
          pricePerCreditNaira: data.access?.policy?.pricePerCreditNaira || 0,
        }));
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Could not load AI access.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!paymentRef) return;

    let active = true;
    setNotice('Verifying your returned AI credit payment...');

    async function verifyPayment() {
      try {
        const result = await verifyAiTopUp(paymentRef);
        if (!active) return;
        setNotice(result.verified ? 'AI credit payment verified successfully.' : 'AI credit payment is still pending verification.');
        if (result.access) {
          setAccessPayload(current => ({ ...(current || {}), access: result.access, management: current?.management || management }));
        }
      } catch (verifyError) {
        if (!active) return;
        setError(verifyError.message || 'Could not verify the AI credit payment.');
        if (verifyError.data?.access) {
          setAccessPayload(current => ({ ...(current || {}), access: verifyError.data.access, management: current?.management || management }));
        }
      }
    }

    verifyPayment();
    return () => {
      active = false;
    };
  }, [management, paymentRef]);

  const summaryCards = useMemo(() => {
    if (!access) return [];

    return [
      {
        label: 'Free Requests Remaining',
        value: `${access.usage.remainingFreeRequests}/${access.usage.dailyFreeRequests}`,
        helper: 'Each account gets 50 free AI requests per day before wallet credits are used.',
      },
      {
        label: 'Current Billing Mode',
        value: access.policy.billingModel === 'school' ? 'School Sponsored' : 'Individual Billing',
        helper: access.policy.billingModel === 'school'
          ? 'After the free quota, the school wallet pays for AI requests.'
          : 'After the free quota, the individual user wallet pays for AI requests.',
      },
      {
        label: 'Available Credits',
        value: String(access.wallet.availableCredits || 0),
        helper: access.policy.billingModel === 'school'
          ? `${access.wallet.schoolCredits || 0} school credits are currently funded.`
          : `${access.wallet.userCredits || 0} personal credits are currently funded.`,
      },
      {
        label: 'Configured Credit Price',
        value: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'Not Set',
        helper: 'When pricing is configured, one AI request consumes one credit after the free daily allowance.',
      },
    ];
  }, [access]);

  async function refreshAccessWithMessage(message) {
    const data = await getAiAccess();
    setAccessPayload(data);
    setNotice(message);
    setPolicyForm(current => ({
      ...current,
      billingModel: data.access?.policy?.billingModel || current.billingModel,
      dailyFreeRequests: data.access?.policy?.dailyFreeRequests || current.dailyFreeRequests,
      pricePerCreditNaira: data.access?.policy?.pricePerCreditNaira || current.pricePerCreditNaira,
    }));
  }

  async function handleSavePolicy() {
    setSavingPolicy(true);
    setError('');
    setNotice('');

    try {
      await saveAiBillingSettings({
        scope: management.role === 'ami' ? policyForm.scope : 'tenant',
        tenantId: management.tenantId,
        billingModel: policyForm.billingModel,
        dailyFreeRequests: Number(policyForm.dailyFreeRequests) || 50,
        pricePerCreditNaira: Number(policyForm.pricePerCreditNaira) || 0,
      });
      await refreshAccessWithMessage('AI billing policy updated successfully.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save AI billing policy.');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleSchoolTopUp() {
    setTopUpBusy(true);
    setError('');
    setNotice('');

    try {
      const data = await initiateAiTopUp({ quantity: schoolCreditQuantity, target: 'school' });
      if (data.paymentLink) {
        window.location.assign(data.paymentLink);
        return;
      }
      throw new Error('Flutterwave checkout link was not returned.');
    } catch (topUpError) {
      setError(topUpError.message || 'Could not open the school AI credit checkout.');
    } finally {
      setTopUpBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <CommandPageShell
        section="Adaptive Intelligence"
        title="AI Tutor"
        description="Live AI quota, wallet, and payment control for individual billing or school-sponsored access."
        live
        chips={[
          { label: '50 Free Daily', accent: 'accent-emerald' },
          { label: 'Credits', accent: 'accent-amber' },
          { label: 'School Or Individual', accent: 'accent-indigo' },
        ]}
      />

      {error ? (
        <div className="rounded-3xl border border-red-300/60 bg-red-50 px-5 py-4 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-3xl border border-[#1a5c38]/25 bg-[#f5deb3] px-5 py-4 text-sm font-semibold text-[#1a5c38] dark:border-[#00ffff]/35 dark:bg-[#191970]/45 dark:text-[#39ff14]">
          {notice}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <div className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3] px-5 py-6 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70 dark:text-[#39ff14]">
            Loading AI access...
          </div>
        ) : summaryCards.map(card => (
          <div key={card.label} className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-[#800000] dark:text-[#ffffff]">{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">{card.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,1fr)]">
        <div className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-6 shadow-[0_22px_48px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
          <h2 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">Billing Rules</h2>
          <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
            Individual users receive 50 free AI requests every day. After that, the system charges either the user wallet or the school wallet based on the active billing model.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#800000]/10 bg-white/55 p-5 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Individual Billing</p>
              <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                The learner uses 50 free requests per day first, then personal credits are consumed one request at a time.
              </p>
            </div>
            <div className="rounded-3xl border border-[#800000]/10 bg-white/55 p-5 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">School Sponsored</p>
              <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                The learner still gets 50 free daily requests, but extra usage draws from the school wallet instead of the user wallet.
              </p>
            </div>
          </div>
        </div>

        {management.canManagePolicy ? (
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-6 shadow-[0_22px_48px_rgba(25,25,112,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
              <h2 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">Manage AI Billing</h2>
              <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                Configure whether AI is paid for by individual users or by the school, and set the live price per credit.
              </p>

              <div className="mt-5 space-y-4">
                {management.role === 'ami' ? (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Scope</label>
                    <select
                      value={policyForm.scope}
                      onChange={event => setPolicyForm(current => ({ ...current, scope: event.target.value }))}
                      className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                    >
                      <option value="global">Global Default</option>
                      <option value="tenant">Current School</option>
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Billing Mode</label>
                  <select
                    value={policyForm.billingModel}
                    onChange={event => setPolicyForm(current => ({ ...current, billingModel: event.target.value }))}
                    className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                  >
                    <option value="individual">Individual Billing</option>
                    <option value="school">School Sponsored</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Daily Free Requests</label>
                  <input
                    type="number"
                    min="0"
                    value={policyForm.dailyFreeRequests}
                    onChange={event => setPolicyForm(current => ({ ...current, dailyFreeRequests: Math.max(0, Number(event.target.value) || 0) }))}
                    className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Price Per Credit (Naira)</label>
                  <input
                    type="number"
                    min="0"
                    value={policyForm.pricePerCreditNaira}
                    onChange={event => setPolicyForm(current => ({ ...current, pricePerCreditNaira: Math.max(0, Number(event.target.value) || 0) }))}
                    className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSavePolicy}
                  disabled={savingPolicy}
                  className="w-full rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                >
                  {savingPolicy ? 'Saving Policy...' : 'Save Billing Policy'}
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-6 shadow-[0_22px_48px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
              <h2 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">Top Up School Credits</h2>
              <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                Use Flutterwave to fund the school wallet so extra AI requests continue after the daily free quota is finished.
              </p>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Credit Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={schoolCreditQuantity}
                  onChange={event => setSchoolCreditQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                />
              </div>

              <button
                type="button"
                onClick={handleSchoolTopUp}
                disabled={topUpBusy || !(access?.policy?.pricePerCreditNaira > 0)}
                className="mt-4 w-full rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
              >
                {topUpBusy ? 'Opening Checkout...' : 'Buy School Credits'}
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default AITutor;
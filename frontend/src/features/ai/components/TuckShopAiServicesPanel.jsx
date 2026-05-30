import React, { useEffect, useMemo, useState } from 'react';
import { getAiAccess, initiateAiTopUp } from '../services/aiTutorApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export default function TuckShopAiServicesPanel({ title = 'Added Services' }) {
  const [accessPayload, setAccessPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState(10);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  const access = accessPayload?.access || null;
  const canBuyIndividualCredits = access?.policy?.billingModel === 'individual' && Number(access?.policy?.pricePerCreditNaira || 0) > 0;
  const creditPackOptions = useMemo(
    () => [10, 25, 50, 100].map(quantity => ({
      quantity,
      total: Number(access?.policy?.pricePerCreditNaira || 0) * quantity,
    })),
    [access?.policy?.pricePerCreditNaira],
  );

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      setLoading(true);
      try {
        const data = await getAiAccess();
        if (!active) return;
        setAccessPayload(data);
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load AI services.');
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

  const summary = useMemo(() => {
    if (!access) return [];

    return [
      {
        label: 'Free Requests Left',
        value: `${access.usage.remainingFreeRequests || 0}/${access.usage.dailyFreeRequests || 0}`,
      },
      {
        label: 'Available Credits',
        value: String(access.wallet.availableCredits || 0),
      },
      {
        label: 'Credit Price',
        value: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'Not set',
      },
    ];
  }, [access]);

  const estimatedTotal = Number(access?.policy?.pricePerCreditNaira || 0) * Math.max(1, purchaseQuantity || 1);

  async function handleCheckout() {
    if (!canBuyIndividualCredits) return;

    setPurchaseBusy(true);
    setError('');
    try {
      const data = await initiateAiTopUp({ quantity: Math.max(1, purchaseQuantity || 1), target: 'individual' });
      if (data?.paymentLink) {
        window.location.assign(data.paymentLink);
        return;
      }
      throw new Error('Checkout link was not returned.');
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : 'Could not start the AI credit checkout.');
    } finally {
      setPurchaseBusy(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 p-5 shadow-[0_20px_44px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/68">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#800020] dark:text-[#bf00ff]">{title}</p>
          <h3 className="mt-2 text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">AI Credits In The Tuck Shop</h3>
          <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
            Buy personal Ndovera AI credits from the same tuck-shop area you use for school items. Credits keep the chat assistant active after the daily free requests are exhausted.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
          {(loading ? [{ label: 'Status', value: 'Loading...' }] : summary).map(card => (
            <div key={card.label} className="rounded-3xl border border-[#800000]/10 bg-white/55 px-4 py-3 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">{card.label}</p>
              <p className="mt-2 text-lg font-semibold text-[#800000] dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-white">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[1.75rem] border border-[#800000]/10 bg-white/60 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
          <p className="text-sm font-semibold text-[#800000] dark:text-white">Service Notes</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
            <p>Daily free requests are used first before any personal AI credit is charged.</p>
            <p>If your school is on school-sponsored billing, this panel still shows the live AI status even though personal checkout is disabled.</p>
            <p>After payment, your new balance is available in Ndovera AI automatically.</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[#800000]/10 bg-white/60 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">AI Credit Checkout</p>
          {canBuyIndividualCredits ? (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {creditPackOptions.map(pack => {
                  const active = purchaseQuantity === pack.quantity;
                  return (
                    <button
                      key={pack.quantity}
                      type="button"
                      onClick={() => setPurchaseQuantity(pack.quantity)}
                      className={`rounded-3xl border px-4 py-4 text-left transition ${active
                        ? 'border-[#1a5c38] bg-[#1a5c38]/12 dark:border-[#00ffff] dark:bg-[#00ffff]/12'
                        : 'border-[#800000]/10 bg-[#fff8ea] dark:border-[#bf00ff]/20 dark:bg-[#120014]/70'
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Credit Pack</p>
                      <p className="mt-2 text-2xl font-semibold text-[#800000] dark:text-white">{pack.quantity}</p>
                      <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">{currencyFormatter.format(pack.total)}</p>
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">
                Custom Quantity
                <input
                  type="number"
                  min="1"
                  value={purchaseQuantity}
                  onChange={event => setPurchaseQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="mt-2 w-full rounded-2xl border border-[#800000]/15 bg-[#fff8ea] px-4 py-3 text-sm text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/20 dark:bg-[#120014]/70 dark:text-white"
                />
              </label>
              <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                Estimated total: <span className="font-semibold text-[#800000] dark:text-white">{currencyFormatter.format(estimatedTotal)}</span>
              </p>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={purchaseBusy}
                className="mt-4 w-full rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
              >
                {purchaseBusy ? 'Opening Checkout...' : 'Buy AI Credits'}
              </button>
            </>
          ) : (
            <div className="mt-3 rounded-2xl border border-[#800000]/10 bg-[#fff8ea] px-4 py-3 text-sm leading-6 text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#120014]/70 dark:text-[#39ff14]">
              {loading
                ? 'Loading the current billing policy...'
                : access?.policy?.billingModel === 'school'
                  ? 'This account is currently on school-sponsored AI billing. Personal checkout is disabled until the school changes the policy.'
                  : 'AI credit pricing has not been configured yet.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
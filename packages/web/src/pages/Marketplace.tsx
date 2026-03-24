import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ShoppingBag, Sparkles, Ticket } from 'lucide-react';
import { createMarketplacePurchaseIntent, getPricingCatalog, type MarketplaceBundle, type PricingCatalog } from '../services/monetizationApi';

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function MarketplaceView() {
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{
    invoiceId: string;
    bundleLabel: string;
    payableAmount: number;
    discountAmount: number;
    appliedCode?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getPricingCatalog().then((data) => {
      if (!active) return;
      setCatalog(data);
      const featured = data.marketplace.bundles.find((bundle) => bundle.featured && bundle.active) || data.marketplace.bundles.find((bundle) => bundle.active);
      setSelectedBundleId(featured?.id || '');
    }).catch(() => {
      if (!active) return;
      setError('Marketplace catalog could not be loaded.');
    });
    return () => {
      active = false;
    };
  }, []);

  const activeBundles = useMemo(() => (catalog?.marketplace.bundles || []).filter((bundle) => bundle.active), [catalog]);
  const selectedBundle = activeBundles.find((bundle) => bundle.id === selectedBundleId) || activeBundles[0] || null;

  const submitPurchaseIntent = async () => {
    if (!selectedBundle) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await createMarketplacePurchaseIntent({
        bundleId: selectedBundle.id,
        discountCode: discountCode.trim() || undefined,
      });
      setPurchaseResult({
        invoiceId: response.invoice.id,
        bundleLabel: response.bundle.label,
        payableAmount: response.bundle.payableAmount,
        discountAmount: response.bundle.discountAmount,
        appliedCode: response.bundle.appliedDiscountCode?.code,
      });
    } catch (purchaseError) {
      setPurchaseResult(null);
      setError(purchaseError instanceof Error ? purchaseError.message : 'Purchase intent could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(6,106,62,0.26),rgba(11,15,14,0.96))] p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100">
              <ShoppingBag size={14} /> Central Marketplace
            </div>
            <h1 className="mt-4 text-3xl font-black text-white lg:text-4xl">Buy AI credits, Keyu bundles, and tutor access in one place</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">All buying links now point here. Super-admin controls the available bundles, launch discounts, and active codes from monetization settings.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-zinc-200">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Current Keyu rate</div>
            <div className="mt-2 text-2xl font-bold text-white">N1 = {catalog?.marketplace.keyuPerNaira || 3} Keyu</div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {activeBundles.map((bundle: MarketplaceBundle) => (
            <button
              key={bundle.id}
              type="button"
              onClick={() => setSelectedBundleId(bundle.id)}
              className="rounded-[1.75rem] border p-5 text-left transition"
              style={selectedBundleId === bundle.id ? { borderColor: 'rgba(16,185,129,0.32)', background: 'rgba(16,185,129,0.08)' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{bundle.category.replace('-', ' ')}</div>
                  <h2 className="mt-2 text-xl font-bold text-white">{bundle.label}</h2>
                </div>
                {bundle.discountPercent ? <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">-{bundle.discountPercent}%</div> : null}
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-400">{bundle.description}</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-300">
                {bundle.aiCredits > 0 ? <span className="rounded-full bg-white/5 px-3 py-1">{bundle.aiCredits} AI credits</span> : null}
                {bundle.keyuAmount > 0 ? <span className="rounded-full bg-white/5 px-3 py-1">{bundle.keyuAmount} Keyu</span> : null}
              </div>
              <div className="mt-6 flex items-end gap-3">
                <div className="text-2xl font-black text-white">{formatNaira(bundle.nairaAmount)}</div>
                {bundle.originalNairaAmount && bundle.originalNairaAmount > bundle.nairaAmount ? <div className="pb-1 text-sm text-zinc-500 line-through">{formatNaira(bundle.originalNairaAmount)}</div> : null}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[1.9rem] border border-white/10 bg-[#101214] p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
            <Sparkles size={14} /> Purchase intent
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">{selectedBundle?.label || 'Choose a bundle'}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{selectedBundle?.description || 'Select any bundle to generate a payable invoice and reference.'}</p>
          <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="text-zinc-400">Base amount</span><span className="font-semibold text-white">{formatNaira(selectedBundle?.nairaAmount || 0)}</span></div>
            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"><Ticket size={12} /> Discount code</label>
              <input value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} placeholder="Optional marketplace code" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            </div>
            <button disabled={submitting || !selectedBundle} onClick={submitPurchaseIntent} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? 'Creating invoice...' : 'Create payment intent'}</button>
          </div>
          {purchaseResult ? <div className="mt-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]"><AlertCircle size={14} /> Ready for payment</div><div className="mt-3 space-y-2"><div>Bundle: <span className="font-semibold text-white">{purchaseResult.bundleLabel}</span></div><div>Invoice: <span className="font-mono text-white">{purchaseResult.invoiceId}</span></div><div>Amount: <span className="font-semibold text-white">{formatNaira(purchaseResult.payableAmount)}</span></div>{purchaseResult.discountAmount > 0 ? <div>You saved {formatNaira(purchaseResult.discountAmount)}{purchaseResult.appliedCode ? ` with ${purchaseResult.appliedCode}` : ''}.</div> : null}</div></div> : null}
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-zinc-400">
            Purchase intents create invoices only. Payment confirmation still happens through the billing workflow, so the finance team keeps a single source of truth.
          </div>
        </div>
      </section>
    </div>
  );
}

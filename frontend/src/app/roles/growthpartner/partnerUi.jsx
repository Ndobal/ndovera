import React from 'react';

export const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

// Dark text on light surfaces throughout — the app shell is light, so nothing here relies on
// a dark background to stay readable.
export const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 sm:p-6 dark:border-white/10 dark:bg-slate-900/40';
export const INPUT = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2.5 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38]/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100';
export const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';
export const BODY = 'text-sm leading-6 text-[#191970] dark:text-slate-300';
export const MUTED = 'text-xs text-[#4a5578] dark:text-slate-400';
export const BTN_PRIMARY = 'rounded-xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-50';
export const BTN_SECONDARY = 'rounded-xl border border-[#191970]/25 bg-white/70 px-5 py-2.5 text-sm font-bold text-[#191970] transition hover:border-[#1a5c38] disabled:opacity-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100';

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-[#191970] dark:text-slate-100">{title}</h1>
          {subtitle ? <p className={`mt-2 max-w-2xl ${BODY}`}>{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-[#c9a96e]/40 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#800020] dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone || 'text-[#191970] dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

export function Notice({ error, notice }) {
  if (!error && !notice) return null;
  return (
    <div className="space-y-2">
      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className={`rounded-2xl border border-dashed border-[#c9a96e]/60 bg-white/50 px-4 py-6 text-center ${BODY} dark:bg-slate-900/30`}>{children}</p>;
}

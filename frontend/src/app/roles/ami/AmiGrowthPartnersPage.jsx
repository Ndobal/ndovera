import React from 'react';
import GrowthPartnersAdmin from '../../../features/public/components/GrowthPartnersAdmin';

export default function AmiGrowthPartnersPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-6 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#800020] dark:text-fuchsia-300">AMI Growth Partner Command</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#800000] dark:text-blue-400">Partner analytics, payouts, and appointments</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#191970] dark:text-emerald-300">
          Monitor every active growth partner, their referrals, commissions, payouts, and latest activity. Record offline payments and assign representative coverage from one place.
        </p>
      </section>
      <GrowthPartnersAdmin />
    </div>
  );
}

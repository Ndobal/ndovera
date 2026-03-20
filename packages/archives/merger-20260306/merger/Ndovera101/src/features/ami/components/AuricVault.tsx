import React from 'react';
import { Zap, DollarSign, CheckCircle } from 'lucide-react';

const mockPricingTiers = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'For new schools getting started.',
    features: ['Up to 50 students', 'Basic Modules', 'Community Support'],
  },
  {
    name: 'Professional',
    price: '₦25,000',
    price_suffix: '/ month',
    description: 'For growing schools needing more power.',
    features: ['Up to 500 students', 'Premium Blueprint', 'Dedicated Support', 'Aura Farming'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large institutions and school groups.',
    features: ['Unlimited Students', 'International Blueprint', 'API Access', 'On-site Training'],
  },
];

const PricingCard = ({ tier }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
    <h3 className="text-lg font-bold text-emerald-400 mb-2">{tier.name}</h3>
    <p className="text-3xl font-bold text-slate-100 mb-1">{tier.price} <span className="text-sm font-normal text-slate-400">{tier.price_suffix}</span></p>
    <p className="text-sm text-slate-400 mb-6 h-10">{tier.description}</p>
    <ul className="space-y-3">
      {tier.features.map(feature => (
        <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <button className="w-full mt-8 text-center py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-200 transition-colors">
      Manage Tier
    </button>
  </div>
);

export default function AuricVault() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">AuricVault / Pricing & Auras</h1>
        <p className="text-sm text-slate-400">Manage the platform's economic engine and reward systems.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Aura Configuration */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400" /> Aura Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400">Aura to Naira Rate</label>
              <input type="number" defaultValue="50" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
              <p className="text-xs text-slate-500 mt-1">1 Aura = 50 Naira</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Daily Aura Cap (User)</label>
              <input type="number" defaultValue="100" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Global Daily Aura Cap</label>
              <input type="number" defaultValue="10000" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
            </div>
            <button className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold text-white transition-colors">
              Save Aura Settings
            </button>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" /> Pricing Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mockPricingTiers.map(tier => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Plus, Copy, ShieldCheck, Zap } from 'lucide-react';

const mockBlueprints = [
  {
    id: 'bp_basic',
    name: 'Basic Blueprint',
    description: 'Core modules for new and small schools. Focus on essential management.',
    features: ['Academics', 'Basic Finance', 'Attendance', 'Communication'],
    color: 'slate',
  },
  {
    id: 'bp_premium',
    name: 'Premium Blueprint',
    description: 'Advanced features for established schools, including Aura farming and rewards.',
    features: ['All Basic Features', 'Aura Farm', 'Rewards Engine', 'Aptitude Tests', 'Website Builder'],
    color: 'emerald',
  },
  {
    id: 'bp_international',
    name: 'International Blueprint',
    description: 'For schools with international curriculum needs and advanced result processing.',
    features: ['All Premium Features', 'Advanced Result Engine', 'Alumni Network', 'Multi-language Support'],
    color: 'indigo',
  },
];

const BlueprintCard = ({ blueprint }) => {
  const colors = {
    slate: 'border-slate-700',
    emerald: 'border-emerald-500',
    indigo: 'border-indigo-500',
  };

  return (
    <div className={`bg-slate-900 border ${colors[blueprint.color]} rounded-2xl p-6 flex flex-col`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg bg-${blueprint.color}-500/10 flex items-center justify-center`}>
          <Copy className={`w-5 h-5 text-${blueprint.color}-400`} />
        </div>
        <h2 className="text-lg font-bold text-slate-100">{blueprint.name}</h2>
      </div>
      <p className="text-sm text-slate-400 flex-1 mb-6">{blueprint.description}</p>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Features Included:</h3>
        <ul className="space-y-2">
          {blueprint.features.map(feature => (
            <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <button className="w-full mt-6 text-center py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-200 transition-colors">
        Manage Blueprint
      </button>
    </div>
  );
};

export default function Blueprint() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Blueprint / Template Control</h1>
          <p className="text-sm text-slate-400">Define and manage the feature sets available to different school tiers.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          Create New Blueprint
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mockBlueprints.map(bp => (
          <BlueprintCard key={bp.id} blueprint={bp} />
        ))}
      </div>
    </div>
  );
}

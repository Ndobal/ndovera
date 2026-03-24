import React from 'react';
import type { DashboardStat } from './types';

export function StatGrid({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="card-mini flex items-center gap-3">
          <div className={`w-8 h-8 ${stat.bg || 'bg-white/5'} ${stat.color || 'text-white'} rounded-lg flex items-center justify-center`}>{stat.icon}</div>
          <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-mono font-bold text-white">{stat.value}</span>
              <span className={`text-[8px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>{stat.change}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
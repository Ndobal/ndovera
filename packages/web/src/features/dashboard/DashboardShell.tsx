import React from 'react';
import { RefreshCw } from 'lucide-react';

export function DashboardShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Term 2, Week 6</div>
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>
      {children}
    </div>
  );
}
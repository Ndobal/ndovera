import React from 'react';
import { AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function OperationsDashboard({ role, setActiveTab, stats }: DashboardCommonProps) {
  return (
    <DashboardShell title="Operations Dashboard" subtitle="Library, transport, clinic, hostel, and tuckshop operations in one view.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card-compact bg-orange-500/5 border-orange-500/10"><h3 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Quick Actions</h3><div className="space-y-3"><button onClick={() => setActiveTab?.(role === 'Tuckshop Manager' ? 'tuckshop' : role === 'Hostel Manager' ? 'hostel' : role === 'Librarian' ? 'library' : 'clinic')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Open Operations Workspace</button><button onClick={() => setActiveTab?.('inventory')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Manage Inventory & Logs</button></div></div>
        <div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Recent Operations Log</h3><div className="space-y-3"><div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5"><div><span className="text-[10px] text-zinc-500">10:42 AM</span><p className="text-sm font-bold text-white mt-0.5">System Request</p></div><p className="text-[9px] font-bold uppercase mt-1 text-emerald-400">Completed</p></div></div></div>
      </div>
    </DashboardShell>
  );
}
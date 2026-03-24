import React from 'react';
import { Clock, Wallet } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function FinanceDashboard({ stats, setActiveTab, financeStats }: DashboardCommonProps) {
  const invoices = [
    { id: 'INV-2026-001', student: 'Sarah Johnson', amount: '₦45,000', status: 'Overdue' },
    { id: 'INV-2026-002', student: 'Michael Obi', amount: '₦120,000', status: 'Pending' },
  ];

  return (
    <DashboardShell title="Finance Dashboard" subtitle="Track collections, invoices, and financial workflows.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Pending Invoices</h3>{invoices.map((inv) => <div key={inv.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 mb-3"><div><p className="text-sm font-bold text-white">{inv.student}</p><p className="text-[10px] text-zinc-400">{inv.id}</p></div><div className="text-right"><p className="text-sm font-mono text-emerald-400">{inv.amount}</p><p className={`text-[9px] font-bold uppercase ${inv.status === 'Overdue' ? 'text-red-400' : 'text-orange-400'}`}>{inv.status}</p></div></div>)}</div>
        <div className="card-compact bg-orange-500/5 border-orange-500/10"><h3 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Quick Actions</h3><div className="space-y-3"><button onClick={() => setActiveTab?.('finance')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Generate Fee Invoices</button><button onClick={() => setActiveTab?.('finance')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Record Manual Payment</button></div></div>
      </div>
    </DashboardShell>
  );
}
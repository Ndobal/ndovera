import React from 'react';
import { AlertCircle, Megaphone, Users } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function FrontDeskDashboard({ setActiveTab, stats }: DashboardCommonProps) {
  return (
    <DashboardShell title="Front Desk Command Center" subtitle="Manage communications, attendance, records, and access from one place.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-compact border-t-2 border-t-emerald-500"><div className="flex items-center gap-2 mb-4"><Megaphone size={16} className="text-emerald-500" /><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Communications</h3></div><button onClick={() => setActiveTab?.('communication')} className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">New Broadcast</button></div>
            <div className="card-compact border-t-2 border-t-blue-500"><div className="flex items-center gap-2 mb-4"><Users size={16} className="text-blue-500" /><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Activity & Attendance</h3></div></div>
          </div>
          <div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Operations Hub</h3><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{['finance','tuckshop','hostel','clinic'].map((tab) => <button key={tab} onClick={() => setActiveTab?.(tab)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-left"><p className="text-xs font-bold text-white">{tab}</p></button>)}</div></div>
        </div>
        <div className="space-y-6"><div className="card-compact bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/10"><div className="flex items-center gap-2 mb-4"><AlertCircle size={16} className="text-red-500" /><h3 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Access Control & Approvals</h3></div></div><div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Support & Scheduling</h3></div></div>
      </div>
    </DashboardShell>
  );
}
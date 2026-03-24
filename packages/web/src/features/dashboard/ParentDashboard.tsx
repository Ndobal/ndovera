import React from 'react';
import { Megaphone, Wallet } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function ParentDashboard({ currentUser, setActiveTab, stats, children, announcements, financeStats }: DashboardCommonProps) {
  const items = children?.length ? children : [{ id: 'child-1', name: 'Child', grade: 'Class', gpa: 'B+' }];
  const notes = announcements?.length ? announcements : ['No announcements.'];

  return (
    <DashboardShell title={`Welcome back, ${currentUser?.name || 'Parent/Guardian'}`} subtitle="Track attendance, announcements, and fees in one place.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card-compact"><div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Children In Focus</h3><span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">{items.length} Active</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{items.map((child: any) => <div key={child.id} className="p-4 bg-white/2 rounded-2xl border border-white/5"><p className="text-sm font-bold text-white">{child.name}</p><p className="text-[10px] text-zinc-400">{child.grade}</p></div>)}</div></div>
          <div className="card-compact"><div className="flex items-center justify-between px-1 mb-4"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">School Announcements</h3><button onClick={() => setActiveTab?.('notices')} className="text-[10px] font-bold text-emerald-500 hover:underline">View All</button></div><div className="grid gap-3">{notes.slice(0, 4).map((ann: any, i) => <div key={i} className="group flex items-center gap-4 bg-white/2 border border-white/5 p-3 rounded-xl"><Megaphone size={16} className="text-emerald-500" /><div className="flex-1 text-sm text-white">{typeof ann === 'string' ? ann : ann.title}</div></div>)}</div></div>
        </div>
        <div className="space-y-6"><div className="card-compact bg-linear-to-b from-orange-500/10 to-transparent border-orange-500/20"><div className="flex items-center gap-2 mb-4"><Wallet size={16} className="text-orange-400" /><h3 className="text-xs font-bold uppercase tracking-widest text-orange-400">Financial Summary</h3></div><h4 className="text-3xl font-bold text-white">{financeStats ? `₦${(financeStats.outstanding / 1000000).toFixed(1)}M` : '—'}</h4></div><div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Quick Links</h3><div className="grid grid-cols-2 gap-3">{['attendance', 'results', 'messages', 'fees'].map((tab) => <button key={tab} onClick={() => setActiveTab?.(tab)} className="p-3 rounded-xl bg-white/5 border border-white/5 text-left"><p className="text-xs font-bold text-white">{tab}</p></button>)}</div></div></div>
      </div>
    </DashboardShell>
  );
}
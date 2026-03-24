import React from 'react';
import { Video } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function TeacherDashboard({ currentUser, setActiveTab, stats, teacherSummary }: DashboardCommonProps) {
  const assignments = teacherSummary?.assignments || [];
  const classes = teacherSummary?.liveClasses || [];

  return (
    <DashboardShell title={`Welcome back, ${currentUser?.name || 'Instructor'}`} subtitle="Your teaching command center with classes, grading, and live-room status.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 mt-6">
        <div className="space-y-6">
          <div className="card-compact">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Action Items</h3><span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">{assignments.length || 0} Pending</span></div>
            <div className="space-y-3">
              {(assignments.length ? assignments : [{ title: 'Review classwork', course: 'General' }]).map((item: any, i: number) => <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"><div><h4 className="text-sm font-bold text-white">{item.title}</h4><p className="text-xs text-zinc-400 mt-1">{item.course || item.subject || 'Classroom'}</p></div><span className="text-[10px] text-zinc-500">{item.deadline || item.due || 'Tracked'}</span></div>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[{ id: 'assignments', label: 'Assignments' }, { id: 'classroom', label: 'Classroom' }, { id: 'results', label: 'Results' }, { id: 'notes', label: 'Lesson Notes' }].map((action) => <button key={action.id} onClick={() => setActiveTab?.(action.id)} className="card-mini hover:bg-white/10 transition-colors flex flex-col justify-center items-center text-center p-6 border-white/5"><p className="text-sm font-bold text-white">{action.label}</p><p className="text-[10px] uppercase tracking-wider text-emerald-500 mt-2 font-bold">Launch</p></button>)}
          </div>
        </div>
        <div className="space-y-6">
          <div className="card-compact bg-linear-to-b from-blue-900/10 to-transparent border-blue-500/10"><div className="flex items-center gap-2 mb-4"><Video size={16} className="text-blue-400" /><h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Today's Schedule</h3></div><div className="space-y-3">{(classes.length ? classes : [{ title: 'Live class', time: 'Today', subject: 'General' }]).map((cls: any, i: number) => <div key={i} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5"><div><p className="text-[10px] font-mono text-zinc-400">{cls.time || cls.schedule}</p><h4 className="text-sm font-bold text-white mt-1">{cls.subject || cls.title}</h4></div></div>)}</div></div>
          <div className="card-compact"><h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Class Analytics</h3><div className="space-y-4">{[['Average Attendance', '92%'], ['Assignment Completion', '88%'], ['Avg. Performance Grade', '84%']].map(([label, value]) => <div key={label as string}><div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5"><span className="text-zinc-500">{label}</span><span className="text-blue-400">{value}</span></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: value }} /></div></div>)}</div></div>
        </div>
      </div>
    </DashboardShell>
  );
}
import React from 'react';
import { BookOpen, TrendingUp, Video } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { StatGrid } from './StatGrid';
import type { DashboardCommonProps } from './types';

export function StudentDashboard({ currentUser, setActiveTab, stats, studentSummary, liveClassData, announcements }: DashboardCommonProps) {
  const nextLiveClass = studentSummary?.liveClasses?.[0] || liveClassData?.[0] || { title: 'Live class', schedule: 'Today', attendees: 0, limit: 0 };
  const notes = announcements?.length ? announcements : ['School feed is empty.'];

  return (
    <DashboardShell title={`Welcome back, ${currentUser?.name || 'Student'}`} subtitle="Your dashboard follows the academic, attendance, and live-class workflow.">
      <StatGrid stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-compact bg-linear-to-br from-emerald-600/10 via-white/2 to-transparent border-emerald-500/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500 mb-3">Student Intelligence Screen</p>
            <h3 className="text-2xl font-bold text-white mb-2">{studentSummary?.upcomingAssignment?.title || 'Upcoming assignment'}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{studentSummary?.upcomingAssignment?.note || 'Assignments, attendance, and live classes are shown here.'}</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Assignment Countdown', studentSummary?.stats?.pendingAssignments || '0'],
                ['Next Exam', studentSummary?.stats?.latestAverage || '—'],
                ['Attendance', '96%'],
                ['Farming Rewards', studentSummary?.stats?.submittedAssignments || '0'],
              ].map(([label, value]) => (
                <div key={label as string} className="card-mini">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
                  <p className="text-xl font-bold text-white mt-2">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card-compact">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Lesson notes', icon: <BookOpen size={16} className="text-blue-400" /> },
                { label: 'Practice loops', icon: <TrendingUp size={16} className="text-emerald-400" /> },
                { label: 'Live class', icon: <Video size={16} className="text-violet-400" /> },
              ].map((item) => (
                <button key={item.label} onClick={() => setActiveTab?.('classroom')} className="rounded-2xl border border-white/5 bg-white/3 p-4 text-left transition-all hover:border-emerald-500/30">
                  {item.icon}
                  <p className="mt-3 text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-400">Open the current workspace.</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Upcoming exam</h3>
            <p className="text-lg font-bold text-white">{studentSummary?.nextExam?.title || 'Next exam'}</p>
            <p className="text-xs text-zinc-400 mt-2">{studentSummary?.nextExam?.window || 'Exam window will appear here.'}</p>
          </div>
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Next live class</h3>
            <p className="text-lg font-bold text-white">{nextLiveClass.title}</p>
            <p className="text-xs text-zinc-400 mt-2">{nextLiveClass.schedule} • {nextLiveClass.attendees || 0}/{nextLiveClass.limit || 0}</p>
            <button onClick={() => setActiveTab?.('classroom')} className="mt-4 w-full rounded-xl bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-600">Open Live Class</button>
          </div>
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Notifications</h3>
            <div className="space-y-2">
              {notes.slice(0, 4).map((note: any, idx) => <div key={idx} className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs text-zinc-300">{typeof note === 'string' ? note : note.title || 'Update'}</div>)}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
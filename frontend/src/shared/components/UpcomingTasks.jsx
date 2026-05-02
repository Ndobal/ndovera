import React from 'react';
import { ChartPieIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/solid';

const tasks = [
  { id: 1, title: 'Math Assignment 4', course: 'Mathematics 101', due: 'Today, 11:59 PM', status: 'pending', icon: ClockIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 2, title: 'Physics Lab Report', course: 'Physics 202', due: 'Tomorrow, 5:00 PM', status: 'pending', icon: ClockIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 3, title: 'History Essay', course: 'History 105', due: 'Completed', status: 'done', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 4, title: 'Chemistry Quiz', course: 'Chemistry 101', due: 'Missed', status: 'missed', icon: XCircleIcon, color: 'text-red-500', bg: 'bg-red-50' },
];

export default function UpcomingTasks() {
  return (
    <div className="bg-white glass-surface p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg command-title text-slate-800 neon-title flex items-center gap-2">
          <ChartPieIcon className="w-5 h-5 text-emerald-600" />
          Upcoming Tasks
        </h2>
        <span className="micro-label accent-rose flex items-center gap-2"><span className="live-dot" /> Live</span>
      </div>
      
      <div className="space-y-4">
        {tasks.map(task => (
          <div key={task.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-cyan-300/20">
            <div className={`p-2 rounded-full ${task.bg}`}>
              <task.icon className={`w-5 h-5 ${task.color}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">{task.title}</h3>
              <p className="text-sm text-slate-500 neon-subtle">{task.course}</p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-medium micro-label ${task.status === 'pending' ? 'text-amber-600' : task.status === 'done' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {task.due}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

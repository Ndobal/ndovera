import React from 'react';
import { SparklesIcon, CalendarDaysIcon, BookOpenIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

export default function DailySchedule() {
  const schedule = [];

  return (
    <div className="bg-white glass-surface p-6 rounded-3xl shadow-sm border border-slate-100 mt-6 flex flex-col transition-all duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="micro-label text-slate-500 neon-subtle mb-1">Timeline</p>
          <h2 className="text-lg command-title text-slate-800 neon-title">Today's Schedule</h2>
        </div>
        <span className="text-sm font-medium text-slate-500 neon-subtle bg-slate-100 dark:glass-chip px-3 py-1 rounded-full mono-metric">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100"></div>

        <div className="space-y-6 relative z-10">
          {schedule.length > 0 ? schedule.map((item, index) => (
            <div key={index} className="flex gap-4">
              <div className={`w-8 h-8 rounded-full bg-${item.color}-100 flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm`}>
                <item.icon className={`w-4 h-4 text-${item.color}-600`} />
              </div>
              <div className="flex-1 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-slate-800">{item.subject}</h3>
                    <p className="text-sm text-slate-500 neon-subtle flex items-center gap-1 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full bg-${item.color}-500 inline-block`}></span>
                      {item.type}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700 bg-slate-50 dark:glass-chip px-2 py-1 rounded-md mono-metric">{item.time}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/20 p-4 text-center">
              <p className="micro-label accent-amber">No timetable loaded</p>
              <p className="mt-2 text-sm text-slate-300">Today&apos;s schedule will show here when a live timetable feed is available.</p>
            </div>
          )}
        </div>
      </div>
      
      <button className="w-full mt-6 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
        View Full Timetable
      </button>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StaffAttendanceMarking from './components/StaffAttendanceMarking';
import AttendanceAnalytics from './components/AttendanceAnalytics';
import AuditLog from './components/AuditLog';
import OfflineQueueManager from './components/OfflineQueueManager';
import StaffSignIn, { isSignedIn } from './components/StaffSignIn';

const TABS = [
  { id: 'signin', label: 'Clock In', icon: '📲', roles: ['admin', 'staff', 'teacher', 'hos', 'owner', 'security'] },
  { id: 'marking', label: 'Mark Attendance', icon: '✓', roles: ['admin', 'staff', 'security'] },
  { id: 'analytics', label: 'Analytics', icon: '📊', roles: ['admin', 'hos', 'owner'] },
  { id: 'audit', label: 'Audit Log', icon: '📋', roles: ['admin', 'hos', 'owner', 'security'] },
  { id: 'queue', label: 'Offline Queue', icon: '🔄', roles: ['admin', 'staff'] },
];

export const AttendanceEngine = ({ userRole = 'admin' }) => {
  const availableTabs = TABS.filter(tab => tab.roles.includes(userRole));
  const [activeView, setActiveView] = useState(availableTabs[0]?.id || 'marking');
  const allowOverride = ['admin', 'security'].includes(userRole);

  return (
    <div className="dashboard-bg min-h-screen">
      {/* Tab Navigation — organized for mobile and desktop */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
            {availableTabs.map(tab => {
              const active = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'border border-slate-200 bg-white text-[#191970] hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
        >
          {activeView === 'signin' && <ClockInPanel />}
          {activeView === 'marking' && <StaffAttendanceMarking allowOverride={allowOverride} />}
          {activeView === 'analytics' && <AttendanceAnalytics />}
          {activeView === 'audit' && <AuditLog />}
          {activeView === 'queue' && <OfflineQueueManager />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function ClockInPanel() {
  const [open, setOpen] = useState(false);
  const morningDone = isSignedIn('morning');
  const afternoonDone = isSignedIn('afternoon');

  return (
    <div className="dashboard-bg min-h-[60vh] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-600/20">
          <h1 className="text-xl font-bold">Clock in</h1>
          <p className="text-sm text-blue-100">Scan the school QR to sign in. Twice daily — morning is compulsory.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={`rounded-2xl border px-4 py-3 ${morningDone ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800/50'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#191970] dark:text-slate-200">☀️ Morning</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{morningDone ? 'Signed in ✓' : 'Compulsory · pending'}</p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${afternoonDone ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800/50'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#191970] dark:text-slate-200">🌇 Afternoon</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{afternoonDone ? 'Signed in ✓' : 'Optional · pending'}</p>
          </div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
        >
          📷 Open scanner & sign in
        </button>
      </div>

      {open && <StaffSignIn onClose={() => setOpen(false)} />}
    </div>
  );
}

export default AttendanceEngine;

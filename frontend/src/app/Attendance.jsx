import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AttendanceEngine from '../features/attendance/AttendanceEngine';
import PTAAttendanceEngine from '../features/pta-attendance/PTAAttendanceEngine';

function resolveUserRole() {
  try {
    const selected = localStorage.getItem('selectedRole');
    if (selected) return String(selected).toLowerCase();
    const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    if (authUser?.role) return String(authUser.role).toLowerCase();
    const legacy = localStorage.getItem('userRole');
    if (legacy) return String(legacy).toLowerCase();
  } catch {
    /* ignore */
  }
  return 'admin';
}

export default function Attendance() {
  const [systemType, setSystemType] = useState('staff');
  const userRole = resolveUserRole();
  const canSwitchSystem = ['admin', 'hos', 'owner'].includes(userRole);

  return (
    <div className="dashboard-bg min-h-screen">
      {/* System selector (admin / hos / owner) */}
      {canSwitchSystem && (
        <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90">
          <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6">
            <div className="flex items-center gap-2 overflow-x-auto sm:gap-3">
              <span className="shrink-0 text-sm font-bold text-[#191970] dark:text-white">System:</span>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setSystemType('staff')}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  systemType === 'staff'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'border border-slate-200 bg-white text-[#191970] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                👥 Staff Attendance
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setSystemType('pta')}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  systemType === 'pta'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'border border-slate-200 bg-white text-[#191970] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                👨‍👩‍👧 PTA Attendance
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {systemType === 'staff' ? (
        <AttendanceEngine userRole={userRole} />
      ) : (
        <PTAAttendanceEngine userRole={userRole} />
      )}
    </div>
  );
}

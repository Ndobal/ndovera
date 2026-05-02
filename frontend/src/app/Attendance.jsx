import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AttendanceEngine from '../features/attendance/AttendanceEngine';
import PTAAttendanceEngine from '../features/pta-attendance/PTAAttendanceEngine';

export default function Attendance() {
  const [systemType, setSystemType] = useState('staff');
  const userRole = localStorage.getItem('userRole') || 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* System Selector (if admin/hos) */}
      {['admin', 'hos', 'owner'].includes(userRole) && systemType !== 'ptas' && (
        <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex gap-4 items-center">
              <span className="text-white font-semibold">Select System:</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSystemType('staff')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  systemType === 'staff'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-white/10 text-slate-300 border border-white/10 hover:border-white/20'
                }`}
              >
                👥 Staff Attendance
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSystemType('pta')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  systemType === 'pta'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-white/10 text-slate-300 border border-white/10 hover:border-white/20'
                }`}
              >
                👨‍👩‍👧 PTA Attendance
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {systemType === 'staff' ? (
        <AttendanceEngine userRole={userRole} />
      ) : (
        <PTAAttendanceEngine userRole={userRole} />
      )}
    </div>
  );
}

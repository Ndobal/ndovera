import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StaffAttendanceMarking from './components/StaffAttendanceMarking';
import AttendanceAnalytics from './components/AttendanceAnalytics';
import AuditLog from './components/AuditLog';
import OfflineQueueManager from './components/OfflineQueueManager';

export const AttendanceEngine = ({ userRole = 'admin' }) => {
  const [activeView, setActiveView] = useState('marking');

  const tabs = [
    {
      id: 'marking',
      label: 'Mark Attendance',
      icon: '✓',
      description: 'Mark staff attendance using Facial, QR, or Device',
      component: StaffAttendanceMarking,
      roles: ['admin', 'staff', 'security'],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📊',
      description: 'View attendance metrics and trends',
      component: AttendanceAnalytics,
      roles: ['admin', 'hos', 'owner'],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: '📋',
      description: 'Complete compliance and marking history',
      component: AuditLog,
      roles: ['admin', 'hos', 'owner', 'security'],
    },
    {
      id: 'queue',
      label: 'Offline Queue',
      icon: '🔄',
      description: 'Manage offline attendance records',
      component: OfflineQueueManager,
      roles: ['admin', 'staff'],
    },
  ];

  const availableTabs = tabs.filter(tab => tab.roles.includes(userRole));
  // activeTab determination moved inline to tab rendering

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 py-4 overflow-x-auto">
            {availableTabs.map((tab, idx) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap relative group ${
                  activeView === tab.id
                    ? 'text-white bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 px-3 py-2 rounded border border-white/20 z-10 whitespace-nowrap text-xs text-center">
                  {tab.description}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Render the active component based on role and permission */}
          {activeView === 'marking' && <StaffAttendanceMarking allowOverride={['admin', 'security'].includes(userRole)} />}
          {activeView === 'analytics' && <AttendanceAnalytics />}
          {activeView === 'audit' && <AuditLog />}
          {activeView === 'queue' && <OfflineQueueManager />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AttendanceEngine;

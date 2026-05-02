import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PTAQRScanner from './components/PTAQRScanner';
import PTADashboard from './components/PTADashboard';
import PTAReportGenerator from './components/PTAReportGenerator';

export const PTAAttendanceEngine = ({ userRole = 'parent' }) => {
  const [activeView, setActiveView] = useState(userRole === 'parent' ? 'scanner' : 'dashboard');

  const tabs = [
    {
      id: 'scanner',
      label: 'Check-In',
      icon: '📱',
      description: 'Scan QR code to mark attendance',
      component: PTAQRScanner,
      roles: ['parent'],
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      description: 'View parent attendance and meeting analytics',
      component: PTADashboard,
      roles: ['admin', 'hos', 'owner'],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📄',
      description: 'Generate and export attendance reports',
      component: PTAReportGenerator,
      roles: ['admin', 'hos', 'owner'],
    },
  ];

  const availableTabs = tabs.filter(tab => tab.roles.includes(userRole));
  const activeTab = availableTabs.find(tab => tab.id === activeView) || availableTabs[0];
  const ActiveComponent = activeTab.component;

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
                    ? 'text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50'
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
          {/* Render the active component based on role */}
          {activeView === 'scanner' && <PTAQRScanner />}
          {activeView === 'dashboard' && <PTADashboard />}
          {activeView === 'reports' && <PTAReportGenerator />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PTAAttendanceEngine;

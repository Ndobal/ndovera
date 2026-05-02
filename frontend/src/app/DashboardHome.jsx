import React from 'react';
import { motion } from 'framer-motion';

import DashboardStats from './DashboardStats';
import QuickActions from '../shared/components/QuickActions';
import PerformanceChart from '../shared/components/PerformanceChart';
import UpcomingTasks from '../shared/components/UpcomingTasks';
import DailySchedule from '../shared/components/DailySchedule';
import UserProfileDropdown from '../shared/components/UserProfileDropdown';
import ThemeToggle from '../shared/components/ThemeToggle';
import RoleSwitcher from '../shared/components/RoleSwitcher';

// Container animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardHome({ toggleTheme, isDark }) {
  return (
    <motion.div 
      className="p-8 max-w-7xl mx-auto dark:bg-slate-950 transition-colors duration-300 relative"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div className="flex items-center justify-between mb-8" variants={itemVariants}>
        <div>
          <p className="micro-label text-slate-500 neon-subtle mb-2 flex items-center gap-2"><span className="live-dot" /> Node Live</p>
          <h1 className="text-3xl command-title text-slate-800 dark:text-slate-100 neon-title">Welcome to NDOVERA</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 neon-subtle">Here's what's happening with your academic progress today.</p>
        </div>
        <div className="flex items-center gap-4 relative">
          <RoleSwitcher />
          <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
          <QuickActions />
          <UserProfileDropdown />
        </div>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <DashboardStats />
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-6">
          <motion.div className="h-96 frost-hover rounded-xl transition-all duration-300" variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <PerformanceChart />
          </motion.div>
          <motion.div className="frost-hover rounded-xl transition-all duration-300" variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <UpcomingTasks />
          </motion.div>
        </div>
        
        <motion.div className="lg:col-span-1 frost-hover rounded-xl transition-all duration-300" variants={itemVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <DailySchedule />
        </motion.div>
      </div>
    </motion.div>
  );
}

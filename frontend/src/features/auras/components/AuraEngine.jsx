import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import AuraBalance from './AuraBalance';
import StaffGifting from './StaffGifting';
import StaffToStaffGifting from './StaffToStaffGifting';
import StaffFarmingMode from './StaffFarmingMode';
import TransactionLog from './TransactionLog';

/**
 * AuraEngine Component
 * Main orchestrator for the complete Aura system
 * Manages balance, gifting, farming mode, and transactions
 */
export default function AuraEngine() {
  const [activeTab, setActiveTab] = useState('balance');

  // Mock user data - replace with actual user context
  const currentUser = {
    id: 'STF-001',
    name: 'Jane Williams',
    role: 'teacher',
  };

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: 'balance',
        label: 'Balance',
        icon: '💰',
        component: AuraBalance,
      },
      {
        id: 'transactions',
        label: 'Transactions',
        icon: '📋',
        component: TransactionLog,
      },
    ];

    // Add role-specific tabs
    if (currentUser.role === 'teacher' || currentUser.role === 'admin') {
      baseTabs.splice(2, 0, {
        id: 'gift_students',
        label: 'Reward Students',
        icon: '🎁',
        component: StaffGifting,
      });

      baseTabs.splice(3, 0, {
        id: 'gift_staff',
        label: 'Team Recognition',
        icon: '👥',
        component: StaffToStaffGifting,
      });

      baseTabs.push({
        id: 'farming',
        label: 'Farming Mode',
        icon: '🌱',
        component: StaffFarmingMode,
      });
    }

    return baseTabs;
  }, [currentUser.role]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ✨ Aura System
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Earn, gift, and manage your learning rewards
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-4 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all rounded-t-lg border-b-2 ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'balance' && <AuraBalance userId={currentUser.id} variant="card" />}

        {activeTab === 'transactions' && (
          <TransactionLog userId={currentUser.id} userRole={currentUser.role} />
        )}

        {activeTab === 'gift_students' && (
          <StaffGifting staffId={currentUser.id} staffName={currentUser.name} />
        )}

        {activeTab === 'gift_staff' && (
          <StaffToStaffGifting staffId={currentUser.id} staffName={currentUser.name} />
        )}

        {activeTab === 'farming' && (
          <StaffFarmingMode staffId={currentUser.id} staffName={currentUser.name} />
        )}
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl cursor-pointer"
        >
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">🚀</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
            Quick Start
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            New to Auras? Enable Farming Mode to start earning.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl cursor-pointer"
        >
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">🎯</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
            Goals
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Reach 5 months farming to unlock staff gifting.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl cursor-pointer"
        >
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">💝</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
            Share Joy
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Reward students and colleagues for excellence.
          </p>
        </motion.div>
      </div>

      {/* Information Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        {/* How it Works */}
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-4">
            ✨ How Auras Work
          </h3>
          <ul className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
            <li className="flex gap-3">
              <span>1️⃣</span>
              <span>Earn Auras through engagement, assignments, and learning activities</span>
            </li>
            <li className="flex gap-3">
              <span>2️⃣</span>
              <span>Spend Auras on premium features like AI Tutor and Library books</span>
            </li>
            <li className="flex gap-3">
              <span>3️⃣</span>
              <span>Gift Auras to students to recognize achievement</span>
            </li>
            <li className="flex gap-3">
              <span>4️⃣</span>
              <span>Staff with 5+ months farming mode can gift to colleagues</span>
            </li>
          </ul>
        </div>

        {/* Rules & Rewards */}
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-4">
            🎯 Your Goals
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                Reach 2+ Months Farming
              </p>
              <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-1">
                Unlock cashout eligibility to withdraw earnings
              </p>
            </div>
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                Reach 5+ Months Farming
              </p>
              <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-1">
                Gift Auras to fellow staff members for collaboration
              </p>
            </div>
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                Maintain Your Streak
              </p>
              <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-1">
                Keep farming mode active to prevent streak reset
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

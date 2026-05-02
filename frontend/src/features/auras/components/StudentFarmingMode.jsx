import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuraBalance } from '../hooks/useAuraBalance';
import { formatAuras, isAurasAboutToReset, getDaysUntilReset } from '../utils/auraHelpers';

/**
 * StudentFarmingMode Component
 * Displays farming mode earnings and spending options for students
 * Students CANNOT cashout, only spend on AI Tutor & library books
 */
export default function StudentFarmingMode({ studentId, studentName }) {
  const { balance, loading } = useAuraBalance(studentId);
  const [daysUntilReset, setDaysUntilReset] = useState(null);
  const [shouldShowResetAlert, setShouldShowResetAlert] = useState(false);

  useEffect(() => {
    if (balance?.resetSchedule?.resetDate) {
      const days = getDaysUntilReset(balance.resetSchedule.resetDate);
      setDaysUntilReset(days);
      setShouldShowResetAlert(isAurasAboutToReset(balance.resetSchedule.resetDate));
    }
  }, [balance]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">
              Current Balance
            </p>
            <p className="text-4xl font-bold text-green-900 dark:text-green-100">
              {formatAuras(balance?.current || 0)}
            </p>
          </div>
          <div className="text-6xl">✨</div>
        </div>
      </motion.div>

      {/* Reset Alert */}
      {shouldShowResetAlert && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <div className="flex gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Auras Will Reset Soon
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You have <strong>{daysUntilReset} days</strong> to spend unused Auras.
                After that, they will reset automatically.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* How to Earn */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          🌱 How to Earn Auras
        </h3>
        <div className="space-y-3">
          {[
            { icon: '📚', title: 'Complete Lessons', desc: 'Read lesson notes and mark as complete' },
            { icon: '✍️', title: 'Submit Assignments', desc: 'Complete and submit approved assignments' },
            { icon: '📖', title: 'Read Library Books', desc: 'Explore and read books in the library' },
            { icon: '🧪', title: 'Practice Exercises', desc: 'Complete CBT and practice tests' },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Spending Options */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          🛒 Spend Your Auras
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Note: You cannot withdraw Auras as cash. Only use them within the app.
        </p>

        <div className="space-y-3">
          {[
            {
              icon: '🤖',
              title: 'AI Tutor Help',
              desc: 'Get homework help & lesson explanations',
              cost: 'Variable',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              icon: '📚',
              title: 'Premium Books',
              desc: 'Access exclusive library content',
              cost: 'Variable',
              color: 'from-purple-500 to-pink-500',
            },
          ].map((option, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02 }}
              className={`p-4 bg-gradient-to-r ${option.color} bg-opacity-10 dark:bg-opacity-20 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{option.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{option.desc}</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-gray-700 dark:text-gray-300">
                  {option.cost}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Important Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 About Farming Mode
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>✓ Optional feature you can enable</li>
            <li>✓ Ads support your learning</li>
            <li>✓ Safe, in-app currency</li>
            <li>✓ No personal info shared</li>
          </ul>
        </div>

        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
            ⚠️ Important Notes
          </p>
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
            <li>✓ NO academic interference</li>
            <li>✓ Ads OFF during exams</li>
            <li>✓ Cannot be withdrawn as cash</li>
            <li>✓ Reset every 3 months</li>
          </ul>
        </div>
      </div>

      {/* Reset Schedule Info */}
      {balance?.resetSchedule && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Next reset: <strong>{new Date(balance.resetSchedule.resetDate).toLocaleDateString()}</strong>
            {daysUntilReset && ` (${daysUntilReset} days remaining)`}
          </p>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useFarmingMode } from '../hooks/useAuraBalance';
import { isEligibleForStaffGifting, isEligibleForCashout } from '../utils/auraHelpers';

/**
 * StaffFarmingMode Component
 * Displays farming mode status and eligibility for staff gifting and cashout
 */
export default function StaffFarmingMode({ staffId, staffName }) {
  const { farmingMode, loading, toggleFarmingMode } = useFarmingMode(staffId);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    try {
      setIsToggling(true);
      await toggleFarmingMode(!farmingMode?.enabled);
    } catch (error) {
      console.error('Error toggling farming mode:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (!farmingMode) return null;

  const isEligibleForGifting = isEligibleForStaffGifting(farmingMode);
  const isEligibleForCashoutCheck = isEligibleForCashout(farmingMode);
  const monthsToGifting = Math.max(0, 5 - (farmingMode.consecutiveMonths || 0));
  const monthsToCashout = Math.max(0, 2 - (farmingMode.consecutiveMonths || 0));

  return (
    <div className="space-y-6">
      {/* Farming Mode Toggle */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              🌱 Farming Mode
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Earn Auras through engagement and unlock special benefits
            </p>
          </div>

          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
              farmingMode.enabled
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white'
            } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {farmingMode.enabled ? '✓ Active' : 'Inactive'}
          </button>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {farmingMode.enabled
            ? 'Farming mode is active. You are earning Auras.'
            : 'Farming mode is inactive. Enable it to start earning.'}
        </div>
      </div>

      {/* Streak & Eligibility */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Streak */}
        <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🔥</span>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
              {farmingMode.currentStreak} MONTHS
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Current Streak
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Consecutive months active
          </p>
        </div>

        {/* Staff Gifting Eligibility */}
        <motion.div
          animate={{
            scale: isEligibleForGifting ? 1.02 : 1,
          }}
          className={`p-4 border rounded-xl ${
            isEligibleForGifting
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{isEligibleForGifting ? '✅' : '⏳'}</span>
            <span className={`text-xs font-bold ${
              isEligibleForGifting
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isEligibleForGifting
                ? 'ELIGIBLE'
                : `${monthsToGifting} MONTHS LEFT`}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Staff Gifting
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Gift Auras to colleagues
          </p>
        </motion.div>

        {/* Cashout Eligibility */}
        <motion.div
          animate={{
            scale: isEligibleForCashoutCheck ? 1.02 : 1,
          }}
          className={`p-4 border rounded-xl ${
            isEligibleForCashoutCheck
              ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{isEligibleForCashoutCheck ? '💰' : '⏳'}</span>
            <span className={`text-xs font-bold ${
              isEligibleForCashoutCheck
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isEligibleForCashoutCheck
                ? 'ELIGIBLE'
                : `${monthsToCashout} MONTHS LEFT`}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Cashout
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Withdraw earnings
          </p>
        </motion.div>
      </div>

      {/* Monthly Earnings */}
      {farmingMode.monthlyEarnings && farmingMode.monthlyEarnings.length > 0 && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            📊 Monthly Earnings
          </h4>

          <div className="space-y-3">
            {farmingMode.monthlyEarnings.slice(-6).map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {entry.month}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
                      style={{
                        width: `${Math.min((entry.earned / 500) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 w-16 text-right">
                    +{entry.earned}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Total Earned (Last 6 months): <strong className="text-green-600 dark:text-green-400">
                +{farmingMode.monthlyEarnings
                  .slice(-6)
                  .reduce((sum, m) => sum + m.earned, 0)} Auras
              </strong>
            </p>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 How Farming Mode Works
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>✓ Ads appear outside exam time</li>
            <li>✓ Earn Auras for engagement</li>
            <li>✓ No academic interference</li>
            <li>✓ Track earnings monthly</li>
          </ul>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
            🎯 Unlock Benefits at...
          </p>
          <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
            <li>2 Months: Cashout eligibility</li>
            <li>5 Months: Staff gifting access</li>
            <li>Maintain streak for best output</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

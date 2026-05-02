import React, { useMemo } from 'react';
import { useAuraBalance } from '../hooks/useAuraBalance';
import { getAuraTier, getProgressToNextTier, formatAuras } from '../utils/auraHelpers';

/**
 * AuraBalance Component
 * Displays user's current Aura balance with tier information and progress
 */
export default function AuraBalance({ userId, variant = 'card' }) {
  const { balance, loading, error } = useAuraBalance(userId);

  const tierInfo = useMemo(() => {
    if (!balance) return null;
    return getAuraTier(balance.balance || 0);
  }, [balance]);

  const progressPercent = useMemo(() => {
    if (!balance) return 0;
    return getProgressToNextTier(balance.balance || 0);
  }, [balance]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
        Failed to load Aura balance
      </div>
    );
  }

  if (!balance) return null;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <span className="text-2xl">{tierInfo.badge}</span>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatAuras(balance.balance || 0)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{tierInfo.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aura Balance</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Your learning rewards</p>
        </div>
        <span className="text-4xl">{tierInfo.badge}</span>
      </div>

      <div className="mb-6">
        <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-yellow-600">
          {balance.balance || 0}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {tierInfo.description}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">This Period</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            +{balance.earned || 0} earned
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Spent</span>
          <span className="font-semibold text-red-600 dark:text-red-400">
            -{balance.spent || 0}
          </span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-amber-200 dark:border-amber-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Progress to Next Tier
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

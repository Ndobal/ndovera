import React, { useState } from 'react';
import { useAuraTransactions } from '../hooks/useAuraBalance';
import {
  getTransactionTypeLabel,
  getCategoryBadge,
  formatTransactionTime,
} from '../utils/auraHelpers';

/**
 * TransactionLog Component
 * Displays all Aura transactions for a user
 */
export default function TransactionLog({ userId, userRole = 'student' }) {
  const [filter, setFilter] = useState('all');
  const { transactions, loading, error } = useAuraTransactions(userId, {
    type: filter === 'all' ? undefined : filter,
  });

  const filterOptions = [
    { value: 'all', label: 'All Transactions' },
    { value: 'earned', label: 'Earned' },
    { value: 'spent', label: 'Spent' },
    { value: 'gifted', label: 'Gifted' },
    { value: 'received_gift', label: 'Received' },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
        Failed to load transactions
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📋 Transaction History
        </h3>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                filter === option.value
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {transactions && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((transaction) => {
            const typeLabel = getTransactionTypeLabel(transaction.type);
            const categoryBadge = getCategoryBadge(transaction.category);
            const isFund = ['earned', 'received_gift', 'transferred'].includes(
              transaction.type
            );

            return (
              <div
                key={transaction.id}
                className={`p-4 border rounded-lg ${
                  categoryBadge.color
                } border-gray-200 dark:border-gray-700`}
              >
                <div className="flex items-center justify-between">
                  {/* Left Side: Icon, Description */}
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl">{categoryBadge.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {transaction.reason}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formatTransactionTime(transaction.timestamp)}
                      </p>

                      {/* Gift Details */}
                      {(transaction.giftedBy || transaction.giftedTo) && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          {transaction.giftedBy && `🎁 From ${transaction.giftedBy}`}
                          {transaction.giftedTo && `🎁 To ${transaction.giftedTo}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Amount and Type */}
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold mb-1 ${
                        isFund
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isFund ? '+' : '-'}{transaction.amount}
                    </div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        typeLabel.color
                      }`}
                    >
                      {typeLabel.icon} {typeLabel.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {filter === 'all'
              ? 'Start earning, spending, or gifting Auras!'
              : `No ${filter} transactions found`}
          </p>
        </div>
      )}

      {/* Summary Stats */}
      {transactions && transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              +
              {transactions
                .filter((t) => t.type === 'earned' || t.type === 'received_gift')
                .reduce((sum, t) => sum + t.amount, 0)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Earned</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              -
              {transactions
                .filter((t) => t.type === 'spent')
                .reduce((sum, t) => sum + t.amount, 0)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Spent</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {transactions.filter((t) => t.type === 'gifted').length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Gifted</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {transactions.filter((t) => t.type === 'received_gift').length}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Received</p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuraBalance } from '../hooks/useAuraBalance';
import { formatAuras } from '../utils/auraHelpers';

/**
 * ParentFarmingMode Component
 * Allows parents to:
 * - View children's Aura balances
 * - Transfer Auras to children
 * - Monitor spending
 * Parents CANNOT cashout themselves
 */
export default function ParentFarmingMode({ parentId, children = [] }) {
  const [selectedChild, setSelectedChild] = useState(children[0]?.id || null);
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [message, setMessage] = useState(null);

  const childBalance = useAuraBalance(selectedChild);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferAmount || isNaN(transferAmount) || transferAmount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    try {
      setIsTransferring(true);
      // This will call the auraService.transferAuresToChild method
      // TODO: Implement transfer logic in service
      setMessage({ type: 'success', text: `Transferred ${transferAmount} Auras to ${selectedChild}` });
      setTransferAmount('');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMessage(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Children Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((child) => (
          <motion.button
            key={child.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedChild(child.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedChild === child.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <p className="font-semibold text-gray-900 dark:text-white">{child.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{child.className}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">
                {formatAuras(child.balance || 0)}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Selected Child Details */}
      {selectedChild && childBalance && (
        <>
          {/* Transfer Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              💳 Transfer Auras
            </h3>

            <form onSubmit={handleTransfer} className="space-y-4">
              {/* Message Alert */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-3 rounded-lg text-sm font-medium ${
                    message.type === 'success'
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  }`}
                >
                  {message.text}
                </motion.div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount to Transfer
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium">
                    ✨
                  </span>
                </div>
              </div>

              {/* Info Text */}
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Your current balance: <strong>{formatAuras(childBalance?.balance?.current || 0)}</strong>
              </p>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isTransferring || !transferAmount}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isTransferring ? 'Transferring...' : 'Transfer to Child'}
              </button>
            </form>

            {/* Important Note */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                ℹ️ <strong>Note:</strong> Once transferred, your child can spend these Auras on AI Tutor and premium books.
              </p>
            </div>
          </motion.div>

          {/* Child's Recent Transactions */}
          {childBalance?.transactions && childBalance.transactions.length > 0 && (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                📋 Recent Activity
              </h3>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {childBalance.transactions.slice(0, 10).map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {tx.type === 'earned' ? '⬆️' : '⬇️'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {tx.reason || tx.type}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold ${tx.type === 'earned' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Parent Cannot Cashout Info */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
          👨‍👩‍👧 Parent Features
        </p>
        <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
          <li>✓ View children's Aura balances</li>
          <li>✓ Transfer Auras to children</li>
          <li>✓ Monitor their spending</li>
          <li>✓ Receive alerts before reset</li>
          <li>❌ Cannot withdraw cash yourself</li>
        </ul>
      </div>

      {/* Safety & Control Info */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
          🔒 Safe & Controlled
        </p>
        <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
          <li>✓ Auras are safe, in-app currency only</li>
          <li>✓ No real money involved</li>
          <li>✓ Children learn money management</li>
          <li>✓ Completely under your control</li>
        </ul>
      </div>
    </div>
  );
}

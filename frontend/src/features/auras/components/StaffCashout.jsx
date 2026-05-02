import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useCashout } from '../hooks/useAuraBalance';
import { formatAuras, getCashoutEligibilityDetails } from '../utils/auraHelpers';

/**
 * StaffCashout Component
 * Handles staff cashout requests after 2 months of farming
 * Staff must have cumulative Auras and 2+ months active farming mode
 */
export default function StaffCashout({ staffId, staffName, balance, farmingMode }) {
  const { requestCashout, isLoading } = useCashout(staffId);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    bankName: '',
    accountNumber: '',
    mobileWallet: '',
  });
  const [message, setMessage] = useState(null);

  const eligibilityDetails = getCashoutEligibilityDetails(farmingMode);
  const isEligible = eligibilityDetails.eligible;

  const handleAmountChange = (e) => {
    let value = e.target.value;
    if (value && !isNaN(value)) {
      value = Math.min(Math.max(value, 100), balance?.current || 0);
    }
    setFormData({ ...formData, amount: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || isNaN(formData.amount)) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount < 100) {
      setMessage({ type: 'error', text: 'Minimum cashout amount is 100 Auras' });
      return;
    }

    if (amount > (balance?.current || 0)) {
      setMessage({ type: 'error', text: 'Insufficient Auras' });
      return;
    }

    if (formData.paymentMethod === 'bank_transfer' && !formData.bankName) {
      setMessage({ type: 'error', text: 'Please enter bank name' });
      return;
    }

    if (formData.paymentMethod === 'bank_transfer' && !formData.accountNumber) {
      setMessage({ type: 'error', text: 'Please enter account number' });
      return;
    }

    if (formData.paymentMethod === 'mobile_wallet' && !formData.mobileWallet) {
      setMessage({ type: 'error', text: 'Please enter mobile wallet number' });
      return;
    }

    try {
      await requestCashout(amount, formData.paymentMethod, formData);
      setMessage({
        type: 'success',
        text: `Cashout request submitted for ${formatAuras(amount)}. You have 7 days to claim.`,
      });
      setTimeout(() => {
        setShowForm(false);
        setFormData({
          amount: '',
          paymentMethod: 'bank_transfer',
          bankName: '',
          accountNumber: '',
          mobileWallet: '',
        });
        setMessage(null);
      }, 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Eligibility Status */}
      <div
        className={`p-6 rounded-xl border-2 ${
          isEligible
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-600'
            : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-300 dark:border-gray-600'
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-semibold mb-1 ${isEligible ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {isEligible ? '✅ Eligible for Cashout' : '⏳ Not Yet Eligible'}
            </p>
            <p className={`text-lg font-bold mb-2 ${isEligible ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-gray-100'}`}>
              {isEligible
                ? 'You can cash out now!'
                : `You need ${eligibilityDetails.monthsRemaining} more months of farming`}
            </p>
            <p className={`text-sm ${isEligible ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {eligibilityDetails.message}
            </p>
          </div>
          <div className="text-4xl text-center">
            {isEligible ? '💰' : '⏳'}
          </div>
        </div>
      </div>

      {/* Current Balance */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Available to Cashout
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatAuras(balance?.current || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Minimum: 100 ✨</p>
            <p className="text-2xl">✨</p>
          </div>
        </div>
      </div>

      {/* Cashout Form */}
      {isEligible && (
        <motion.div
          layout
          className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all"
            >
              💰 Request Cashout
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Cashout Request
              </h3>

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
                  Amount (Auras)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={handleAmountChange}
                    placeholder="Min 100"
                    min="100"
                    max={balance?.current || 0}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                  <span className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium">
                    ✨
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Available: {formatAuras(balance?.current || 0)}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                  <option value="mobile_wallet">📱 Mobile Wallet</option>
                </select>
              </div>

              {/* Bank Details */}
              {formData.paymentMethod === 'bank_transfer' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., First Bank"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="Your account number"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                </>
              )}

              {/* Mobile Wallet Details */}
              {formData.paymentMethod === 'mobile_wallet' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mobile Wallet Number
                  </label>
                  <input
                    type="tel"
                    value={formData.mobileWallet}
                    onChange={(e) => setFormData({ ...formData, mobileWallet: e.target.value })}
                    placeholder="Your phone number"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              )}

              {/* Important Info */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ <strong>7-Day Window:</strong> You have 7 days to claim your cashout. After that, it resets automatically.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </motion.div>
      )}

      {/* Cashout Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            📋 Cashout Requirements
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>✓ 2+ months of active farming</li>
            <li>✓ Minimum 100 Auras</li>
            <li>✓ Valid payment details</li>
            <li>✓ Claim within 7 days</li>
          </ul>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
            ⏱️ Timeline
          </p>
          <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
            <li>Month 1-2: Accumulate Auras</li>
            <li>Month 2 (18th): Eligible</li>
            <li>Request any time after Month 2</li>
            <li>7-day window to claim</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGiftToStaff } from '../hooks/useAuraBalance';
import { useAuraBalance } from '../hooks/useAuraBalance';
import { useFarmingMode } from '../hooks/useAuraBalance';
import { validateGiftAmount, getStaffGiftingRestrictionMessage, formatAuras } from '../utils/auraHelpers';

/**
 * StaffToStaffGifting Component
 * Only staff with 5+ consecutive months of farming mode can gift to other staff
 */
export default function StaffToStaffGifting({ staffId, staffName }) {
  const { balance } = useAuraBalance(staffId);
  const { farmingMode } = useFarmingMode(staffId);
  const { giftAuras, error: giftError } = useGiftToStaff();

  const [formData, setFormData] = useState({
    recipientId: '',
    recipientName: '',
    amount: '',
    reason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const staffOptions = [
    { id: 'STF-002', name: 'Mark Okorie (ICT Admin)' },
    { id: 'STF-003', name: 'Grace Okafor (Administrator)' },
    { id: 'STF-004', name: 'Ahmed Hassan (Teacher)' },
  ];

  const reasonOptions = [
    'Collaborative excellence on curriculum design',
    'Support with student mentoring program',
    'Outstanding lesson planning contribution',
    'Extra professional development support',
    'Department project leadership',
    'Student success initiative',
    'School improvement initiative',
    'Peer mentoring excellence',
  ];

  // Check eligibility
  const isEligible = farmingMode?.isEligibleForStaffGifting || false;
  const restrictionMessage = getStaffGiftingRestrictionMessage(farmingMode, null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationError('');
  };

  const handleRecipientSelect = (e) => {
    const selectedId = e.target.value;
    const selected = staffOptions.find((s) => s.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      recipientId: selected?.id || '',
      recipientName: selected?.name || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setValidationError('');

    // Check eligibility first
    if (!isEligible) {
      setValidationError(restrictionMessage);
      return;
    }

    // Validation
    if (!formData.recipientId) {
      setValidationError('Please select a staff member');
      return;
    }

    if (!formData.amount || isNaN(formData.amount)) {
      setValidationError('Please enter a valid Aura amount');
      return;
    }

    const amount = parseInt(formData.amount);
    const validation = validateGiftAmount(amount, balance?.balance || 0, 10); // Min 10 for staff

    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    if (!formData.reason) {
      setValidationError('Please select or enter a reason');
      return;
    }

    try {
      setIsSubmitting(true);
      await giftAuras(staffId, formData.recipientId, amount, formData.reason);
      setSuccessMessage(
        `Successfully gifted ${amount} Auras to ${formData.recipientName}!`
      );
      setFormData({
        recipientId: '',
        recipientName: '',
        amount: '',
        reason: '',
      });

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setValidationError(err.message || 'Failed to gift Auras');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          👥 Staff Collaboration Recognition
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gift Auras to colleagues for exceptional collaboration
        </p>
      </div>

      {/* Eligibility Status */}
      {isEligible ? (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Eligible for Staff Gifting
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {farmingMode?.consecutiveMonths} months of continuous farming mode
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-1">⏳</span>
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Not Yet Eligible
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {restrictionMessage}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                    style={{
                      width: `${((farmingMode?.consecutiveMonths || 0) / 5) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {farmingMode?.consecutiveMonths || 0}/5
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Balance */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Your Available Balance: <strong>{formatAuras(balance?.balance || 0)}</strong>
        </p>
      </div>

      {isEligible && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Staff Member *
            </label>
            <select
              name="recipientId"
              value={formData.recipientId}
              onChange={handleRecipientSelect}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a colleague...</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auras Amount (Min 10) *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                min="10"
                max={balance?.balance || 0}
                placeholder="Enter amount..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">Max</p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {balance?.balance || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Recognition *
            </label>
            <select
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a reason...</option>
              {reasonOptions.map((reason, idx) => (
                <option key={idx} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Error Message */}
          {(validationError || giftError) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p className="text-sm text-red-700 dark:text-red-300">
                {validationError || giftError}
              </p>
            </motion.div>
          )}

          {/* Success Message */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !formData.recipientId || !formData.amount}
            className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmitting ? 'Sending Recognition...' : '👥 Send Auras'}
          </button>
        </form>
      )}

      {!isEligible && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please enable and maintain Farming Mode for 5 consecutive months to unlock staff gifting.
          </p>
        </div>
      )}
    </div>
  );
}

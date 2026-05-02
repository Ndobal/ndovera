import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGiftToStudent } from '../hooks/useAuraBalance';
import { useAuraBalance } from '../hooks/useAuraBalance';
import { validateGiftAmount } from '../utils/auraHelpers';

/**
 * StaffGiftingComponent
 * Allows teachers/staff to reward students with Auras
 */
export default function StaffGifting({ staffId, staffName }) {
  const { balance } = useAuraBalance(staffId);
  const { giftAuras, error: giftError } = useGiftToStudent();

  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    amount: '',
    reason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const studentOptions = [
    { id: 'STD-101', name: 'Chioma Eze' },
    { id: 'STD-102', name: 'Tunde Adeyemi' },
    { id: 'STD-103', name: 'Zainab Ibrahim' },
    { id: 'STD-104', name: 'David Okonkwo' },
    { id: 'STD-105', name: 'Linda Mensah' },
  ];

  const reasonOptions = [
    'Outstanding assignment submission',
    'Excellent class participation',
    'Perfect attendance milestone',
    'Improvement in academic performance',
    'Leadership demonstration',
    'Creative thinking',
    'Helping classmates',
    'Extra curricular excellence',
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationError('');
  };

  const handleStudentSelect = (e) => {
    const selectedId = e.target.value;
    const selected = studentOptions.find((s) => s.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      studentId: selected?.id || '',
      studentName: selected?.name || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setValidationError('');

    // Validation
    if (!formData.studentId) {
      setValidationError('Please select a student');
      return;
    }

    if (!formData.amount || isNaN(formData.amount)) {
      setValidationError('Please enter a valid Aura amount');
      return;
    }

    const amount = parseInt(formData.amount);
    const validation = validateGiftAmount(amount, balance?.balance || 0);

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
      await giftAuras(staffId, formData.studentId, amount, formData.reason);
      setSuccessMessage(
        `Successfully gifted ${amount} Auras to ${formData.studentName}!`
      );
      setFormData({
        studentId: '',
        studentName: '',
        amount: '',
        reason: '',
      });

      // Clear success message after 3 seconds
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
          🎁 Reward Students with Auras
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Show appreciation for student excellence and achievement
        </p>
      </div>

      {/* Current Balance */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Your Available Balance: <strong>{balance?.balance || 0} Auras</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Student *
          </label>
          <select
            name="studentId"
            value={formData.studentId}
            onChange={handleStudentSelect}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Choose a student...</option>
            {studentOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Auras Amount *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              min="1"
              max={balance?.balance || 0}
              placeholder="Enter amount..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
            Reason for Reward *
          </label>
          <select
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
          disabled={isSubmitting || !formData.studentId || !formData.amount}
          className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isSubmitting ? 'Sending Gift...' : '🎁 Send Auras'}
        </button>
      </form>

      {/* Quick Amounts */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
          Quick amount presets:
        </p>
        <div className="flex gap-2 flex-wrap">
          {[5, 10, 25, 50].map((amount) => (
            <button
              key={amount}
              onClick={() =>
                setFormData((prev) => ({ ...prev, amount: amount.toString() }))
              }
              className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
            >
              {amount}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

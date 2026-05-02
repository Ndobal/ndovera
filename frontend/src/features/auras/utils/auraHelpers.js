// Aura System Helper Utilities
import { auraRewardTiers } from '../data/auraData';

/**
 * Calculate which tier a user belongs to based on their Aura balance
 */
export const getAuraTier = (balance) => {
  return auraRewardTiers.find(
    (tier) => balance >= tier.minAuras && balance <= tier.maxAuras
  ) || auraRewardTiers[0];
};

/**
 * Format Aura amount for display
 */
export const formatAuras = (amount) => {
  return `${amount} ✨`;
};

/**
 * Check if staff member is eligible to gift Auras to other staff
 * Requires 5 consecutive months of active farming mode
 */
export const isEligibleForStaffGifting = (farmingModeStatus) => {
  if (!farmingModeStatus || !farmingModeStatus.enabled) {
    return false;
  }
  return farmingModeStatus.consecutiveMonths >= 5;
};

/**
 * Check if staff member is eligible to cashout
 * Requires 2 months of active farming mode
 */
export const isEligibleForCashout = (farmingModeStatus) => {
  if (!farmingModeStatus || !farmingModeStatus.enabled) {
    return false;
  }
  return farmingModeStatus.consecutiveMonths >= 2;
};

/**
 * Get remaining days until Aura reset for students/parents
 */
export const getDaysUntilReset = (resetDate) => {
  const today = new Date();
  const reset = new Date(resetDate);
  const diffTime = reset - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Get transaction type badge/label
 */
export const getTransactionTypeLabel = (type) => {
  const types = {
    earned: { label: 'Earned', color: 'bg-green-100 text-green-800', icon: '⬆️' },
    spent: { label: 'Spent', color: 'bg-red-100 text-red-800', icon: '⬇️' },
    gifted: { label: 'Gifted To', color: 'bg-blue-100 text-blue-800', icon: '🎁' },
    received_gift: { label: 'Received', color: 'bg-purple-100 text-purple-800', icon: '🎀' },
    transferred: { label: 'Transferred', color: 'bg-yellow-100 text-yellow-800', icon: '↔️' },
  };
  return types[type] || types.earned;
};

/**
 * Get reason/category emoji and color
 */
export const getCategoryBadge = (category) => {
  const categories = {
    engagement: { emoji: '✨', label: 'Engagement', color: 'bg-yellow-50' },
    reward: { emoji: '🏆', label: 'Reward', color: 'bg-purple-50' },
    ai_usage: { emoji: '🤖', label: 'AI Usage', color: 'bg-blue-50' },
    library: { emoji: '📚', label: 'Library', color: 'bg-green-50' },
    ai_school_health: { emoji: '📊', label: 'School Analytics', color: 'bg-indigo-50' },
    ai_teacher: { emoji: '🎯', label: 'Teacher AI', color: 'bg-cyan-50' },
  };
  return categories[category] || categories.engagement;
};

/**
 * Format transaction timestamp to readable format
 */
export const formatTransactionTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get percentage to next tier
 */
export const getProgressToNextTier = (balance) => {
  const currentTier = getAuraTier(balance);
  const nextTier = auraRewardTiers[auraRewardTiers.indexOf(currentTier) + 1];

  if (!nextTier) {
    return 100; // Already at max tier
  }

  const progress =
    ((balance - currentTier.minAuras) /
      (nextTier.minAuras - currentTier.minAuras)) *
    100;
  return Math.min(progress, 100);
};

/**
 * Calculate months remaining to reach staff gifting eligibility
 */
export const getMonthsToStaffGiftingEligibility = (farmingModeStatus) => {
  if (!farmingModeStatus) return 5;
  const months = 5 - (farmingModeStatus.consecutiveMonths || 0);
  return Math.max(months, 0);
};

/**
 * Get cashout eligibility details
 */
export const getCashoutEligibilityDetails = (farmingModeStatus) => {
  if (!farmingModeStatus) {
    return {
      eligible: false,
      reason: 'Farming mode not enabled',
      monthsRemaining: 2,
    };
  }

  if (!farmingModeStatus.enabled) {
    return {
      eligible: false,
      reason: 'Farming mode is disabled',
      monthsRemaining: 2,
    };
  }

  if (farmingModeStatus.consecutiveMonths < 2) {
    return {
      eligible: false,
      reason: `${2 - farmingModeStatus.consecutiveMonths} months of active farming required`,
      monthsRemaining: 2 - farmingModeStatus.consecutiveMonths,
    };
  }

  return {
    eligible: true,
    reason: 'You are eligible to cash out',
    monthsRemaining: 0,
  };
};

/**
 * Validate gift amount
 */
export const validateGiftAmount = (amount, senderBalance, minAmount = 5) => {
  if (amount < minAmount) {
    return { valid: false, error: `Minimum gift amount is ${minAmount} Auras` };
  }
  if (amount > senderBalance) {
    return { valid: false, error: 'Insufficient Auras balance' };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Gift amount must be a whole number' };
  }
  return { valid: true, error: null };
};

/**
 * Format staffto staff gifting restriction message
 */
export const getStaffGiftingRestrictionMessage = (senderStatus, recipientStatus) => {
  if (!senderStatus || !senderStatus.enabled) {
    return 'You must enable Farming Mode to gift Auras to other staff members';
  }

  if (senderStatus.consecutiveMonths < 5) {
    const remaining = 5 - senderStatus.consecutiveMonths;
    return `You need ${remaining} more month${remaining > 1 ? 's' : ''} of continuous farming mode to gift Auras to staff (${senderStatus.consecutiveMonths}/5)`;
  }

  return null;
};

/**
 * Calculate total Auras earned in a period
 */
export const calculateTotalEarned = (transactions, startDate, endDate) => {
  return transactions
    .filter((txn) => {
      const txnDate = new Date(txn.timestamp);
      return (
        txn.type === 'earned' &&
        txnDate >= startDate &&
        txnDate <= endDate
      );
    })
    .reduce((total, txn) => total + txn.amount, 0);
};

/**
 * Calculate total Auras spent in a period
 */
export const calculateTotalSpent = (transactions, startDate, endDate) => {
  return transactions
    .filter((txn) => {
      const txnDate = new Date(txn.timestamp);
      return (
        txn.type === 'spent' &&
        txnDate >= startDate &&
        txnDate <= endDate
      );
    })
    .reduce((total, txn) => total + txn.amount, 0);
};

/**
 * Generate Aura transaction receipt
 */
export const generateTransactionReceipt = (transaction, userName) => {
  const { getTransactionTypeLabel, formatTransactionTime } = require('./auraHelpers');
  const typeLabel = getTransactionTypeLabel(transaction.type);

  return {
    receiptId: `RCP-${Date.now()}`,
    userName,
    transactionType: typeLabel.label,
    amount: transaction.amount,
    currency: 'Auras',
    reason: transaction.reason,
    timestamp: formatTransactionTime(transaction.timestamp),
    relatedId: transaction.relatedId,
  };
};

/**
 * Check if student Auras are about to reset
 */
export const isAurasAboutToReset = (resetDate, daysThreshold = 7) => {
  const daysRemaining = getDaysUntilReset(resetDate);
  return daysRemaining > 0 && daysRemaining <= daysThreshold;
};

/**
 * Check if ads are allowed in the given context
 * Ads should NOT appear during exams, assessments, or assignment submissions
 */
export const isAdContextAllowed = (context) => {
  const restrictedContexts = ['exam', 'assessment', 'assignment_submission'];
  return !restrictedContexts.includes(context);
};

/**
 * Check if user can earn Auras in a given context
 */
export const canEarnAurasInContext = (context) => {
  const earnableContexts = [
    'lesson_notes',
    'library',
    'dashboard',
    'ai_practice',
    'cbt',
    'assignment_submission',
    'quiz_completion',
  ];
  return earnableContexts.includes(context);
};

/**
 * Get farming mode context information
 */
export const getFarmingModeContextInfo = (context) => {
  const contextInfo = {
    lesson_notes: {
      label: 'Lesson Notes',
      earnPossible: true,
      adsAllowed: true,
      icon: '📖',
    },
    library: {
      label: 'Library',
      earnPossible: true,
      adsAllowed: true,
      icon: '📚',
    },
    dashboard: {
      label: 'Dashboard',
      earnPossible: false,
      adsAllowed: true,
      icon: '📊',
    },
    ai_practice: {
      label: 'AI Practice',
      earnPossible: true,
      adsAllowed: true,
      icon: '🤖',
    },
    cbt: {
      label: 'Practice Tests',
      earnPossible: true,
      adsAllowed: true,
      icon: '🧪',
    },
    exam: {
      label: 'Exam',
      earnPossible: false,
      adsAllowed: false,
      icon: '✏️',
    },
    assessment: {
      label: 'Assessment',
      earnPossible: false,
      adsAllowed: false,
      icon: '📝',
    },
    assignment_submission: {
      label: 'Assignment Submission',
      earnPossible: true,
      adsAllowed: false,
      icon: '📬',
    },
  };

  return contextInfo[context] || contextInfo.dashboard;
};

/**
 * Calculate farming mode earnings for a period
 */
export const calculateFarmingEarnings = (transactions, startDate, endDate) => {
  return transactions
    .filter((txn) => {
      const txnDate = new Date(txn.timestamp);
      return (
        txn.type === 'earned' &&
        txnDate >= startDate &&
        txnDate <= endDate
      );
    })
    .reduce((total, txn) => total + txn.amount, 0);
};

/**
 * Get months to eligibility for staffcashout
 */
export const getMonthsToCashoutEligibility = (farmingModeStatus) => {
  if (!farmingModeStatus) return 2;
  const months = 2 - (farmingModeStatus.consecutiveMonths || 0);
  return Math.max(months, 0);
};

/**
 * Format cashout eligibility message
 */
export const formatCashoutMessage = (farmingModeStatus) => {
  if (!farmingModeStatus) {
    return 'Enable farming mode to start earning';
  }

  if (!farmingModeStatus.enabled) {
    return 'Activate farming mode to become eligible';
  }

  const months = farmingModeStatus.consecutiveMonths || 0;
  if (months < 2) {
    return `${2 - months} more month${months !== 1 ? 's' : ''} until cashout eligible`;
  }

  return 'You are eligible for cashout!';
};


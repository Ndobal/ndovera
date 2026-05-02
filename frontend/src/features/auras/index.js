// Aura System - Main Index
// Complete Aura management system with farming mode, gifting, and cashout capabilities

export { AuraEngine, AuraBalance, StaffGifting, StaffToStaffGifting, StaffFarmingMode, StudentFarmingMode, ParentFarmingMode, StaffCashout, FarmingModeAds, TransactionLog } from './components';

export { auraService } from './services';

export {
  useAuraBalance,
  useAuraTransactions,
  useFarmingMode,
  useGiftToStudent,
  useGiftToStaff,
  useSpendAuras,
  usePendingStaffGifts,
  useCashout,
  useAuraAnalytics,
  useSpendingOptions,
} from './hooks/useAuraBalance';

export {
  getAuraTier,
  formatAuras,
  isEligibleForStaffGifting,
  isEligibleForCashout,
  getDaysUntilReset,
  getTransactionTypeLabel,
  getCategoryBadge,
  formatTransactionTime,
  getProgressToNextTier,
  getMonthsToStaffGiftingEligibility,
  getCashoutEligibilityDetails,
  validateGiftAmount,
  getStaffGiftingRestrictionMessage,
  calculateTotalEarned,
  calculateTotalSpent,
  generateTransactionReceipt,
  isAurasAboutToReset,
  isAdContextAllowed,
  canEarnAurasInContext,
  getFarmingModeContextInfo,
  calculateFarmingEarnings,
  getMonthsToCashoutEligibility,
  formatCashoutMessage,
} from './utils/auraHelpers';

export {
  auraBalances,
  farmingModeStatus,
  auraTransactions,
  staffToStaffGifts,
  auraSpendingOptions,
  auraRewardTiers,
  resetSchedules,
  cashoutRequests,
} from './data/auraData';

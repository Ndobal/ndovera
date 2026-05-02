// Aura System Custom Hooks
import { useState, useEffect, useCallback } from 'react';
import auraService from '../services/auraService';

/**
 * Hook to manage Aura balance
 */
export function useAuraBalance(userId) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await auraService.getBalance(userId);
        setBalance(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getBalance(userId);
      setBalance(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  return { balance, loading, error, refetch };
}

/**
 * Hook to manage user transactions
 */
export function useAuraTransactions(userId, filters = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const data = await auraService.getTransactions(userId, filters);
        setTransactions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchTransactions();
    }
  }, [userId, filters]);

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getTransactions(userId, filters);
      setTransactions(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId, filters]);

  return { transactions, loading, error, refetch };
}

/**
 * Hook to manage farming mode status
 */
export function useFarmingMode(userId) {
  const [farmingMode, setFarmingMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const data = await auraService.getFarmingModeStatus(userId);
        setFarmingMode(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchStatus();
    }
  }, [userId]);

  const toggleFarmingMode = useCallback(
    async (enabled) => {
      try {
        const data = await auraService.toggleFarmingMode(userId, enabled);
        setFarmingMode(data);
        return data;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [userId]
  );

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getFarmingModeStatus(userId);
      setFarmingMode(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  return { farmingMode, loading, error, toggleFarmingMode, refetch };
}

/**
 * Hook to handle gifting Auras to students
 */
export function useGiftToStudent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const giftAuras = useCallback(async (fromUserId, toUserId, amount, reason) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await auraService.giftToStudent(fromUserId, toUserId, amount, reason);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { giftAuras, isLoading, error };
}

/**
 * Hook to handle gifting Auras staff-to-staff
 */
export function useGiftToStaff() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const giftAuras = useCallback(async (fromUserId, toUserId, amount, reason) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await auraService.giftToStaff(fromUserId, toUserId, amount, reason);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { giftAuras, isLoading, error };
}

/**
 * Hook to handle spending Auras
 */
export function useSpendAuras() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const spendAuras = useCallback(async (userId, amount, category, reason, relatedId) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await auraService.spendAuras(userId, amount, category, reason, relatedId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { spendAuras, isLoading, error };
}

/**
 * Hook to manage pending staff gifts
 */
export function usePendingStaffGifts(userId) {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        setLoading(true);
        const data = await auraService.getPendingStaffGifts(userId);
        setGifts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchGifts();
    }
  }, [userId]);

  const acceptGift = useCallback(
    async (giftId) => {
      try {
        await auraService.acceptStaffGift(giftId);
        setGifts((prev) => prev.map((g) => (g.id === giftId ? { ...g, status: 'accepted' } : g)));
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  const declineGift = useCallback(
    async (giftId) => {
      try {
        await auraService.declineStaffGift(giftId);
        setGifts((prev) => prev.filter((g) => g.id !== giftId));
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getPendingStaffGifts(userId);
      setGifts(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  return { gifts, loading, error, acceptGift, declineGift, refetch };
}

/**
 * Hook to handle cashout requests
 */
export function useCashout(userId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await auraService.getCashoutHistory(userId);
        setHistory(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchHistory();
    }
  }, [userId]);

  const requestCashout = useCallback(
    async (amount, paymentMethod, bankDetails) => {
      try {
        const result = await auraService.requestCashout(userId, amount, paymentMethod, bankDetails);
        setHistory((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [userId]
  );

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getCashoutHistory(userId);
      setHistory(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  return { history, loading, error, requestCashout, refetch };
}

/**
 * Hook to get Aura analytics
 */
export function useAuraAnalytics(filters = {}) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await auraService.getAuraAnalytics(filters);
        setAnalytics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [filters]);

  const refetch = useCallback(async () => {
    try {
      const data = await auraService.getAuraAnalytics(filters);
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    }
  }, [filters]);

  return { analytics, loading, error, refetch };
}

/**
 * Hook to get available spending options
 */
export function useSpendingOptions(role) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        const data = await auraService.getSpendingOptions(role);
        setOptions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (role) {
      fetchOptions();
    }
  }, [role]);

  return { options, loading, error };
}

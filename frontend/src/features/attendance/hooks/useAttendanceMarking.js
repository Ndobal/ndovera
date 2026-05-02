// Custom hooks for attendance marking

import { useState, useCallback, useEffect } from 'react';
import attendanceService from '../services/attendanceService';
import offlineQueueService from '../services/offlineQueueService';

export const useAttendanceMarking = () => {
  const [marking, setMarking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const markAttendance = useCallback(async (staffId, markingData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await attendanceService.markAttendance(staffId, markingData);
      setMarking(result);
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { marking, loading, error, success, markAttendance };
};

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStats, setQueueStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue stats
    const updateStats = () => {
      setQueueStats(offlineQueueService.getQueueStats());
    };
    updateStats();
    const interval = setInterval(updateStats, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const syncQueue = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await attendanceService.syncOfflineQueue();
      setSyncResult(result);
      setQueueStats(offlineQueueService.getQueueStats());
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  const getQueue = useCallback(() => {
    return offlineQueueService.getQueue();
  }, []);

  const getPendingQueue = useCallback(() => {
    return offlineQueueService.getPendingQueue();
  }, []);

  const resolveConflict = useCallback((queueId, resolution) => {
    const result = offlineQueueService.resolveConflict(queueId, resolution);
    setQueueStats(offlineQueueService.getQueueStats());
    return result;
  }, []);

  return {
    isOnline,
    queueStats,
    syncing,
    syncResult,
    syncQueue,
    getQueue,
    getPendingQueue,
    resolveConflict,
  };
};

export const useAttendanceData = (staffId = null) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(
    async (params = {}) => {
      setLoading(true);
      setError(null);

      try {
        const data = staffId
          ? await attendanceService.getStaffAttendance(staffId, params)
          : await attendanceService.getAllAttendance(params);
        setAttendance(Array.isArray(data) ? data : data.records || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [staffId]
  );

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return { attendance, loading, error, refetch: fetchAttendance };
};

export const useAttendanceMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async (date = null) => {
    setLoading(true);
    setError(null);

    try {
      const data = await attendanceService.getAttendanceMetrics(date);
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
};

export const useAttendanceOverride = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const override = useCallback(async (attendanceId, overrideData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await attendanceService.overrideAttendance(attendanceId, overrideData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, success, override };
};

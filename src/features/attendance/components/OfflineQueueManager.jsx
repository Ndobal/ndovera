import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOfflineSync } from '../hooks/useAttendanceMarking';
import { staffMembers } from '../data/attendanceData';

export const OfflineQueueManager = () => {
  const { isOnline, queueStats, syncing, syncQueue, getQueue, resolveConflict } = useOfflineSync();
  const [queue, setQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const updateQueue = () => {
      setQueue(getQueue());
    };

    updateQueue();
    const interval = setInterval(updateQueue, 2000);

    return () => clearInterval(interval);
  }, [getQueue]);

  const handleSync = async () => {
    await syncQueue();
  };

  const handleResolveConflict = (queueId, resolution) => {
    resolveConflict(queueId, resolution);
    setQueue(getQueue());
  };

  const pendingQueue = queue.filter(item => item.status === 'Pending');
  const syncedQueue = queue.filter(item => item.status === 'Synced');
  const conflictedQueue = queue.filter(item => item.conflict !== null);

  const getDisplayQueue = () => {
    switch (activeTab) {
      case 'pending':
        return pendingQueue;
      case 'synced':
        return syncedQueue;
      case 'conflicts':
        return conflictedQueue;
      default:
        return queue;
    }
  };

  const displayQueue = getDisplayQueue();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Offline Queue Manager</h1>
          <p className="text-slate-300">Manage local attendance records pending synchronization</p>
        </div>

        {/* Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-6 border mb-8 ${
            isOnline
              ? 'glass-surface border-green-500/30 bg-green-500/10'
              : 'glass-surface border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <div>
                <p className={`text-lg font-semibold ${isOnline ? 'text-green-100' : 'text-red-100'}`}>
                  {isOnline ? '🟢 Online - Connected' : '🔴 Offline - Queuing Enabled'}
                </p>
                <p className={`text-sm ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                  {isOnline
                    ? 'All records syncing automatically'
                    : 'Records queued locally, will sync when connection restored'}
                </p>
              </div>
            </div>

            {isOnline && pendingQueue.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSync}
                disabled={syncing}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50"
              >
                {syncing ? '🔄 Syncing...' : '📤 Sync Now'}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Queue Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Queued', value: queue.length, color: 'blue', icon: '📋' },
            { label: 'Pending', value: pendingQueue.length, color: 'yellow', icon: '⏳' },
            { label: 'Synced', value: syncedQueue.length, color: 'green', icon: '✓' },
            { label: 'Conflicts', value: conflictedQueue.length, color: 'red', icon: '⚠️' },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-surface rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{stat.icon}</span>
                <div>
                  <p className="text-slate-400 text-xs">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-surface rounded-2xl p-6 border border-white/10"
        >
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
            {[
              { id: 'all', label: 'All', count: queue.length },
              { id: 'pending', label: 'Pending', count: pendingQueue.length },
              { id: 'synced', label: 'Synced', count: syncedQueue.length },
              { id: 'conflicts', label: 'Conflicts', count: conflictedQueue.length },
            ].map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'text-blue-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-sm">({tab.count})</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* Queue Items */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {displayQueue.length > 0 ? (
              displayQueue.map((item, idx) => {
                const staff = staffMembers.find(s => s.id === item.staffId);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      {/* Staff Info */}
                      <div className="flex items-center gap-3">
                        <span>{staff?.avatar}</span>
                        <div>
                          <p className="text-white font-semibold">{staff?.name}</p>
                          <p className="text-slate-400 text-xs">{staff?.role}</p>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div>
                        <p className="text-slate-400 text-xs uppercase">Queued</p>
                        <p className="text-white font-mono text-sm">
                          {new Date(item.queuedAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div>
                        <p className="text-slate-400 text-xs uppercase">Status</p>
                        <div className="flex gap-2 mt-1">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              item.status === 'Pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.status === 'Synced'
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : item.status === 'Conflict'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>

                      {/* Method */}
                      <div>
                        <p className="text-slate-400 text-xs uppercase">Method</p>
                        <p className="text-white text-sm">{item.method}</p>
                      </div>

                      {/* Actions */}
                      <div>
                        {item.status === 'Conflict' && (
                          <div className="space-y-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleResolveConflict(item.id, 'keep_new')}
                              className="w-full px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium border border-blue-500/30 hover:bg-blue-500/30"
                            >
                              Keep New
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleResolveConflict(item.id, 'keep_existing')}
                              className="w-full px-3 py-1 bg-slate-500/20 text-slate-300 rounded text-xs font-medium border border-slate-500/30 hover:bg-slate-500/30"
                            >
                              Keep Existing
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Conflict Details */}
                    {item.conflict && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-white/10"
                      >
                        <p className="text-amber-300 text-sm font-semibold mb-2">⚠️ Conflict Detected</p>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                            <p className="text-red-300 font-semibold">New Record</p>
                            <p className="text-red-200">{JSON.stringify(item.conflict.newRecord, null, 2)}</p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                            <p className="text-blue-300 font-semibold">Existing Record</p>
                            <p className="text-blue-200">{JSON.stringify(item.conflict.existingRecord, null, 2)}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-slate-400 text-lg">
                  {activeTab === 'all'
                    ? 'No queued records'
                    : activeTab === 'pending'
                      ? 'No pending records'
                      : activeTab === 'synced'
                        ? 'No synced records yet'
                        : 'No conflicts'}
                </p>
                <p className="text-slate-500 text-sm">
                  {isOnline && activeTab === 'pending' && 'All records synced successfully!'}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Info Panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 glass-surface rounded-2xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-semibold text-white mb-4">ℹ️ How Offline Queue Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-blue-300 font-semibold mb-2">1. Offline Marking</h4>
              <p className="text-slate-300 text-sm">
                When you're offline, attendance records are stored locally in the queue with a "Pending" status.
              </p>
            </div>
            <div>
              <h4 className="text-purple-300 font-semibold mb-2">2. Automatic Sync</h4>
              <p className="text-slate-300 text-sm">
                When you reconnect to the internet, the system automatically syncs all pending records to the server.
              </p>
            </div>
            <div>
              <h4 className="text-green-300 font-semibold mb-2">3. Conflict Resolution</h4>
              <p className="text-slate-300 text-sm">
                If a record already exists on the server, you'll choose to keep the new or existing version.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OfflineQueueManager;

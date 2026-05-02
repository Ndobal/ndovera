import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { auditLogs, staffMembers } from '../data/attendanceData';

export const AuditLog = () => {
  const [filterAction, setFilterAction] = useState('All');
  const [filterStaff, setFilterStaff] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const actions = ['All', 'MARK_ATTENDANCE', 'OVERRIDE_ATTENDANCE', 'OFFLINE_SYNC', 'DELETE_RECORD'];

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchAction = filterAction === 'All' || log.action === filterAction;
      const matchStaff = filterStaff === 'All' || log.staffId === filterStaff;
      const matchQuery =
        searchQuery === '' ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staffMembers.find(s => s.id === log.staffId)?.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchAction && matchStaff && matchQuery;
    });
  }, [filterAction, filterStaff, searchQuery]);

  const getActionColor = (action) => {
    const colors = {
      MARK_ATTENDANCE: 'from-blue-500 to-blue-600',
      OVERRIDE_ATTENDANCE: 'from-amber-500 to-amber-600',
      OFFLINE_SYNC: 'from-purple-500 to-purple-600',
      DELETE_RECORD: 'from-red-500 to-red-600',
    };
    return colors[action] || 'from-slate-500 to-slate-600';
  };

  const getActionIcon = (action) => {
    const icons = {
      MARK_ATTENDANCE: '✓',
      OVERRIDE_ATTENDANCE: '⚠️',
      OFFLINE_SYNC: '🔄',
      DELETE_RECORD: '🗑️',
    };
    return icons[action] || '•';
  };

  const getStatusColor = (status) => {
    const colors = {
      Present: 'bg-green-500/20 text-green-300 border-green-500/30',
      Late: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      Absent: 'bg-red-500/20 text-red-300 border-red-500/30',
      Excused: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Audit Log</h1>
          <p className="text-slate-300">Complete attendance marking history and compliance trail</p>
        </div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-surface rounded-2xl p-6 border border-white/10 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Staff name or details..."
                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400 placeholder-slate-500"
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">Action</label>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
              >
                {actions.map(action => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff Filter */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">Staff</label>
              <select
                value={filterStaff}
                onChange={e => setFilterStaff(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
              >
                <option value="All">All Staff</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Log Count */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">Stats</label>
              <div className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg">
                <p className="font-semibold">{filteredLogs.length} entries</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-surface rounded-2xl p-6 border border-white/10 overflow-hidden"
        >
          <div className="overflow-x-auto">
            {filteredLogs.length > 0 ? (
              <div className="space-y-3">
                {filteredLogs.map((log, idx) => {
                  const staff = staffMembers.find(s => s.id === log.staffId);
                  const markedByStaff = staffMembers.find(s => s.id === log.markedBy);

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        {/* Action Icon */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${getActionColor(log.action)}`}>
                          <span className="text-white font-bold">{getActionIcon(log.action)}</span>
                        </div>

                        {/* Action Type */}
                        <div>
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Action</p>
                          <p className="text-white font-semibold">{log.action.replace(/_/g, ' ')}</p>
                        </div>

                        {/* Staff Affected */}
                        <div>
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Staff</p>
                          <div className="flex items-center gap-2">
                            <span>{staff?.avatar}</span>
                            <p className="text-white font-medium text-sm">{staff?.name}</p>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Status</p>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div>
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Time</p>
                          <p className="text-white font-mono text-sm">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        {/* Details (expandable) */}
                        <div className="md:col-span-1">
                          <p className="text-slate-400 text-xs uppercase tracking-wider">Details</p>
                          <div className="group relative">
                            <p className="text-slate-300 text-sm cursor-help truncate">
                              {log.details}
                            </p>
                            {/* Tooltip */}
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 bg-slate-900 p-3 rounded border border-white/20 z-10 text-sm">
                              <p className="text-white font-semibold mb-2">Full Details</p>
                              <div className="space-y-2 text-slate-300 text-xs">
                                <p>
                                  <span className="text-slate-400">Action:</span> {log.action}
                                </p>
                                <p>
                                  <span className="text-slate-400">Marked By:</span> {markedByStaff?.name || log.markedBy}
                                </p>
                                <p>
                                  <span className="text-slate-400">Method:</span> {log.method}
                                </p>
                                <p>
                                  <span className="text-slate-400">Details:</span> {log.details}
                                </p>
                                <p>
                                  <span className="text-slate-400">IP Address:</span> {log.ipAddress}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-slate-400 text-lg">No logs match your filters</p>
                <p className="text-slate-500 text-sm">Try adjusting your search criteria</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Audit Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {[
            {
              label: 'Total Logs',
              value: auditLogs.length,
              icon: '📋',
              color: 'from-blue-500 to-blue-600',
            },
            {
              label: 'Markings',
              value: auditLogs.filter(l => l.action === 'MARK_ATTENDANCE').length,
              icon: '✓',
              color: 'from-green-500 to-green-600',
            },
            {
              label: 'Overrides',
              value: auditLogs.filter(l => l.action === 'OVERRIDE_ATTENDANCE').length,
              icon: '⚠️',
              color: 'from-amber-500 to-amber-600',
            },
            {
              label: 'Sync Events',
              value: auditLogs.filter(l => l.action === 'OFFLINE_SYNC').length,
              icon: '🔄',
              color: 'from-purple-500 to-purple-600',
            },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className={`glass-surface rounded-xl p-4 border border-white/10 bg-gradient-to-br ${stat.color}/10`}
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
        </motion.div>
      </div>
    </div>
  );
};

export default AuditLog;

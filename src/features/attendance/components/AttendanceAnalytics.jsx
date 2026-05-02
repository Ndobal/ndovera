import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAttendanceData, useAttendanceMetrics } from '../hooks/useAttendanceMarking';
import {
  calculateAttendanceMetrics,
  calculateDepartmentStats,
  calculateWeeklyTrend,
  getLateArrivals,
  getAbsentFrequency,
  identifyAtRiskStaff,
} from '../services/attendanceCalculations';
import { attendanceRecords, staffMembers, attendanceMetrics as mockMetrics } from '../data/attendanceData';

export const AttendanceAnalytics = () => {
  const { attendance } = useAttendanceData();
  const [selectedDept, setSelectedDept] = useState('All');
  const [dateRange, setDateRange] = useState('week');

  // Calculate metrics using seed data
  const data = {
    records: attendance.length > 0 ? attendance : attendanceRecords,
    staff: staffMembers,
  };

  const metrics = useMemo(() => ({
    daily: calculateAttendanceMetrics(data.records, data.staff),
    departments: calculateDepartmentStats(data.records, data.staff),
    weekly: calculateWeeklyTrend(data.records, data.staff),
    lateArrivals: getLateArrivals(data.records, 10),
    absentFreq: getAbsentFrequency(data.records, data.staff, 10),
    atRisk: identifyAtRiskStaff(data.records, data.staff),
  }), [data.records, data.staff]);

  const departments = Object.keys(metrics.departments);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance Analytics</h1>
          <p className="text-slate-300">Real-time attendance metrics and insights</p>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Present', value: metrics.daily.present, color: 'green', icon: '👥' },
            { label: 'Late Arrivals', value: metrics.daily.late, color: 'yellow', icon: '⏰' },
            { label: 'Absent', value: metrics.daily.absent, color: 'red', icon: '❌' },
            { label: 'Excused', value: metrics.daily.excused, color: 'blue', icon: '📋' },
            { label: 'Presence %', value: `${metrics.daily.presentPercentage}%`, color: 'purple', icon: '📊' },
          ].map((metric, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-surface rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{metric.icon}</span>
                <div>
                  <p className="text-slate-400 text-xs">{metric.label}</p>
                  <p className="text-2xl font-bold text-white">{metric.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Department Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Department Performance</h2>

            <div className="space-y-3">
              {departments.map(dept => {
                const stats = metrics.departments[dept];
                const percentage = parseFloat(stats.presentPercentage);

                return (
                  <motion.div
                    key={dept}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-white">{dept}</p>
                      <span className="text-sm text-slate-300">
                        {stats.present}/{stats.total}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>Present: {stats.present}</span>
                      <span>Late: {stats.late}</span>
                      <span>Absent: {stats.absent}</span>
                      <span className="font-semibold text-white">{percentage}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Summary</h2>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
                <p className="text-green-300 text-sm">Today's Attendance</p>
                <p className="text-3xl font-bold text-green-100">{metrics.daily.pullRate}%</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg p-4 border border-amber-500/30">
                <p className="text-amber-300 text-sm">At Risk Staff</p>
                <p className="text-3xl font-bold text-amber-100">{metrics.atRisk.length}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-4 border border-blue-500/30">
                <p className="text-blue-300 text-sm">Late Arrivals (7d)</p>
                <p className="text-3xl font-bold text-blue-100">{metrics.lateArrivals.length}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Late Arrivals */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">⏰ Recent Late Arrivals</h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {metrics.lateArrivals.length > 0 ? (
                metrics.lateArrivals.map((item, idx) => {
                  const staff = staffMembers.find(s => s.id === item.staffId);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span>{staff?.avatar}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{staff?.name}</p>
                          <p className="text-slate-400 text-xs">{item.date}</p>
                        </div>
                      </div>
                      <span className="text-amber-300 font-mono">{item.timeIn}</span>
                    </motion.div>
                  );
                })
              ) : (
                <p className="text-slate-400 text-center py-6">No late arrivals</p>
              )}
            </div>
          </motion.div>

          {/* Absent Frequency */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">❌ Absence Patterns</h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {metrics.absentFreq.length > 0 ? (
                metrics.absentFreq.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 rounded-lg p-3 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{staffMembers.find(s => s.id === item.staffId)?.avatar}</span>
                        <p className="text-white font-medium">{item.name}</p>
                      </div>
                      <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-sm font-mono">
                        {item.count}x
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs">Last: {item.lastDate}</p>
                  </motion.div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-6">No absence patterns</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Weekly Trend Chart (simple bars) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 glass-surface rounded-2xl p-6 border border-white/10"
        >
          <h2 className="text-2xl font-semibold text-white mb-6">📈 7-Day Trend</h2>

          <div className="flex items-end justify-between gap-2 h-48">
            {metrics.weekly.map((day, idx) => (
              <motion.div
                key={idx}
                initial={{ height: 0 }}
                animate={{ height: `${day.percentage * 1.5}px` }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
                className="flex-1 group relative"
              >
                <div className="w-full h-full rounded-t bg-gradient-to-t from-blue-500 to-cyan-400 hover:shadow-lg hover:shadow-blue-500/50 transition-all cursor-pointer" />

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-slate-900 px-3 py-2 rounded border border-white/20 z-10">
                  <p className="text-white text-sm font-bold">{day.percentage}%</p>
                  <p className="text-xs text-slate-300">{day.dayName}</p>
                </div>

                {/* Label */}
                <p className="text-center text-xs text-slate-400 mt-2">{day.dayName}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 mt-4 text-xs">
            {metrics.weekly.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-slate-400">{day.percentage}%</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AttendanceAnalytics;

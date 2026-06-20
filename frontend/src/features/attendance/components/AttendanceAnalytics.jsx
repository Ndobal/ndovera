import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAttendanceData } from '../hooks/useAttendanceMarking';
import {
  calculateAttendanceMetrics,
  calculateDepartmentStats,
  calculateWeeklyTrend,
  getLateArrivals,
  identifyAtRiskStaff,
} from '../services/attendanceCalculations';
import { attendanceRecords, staffMembers } from '../data/attendanceData';

export const AttendanceAnalytics = () => {
  const { attendance } = useAttendanceData();

  const data = {
    records: attendance.length > 0 ? attendance : attendanceRecords,
    staff: staffMembers,
  };

  const metrics = useMemo(() => ({
    daily: calculateAttendanceMetrics(data.records, data.staff),
    departments: calculateDepartmentStats(data.records, data.staff),
    weekly: calculateWeeklyTrend(data.records, data.staff),
    lateArrivals: getLateArrivals(data.records, 10),
    atRisk: identifyAtRiskStaff(data.records, data.staff),
  }), [data.records, data.staff]);

  const departments = Object.keys(metrics.departments);

  // Tiny one-line analytics
  const miniStats = [
    { label: 'Present', value: metrics.daily.present, dot: 'bg-emerald-500', tint: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Late', value: metrics.daily.late, dot: 'bg-amber-500', tint: 'text-amber-600 dark:text-amber-400' },
    { label: 'Absent', value: metrics.daily.absent, dot: 'bg-rose-500', tint: 'text-rose-600 dark:text-rose-400' },
    { label: 'Excused', value: metrics.daily.excused, dot: 'bg-blue-500', tint: 'text-blue-600 dark:text-blue-400' },
    { label: 'Presence', value: `${metrics.daily.presentPercentage}%`, dot: 'bg-indigo-500', tint: 'text-indigo-600 dark:text-indigo-400' },
  ];

  // Penalty details — grid of two lines (3 cols x 2 rows)
  const penalties = [
    { icon: '🚫', title: 'Absent without leave', amount: '₦5,000', note: 'Per unexcused absent day', count: metrics.daily.absent },
    { icon: '⏰', title: 'Late arrival', amount: '₦1,500', note: 'After the 7:45am grace window', count: metrics.daily.late },
    { icon: '☀️', title: 'Missed morning sign-in', amount: '₦2,000', note: 'Morning sign-in is compulsory', count: 0 },
    { icon: '🚪', title: 'Early departure', amount: '₦1,000', note: 'Leaving before close without leave', count: 0 },
    { icon: '🛡️', title: 'No permission filed', amount: '₦2,500', note: 'Absent with no request submitted', count: 0 },
    { icon: '🔁', title: 'Repeat offence', amount: 'x2', note: '3rd offence in a term doubles the fine', count: 0 },
  ];

  return (
    <div className="dashboard-bg min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-600/20">
          <div>
            <h1 className="text-xl font-bold text-white">Attendance Analytics</h1>
            <p className="text-sm text-blue-100">Live metrics, penalties and trends</p>
          </div>
          <span className="hidden rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold sm:inline">{new Date().toLocaleDateString()}</span>
        </div>

        {/* Tiny one-line analytics grid */}
        <div className="mb-4 grid grid-cols-5 gap-2">
          {miniStats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-slate-800/50">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
              <div className="min-w-0">
                <p className={`text-base font-bold leading-none ${s.tint}`}>{s.value}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Penalty details — grid of two lines */}
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-800/40">
          <div className="mb-3 flex items-center gap-2">
            <span>🪙</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Penalty details</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {penalties.map((p) => (
              <div key={p.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{p.amount}</span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">{p.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{p.note}</p>
                {p.count > 0 ? <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-500">{p.count} flagged today</p> : null}
              </div>
            ))}
          </div>
        </section>

        {/* Department performance + summary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-800/40 lg:col-span-2">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Department performance</h2>
            <div className="space-y-3">
              {departments.map((dept) => {
                const stats = metrics.departments[dept];
                const percentage = parseFloat(stats.presentPercentage);
                return (
                  <div key={dept} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-white">{dept}</p>
                      <span className="text-sm text-slate-500 dark:text-slate-300">{stats.present}/{stats.total}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-blue-500 to-indigo-600" />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-400">
                      <span>Present: {stats.present}</span>
                      <span>Late: {stats.late}</span>
                      <span>Absent: {stats.absent}</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Today's attendance</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-100">{metrics.daily.pullRate}%</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-700 dark:text-amber-300">At-risk staff</p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-100">{metrics.atRisk.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">Late arrivals (7d)</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-100">{metrics.lateArrivals.length}</p>
            </div>
          </motion.div>
        </div>

        {/* Compact weekly trend */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-800/40">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">📈 7-day trend</h2>
          <div className="flex h-32 items-end justify-between gap-2">
            {metrics.weekly.map((day, idx) => (
              <div key={idx} className="group relative flex-1">
                <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, day.percentage)}%` }} transition={{ duration: 0.6, delay: idx * 0.05 }} className="w-full rounded-t bg-gradient-to-t from-blue-500 to-indigo-400" style={{ minHeight: 6 }} />
                <p className="mt-2 text-center text-[10px] text-slate-400">{day.dayName}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AttendanceAnalytics;

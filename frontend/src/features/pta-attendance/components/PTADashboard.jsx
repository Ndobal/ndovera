import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ptaMeetings, ptaParticipants, ptaAttendanceRecords, ptaAnalytics } from '../data/ptaData';

export const PTADashboard = () => {
  const [selectedMeeting, setSelectedMeeting] = useState(ptaMeetings[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Calculate meeting attendance
  const meetingAttendees = useMemo(() => {
    if (!selectedMeeting) return [];
    const records = ptaAttendanceRecords.filter(r => r.meetingId === selectedMeeting.id);

    return ptaParticipants.map(parent => {
      const record = records.find(r => r.parentId === parent.id);
      return {
        ...parent,
        attended: !!record,
        timestamp: record?.timestamp,
        notes: record?.notes,
      };
    });
  }, [selectedMeeting]);

  // Filter attendees
  const filteredAttendees = useMemo(() => {
    let filtered = meetingAttendees;

    if (filterStatus !== 'All') {
      filtered = filtered.filter(a =>
        filterStatus === 'Present' ? a.attended : !a.attended
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [meetingAttendees, filterStatus, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = meetingAttendees.length;
    const attended = meetingAttendees.filter(a => a.attended).length;
    const absent = total - attended;

    return {
      total,
      attended,
      absent,
      percentage: total > 0 ? ((attended / total) * 100).toFixed(1) : 0,
    };
  }, [meetingAttendees]);

  // Get all upcoming meetings
  const upcomingMeetings = ptaMeetings.filter(m => m.status !== 'completed');
  const completedMeetings = ptaMeetings.filter(m => m.status === 'completed');

  if (!selectedMeeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-surface rounded-2xl p-6 border border-white/10 text-center">
            <p className="micro-label accent-amber">No live PTA data</p>
            <p className="mt-2 text-slate-300">PTA meetings and attendance dashboards will appear here when real parent records are connected.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">PTA Attendance Dashboard</h1>
          <p className="text-slate-300">Manage parent participation and meeting attendance</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Parents',
              value: ptaParticipants.length,
              color: 'blue',
              icon: '👥',
            },
            {
              label: 'Total Meetings',
              value: ptaMeetings.length,
              color: 'purple',
              icon: '📅',
            },
            {
              label: 'Avg Attendance',
              value: `${ptaAnalytics.averageAttendance.toFixed(1)}%`,
              color: 'green',
              icon: '📊',
            },
            {
              label: 'Engagement Score',
              value: `${ptaAnalytics.parentEngagementScore}/100`,
              color: 'amber',
              icon: '⭐',
            },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass-surface rounded-2xl p-6 border border-white/10"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Meeting Attendance</h2>

              {/* Meeting Selection */}
              <select
                value={selectedMeeting.id}
                onChange={e =>
                  setSelectedMeeting(ptaMeetings.find(m => m.id === e.target.value))
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400 mb-4"
              >
                {upcomingMeetings.map(meeting => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title} - {meeting.date}
                  </option>
                ))}
              </select>

              {/* Meeting Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-slate-400 text-xs">Date</p>
                  <p className="text-white font-semibold text-sm">{selectedMeeting.date}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-slate-400 text-xs">Time</p>
                  <p className="text-white font-semibold text-sm">
                    {selectedMeeting.startTime} - {selectedMeeting.endTime}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-slate-400 text-xs">Location</p>
                  <p className="text-white font-semibold text-sm">{selectedMeeting.location}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-slate-400 text-xs">Status</p>
                  <p className="text-white font-semibold text-sm capitalize">{selectedMeeting.status}</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search parents..."
                className="flex-1 px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400 placeholder-slate-500"
              />

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
              >
                <option value="All">All</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            {/* Attendance List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAttendees.map((parent, idx) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-3 rounded-lg border transition-all ${
                    parent.attended
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span>{parent.avatar}</span>
                      <div>
                        <p className="text-white font-medium">{parent.name}</p>
                        <p className="text-slate-400 text-xs">
                          {parent.childrenNames.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {parent.attended ? (
                        <div>
                          <p className="text-green-300 text-sm font-semibold">✓ Present</p>
                          <p className="text-green-200/75 text-xs">
                            {parent.timestamp
                              ? new Date(parent.timestamp).toLocaleTimeString()
                              : 'Time N/A'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-red-300 text-sm font-semibold">✗ Absent</p>
                      )}
                    </div>
                  </div>

                  {parent.notes && (
                    <p className="text-slate-400 text-xs mt-2 ml-10">{parent.notes}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Attendance Stats */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Attendance Summary</h3>

              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <p className="text-slate-400 text-sm mb-2">Attendance Rate</p>
                  <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.percentage}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                    />
                  </div>
                  <p className="text-white font-bold mt-2">{stats.percentage}%</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30 text-center">
                    <p className="text-green-300 text-2xl font-bold">{stats.attended}</p>
                    <p className="text-green-200/75 text-xs">Present</p>
                  </div>

                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 text-center">
                    <p className="text-red-300 text-2xl font-bold">{stats.absent}</p>
                    <p className="text-red-200/75 text-xs">Absent</p>
                  </div>

                  <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30 text-center">
                    <p className="text-blue-300 text-2xl font-bold">{stats.total}</p>
                    <p className="text-blue-200/75 text-xs">Total</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Meetings */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Upcoming Meetings</h3>

              <div className="space-y-2">
                {upcomingMeetings.map(meeting => (
                  <motion.button
                    key={meeting.id}
                    onClick={() => setSelectedMeeting(meeting)}
                    className={`w-full text-left p-3 rounded-lg transition-all border ${
                      selectedMeeting.id === meeting.id
                        ? 'bg-blue-500/20 border-blue-500 text-blue-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <p className="font-semibold text-sm">{meeting.title}</p>
                    <p className="text-xs text-slate-400">{meeting.date}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Recent Meetings */}
            {completedMeetings.length > 0 && (
              <div className="glass-surface rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-3">Completed Meetings</h3>

                <div className="space-y-2">
                  {completedMeetings.map(meeting => (
                    <div key={meeting.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-white text-sm font-medium">{meeting.title}</p>
                      <p className="text-slate-400 text-xs">{meeting.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-surface rounded-2xl p-6 border border-white/10"
        >
          <h3 className="text-lg font-semibold text-white mb-3">📋 PTA Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Active Members</p>
              <p className="text-white font-semibold">{ptaParticipants.length} Parents</p>
            </div>
            <div>
              <p className="text-slate-400">Total Meetings This Session</p>
              <p className="text-white font-semibold">{ptaMeetings.length}</p>
            </div>
            <div>
              <p className="text-slate-400">Average Meeting Attendance</p>
              <p className="text-white font-semibold">{ptaAnalytics.averageAttendance.toFixed(1)}%</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PTADashboard;

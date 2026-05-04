import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ptaMeetings, ptaParticipants, ptaAttendanceRecords, ptaReportFilters } from '../data/ptaData';

export const PTAReportGenerator = () => {
  const [reportType, setReportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('month');
  const [format, setFormat] = useState('pdf');
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);

  if (ptaMeetings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-surface rounded-2xl p-6 border border-white/10 text-center">
            <p className="micro-label accent-amber">No live PTA reports</p>
            <p className="mt-2 text-slate-300">Report generation will appear here when PTA meetings and attendance records are available.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleToggleMeeting = (meetingId) => {
    setSelectedMeetings(prev =>
      prev.includes(meetingId)
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMeetings(
      selectedMeetings.length === ptaMeetings.length
        ? []
        : ptaMeetings.map(m => m.id)
    );
  };

  const generateReport = async () => {
    setGenerating(true);

      const generatedData = {
      type: reportType,
      dateRange,
      format,
      generatedAt: new Date().toISOString(),
      title:
        reportType === 'attendance'
          ? 'PTA Attendance Report'
          : reportType === 'engagement'
            ? 'Parent Engagement Report'
            : 'PTA Analytics Report',
      data: {
        totalParents: ptaParticipants.length,
        totalMeetings: selectedMeetings.length || ptaMeetings.length,
        totalAttendance: ptaAttendanceRecords.filter(r =>
          selectedMeetings.length === 0 || selectedMeetings.includes(r.meetingId)
        ).length,
        averageAttendanceRate: 66.7,
        meetingDetails: (selectedMeetings.length > 0
          ? ptaMeetings.filter(m => selectedMeetings.includes(m.id))
          : ptaMeetings
        ).map(meeting => {
          const records = ptaAttendanceRecords.filter(r => r.meetingId === meeting.id);
          return {
            ...meeting,
            attended: records.length,
            absent: ptaParticipants.length - records.length,
            rate: ((records.length / ptaParticipants.length) * 100).toFixed(1),
          };
        }),
        parentSummary: ptaParticipants.map(parent => {
          const attended = ptaAttendanceRecords.filter(
            r =>
              r.parentId === parent.id &&
              (selectedMeetings.length === 0 || selectedMeetings.includes(r.meetingId))
          ).length;
          return {
            ...parent,
            attendanceCount: attended,
            totalMeetings: selectedMeetings.length || ptaMeetings.length,
            attendanceRate: (
              (attended / (selectedMeetings.length || ptaMeetings.length)) *
              100
            ).toFixed(1),
          };
        }),
      },
    };

    setGeneratedReport(generatedData);
    setGenerating(false);
  };

  const downloadReport = () => {
    if (!generatedReport) return;

    const content = JSON.stringify(generatedReport, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedReport.title}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">PTA Report Generator</h1>
          <p className="text-slate-300">Generate, customize, and export PTA attendance reports</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass-surface rounded-2xl p-6 border border-white/10 space-y-6"
          >
            {/* Report Type */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Report Type</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'attendance',
                    name: 'Attendance Report',
                    desc: 'Detailed attendance records',
                  },
                  {
                    id: 'engagement',
                    name: 'Engagement Report',
                    desc: 'Parent participation analysis',
                  },
                  {
                    id: 'analytics',
                    name: 'Analytics Report',
                    desc: 'Trends and statistics',
                  },
                ].map(type => (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setReportType(type.id)}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      reportType === type.id
                        ? 'bg-blue-500/20 border-blue-500 text-blue-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <p className="font-semibold">{type.name}</p>
                    <p className="text-xs mt-1">{type.desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Date Range</h3>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {ptaReportFilters.dateRanges.map(range => (
                  <motion.button
                    key={range.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDateRange(range.id)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      dateRange === range.id
                        ? 'bg-purple-500/20 border-purple-500 text-purple-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {range.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Export Format */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Export Format</h3>

              <div className="grid grid-cols-3 gap-3">
                {ptaReportFilters.formats.map(fmt => (
                  <motion.button
                    key={fmt.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFormat(fmt.id)}
                    className={`p-4 rounded-lg border transition-all text-center ${
                      format === fmt.id
                        ? 'bg-green-500/20 border-green-500 text-green-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <p className="text-2xl mb-1">{fmt.icon}</p>
                    <p className="text-xs font-medium">{fmt.label}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Select Meetings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Include Meetings</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSelectAll}
                  className="text-sm px-3 py-1 bg-slate-500/20 text-slate-300 rounded border border-slate-500/30 hover:border-slate-400/50"
                >
                  {selectedMeetings.length === ptaMeetings.length ? 'Deselect All' : 'Select All'}
                </motion.button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {ptaMeetings.map(meeting => (
                  <motion.button
                    key={meeting.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handleToggleMeeting(meeting.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                      selectedMeetings.includes(meeting.id)
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMeetings.includes(meeting.id)}
                      readOnly
                      className="cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{meeting.title}</p>
                      <p className="text-slate-400 text-xs">{meeting.date}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateReport}
              disabled={generating}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50"
            >
              {generating ? '⏳ Generating Report...' : '📄 Generate Report'}
            </motion.button>
          </motion.div>

          {/* Preview Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>

            {generatedReport ? (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-slate-400 text-xs uppercase">Report Title</p>
                  <p className="text-white font-semibold">{generatedReport.title}</p>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-slate-400 text-xs uppercase">Generated</p>
                  <p className="text-white font-mono text-sm">
                    {new Date(generatedReport.generatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30 text-center">
                    <p className="text-blue-300 text-2xl font-bold">
                      {generatedReport.data.totalParents}
                    </p>
                    <p className="text-blue-200/75 text-xs">Parents</p>
                  </div>

                  <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/30 text-center">
                    <p className="text-purple-300 text-2xl font-bold">
                      {generatedReport.data.totalMeetings}
                    </p>
                    <p className="text-purple-200/75 text-xs">Meetings</p>
                  </div>
                </div>

                <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                  <p className="text-green-300 text-xs uppercase">Avg Attendance Rate</p>
                  <p className="text-green-100 text-2xl font-bold">
                    {generatedReport.data.averageAttendanceRate}%
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadReport}
                  className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all text-sm"
                >
                  📥 Download Report
                </motion.button>

                <p className="text-slate-400 text-xs text-center">
                  Format: {format.toUpperCase()}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">Configure and generate a report to see preview</p>
                <p className="text-slate-500 text-xs mt-2">👉 Set parameters on the left and click Generate</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Generated Report Content (if available) */}
        {generatedReport && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 glass-surface rounded-2xl p-6 border border-white/10"
          >
            <h3 className="text-2xl font-semibold text-white mb-6">Report Details</h3>

            {/* Meeting Breakdown */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-white mb-4">Meeting Attendance</h4>

              <div className="space-y-3">
                {generatedReport.data.meetingDetails.map((meeting, idx) => (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-white font-semibold">{meeting.title}</p>
                        <p className="text-slate-400 text-sm">{meeting.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-lg">{meeting.rate}%</p>
                        <p className="text-slate-400 text-xs">
                          {meeting.attended}/{ptaParticipants.length}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${meeting.rate}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Parent Summary */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Parent Attendance Summary</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedReport.data.parentSummary.map((parent, idx) => (
                  <motion.div
                    key={parent.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span>{parent.avatar}</span>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{parent.name}</p>
                        <p className="text-slate-400 text-xs">{parent.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Attendance</span>
                        <span className="text-white font-semibold">
                          {parent.attendanceCount}/{parent.totalMeetings}
                        </span>
                      </div>

                      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${parent.attendanceRate}%` }}
                          transition={{ duration: 0.6 }}
                          className={`h-full ${
                            parent.attendanceRate >= 70
                              ? 'bg-green-500'
                              : parent.attendanceRate >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                        />
                      </div>

                      <p className="text-right text-slate-300 font-semibold">{parent.attendanceRate}%</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PTAReportGenerator;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ptaAttendanceService from '../services/ptaAttendanceService';
import { ptaMeetings, ptaParticipants, ptaAttendanceRecords } from '../data/ptaData';

export const PTAQRScanner = ({ parentId = 'PARENT001' }) => {
  const [selectedMeeting, setSelectedMeeting] = useState(ptaMeetings[0]);
  const [currentParent, setCurrentParent] = useState(
    ptaParticipants.find(p => p.id === parentId) || ptaParticipants[0]
  );
  const [showScanner, setShowScanner] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [marked, setMarked] = useState(false);

  const isOnline = navigator.onLine;

  // Check if already marked for this meeting
  useEffect(() => {
    const alreadyMarked = ptaAttendanceRecords.some(
      r =>
        r.parentId === currentParent.id &&
        r.meetingId === selectedMeeting.id &&
        r.status === 'Present'
    );
    setMarked(alreadyMarked);
  }, [selectedMeeting, currentParent]);

  const handleQRScan = async (qrCode = '') => {
    const code = qrCode || qrInput;
    if (!code) {
      setScanResult({ success: false, message: 'Please enter or scan QR code' });
      return;
    }

    setScanning(true);

    try {
      // Simulate QR validation
      const isValid = code.includes('MEETING');

      if (!isValid) {
        setScanResult({
          success: false,
          message: 'Invalid QR code. Please try again.',
        });
        setScanning(false);
        return;
      }

      // Mark attendance
      const result = await ptaAttendanceService.scanQRCode(
        code,
        currentParent.id,
        selectedMeeting.id
      );

      if (result.success || result.id) {
        setScanResult({
          success: true,
          message: `Attendance recorded for ${selectedMeeting.title}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        setMarked(true);
        setQrInput('');
        setShowScanner(false);

        setTimeout(() => {
          setScanResult(null);
        }, 5000);
      } else {
        throw new Error('Failed to record attendance');
      }
    } catch (error) {
      setScanResult({
        success: false,
        message: error.message || 'Failed to process QR code',
      });
    } finally {
      setScanning(false);
    }
  };

  const upcomingMeetings = ptaMeetings.filter(m => m.status !== 'completed');
  const attendedMeetings = ptaMeetings.filter(m =>
    ptaAttendanceRecords.some(
      r =>
        r.parentId === currentParent.id &&
        r.meetingId === m.id &&
        r.status === 'Present'
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">PTA Attendance Check-In</h1>
          <p className="text-slate-300">Scan QR code to mark your attendance at meetings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* QR Scanner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass-surface rounded-2xl p-8 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">📱</span>
              <div>
                <h2 className="text-2xl font-semibold text-white">QR Code Scanner</h2>
                <p className="text-slate-400">{isOnline ? '🟢 Online' : '🔴 Offline Mode'}</p>
              </div>
            </div>

            {/* Scanner Area */}
            <AnimatePresence mode="wait">
              {!showScanner ? (
                <motion.div
                  key="closed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Meeting Selection */}
                  <div className="mb-6">
                    <label className="text-slate-300 text-sm font-medium block mb-2">
                      Select Meeting
                    </label>
                    <select
                      value={selectedMeeting.id}
                      onChange={e =>
                        setSelectedMeeting(
                          ptaMeetings.find(m => m.id === e.target.value)
                        )
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
                    >
                      {upcomingMeetings.map(meeting => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title} - {meeting.date} at {meeting.startTime}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Meeting Details */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Date & Time</p>
                        <p className="text-white font-semibold">
                          {selectedMeeting.date} {selectedMeeting.startTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Location</p>
                        <p className="text-white font-semibold">{selectedMeeting.location}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-400">Description</p>
                        <p className="text-white">{selectedMeeting.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Scanner Button or Input Field */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowScanner(true)}
                    disabled={marked || !isOnline}
                    className={`w-full py-4 rounded-xl font-semibold transition-all ${
                      marked
                        ? 'bg-green-500/20 text-green-300 border border-green-500'
                        : !isOnline
                          ? 'bg-slate-500/20 text-slate-300 border border-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/50'
                    }`}
                  >
                    {marked ? '✅ Already Marked Today' : '📱 Click to Scan QR Code'}
                  </motion.button>

                  {!isOnline && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200 text-sm">
                      <p className="font-semibold">⚠️ Offline Mode Active</p>
                      <p>Your attendance will be recorded locally and synced when online.</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="open"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  {/* Scanner Placeholder */}
                  <div className="bg-black rounded-xl p-8 aspect-square flex items-center justify-center border-2 border-dashed border-white/20">
                    <div className="text-center">
                      <p className="text-white text-lg mb-4">📸 Camera Scanner</p>
                      <p className="text-slate-400 text-sm">
                        In a real app, this would show camera feed
                      </p>
                    </div>
                  </div>

                  {/* Manual Input */}
                  <div>
                    <label className="text-slate-300 text-sm font-medium block mb-2">
                      Manual QR Input (for testing)
                    </label>
                    <input
                      type="text"
                      value={qrInput}
                      onChange={e => setQrInput(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter') handleQRScan();
                      }}
                      placeholder="Enter QR code or press scan..."
                      className="w-full px-4 py-3 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400 placeholder-slate-500"
                      autoFocus
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleQRScan()}
                      disabled={scanning || !qrInput}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all disabled:opacity-50"
                    >
                      {scanning ? '⏳ Processing...' : '✓ Confirm Scan'}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowScanner(false);
                        setQrInput('');
                        setScanResult(null);
                      }}
                      className="flex-1 py-3 bg-slate-500/20 text-slate-300 rounded-lg font-semibold border border-slate-500/30 hover:border-slate-400/50 transition-all"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scan Result */}
            <AnimatePresence>
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`mt-6 p-4 rounded-lg border ${
                    scanResult.success
                      ? 'bg-green-500/20 border-green-500 text-green-200'
                      : 'bg-red-500/20 border-red-500 text-red-200'
                  }`}
                >
                  <p className="font-semibold">{scanResult.message}</p>
                  {scanResult.timestamp && (
                    <p className="text-sm mt-1">Recorded at: {scanResult.timestamp}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Sidebar - Parent Info & History */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Parent Info */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Profile</h3>

              <div className="text-center mb-4">
                <span className="text-5xl block mb-2">{currentParent.avatar}</span>
                <p className="text-white font-semibold">{currentParent.name}</p>
                <p className="text-slate-400 text-sm">{currentParent.email}</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-slate-400">Children</p>
                  <div className="text-white text-xs mt-1 space-y-1">
                    {currentParent.childrenNames.map((child, idx) => (
                      <p key={idx}>• {child}</p>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-slate-400">Contact</p>
                  <p className="text-white text-xs">{currentParent.phone}</p>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Meetings Attended</h3>

              <div className="space-y-2">
                {attendedMeetings.length > 0 ? (
                  attendedMeetings.map(meeting => (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-green-500/10 border border-green-500/30 rounded-lg p-3"
                    >
                      <p className="text-green-300 text-sm font-medium">{meeting.title}</p>
                      <p className="text-green-200/75 text-xs">{meeting.date}</p>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm">No meetings attended yet</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Attendance Rate</span>
                  <span className="text-lg font-bold text-blue-300">
                    {Math.round(
                      (attendedMeetings.length / ptaMeetings.length) * 100
                    )}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Meetings Attended</span>
                  <span className="text-lg font-bold text-green-300">
                    {attendedMeetings.length}/{ptaMeetings.length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Engagement Level</span>
                  <span className="text-lg font-bold text-purple-300">Good</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PTAQRScanner;

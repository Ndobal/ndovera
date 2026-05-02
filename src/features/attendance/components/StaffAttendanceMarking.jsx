import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAttendanceMarking, useOfflineSync } from '../hooks/useAttendanceMarking';
import { staffMembers, devices } from '../data/attendanceData';

export const StaffAttendanceMarking = ({
  staffId = 'STAFF001',
  currentStaffUser = null,
  allowOverride = false,
}) => {
  const { marking, loading, error, success, markAttendance } = useAttendanceMarking();
  const { isOnline, queueStats } = useOfflineSync();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [status, setStatus] = useState('Present');
  const [notes, setNotes] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(
    staffMembers.find(s => s.id === staffId) || staffMembers[0]
  );
  const [todayMarked, setTodayMarked] = useState(false);

  const markingMethods = [
    {
      id: 'facial',
      name: 'Facial Recognition',
      icon: '👤',
      description: 'Use biometric scanner at entrance',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'qr',
      name: 'QR Code',
      icon: '📱',
      description: 'Scan QR code with your phone',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'device',
      name: 'Device/Admin',
      icon: '📲',
      description: 'Mark using tablet or admin device',
      color: 'from-green-500 to-green-600',
      requiresAdmin: true,
    },
  ];

  const handleMarkAttendance = async () => {
    if (!selectedMethod) {
      alert('Please select a marking method');
      return;
    }

    const markingData = {
      method: selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1),
      deviceId: selectedDevice?.id,
      status,
      notes,
      markedBy: allowOverride ? currentStaffUser?.id : 'SYSTEM',
      ptaFlag: selectedStaff.hasChildren,
    };

    await markAttendance(selectedStaff.id, markingData);
    setTodayMarked(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Staff Attendance Marking</h1>
          <p className="text-slate-300 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
            {isOnline ? 'Online Mode' : 'Offline Mode'}
            {queueStats && queueStats.pending > 0 && (
              <span className="ml-4 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm">
                {queueStats.pending} pending syncs
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Staff Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-surface rounded-2xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-semibold text-white mb-4">Select Staff Member</h2>

              {!allowOverride ? (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{selectedStaff.avatar}</span>
                    <div>
                      <p className="text-white font-semibold">{selectedStaff.name}</p>
                      <p className="text-slate-400 text-sm">{selectedStaff.role}</p>
                      <p className="text-slate-500 text-xs">{selectedStaff.department}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedStaff.id}
                  onChange={e => setSelectedStaff(staffMembers.find(s => s.id === e.target.value))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
                >
                  {staffMembers.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role})
                    </option>
                  ))}
                </select>
              )}
            </motion.div>

            {/* Marking Methods */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-surface rounded-2xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-semibold text-white mb-4">Marking Method</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {markingMethods.map(method => {
                  const isSelected = selectedMethod === method.id;
                  const isDisabled = method.requiresAdmin && !allowOverride;

                  return (
                    <motion.button
                      key={method.id}
                      whileHover={!isDisabled ? { scale: 1.05 } : {}}
                      whileTap={!isDisabled ? { scale: 0.95 } : {}}
                      onClick={() => {
                        if (!isDisabled) setSelectedMethod(method.id);
                      }}
                      disabled={isDisabled}
                      className={`relative p-4 rounded-xl transition-all ${
                        isSelected
                          ? `bg-gradient-to-br ${method.color} border-2 border-white/30`
                          : 'bg-white/5 border border-white/10 hover:border-white/20'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-3xl mb-2">{method.icon}</div>
                      <p className={`font-semibold ${isSelected ? 'text-white' : 'text-white'}`}>
                        {method.name}
                      </p>
                      <p className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {method.description}
                      </p>
                      {isSelected && (
                        <motion.div
                          layoutId="selectedIndicator"
                          className="absolute inset-0 rounded-xl border-2 border-white/50"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Device Selection (if Device method selected) */}
            {selectedMethod === 'device' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-surface rounded-2xl p-6 border border-white/10"
              >
                <h2 className="text-xl font-semibold text-white mb-4">Select Device</h2>

                <div className="space-y-2">
                  {devices.map(device => (
                    <button
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`w-full p-3 rounded-lg text-left transition-all border ${
                        selectedDevice?.id === device.id
                          ? 'bg-blue-500/20 border-blue-400 text-blue-100'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <p className="font-semibold">{device.name}</p>
                      <p className="text-xs text-slate-400">{device.location}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Status & Notes */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-surface rounded-2xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-semibold text-white mb-4">Status & Notes</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-2">
                    Attendance Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Excused">Excused</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-2">
                    Optional Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g., On-site, Remote, Emergency..."
                    rows="3"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-lg focus:outline-none focus:border-blue-400 placeholder-slate-500"
                  />
                </div>
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleMarkAttendance}
              disabled={loading || todayMarked}
              className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                todayMarked
                  ? 'bg-green-500/20 text-green-300 border border-green-500'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/50'
              } ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {loading ? '📤 Processing...' : todayMarked ? '✅ Marked Today' : '✓ Mark Attendance'}
            </motion.button>
          </div>

          {/* Side Panel - Status & Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Status Messages */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Status</h3>

              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-green-500/20 border border-green-500 text-green-200 p-4 rounded-lg mb-4"
                  >
                    <p className="font-semibold">✅ Attendance Marked Successfully</p>
                    <p className="text-sm">Recorded at {new Date().toLocaleTimeString()}</p>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded-lg mb-4"
                  >
                    <p className="font-semibold">❌ Error</p>
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {!success && !error && (
                <div className="text-slate-400 text-sm">
                  <p>Ready to mark attendance.</p>
                  <p>Select a method and click submit.</p>
                </div>
              )}
            </div>

            {/* Queue Status */}
            {!isOnline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-surface rounded-2xl p-6 border border-amber-500/30 bg-amber-500/10"
              >
                <h3 className="text-lg font-semibold text-amber-100 mb-2">Offline Mode</h3>
                <p className="text-sm text-amber-200">
                  Your attendance will be recorded locally and synced when you're back online.
                </p>
                {queueStats && (
                  <div className="mt-4 text-xs text-amber-300">
                    <p>Pending: {queueStats.pending}</p>
                    <p>Synced: {queueStats.synced}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Staff Info */}
            <div className="glass-surface rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Info</h3>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Role</p>
                  <p className="text-white font-medium">{selectedStaff.role}</p>
                </div>
                <div>
                  <p className="text-slate-400">Department</p>
                  <p className="text-white font-medium">{selectedStaff.department}</p>
                </div>
                <div>
                  <p className="text-slate-400">Email</p>
                  <p className="text-white font-medium text-xs truncate">{selectedStaff.email}</p>
                </div>
                {selectedStaff.hasChildren && (
                  <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-purple-300">👨‍👩‍👧 Has children - PTA eligible</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendanceMarking;

// Main attendance service - handles attendance marking, retrieval, and updates

import offlineQueueService from './offlineQueueService';
// Attendance calculations imported as needed within methods

class AttendanceService {
  constructor() {
    this.apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.isOnline = navigator.onLine;
    this.setupOnlineListener();
  }

  setupOnlineListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onOnline();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Mark attendance for a staff member
  async markAttendance(staffId, markingData) {
    const attendance = {
      id: `ATT_${Date.now()}`,
      staffId,
      date: markingData.date || new Date().toISOString().split('T')[0],
      timeIn: markingData.timeIn || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      method: markingData.method, // 'Facial', 'QR', 'Device'
      deviceId: markingData.deviceId,
      markedBy: markingData.markedBy || 'SYSTEM',
      status: markingData.status || 'Present',
      notes: markingData.notes || '',
      ptaFlag: markingData.ptaFlag || false,
    };

    if (this.isOnline) {
      try {
        const response = await fetch(`${this.apiBase}/attendance/mark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attendance),
        });

        if (!response.ok) throw new Error('Failed to mark attendance');
        return await response.json();
      } catch (error) {
        console.error('Online marking failed, queuing offline:', error);
        return offlineQueueService.addToQueue(attendance);
      }
    } else {
      return offlineQueueService.addToQueue(attendance);
    }
  }

  // Get attendance for a staff member
  async getStaffAttendance(staffId, params = {}) {
    const query = new URLSearchParams(params);
    const url = `${this.apiBase}/attendance/staff/${staffId}?${query}`;

    if (!this.isOnline) {
      return this.getLocalAttendance(staffId);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed, returning local data:', error);
      return this.getLocalAttendance(staffId);
    }
  }

  // Get all attendance records
  async getAllAttendance(params = {}) {
    const query = new URLSearchParams(params);
    const url = `${this.apiBase}/attendance?${query}`;

    if (!this.isOnline) {
      return this.getLocalAllAttendance();
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed, returning local data:', error);
      return this.getLocalAllAttendance();
    }
  }

  // Override attendance (HoS/Admin only)
  async overrideAttendance(attendanceId, overrideData) {
    const payload = {
      attendanceId,
      status: overrideData.status,
      reason: overrideData.reason,
      overriddenBy: overrideData.overriddenBy,
      timestamp: new Date().toISOString(),
    };

    if (!this.isOnline) {
      return {
        success: false,
        message: 'Override requires online connection for audit trail',
        queued: true,
      };
    }

    try {
      const response = await fetch(`${this.apiBase}/attendance/${attendanceId}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to override attendance');
      return await response.json();
    } catch (error) {
      console.error('Override failed:', error);
      return { success: false, message: error.message };
    }
  }

  // Get attendance metrics
  async getAttendanceMetrics(date = null) {
    const params = { date: date || new Date().toISOString().split('T')[0] };
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/attendance/metrics?${query}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return await response.json();
    } catch (error) {
      console.error('Metrics fetch failed:', error);
      return { error: 'Failed to load metrics' };
    }
  }

  // Sync offline queue
  async syncOfflineQueue() {
    const pending = offlineQueueService.getPendingQueue();

    if (pending.length === 0) return { synced: [], conflicts: [] };

    try {
      const response = await fetch(`${this.apiBase}/attendance/sync-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: pending }),
      });

      if (!response.ok) throw new Error('Sync failed');

      const result = await response.json();
      const synced = result.synced.map(r => {
        offlineQueueService.resolveConflict(r.id, 'synced');
        return r;
      });

      return {
        synced,
        conflicts: result.conflicts || [],
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return { synced: [], conflicts: [] };
    }
  }

  // Get offline queue status
  getOfflineStatus() {
    return offlineQueueService.getQueueStats();
  }

  // Local fallback methods
  getLocalAttendance(staffId) {
    const stored = localStorage.getItem(`attendance_${staffId}`);
    return stored ? JSON.parse(stored) : [];
  }

  getLocalAllAttendance() {
    const stored = localStorage.getItem('all_attendance');
    return stored ? JSON.parse(stored) : [];
  }

  // Called when device comes back online
  async onOnline() {
    console.log('Device online - syncing queue');
    await this.syncOfflineQueue();
  }

  // Generate report
  async generateAttendanceReport(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/attendance/report?${query}`);
      if (!response.ok) throw new Error('Failed to generate report');
      return await response.json();
    } catch (error) {
      console.error('Report generation failed:', error);
      return null;
    }
  }

  // Export attendance data
  async exportAttendance(format = 'csv', params = {}) {
    const query = new URLSearchParams({ ...params, format });

    try {
      const response = await fetch(`${this.apiBase}/attendance/export?${query}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Export failed:', error);
      return null;
    }
  }
}

const attendanceService = new AttendanceService();
export default attendanceService;

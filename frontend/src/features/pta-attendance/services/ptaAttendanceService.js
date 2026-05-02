// PTA Attendance Service - handles QR scanning, attendance marking, and reporting

class PTAAttendanceService {
  constructor() {
    this.apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.isOnline = navigator.onLine;
  }

  // Scan QR code and mark parent attendance
  async scanQRCode(qrCode, parentId, meetingId) {
    const attendance = {
      id: `PTA_ATT_${Date.now()}`,
      parentId,
      meetingId,
      timestamp: new Date().toISOString(),
      status: 'Present',
      deviceId: 'DEVICE_QR001', // Would come from actual scanner
    };

    if (this.isOnline) {
      try {
        const response = await fetch(`${this.apiBase}/pta-attendance/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attendance),
        });

        if (!response.ok) throw new Error('Failed to record attendance');
        return await response.json();
      } catch (error) {
        console.error('Online scan failed:', error);
        // Queue locally
        return this.queueOfflineAttendance(attendance);
      }
    } else {
      return this.queueOfflineAttendance(attendance);
    }
  }

  // Queue offline attendance
  queueOfflineAttendance(attendance) {
    const queue = this.getOfflineQueue();
    attendance.status = 'Pending';
    attendance.queuedAt = new Date().toISOString();
    queue.push(attendance);
    localStorage.setItem('pta_attendance_queue', JSON.stringify(queue));
    return attendance;
  }

  // Get offline queue
  getOfflineQueue() {
    const data = localStorage.getItem('pta_attendance_queue');
    return data ? JSON.parse(data) : [];
  }

  // Get PTA attendance for a parent
  async getParentAttendance(parentId, params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/parent/${parentId}?${query}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return [];
    }
  }

  // Get meeting attendance
  async getMeetingAttendance(meetingId, params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/meeting/${meetingId}?${query}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return [];
    }
  }

  // Get all PTA attendance
  async getAllAttendance(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance?${query}`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return [];
    }
  }

  // Get meeting list
  async getMeetings(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-meetings?${query}`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return [];
    }
  }

  // Get parents list
  async getParents(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-parents?${query}`);
      if (!response.ok) throw new Error('Failed to fetch parents');
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return [];
    }
  }

  // Manual attendance entry (admin only)
  async manualEntry(parentId, meetingId, markedBy) {
    const attendance = {
      id: `PTA_ATT_${Date.now()}`,
      parentId,
      meetingId,
      timestamp: new Date().toISOString(),
      status: 'Present',
      markedBy,
      method: 'Manual',
    };

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendance),
      });

      if (!response.ok) throw new Error('Failed to record attendance');
      return await response.json();
    } catch (error) {
      console.error('Manual entry failed:', error);
      return { success: false, message: error.message };
    }
  }

  // Generate attendance report
  async generateReport(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/report?${query}`);
      if (!response.ok) throw new Error('Failed to generate report');
      return await response.json();
    } catch (error) {
      console.error('Report generation failed:', error);
      return null;
    }
  }

  // Export attendance data
  async exportAttendance(format = 'pdf', params = {}) {
    const query = new URLSearchParams({ ...params, format });

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/export?${query}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Export failed:', error);
      return null;
    }
  }

  // Sync offline queue
  async syncOfflineQueue() {
    const queue = this.getOfflineQueue();

    if (queue.length === 0 || !this.isOnline) return { synced: [], conflicts: [] };

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/sync-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: queue }),
      });

      if (!response.ok) throw new Error('Sync failed');

      const result = await response.json();
      localStorage.setItem('pta_attendance_queue', JSON.stringify([]));
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      return { synced: [], conflicts: [] };
    }
  }

  // Get analytics
  async getAnalytics(params = {}) {
    const query = new URLSearchParams(params);

    try {
      const response = await fetch(`${this.apiBase}/pta-attendance/analytics?${query}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return await response.json();
    } catch (error) {
      console.error('Analytics fetch failed:', error);
      return null;
    }
  }

  // Create new meeting (admin)
  async createMeeting(meetingData) {
    try {
      const response = await fetch(`${this.apiBase}/pta-meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingData),
      });

      if (!response.ok) throw new Error('Failed to create meeting');
      return await response.json();
    } catch (error) {
      console.error('Meeting creation failed:', error);
      return { success: false, message: error.message };
    }
  }
}

const ptaAttendanceService = new PTAAttendanceService();
export default ptaAttendanceService;

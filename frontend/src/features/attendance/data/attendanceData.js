export const staffMembers = [];
export const attendanceRecords = [];
export const offlineQueue = [];
export const auditLogs = [];

export const attendanceMetrics = {
  totalStaff: 0,
  presentToday: 0,
  absentToday: 0,
  lateToday: 0,
  departmentStats: {},
  dailyPercentage: 0,
  weeklyTrend: [],
  lateArrivals: [],
  absentFrequency: [],
};

export const devices = [];

export const attendanceConfig = {
  markingMethods: ['Facial', 'QR', 'Device'],
  statuses: ['Present', 'Late', 'Absent', 'Excused'],
  schoolHours: {
    startTime: '07:30',
    endTime: '16:00',
    lateThreshold: 30,
  },
  offlineEnabled: true,
  ptaIntegration: true,
  analyticsFrequency: 'daily',
};

export const ptaParticipants = [];
export const ptaMeetings = [];
export const ptaAttendanceRecords = [];

export const ptaAnalytics = {
  totalParents: 0,
  activeParents: 0,
  totalMeetings: 0,
  completedMeetings: 0,
  upcomingMeetings: 0,
  averageAttendance: 0,
  parentEngagementScore: 0,
  meetingAttendanceTrend: [],
};

export const ptaReportFilters = {
  dateRanges: [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'term', label: 'This Term' },
    { id: 'session', label: 'This Session' },
    { id: 'custom', label: 'Custom Range' },
  ],
  formats: [
    { id: 'pdf', label: 'PDF Report', icon: '📄' },
    { id: 'csv', label: 'CSV Export', icon: '📊' },
    { id: 'excel', label: 'Excel Spreadsheet', icon: '📈' },
  ],
};

export const ptaOfflineQueue = [];
export const ptaAuditLogs = [];

// PTA Attendance seed data

export const ptaParticipants = [
  {
    id: 'PARENT001',
    name: 'Mrs. Chioma Okafor',
    email: 'chioma.okafor@email.com',
    phone: '+234-801-234-5678',
    childrenIds: ['STU001', 'STU002'],
    childrenNames: ['Obinna Okafor (JSS 1)', 'Ada Okafor (Primary 5)'],
    status: 'active',
    avatar: '👩',
    registrationDate: '2023-08-15',
  },
  {
    id: 'PARENT002',
    name: 'Mr. Oluwaseun Adeyemi',
    email: 'seun.adeyemi@email.com',
    phone: '+234-802-345-6789',
    childrenIds: ['STU003'],
    childrenNames: ['Tunde Adeyemi (SSS 2)'],
    status: 'active',
    avatar: '👨',
    registrationDate: '2023-09-20',
  },
  {
    id: 'PARENT003',
    name: 'Mrs. Amara Nkosi',
    email: 'amara.nkosi@email.com',
    phone: '+234-803-456-7890',
    childrenIds: ['STU004', 'STU005'],
    childrenNames: ['Zainab Nkosi (JSS 3)', 'Habeeb Nkosi (Primary 4)'],
    status: 'active',
    avatar: '👩',
    registrationDate: '2024-01-10',
  },
  {
    id: 'PARENT004',
    name: 'Mr. Ibrahim Hassan',
    email: 'ibrahim.hassan@email.com',
    phone: '+234-804-567-8901',
    childrenIds: ['STU006'],
    childrenNames: ['Fatima Hassan (Primary 6)'],
    status: 'active',
    avatar: '👨',
    registrationDate: '2023-07-05',
  },
];

export const ptaMeetings = [
  {
    id: 'MEETING001',
    title: 'Term 2 PTA General Assembly',
    date: '2024-01-19',
    startTime: '14:00',
    endTime: '16:30',
    location: 'School Auditorium',
    description: 'General assembly to discuss school development plans',
    qrCode: 'PTA_MEETING_001_QR',
    attendanceDeadline: '2024-01-19T16:30:00Z',
    status: 'ongoing',
    expectedAttendees: 50,
  },
  {
    id: 'MEETING002',
    title: 'Parent-Teacher Conference',
    date: '2024-01-25',
    startTime: '15:00',
    endTime: '17:00',
    location: 'School Hall',
    description: 'Individual parent-teacher meetings',
    qrCode: 'PTA_MEETING_002_QR',
    attendanceDeadline: '2024-01-25T17:00:00Z',
    status: 'scheduled',
    expectedAttendees: 150,
  },
  {
    id: 'MEETING003',
    title: 'Fundraising Committee Meeting',
    date: '2024-01-22',
    startTime: '16:00',
    endTime: '17:30',
    location: 'Meeting Room 1',
    description: 'Discussion on school building project',
    qrCode: 'PTA_MEETING_003_QR',
    attendanceDeadline: '2024-01-22T17:30:00Z',
    status: 'completed',
    expectedAttendees: 20,
  },
];

export const ptaAttendanceRecords = [
  {
    id: 'PTA_ATT001',
    parentId: 'PARENT001',
    meetingId: 'MEETING001',
    timestamp: '2024-01-19T14:05:00Z',
    status: 'Present',
    deviceId: 'DEVICE_QR001',
    notes: 'On-time arrival',
  },
  {
    id: 'PTA_ATT002',
    parentId: 'PARENT002',
    meetingId: 'MEETING001',
    timestamp: '2024-01-19T14:25:00Z',
    status: 'Present',
    deviceId: 'DEVICE_QR001',
    notes: 'Late arrival - traffic',
  },
  {
    id: 'PTA_ATT003',
    parentId: 'PARENT003',
    meetingId: 'MEETING001',
    timestamp: null,
    status: 'Absent',
    deviceId: null,
    notes: 'No scan recorded',
  },
  {
    id: 'PTA_ATT004',
    parentId: 'PARENT004',
    meetingId: 'MEETING003',
    timestamp: '2024-01-22T16:10:00Z',
    status: 'Present',
    deviceId: 'DEVICE_QR001',
    notes: 'Attended fundraising meeting',
  },
];

export const ptaAnalytics = {
  totalParents: 4,
  activeParents: 4,
  totalMeetings: 3,
  completedMeetings: 1,
  upcomingMeetings: 2,
  averageAttendance: 66.67, // percentage
  parentEngagementScore: 75.5, // out of 100
  meetingAttendanceTrend: [45, 52, 60, 65, 70, 72, 75], // Last 7 meetings
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

export const ptaOfflineQueue = [
  {
    id: 'PTA_QUEUE001',
    parentId: 'PARENT001',
    meetingId: 'MEETING001',
    timestamp: '2024-01-19T14:05:00Z',
    status: 'Pending',
    syncedAt: null,
  },
];

export const ptaAuditLogs = [
  {
    id: 'PTA_AUDIT001',
    action: 'SCAN_QR',
    parentId: 'PARENT001',
    meetingId: 'MEETING001',
    timestamp: '2024-01-19T14:05:00Z',
    deviceId: 'DEVICE_QR001',
    ipAddress: '192.168.1.100',
    details: 'Successfully scanned QR code',
  },
  {
    id: 'PTA_AUDIT002',
    action: 'MANUAL_ENTRY',
    parentId: 'PARENT003',
    meetingId: 'MEETING001',
    timestamp: '2024-01-19T15:30:00Z',
    markedBy: 'STAFF001',
    ipAddress: '192.168.1.105',
    details: 'Manual attendance entry by admin',
  },
];

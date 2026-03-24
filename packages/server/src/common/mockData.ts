export const mockData = {
  user: { id: 'u-1', name: 'Demo User', role: 'Student' },
  students: [{ id: 's-1', name: 'Demo Student' }],
  teachers: [{ id: 't-1', name: 'Demo Teacher' }],
  children: [{ id: 'c-1', name: 'Demo Child', grade: 'JSS 1' }],
  announcements: [{ id: 'a-1', title: 'Welcome to Ndovera', detail: 'System online' }],
  liveClasses: [{ id: 'lc-1', title: 'Mathematics', schedule: 'Today 10:00 AM', attendees: 12, limit: 50, tools: ['chat', 'notes', 'whiteboard'] }],
  financeStats: { totalCollected: 12500000, outstanding: 2100000 },
  dashboardSummary: {
    student: { stats: { latestAverage: '78%', subjectCount: 6, liveClassCount: 2, pendingAssignments: 3, submittedAssignments: 4 }, liveClasses: [], announcements: [] },
    teacher: { stats: { subjectCount: 4, classCount: 3, assignmentCount: 5, pendingGrading: 2, lessonPlanCount: 6, liveClassCount: 1 }, liveClasses: [], assignments: [] },
    generic: { stats: { subjectCount: 8, pendingTraining: 1 }, announcements: [] },
  },
  messages: [{ id: 'm-1', text: 'Hello from Ndovera' }],
  notifications: [{ id: 'n-1', text: 'New announcement' }],
  books: [{ id: 'b-1', title: 'Sample Book', status: 'available' }],
};
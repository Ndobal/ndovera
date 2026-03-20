export const parentDashboardFeed = {
  children: [
    {
      id: 'student_123',
      name: 'Chidi Okoro',
      grade: 'JSS3 A',
      avatar: 'CO',
      gpa: '4.5',
      attendance: 98,
      status: 'In Class - Mathematics',
      nextExam: 'Mock Exams (Next Week)',
      fees: { balance: '₦0', status: 'Cleared' },
      alerts: [
        { type: 'success', message: 'Achieved 95% in Algebra Test' },
        { type: 'info', message: 'Farming reward achieved for consistent attendance' }
      ]
    },
    {
      id: 'student_456',
      name: 'Amara Okoro',
      grade: 'SS2 Science',
      avatar: 'AO',
      gpa: '3.8',
      attendance: 92,
      status: 'Free Period',
      nextExam: 'Termly Assessments',
      fees: { balance: '₦45,000', status: 'Due in 7 days' },
      alerts: [
        { type: 'warning', message: 'Missed Chemistry assignment deadline' },
        { type: 'info', message: 'Parent-Teacher meeting scheduled' }
      ]
    }
  ],
  quickActions: [
    { id: 'fees', label: 'Pay Fees' },
    { id: 'results', label: 'View Results' },
    { id: 'attendance', label: 'Track Attendance' },
    { id: 'teachers', label: 'Message Teachers' }
  ],
  announcements: [
    { id: 1, title: 'PTA Meeting Rescheduled', date: 'March 15, 2026', type: 'Event' },
    { id: 2, title: 'Term 2 Fee Deadline', date: 'March 20, 2026', type: 'Finance' },
    { id: 3, title: 'Inter-House Sports Final', date: 'April 2, 2026', type: 'School' }
  ],
  financialSummary: {
    totalPaid: '₦240,000',
    outstanding: '₦45,000',
    nextDue: 'March 20, 2026'
  }
};

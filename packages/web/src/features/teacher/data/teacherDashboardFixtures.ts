export const teacherDashboardFeed = {
  upcomingClasses: [
    { id: 'c1', subject: 'Mathematics', class: 'SS2 A', time: '08:00 AM', topic: 'Calculus Fundamentals', type: 'Live Class' },
    { id: 'c2', subject: 'Further Math', class: 'SS3 B', time: '10:30 AM', topic: 'Vectors and Mechanics', type: 'Physical' },
    { id: 'c3', subject: 'Physics', class: 'SS1 C', time: '01:15 PM', topic: 'Motion & Gravity', type: 'Lab' },
  ],
  actionItems: [
    { title: 'Grade Mid-Term Essays', course: 'English SS2', deadline: 'Today, 5:00 PM', priority: 'High' },
    { title: 'Review Lesson Plan', course: 'Physics SS1', deadline: 'Tomorrow', priority: 'Medium' },
    { title: 'Approve Attendance', course: 'SS3 B Form Room', deadline: 'Today, EOD', priority: 'Low' },
  ],
  quickActions: [
    { id: 'attendance', label: 'Take Attendance' },
    { id: 'assignments', label: 'Grade Assignments' },
    { id: 'classroom', label: 'Enter Classroom' },
    { id: 'reports', label: 'Generate Reports' }
  ],
  recentSubmissions: [
    { student: 'Chidi Okoro', assignment: 'Algebra Test 2', score: '85/100', time: '10 mins ago' },
    { student: 'Aisha Bello', assignment: 'Algebra Test 2', score: '92/100', time: '1 hour ago' },
    { student: 'Tunde Bakare', assignment: 'Algebra Test 2', score: '78/100', time: '2 hours ago' },
  ],
  analytics: {
    averageAttendance: 94,
    classPerformanceAvg: 78,
    completionRate: 85
  }
};

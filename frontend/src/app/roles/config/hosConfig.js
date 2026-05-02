const hosConfig = {
  roleTitle: 'Head of School Dashboard',
  watermark: 'HOS',
  sections: {
    overview: {
      title: 'Overview',
      subtitle: 'Track school quality, staff work, and learner outcomes.',
      cards: [
        { label: 'Active Classes', value: '34', accent: 'accent-indigo' },
        { label: 'Teacher Compliance', value: '92%', accent: 'accent-emerald' },
        { label: 'Open Issues', value: '6', accent: 'accent-amber' },
        { label: 'Urgent Alerts', value: '1', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Priority Actions', items: [{ text: 'Review low attendance classes.', tag: 'Today', accent: 'accent-rose' }, { text: 'Approve pending lesson plans.', tag: 'Pending', accent: 'accent-amber' }, { text: 'Check exam integrity report.', tag: 'Important', accent: 'accent-indigo' }] },
        { title: 'Leadership Notes', items: [{ text: 'Focus support on weak classes this week.' }, { text: 'Follow up with staff with overdue tasks.' }, { text: 'Share updates with owner and admin.' }] },
      ],
    },
    academics: { title: 'Academic Performance', subtitle: 'Monitor school performance by subject and class.', panels: [{ title: 'Academic View', items: [{ text: 'See top and weak subjects.' }, { text: 'Compare class trends by term.' }, { text: 'Track improvement plans.' }] }] },
    attendance: { title: 'Attendance Monitoring', subtitle: 'Monitor attendance for students and staff.', panels: [{ title: 'Attendance Controls', items: [{ text: 'Watch late and absent patterns.' }, { text: 'Escalate repeated absenteeism.' }, { text: 'Audit attendance changes.' }] }] },
    'teacher-review': { title: 'Teacher Review', subtitle: 'Review teacher activity, quality, and timelines.', panels: [{ title: 'Teacher Checks', items: [{ text: 'Check lesson note completion.' }, { text: 'Check marking speed and quality.' }, { text: 'Review parent feedback trends.' }] }] },
    timetable: { title: 'Timetable & Classes', subtitle: 'Review class schedule health and clashes.', panels: [{ title: 'Timetable Health', items: [{ text: 'Detect schedule clashes quickly.' }, { text: 'Track unassigned periods.' }, { text: 'Approve timetable changes.' }] }] },
    discipline: { title: 'Discipline & Welfare', subtitle: 'Manage student welfare and behavior alerts.', panels: [{ title: 'Welfare Hub', items: [{ text: 'View major behavior incidents.' }, { text: 'Assign follow-up actions.' }, { text: 'Track closure status.' }] }] },
    exams: { title: 'Exam Oversight', subtitle: 'Supervise exam setup, delivery, and integrity.', panels: [{ title: 'Exam Oversight', items: [{ text: 'Confirm exam window settings.' }, { text: 'Review anti-cheat incidents.' }, { text: 'Approve result publication readiness.' }] }] },
    approvals: { title: 'Approvals', subtitle: 'Approve key school workflow requests.', panels: [{ title: 'Approval Queue', items: [{ text: 'Approve leave requests.' }, { text: 'Approve class and subject changes.' }, { text: 'Approve policy updates.' }] }] },
    reports: { title: 'Reports', subtitle: 'Generate leadership reports for key meetings.', panels: [{ title: 'Reports', items: [{ text: 'School weekly operations summary.' }, { text: 'Academic and attendance snapshots.' }, { text: 'Export PDF and spreadsheet files.' }] }] },
    messaging: { title: 'Messaging', subtitle: 'Communicate with teachers, parents, and admin.', panels: [{ title: 'Communication', items: [{ text: 'Send school-wide notices.' }, { text: 'Target by role or class group.' }, { text: 'Keep conversations moderated.' }] }] },
    settings: { title: 'Profile & Security', subtitle: 'Manage account access and security controls.', panels: [{ title: 'Security', items: [{ text: 'Enable two-step sign-in.' }, { text: 'Review device sessions.' }, { text: 'Set alert preferences.' }] }] },
  },
};

export default hosConfig;

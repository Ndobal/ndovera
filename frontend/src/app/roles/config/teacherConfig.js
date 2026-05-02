const teacherConfig = {
  roleTitle: 'Teacher Dashboard',
  watermark: 'TEACHER',
  sections: {
    overview: {
      title: 'Overview',
      subtitle: 'Manage teaching, marking, and class updates.',
      cards: [
        { label: 'Classes Today', value: '5', accent: 'accent-indigo' },
        { label: 'Marked', value: '84', accent: 'accent-emerald' },
        { label: 'To Mark', value: '17', accent: 'accent-amber' },
        { label: 'Alerts', value: '2', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Today', items: [{ text: 'Take class attendance now.', tag: 'Now', accent: 'accent-rose' }, { text: 'Upload this week lesson notes.', tag: 'Important', accent: 'accent-amber' }, { text: 'Publish CA scores for SS2A.', tag: 'Pending', accent: 'accent-indigo' }] },
        { title: 'Quick Tips', items: [{ text: 'Use offline CA sheet if network is poor.' }, { text: 'Check weak students in analytics.' }, { text: 'Use AI helper for lesson ideas.' }] },
      ],
    },
    classroom: {
      title: 'Classroom',
      subtitle: 'Run daily class flow with stream, live, and class controls.',
      cards: [
        { label: 'Active Streams', value: '3', accent: 'accent-indigo' },
        { label: 'Live Rooms', value: '1', accent: 'accent-rose' },
        { label: 'Pending Moderation', value: '5', accent: 'accent-amber' },
        { label: 'Class Reach', value: '94%', accent: 'accent-emerald' },
      ],
      panels: [
        { title: 'Stream Controls', items: [{ text: 'Post announcements and assignment notifications.' }, { text: 'Pin important posts and lock comments.' }, { text: 'Highlight best student responses.' }] },
        { title: 'Class Operations', items: [{ text: 'Start/stop live class instantly.' }, { text: 'Monitor engagement and attendance.' }, { text: 'Open quick polls and quizzes.' }] },
      ],
    },
    materials: {
      title: 'Materials',
      subtitle: 'Publish notes, videos, and references by subject.',
      cards: [
        { label: 'Notes Uploaded', value: '28', accent: 'accent-indigo' },
        { label: 'Videos', value: '14', accent: 'accent-emerald' },
        { label: 'Pending Review', value: '3', accent: 'accent-amber' },
        { label: 'Downloads', value: '412', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Material Publishing', items: [{ text: 'Upload by subject and week.' }, { text: 'Tag level and difficulty.' }, { text: 'Track open, watch, and download rates.' }] },
        { title: 'Quality Checks', items: [{ text: 'Review file clarity and completeness.' }, { text: 'Replace outdated references quickly.' }, { text: 'Pin high-priority materials.' }] },
      ],
    },
    practice: {
      title: 'Practice',
      subtitle: 'Assign drills and monitor weak-topic reinforcement.',
      cards: [
        { label: 'Practice Sets', value: '21', accent: 'accent-indigo' },
        { label: 'Avg Completion', value: '81%', accent: 'accent-emerald' },
        { label: 'Weak Topics', value: '6', accent: 'accent-amber' },
        { label: 'AI Requests', value: '39', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Drill Assignment', items: [{ text: 'Push topic drills to selected classes.' }, { text: 'Set timed or untimed practice.' }, { text: 'Auto-group students by mastery level.' }] },
        { title: 'Practice Analytics', items: [{ text: 'Inspect common errors by topic.' }, { text: 'Recommend reteach points.' }, { text: 'Export intervention list.' }] },
      ],
    },
    attendance: { title: 'Attendance', subtitle: 'Mark present, absent, late, or excused.', panels: [{ title: 'Attendance Rules', items: [{ text: 'Cannot change archived attendance.' }, { text: 'Every change is logged.' }, { text: 'Class teacher can review overrides.' }] }] },
    scores: { title: 'Subject Scores (CA)', subtitle: 'Enter and review CA scores by subject.', panels: [{ title: 'CA Entry', items: [{ text: 'Only assigned teacher can enter scores.' }, { text: 'See missing-score highlights.' }, { text: 'Class teacher can override if needed.' }] }] },
    'offline-ca': { title: 'Offline CA Entry', subtitle: 'Download sheet, fill offline, and upload safely.', panels: [{ title: 'Offline Flow', items: [{ text: 'Download template.' }, { text: 'Fill scores offline.' }, { text: 'Upload and validate with logs.' }] }] },
    'lesson-notes': { title: 'Lesson Notes', subtitle: 'Upload notes and track student engagement.', panels: [{ title: 'Notes Features', items: [{ text: 'Upload text, PDF, slides, audio, or video.' }, { text: 'Set visibility for students and parents.' }, { text: 'Track views and downloads.' }] }] },
    'lesson-plan': { title: 'Lesson Plan', subtitle: 'Plan weekly lessons and link with live class.', panels: [{ title: 'Plan Builder', items: [{ text: 'Set objectives and activities.' }, { text: 'Attach class materials.' }, { text: 'Schedule release date and time.' }] }] },
    exams: { title: 'CBT Exams', subtitle: 'Create and run objective and theory tests.', panels: [{ title: 'Exam Engine', items: [{ text: 'Set timer and anti-cheat controls.' }, { text: 'Auto grade objective questions.' }, { text: 'Review theory answers manually.' }] }] },
    assignments: { title: 'Assignments & Scores', subtitle: 'Create assignments and send feedback.', panels: [{ title: 'Assignment Flow', items: [{ text: 'Create task with due date.' }, { text: 'Review student submission.' }, { text: 'Score and comment clearly.' }] }] },
    live: {
      title: 'Live',
      subtitle: 'Host real-time classes with chat, polls, and participation control.',
      cards: [
        { label: 'Live Sessions', value: '12', accent: 'accent-indigo' },
        { label: 'Avg Attendance', value: '89%', accent: 'accent-emerald' },
        { label: 'Recorded', value: '8', accent: 'accent-amber' },
        { label: 'Incidents', value: '0', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Live Teaching', items: [{ text: 'Start class, mute participants, and share screen.' }, { text: 'Use whiteboard and instant quizzes.' }, { text: 'Track attendance in-session.' }] },
        { title: 'Session Governance', items: [{ text: 'Record for absent learners.' }, { text: 'Moderate chat and raised hands.' }, { text: 'Save poll outcomes after class.' }] },
      ],
    },
    'ai-assistant': { title: 'AI Lesson Assistant', subtitle: 'Get teaching support with safe limits.', panels: [{ title: 'AI Support', items: [{ text: 'Generate lesson drafts and practice questions.' }, { text: 'Explain weak topics for students.' }, { text: 'Cannot submit exams or assignments for students.' }] }] },
    messaging: { title: 'Messaging', subtitle: 'Message class, parents, and school staff safely.', panels: [{ title: 'Messaging Rules', items: [{ text: 'Messages are logged.' }, { text: 'Send to class or parent groups.' }, { text: 'Use templates for quick replies.' }] }] },
    farming: { title: 'Farming Mode', subtitle: 'Optional ad rewards outside exam zones.', panels: [{ title: 'Farming Mode', items: [{ text: 'Ads never show in exam or assignment answer mode.' }, { text: 'Rewards can add to Auras.' }, { text: 'School controls enable/disable.' }] }] },
    reports: { title: 'Reports & Analytics', subtitle: 'Track class trends and weak areas.', panels: [{ title: 'Insights', items: [{ text: 'See average score and attendance trends.' }, { text: 'Find weak topics quickly.' }, { text: 'Export report files.' }] }] },
    auras: {
      title: 'Auras',
      subtitle: 'Manage reward credits tied to practice and classroom engagement.',
      cards: [
        { label: 'Auras Balance', value: '1,240', accent: 'accent-emerald' },
        { label: 'Rewards Issued', value: '88', accent: 'accent-indigo' },
        { label: 'Pending Requests', value: '4', accent: 'accent-amber' },
        { label: 'Rule Violations', value: '0', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Rewards Control', items: [{ text: 'Issue bonus Auras for excellence.' }, { text: 'Set class reward criteria.' }, { text: 'Review reward transaction logs.' }] },
        { title: 'Usage Governance', items: [{ text: 'Monitor AI feature consumption.' }, { text: 'Flag unusual reward patterns.' }, { text: 'Align rewards with policy.' }] },
      ],
    },
    cashout: {
      title: 'Cashout',
      subtitle: 'Withdraw earned Auras after 2 months of farming.',
      cards: [
        { label: 'Active Balance', value: '1,240', accent: 'accent-emerald' },
        { label: 'Eligible Since', value: '15 days', accent: 'accent-amber' },
        { label: 'Total Withdrawn', value: '₦12,450', accent: 'accent-indigo' },
        { label: 'Last Cashout', value: '28 days ago', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Cashout Rules', items: [{ text: 'Need 2 months of active farming to cashout.' }, { text: 'Minimum 100 Auras per withdrawal.' }, { text: '7-day window after becoming eligible.' }] },
        { title: 'Payment Methods', items: [{ text: 'Bank Transfer: Direct to your account.' }, { text: 'Mobile Wallet: Quick withdrawal via USSD.' }, { text: 'All transactions are logged and audited.' }] },
      ],
    },
    settings: { title: 'Profile & Security', subtitle: 'Manage your profile and login safety.', panels: [{ title: 'Security', items: [{ text: 'Change password and secure account.' }, { text: 'Check active sessions.' }, { text: 'Manage notification settings.' }] }] },
  },
};

export default teacherConfig;

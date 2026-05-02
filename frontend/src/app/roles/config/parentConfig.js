const parentConfig = {
  roleTitle: 'Parent Dashboard',
  watermark: 'PARENT',
  sections: {
    overview: {
      title: 'Overview',
      subtitle: 'See your child progress, fees, and alerts in one place.',
      cards: [
        { label: 'Children', value: '2', accent: 'accent-indigo' },
        { label: 'Attendance', value: '96%', accent: 'accent-emerald' },
        { label: 'Fee Balance', value: '₦25,000', accent: 'accent-amber' },
        { label: 'New Alerts', value: '3', accent: 'accent-rose' },
      ],
      panels: [
        {
          title: 'What Needs Your Action',
          items: [
            { text: 'Pay transport fee for this term.', tag: 'Due', accent: 'accent-amber' },
            { text: 'Check new math feedback from teacher.', tag: 'New', accent: 'accent-indigo' },
            { text: 'PTA meeting this Friday.', tag: 'Reminder', accent: 'accent-rose' },
          ],
        },
        {
          title: 'Quick Help',
          items: [
            { text: 'Switch child from the top switcher.', tag: 'Tip' },
            { text: 'Use messaging to contact teachers safely.', tag: 'Safe' },
            { text: 'Download receipts from Fees section.', tag: 'Finance' },
          ],
        },
      ],
    },
    classroom: {
      title: 'Classroom',
      subtitle: 'Monitor class stream, live notifications, and engagement from parent view.',
      cards: [
        { label: 'Class Alerts', value: '6', accent: 'accent-indigo' },
        { label: 'Live Sessions', value: '2', accent: 'accent-rose' },
        { label: 'Engagement', value: '84%', accent: 'accent-emerald' },
        { label: 'Pending Actions', value: '2', accent: 'accent-amber' },
      ],
      panels: [
        { title: 'Class Feed', items: [{ text: 'Read teacher announcements quickly.' }, { text: 'Track assignment and live notices.' }, { text: 'Follow class-level updates safely.' }] },
        { title: 'Parent Visibility', items: [{ text: 'View activity only for linked child.' }, { text: 'No posting to student stream.' }, { text: 'Escalate concerns via messaging.' }] },
      ],
    },
    materials: {
      title: 'Materials',
      subtitle: 'See notes, videos, and study resources shared for your child.',
      cards: [
        { label: 'New Notes', value: '9', accent: 'accent-indigo' },
        { label: 'Videos', value: '5', accent: 'accent-emerald' },
        { label: 'Downloads', value: '23', accent: 'accent-amber' },
        { label: 'Unread', value: '3', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Resource Access', items: [{ text: 'Open teacher-uploaded materials by subject.' }, { text: 'Track what your child has viewed.' }, { text: 'Use references for home support.' }] },
        { title: 'Parent Guidance', items: [{ text: 'Prioritize weak-topic materials first.' }, { text: 'Pair notes with practice sessions.' }, { text: 'Review completion weekly.' }] },
      ],
    },
    practice: {
      title: 'Practice',
      subtitle: 'Track personalized drills and weak-topic improvement.',
      cards: [
        { label: 'Drills Assigned', value: '18', accent: 'accent-indigo' },
        { label: 'Completion', value: '79%', accent: 'accent-emerald' },
        { label: 'Weak Topics', value: '4', accent: 'accent-amber' },
        { label: 'Auras Spent', value: '46', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Practice Monitoring', items: [{ text: 'See timed and untimed attempts.' }, { text: 'Identify repeated mistakes quickly.' }, { text: 'Support child with targeted revision.' }] },
        { title: 'AI Practice Usage', items: [{ text: 'Review AI explanations consumed.' }, { text: 'Check generated question usage.' }, { text: 'Manage Auras budget for learning.' }] },
      ],
    },
    children: {
      title: 'Children Switcher',
      subtitle: 'Pick one child at a time to view full records clearly.',
      panels: [{ title: 'How It Works', items: [{ text: 'One child is active at a time.' }, { text: 'Switching child refreshes all pages.' }, { text: 'Inactive child stays view-only.' }] }],
    },
    performance: {
      title: 'Academic Performance',
      subtitle: 'See progress trend by subject and term.',
      panels: [{ title: 'Performance View', items: [{ text: 'Subjects that improved this term.' }, { text: 'Subjects needing support.' }, { text: 'Teacher remarks when released.' }] }],
    },
    results: {
      title: 'Results',
      subtitle: 'Official records only. Locked if school fees are not cleared.',
      panels: [{ title: 'Result Rules', items: [{ text: 'Results are read-only for parents.' }, { text: 'Past results stay archived.' }, { text: 'Fee lock opens after payment approval.' }] }],
    },
    assignments: {
      title: 'Assignments',
      subtitle: 'Track tasks and feedback. Parents cannot submit work.',
      panels: [{ title: 'Assignment View', items: [{ text: 'See deadline and status.' }, { text: 'Read teacher feedback.' }, { text: 'Support child offline.' }] }],
    },
    live: {
      title: 'Live',
      subtitle: 'View live class schedules, attendance status, and replays.',
      cards: [
        { label: 'Upcoming Live', value: '2', accent: 'accent-indigo' },
        { label: 'Attended', value: '11', accent: 'accent-emerald' },
        { label: 'Missed', value: '1', accent: 'accent-amber' },
        { label: 'Recordings', value: '7', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Live Monitoring', items: [{ text: 'Track attendance per live session.' }, { text: 'View session summaries and outcomes.' }, { text: 'Access replay links where available.' }] },
        { title: 'Parent Actions', items: [{ text: 'Set reminders before class starts.' }, { text: 'Follow up on missed sessions.' }, { text: 'Coordinate with teacher via messaging.' }] },
      ],
    },
    exams: {
      title: 'Exams',
      subtitle: 'Track exam schedules, readiness, and outcomes overview.',
      cards: [
        { label: 'Upcoming Exams', value: '3', accent: 'accent-indigo' },
        { label: 'Preparedness', value: '82%', accent: 'accent-emerald' },
        { label: 'Practice Needed', value: '2', accent: 'accent-amber' },
        { label: 'Alerts', value: '1', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Exam Timeline', items: [{ text: 'See date, time, and subject sequence.' }, { text: 'Review exam readiness indicators.' }, { text: 'Track post-exam teacher remarks.' }] },
      ],
    },
    fees: {
      title: 'Fees & Receipts',
      subtitle: 'View balance, pay, and download receipts.',
      panels: [{ title: 'Payments', items: [{ text: 'Tuition, transport, and extras.' }, { text: 'Auto receipt after payment approval.' }, { text: 'History cannot be edited.' }] }],
    },
    attendance: {
      title: 'Attendance',
      subtitle: 'Track daily and weekly attendance for each linked child.',
      cards: [
        { label: 'This Week', value: '96%', accent: 'accent-emerald' },
        { label: 'Late Marks', value: '1', accent: 'accent-amber' },
        { label: 'Absent Days', value: '0', accent: 'accent-rose' },
        { label: 'Trend', value: 'Stable', accent: 'accent-indigo' },
      ],
      panels: [
        { title: 'Attendance Insight', items: [{ text: 'See class-by-class attendance logs.' }, { text: 'Review late-arrival frequency.' }, { text: 'Export attendance summary.' }] },
      ],
    },
    'tuck-shop': {
      title: 'Tuck Shop',
      subtitle: 'See your child daily spending clearly.',
      panels: [{ title: 'Spending Log', items: [{ text: 'Item name, quantity, amount, and time.' }, { text: 'Set wallet top-up and limits.' }, { text: 'No delete or refund by parent.' }] }],
    },
    'professor-vera': {
      title: 'Professor Vera',
      subtitle: 'Track academic-only AI tutor support and guidance usage.',
      cards: [
        { label: 'AI Sessions', value: '14', accent: 'accent-indigo' },
        { label: 'Concepts Clarified', value: '31', accent: 'accent-emerald' },
        { label: 'Auras Used', value: '27', accent: 'accent-amber' },
        { label: 'Follow-ups', value: '5', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'AI Oversight', items: [{ text: 'Review academic AI explanations requested.' }, { text: 'Track generated question sets.' }, { text: 'Measure confidence trend by topic.' }] },
      ],
    },
    pta: {
      title: 'PTA Attendance',
      subtitle: 'Track PTA attendance records by QR scan.',
      panels: [{ title: 'PTA Records', items: [{ text: 'Date and time for each meeting.' }, { text: 'Event history is locked.' }, { text: 'No manual attendance marking.' }] }],
    },
    messaging: {
      title: 'Messaging',
      subtitle: 'Send safe messages to teachers and school support.',
      panels: [{ title: 'Messaging Rules', items: [{ text: 'Messages are logged and moderated.' }, { text: 'No anonymous chat.' }, { text: 'Respect and safety checks apply.' }] }],
    },
    auras: {
      title: 'Auras Wallet',
      subtitle: 'Buy, earn, and transfer Auras inside NDOVERA.',
      panels: [{ title: 'Auras Rules', items: [{ text: 'Use Auras for premium learning features.' }, { text: 'Transfer Auras to child account.' }, { text: 'Auras cannot be cashed out.' }] }],
    },
    farmingmode: {
      title: 'Farming Mode',
      subtitle: 'Transfer Auras to children and monitor their earnings.',
      cards: [
        { label: 'My Auras', value: '520', accent: 'accent-emerald' },
        { label: 'Transferred', value: '280', accent: 'accent-indigo' },
        { label: 'Children Earning', value: '3', accent: 'accent-amber' },
        { label: 'Pending Resets', value: '2', accent: 'accent-rose' },
      ],
      panels: [
        { title: 'Farming Mode', items: [{ text: 'View your Aura balance and transfers.' }, { text: 'Send Auras to your children to spend.' }, { text: 'Monitor their earnings and activity.' }, { text: 'Parents cannot cash out Auras.' }] },
        { title: 'Learn More', items: [{ text: 'Auras earned through lessons, books, and practice.' }, { text: 'Reset every 3 months if unused.' }, { text: '7-day alert before reset.' }] },
      ],
    },
    settings: {
      title: 'Profile & Security',
      subtitle: 'Manage password, 2FA, and login sessions.',
      panels: [{ title: 'Security', items: [{ text: 'Change password and enable 2FA.' }, { text: 'Check active devices.' }, { text: 'Review session history.' }] }],
    },
  },
};

export default parentConfig;

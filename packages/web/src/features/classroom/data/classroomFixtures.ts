export const classroomAssignments = [
  {
    id: 'asg_1',
    title: 'Algebraic Expressions Worksheet',
    subject: 'Mathematics',
    due: 'Tomorrow, 08:00 AM',
    status: 'Submitted',
    feedback: 'Excellent structure. Revise question 5 for full marks.',
    score: '18/20',
  },
  {
    id: 'asg_2',
    title: 'Comprehension Response on The River Between',
    subject: 'English Language',
    due: 'Today, 06:00 PM',
    status: 'Returned for correction',
    feedback: 'Tighten your evidence and re-upload before cutoff.',
    score: 'Pending',
  },
  {
    id: 'asg_3',
    title: 'Cell Structure Diagram Upload',
    subject: 'Biology',
    due: 'Friday, 02:00 PM',
    status: 'Draft',
    feedback: 'File upload accepted in PDF, JPG, or PNG.',
    score: 'Not marked',
  },
];

export const classroomLessonNotes = [
  {
    id: 'note_1',
    title: 'Chemical Bonding and Valency',
    subject: 'Chemistry',
    week: 6,
    format: 'PDF',
    duration: '12 min read',
    offline: true,
    summary: 'Covers ionic and covalent bonding with worked examples and teacher highlights.',
  },
  {
    id: 'note_2',
    title: 'Narrative Techniques in African Fiction',
    subject: 'Literature',
    week: 6,
    format: 'Slides',
    duration: '9 min read',
    offline: true,
    summary: 'Explains tone, plot movement, and character framing using current class text.',
  },
  {
    id: 'note_3',
    title: 'Map Reading and Scale Interpretation',
    subject: 'Geography',
    week: 5,
    format: 'Video',
    duration: '18 min watch',
    offline: false,
    summary: 'Short guided walkthrough on grid references, bearings, and contour patterns.',
  },
];

export const classroomPracticeSets = [
  {
    id: 'prc_1',
    title: 'Fractions Weak-Area Drill',
    subject: 'Mathematics',
    questions: 15,
    difficulty: 'Targeted',
    reward: '+12 Auras',
    note: 'Generated from your last two quiz attempts.',
  },
  {
    id: 'prc_2',
    title: 'Past Questions: Cell Division',
    subject: 'Biology',
    questions: 20,
    difficulty: 'Exam Prep',
    reward: '+18 Auras',
    note: 'Timed mixed questions from previous internal exams.',
  },
  {
    id: 'prc_3',
    title: 'Vocabulary Builder Challenge',
    subject: 'English Language',
    questions: 10,
    difficulty: 'Quick Practice',
    reward: '+8 Auras',
    note: 'Adaptive drill focused on common comprehension errors.',
  },
];

export const classroomTimetable = [
  {
    day: 'Monday',
    periods: [
      { time: '08:00 - 09:00', subject: 'Mathematics', teacher: 'Mr. John Doe', room: 'Room 101' },
      { time: '09:00 - 10:00', subject: 'English Language', teacher: 'Mrs. Jane Smith', room: 'Room 102' },
      { time: '10:30 - 11:30', subject: 'Physics', teacher: 'Dr. Samuel Okoro', room: 'Lab A' },
    ],
  },
  {
    day: 'Tuesday',
    periods: [
      { time: '08:00 - 09:00', subject: 'Biology', teacher: 'Ms. Alice Johnson', room: 'Lab B' },
      { time: '09:00 - 10:00', subject: 'Chemistry', teacher: 'Mr. John Doe', room: 'Lab C' },
      { time: '11:00 - 12:00', subject: 'History', teacher: 'Mrs. Adebayo', room: 'Room 201' },
    ],
  },
];

export const classroomResults = [
  { term: 'Term 1, 2025', gpa: '4.2/5.0', rank: '5th of 120', status: 'Released' },
  { term: 'Term 2, 2025', gpa: '4.5/5.0', rank: '2nd of 120', status: 'Released' },
  { term: 'Term 3, 2025', gpa: 'Pending', rank: '-', status: 'Awaiting release' },
];

export const teacherClasses = [
  { id: 'JSS1-A', name: 'JSS 1A', subject: 'Mathematics', students: 42, nextPeriod: 'Tomorrow, 08:00' },
  { id: 'JSS2-B', name: 'JSS 2B', subject: 'Mathematics', students: 38, nextPeriod: 'Today, 11:00' },
  { id: 'SSS1-C', name: 'SSS 1C', subject: 'Further Maths', students: 25, nextPeriod: 'Friday, 09:30' },
];

export const classroomCurriculum = [
  { id: 1, name: 'Mathematics', code: 'MAT101', progress: 75, grade: 'A' },
  { id: 2, name: 'English Language', code: 'ENG101', progress: 90, grade: 'B+' },
  { id: 3, name: 'Physics', code: 'PHY101', progress: 60, grade: 'B' },
  { id: 4, name: 'Biology', code: 'BIO101', progress: 85, grade: 'A-' },
];

export const classroomLessonPlans = [
  {
    id: 'lp_1',
    topic: 'Linear Equations in One Variable',
    subject: 'Mathematics',
    week: 6,
    materialType: 'PDF + Practice',
    completion: 100,
    summary: 'Teacher walkthrough, worked examples, and a short checkpoint quiz.',
  },
  {
    id: 'lp_2',
    topic: 'Respiration in Living Organisms',
    subject: 'Biology',
    week: 6,
    materialType: 'Slides + Video',
    completion: 60,
    summary: 'Pre-read notes linked to a short explainer and lab observation checklist.',
  },
  {
    id: 'lp_3',
    topic: 'Figures of Speech in Poetry',
    subject: 'Literature',
    week: 5,
    materialType: 'Audio + PDF',
    completion: 0,
    summary: 'Listen first, annotate key lines, then mark lesson completed to earn points.',
  },
];

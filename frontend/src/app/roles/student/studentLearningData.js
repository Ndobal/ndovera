export const subjectCards = [
  {
    id: 'mathematics',
    title: 'Mathematics',
    teacher: 'Mrs. Okoro',
    analytics: 'Average 78% • 26 students active',
    gradient: 'from-indigo-500/40 to-blue-500/30',
  },
  {
    id: 'english',
    title: 'English Language',
    teacher: 'Mr. Danjuma',
    analytics: 'Average 82% • 24 students active',
    gradient: 'from-rose-500/40 to-fuchsia-500/30',
  },
  {
    id: 'biology',
    title: 'Biology',
    teacher: 'Ms. Faith',
    analytics: 'Average 75% • 28 students active',
    gradient: 'from-emerald-500/40 to-teal-500/30',
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    teacher: 'Mr. Chinedu',
    analytics: 'Average 73% • 22 students active',
    gradient: 'from-amber-500/40 to-orange-500/30',
  },
];

export const classAnnouncements = [
  {
    id: 'ann-1',
    author: 'Mrs. Okoro',
    role: 'Mathematics Teacher',
    time: 'Today • 8:15 AM',
    text: 'Morning class starts by 10:00 AM. Keep your geometry set ready.',
    comments: [
      {
        id: 'c-1',
        user: 'David',
        text: 'Okay ma, ready.',
        time: '8:20 AM',
        replies: [{ id: 'r-1', user: 'Mrs. Okoro', text: 'Great.', time: '8:22 AM' }],
      },
    ],
  },
  {
    id: 'ann-2',
    author: 'Class Captain',
    role: 'Student Lead',
    time: 'Yesterday • 5:40 PM',
    text: 'Please submit your English assignment before 7:00 PM.',
    comments: [],
  },
];

export const subjectTasks = {
  mathematics: {
    classWork: ['Solve page 44 exercise 3', 'Submit classwork photo before 4:00 PM'],
    assignments: ['Algebra quiz (10 marks) due today'],
    materials: ['Quadratic equations note', 'Worked example video'],
    live: 'Live problem-solving class today by 10:00 AM',
  },
  english: {
    classWork: ['Write one short descriptive paragraph', 'Read chapter 5 aloud'],
    assignments: ['Essay draft (250 words) due tomorrow'],
    materials: ['Essay structure note', 'Grammar correction video'],
    live: 'Live reading session tomorrow by 9:00 AM',
  },
  biology: {
    classWork: ['Label digestive system diagram', 'Revise food chain'],
    assignments: ['MCQ test on ecology due Friday'],
    materials: ['Cell structure note with images', 'Photosynthesis explainer video'],
    live: 'Practical demo stream on Thursday by 11:00 AM',
  },
  chemistry: {
    classWork: ['Balance 10 equations', 'Complete acid/base table'],
    assignments: ['Short-answer worksheet due Monday'],
    materials: ['Acids and bases note', 'Lab safety video'],
    live: 'Live revision class this evening by 6:00 PM',
  },
};

export const notesMaterials = [
  {
    id: 'note-1',
    subjectId: 'biology',
    subject: 'Biology',
    title: 'Cell Structure and Functions',
    teacher: 'Ms. Faith',
    cover: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=60',
    pages: 12,
    uploaded: 'Today',
  },
  {
    id: 'note-2',
    subjectId: 'mathematics',
    subject: 'Mathematics',
    title: 'Quadratic Equations - Solved Steps',
    teacher: 'Mrs. Okoro',
    cover: 'https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?auto=format&fit=crop&w=800&q=60',
    pages: 8,
    uploaded: 'Yesterday',
  },
  {
    id: 'note-3',
    subjectId: 'english',
    subject: 'English Language',
    title: 'Narrative Essay Guide',
    teacher: 'Mr. Danjuma',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=60',
    pages: 10,
    uploaded: '2 days ago',
  },
];

export const videoMaterials = [
  {
    id: 'vid-1',
    subjectId: 'biology',
    subject: 'Biology',
    title: 'Photosynthesis in 12 Minutes',
    teacher: 'Ms. Faith',
    duration: '12:40',
    uploaded: 'Today',
  },
  {
    id: 'vid-2',
    subjectId: 'mathematics',
    subject: 'Mathematics',
    title: 'Factorization Fast Method',
    teacher: 'Mrs. Okoro',
    duration: '09:15',
    uploaded: 'Yesterday',
  },
  {
    id: 'vid-3',
    subjectId: 'chemistry',
    subject: 'Chemistry',
    title: 'Acids, Bases, and Indicators',
    teacher: 'Mr. Chinedu',
    duration: '14:28',
    uploaded: '3 days ago',
  },
];

export const practiceSets = [
  {
    id: 'pr-1',
    title: 'Math Daily Drill',
    subject: 'Mathematics',
    questions: 15,
    time: '20 mins',
  },
  {
    id: 'pr-2',
    title: 'English Grammar Sprint',
    subject: 'English Language',
    questions: 12,
    time: '15 mins',
  },
  {
    id: 'pr-3',
    title: 'Biology Quick Revision',
    subject: 'Biology',
    questions: 18,
    time: '25 mins',
  },
];

export const assignments = {
  newAssignments: [
    {
      id: 'asg-math-1',
      title: 'Mathematics CA - Quadratic Equations',
      subject: 'Mathematics',
      teacher: 'Mrs. Okoro',
      due: 'Today, 6:00 PM',
      instructions: 'Answer all sections. Teachers can set MCQ, short answer, essay, and matching. Images are part of some questions.',
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          text: 'Solve: x² - 5x + 6 = 0',
          options: ['x = 2 or 3', 'x = -2 or -3', 'x = 1 or 6', 'x = 0 or 6'],
        },
        {
          id: 'q2',
          type: 'short-answer',
          text: 'Write the sum of roots formula for ax² + bx + c = 0',
        },
        {
          id: 'q3',
          type: 'essay',
          text: 'Explain in simple steps how to complete the square for x² + 6x + 5 = 0.',
        },
        {
          id: 'q4',
          type: 'matching',
          text: 'Match each expression to its factorized form.',
          pairs: [
            { left: 'x² + 7x + 12', right: '(x + 3)(x + 4)' },
            { left: 'x² - x - 12', right: '(x - 4)(x + 3)' },
            { left: 'x² + x - 6', right: '(x + 3)(x - 2)' },
          ],
        },
        {
          id: 'q5',
          type: 'short-answer',
          text: 'Study this graph and state the x-intercepts.',
          image: 'https://images.unsplash.com/photo-1460574283810-2aab119d8511?auto=format&fit=crop&w=900&q=60',
        },
      ],
    },
    {
      id: 'asg-eng-2',
      title: 'English - Narrative Essay',
      subject: 'English Language',
      teacher: 'Mr. Danjuma',
      due: 'Tomorrow, 3:00 PM',
      instructions: 'Write 250-300 words. Add a clear beginning, middle, and ending.',
      questions: [
        {
          id: 'q1',
          type: 'essay',
          text: 'Write a narrative essay titled: A Day I Will Never Forget.',
        },
      ],
    },
  ],
  oldByWeek: [
    {
      week: 'WK1',
      items: [
        {
          id: 'old-bio-1',
          title: 'Biology Worksheet - Cell Parts',
          subject: 'Biology',
          submittedOn: 'Mon, Jan 20',
          status: 'Reviewed',
          mark: '18/20',
          teacherReview: 'Great effort. Labeling is correct. Revise mitochondria role.',
        },
      ],
    },
    {
      week: 'WK2',
      items: [
        {
          id: 'old-chem-2',
          title: 'Chemistry Quiz - Acids & Bases',
          subject: 'Chemistry',
          submittedOn: 'Thu, Jan 30',
          status: 'Reviewed',
          mark: '14/20',
          teacherReview: 'Good start. Work on balancing reactions and indicators.',
        },
      ],
    },
  ],
};
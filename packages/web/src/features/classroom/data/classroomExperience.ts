export const classroomDashboardMoments = [
  {
    id: 'moment_1',
    title: 'Assignment returned for correction',
    detail: 'Your English comprehension response needs stronger evidence before final grading.',
    action: 'Open Assignments',
    tab: 'assignments',
    tag: 'Teacher feedback',
  },
  {
    id: 'moment_2',
    title: 'Lesson note released for Week 6',
    detail: 'Chemical Bonding note is now available with AI summary, DRM reading, and offline access.',
    action: 'Read Lesson Notes',
    tab: 'lesson-notes',
    tag: 'Week 6 notes',
  },
  {
    id: 'moment_3',
    title: 'Live class opens tomorrow',
    detail: 'Biology revision live class opens at 9:00 AM with moderated chat and digital whiteboard tools.',
    action: 'Open Live Class',
    tab: 'live-class',
    tag: 'Countdown',
  },
];

export const socialFeedPosts = [
  {
    id: 'feed_1',
    author: 'Mrs. Jane Smith',
    role: 'Teacher',
    time: 'Today, 08:10 AM',
    body: 'Good morning class. I have posted the comprehension passage and follow-up questions. Read the instructions carefully before answering.',
    likes: 18,
    comments: [
      { id: 'c1', author: 'Amaka Adebayo', role: 'Student', text: 'Thank you ma. Can we submit typed answers?', likes: 4, replies: [{ id: 'r1', author: 'Mrs. Jane Smith', role: 'Teacher', text: 'Yes. Typed or uploaded PDF is allowed.' }] },
      { id: 'c2', author: 'Class Captain', role: 'Student', text: 'Reminder: study group starts by 5 PM.', likes: 2, replies: [] },
    ],
  },
  {
    id: 'feed_2',
    author: 'Mr. John Doe',
    role: 'Assistant Teacher',
    time: 'Yesterday, 04:35 PM',
    body: 'Mathematics revision live class has been moved to Thursday. Please raise questions here before the session so we can prioritize them.',
    likes: 24,
    comments: [
      { id: 'c3', author: 'Bisi Adebayo', role: 'Student', text: 'Please explain simultaneous equations again.', likes: 6, replies: [] },
    ],
  },
];

export const socialFeedEmojiGuide = [
  { emoji: '👍', meaning: 'I agree / acknowledged' },
  { emoji: '👏', meaning: 'Well done / appreciation' },
  { emoji: '🙏', meaning: 'Thank you / please' },
  { emoji: '✅', meaning: 'Completed / confirmed' },
  { emoji: '❓', meaning: 'I have a question' },
  { emoji: '💡', meaning: 'New idea / suggestion' },
  { emoji: '📚', meaning: 'Study / reading note' },
  { emoji: '📝', meaning: 'Assignment related' },
  { emoji: '⏰', meaning: 'Deadline / time reminder' },
  { emoji: '🎯', meaning: 'Target achieved / focus point' },
  { emoji: '🤝', meaning: 'Support / teamwork' },
  { emoji: '🙌', meaning: 'Celebration / success' },
  { emoji: '😊', meaning: 'Friendly tone / happiness' },
  { emoji: '🙂', meaning: 'Calm / okay' },
  { emoji: '😃', meaning: 'Excited / happy' },
  { emoji: '😄', meaning: 'Great mood / cheerful' },
  { emoji: '😁', meaning: 'Very happy' },
  { emoji: '🤔', meaning: 'Thinking / considering' },
  { emoji: '😕', meaning: 'I am confused' },
  { emoji: '😮', meaning: 'Surprised / wow' },
  { emoji: '😢', meaning: 'Sad / struggling' },
  { emoji: '😅', meaning: 'Relieved / that was close' },
  { emoji: '🔥', meaning: 'Excellent / trending' },
  { emoji: '⭐', meaning: 'Outstanding / favorite' },
  { emoji: '🏆', meaning: 'Top performance' },
  { emoji: '📌', meaning: 'Important point' },
  { emoji: '📎', meaning: 'Attachment / file reference' },
  { emoji: '🔔', meaning: 'Reminder / attention' },
  { emoji: '🔍', meaning: 'Need explanation / investigate' },
  { emoji: '💬', meaning: 'Discussion / reply needed' },
  { emoji: '📣', meaning: 'Announcement / urgent notice' },
  { emoji: '🚀', meaning: 'Let’s begin / momentum' },
  { emoji: '🧠', meaning: 'Critical thinking / deep work' },
  { emoji: '📈', meaning: 'Improvement / growth' },
  { emoji: '📉', meaning: 'Needs improvement' },
  { emoji: '🎉', meaning: 'Celebration / success moment' },
  { emoji: '🤗', meaning: 'Warm support / encouragement' },
  { emoji: '🤓', meaning: 'Study mode / academic focus' },
  { emoji: '👀', meaning: 'I am checking / watching' },
  { emoji: '✍️', meaning: 'Writing / preparing answer' },
  { emoji: '📖', meaning: 'Reading now' },
  { emoji: '🎧', meaning: 'Listening to audio lesson' },
  { emoji: '🎥', meaning: 'Video class / recording' },
  { emoji: '🖥️', meaning: 'Screen share / computer' },
  { emoji: '📱', meaning: 'Mobile access / device issue' },
  { emoji: '🌍', meaning: 'Global perspective / language' },
  { emoji: '❤️', meaning: 'I value this / strong approval' },
  { emoji: '💛', meaning: 'Friendly support' },
  { emoji: '💚', meaning: 'All good / safe to proceed' },
  { emoji: '⚠️', meaning: 'Warning / caution' },
];

export const assignmentBlueprints = [
  {
    id: 'assign_1',
    title: 'Comprehension and Grammar Blend',
    subject: 'English Language',
    className: 'JSS 1 Gold',
    due: 'Today, 06:00 PM',
    status: 'Returned for correction',
    allowComments: true,
    allowTeacherChat: true,
    score: '16/20',
    teacherFeedback: 'Strong opening. Improve evidence in question 4 and polish your concluding paragraph.',
    types: ['Comprehension', 'Multiple Choice', 'Short Answer', 'Essay'],
    shuffledNotice: 'Question order is uniquely shuffled per learner to reduce copying while preserving equal difficulty.',
    sections: [
      {
        type: 'Comprehension',
        title: 'Passage Study',
        instructions: 'Read the passage carefully and answer the questions that follow. Students see the same passage but question order differs per learner.',
        prompt: 'Adebisi walked across the compound before dawn, balancing a basin of books and dreams. She believed every small discipline would one day become a larger freedom.',
      },
      {
        type: 'Multiple Choice',
        title: 'Grammar Check',
        instructions: 'Correct options are mixed so the right answer does not repeat the same letter pattern.',
        questions: [
          { no: 1, stem: 'Choose the closest meaning of “discipline” in the passage.', options: ['strict punishment', 'consistent self-control', 'public ceremony', 'physical exercise'], answer: 'consistent self-control' },
          { no: 2, stem: 'Select the sentence with the correct punctuation.', options: ['The bell rang, and the class stood up.', 'The bell rang and, the class stood up.', 'The bell, rang and the class stood up.', 'The bell rang and the class, stood up.'], answer: 'The bell rang, and the class stood up.' },
        ],
      },
      {
        type: 'Matching',
        title: 'Vocabulary Matching',
        left: ['Resolve', 'Observe', 'Journey', 'Remark'],
        right: ['comment', 'trip', 'watch carefully', 'firm decision'],
      },
      {
        type: 'Short Answer',
        title: 'Reflection',
        prompt: 'In one or two sentences, explain what the writer means by “larger freedom.”',
      },
      {
        type: 'Essay',
        title: 'Extended Writing',
        prompt: 'Write a short essay on how discipline can help a student succeed in school.',
      },
    ],
    comments: [
      { id: 'g1', author: 'Class Stream', text: 'Remember to read the passage twice before answering.', likes: 5 },
      { id: 'g2', author: 'Amaka Adebayo', text: 'The matching section was easier after I wrote rough notes first.', likes: 2 },
    ],
    privateThread: [
      { id: 'p1', from: 'Student', text: 'Please explain if my conclusion needs more examples.' },
      { id: 'p2', from: 'Teacher', text: 'Yes. Add one practical school example and tighten the final sentence.' },
    ],
  },
  {
    id: 'assign_2',
    title: 'Biology Practical Readiness Check',
    subject: 'Biology',
    className: 'SS 1 Science',
    due: 'Friday, 10:00 AM',
    status: 'Draft',
    allowComments: true,
    allowTeacherChat: true,
    score: 'Pending',
    teacherFeedback: 'You can still edit your response before final submission.',
    types: ['Multiple Choice', 'Matching', 'Short Answer', 'Long Answer'],
    shuffledNotice: 'Every learner receives a different question order while answer keys remain mapped automatically.',
    sections: [
      {
        type: 'Multiple Choice',
        title: 'Concept Check',
        instructions: 'Objective questions auto-save whenever a teacher updates the correct option.',
        questions: [
          { no: 1, stem: 'Which organelle controls the activities of the cell?', options: ['ribosome', 'nucleus', 'cell membrane', 'vacuole'], answer: 'nucleus' },
          { no: 2, stem: 'Which process releases energy from food?', options: ['respiration', 'osmosis', 'diffusion', 'transpiration'], answer: 'respiration' },
        ],
      },
      {
        type: 'Long Answer',
        title: 'Practical Planning',
        prompt: 'Outline the steps you would follow to observe onion epidermal cells under a microscope.',
      },
    ],
    comments: [
      { id: 'g3', author: 'Mr. Samuel Okoro', text: 'Upload diagram images only if they are clear and labelled.', likes: 7 },
    ],
    privateThread: [
      { id: 'p3', from: 'Teacher', text: 'Use your own wording in the practical steps.' },
    ],
  },
  {
    id: 'assign_3',
    title: 'Fractions and Ratios Sprint',
    subject: 'Mathematics',
    className: 'JHS 1 Thinkers',
    due: 'Tomorrow, 08:30 AM',
    status: 'Open',
    allowComments: true,
    allowTeacherChat: true,
    score: 'Pending',
    teacherFeedback: 'Focus on showing your working clearly for every ratio step.',
    types: ['Multiple Choice', 'Short Answer'],
    shuffledNotice: 'Question order is randomized per learner while grading stays aligned.',
    sections: [
      {
        type: 'Multiple Choice',
        title: 'Quick Check',
        instructions: 'Choose the best answer for each item.',
        questions: [
          { no: 1, stem: 'What is 3/4 of 20?', options: ['12', '15', '16', '18'], answer: '15' },
          { no: 2, stem: 'Simplify 12:16.', options: ['3:4', '4:3', '6:8', '2:3'], answer: '3:4' },
        ],
      },
      {
        type: 'Short Answer',
        title: 'Working space',
        prompt: 'Explain how you would compare 2/3 and 3/5 without using a calculator.',
      },
    ],
    comments: [
      { id: 'g4', author: 'Math Club', text: 'Remember to convert mixed fractions before simplifying.', likes: 3 },
    ],
    privateThread: [
      { id: 'p4', from: 'Teacher', text: 'State each step so I can follow your reasoning.' },
    ],
  },
  {
    id: 'assign_4',
    title: 'Map Reading and Scale Exercise',
    subject: 'Geography',
    className: 'Grade 6 Leaders',
    due: 'Thursday, 02:00 PM',
    status: 'Draft',
    allowComments: true,
    allowTeacherChat: true,
    score: 'Draft saved',
    teacherFeedback: 'You started well. Review the scale conversion questions before submitting.',
    types: ['Matching', 'Short Answer', 'Essay'],
    shuffledNotice: 'Map interpretation questions rotate automatically across learners.',
    sections: [
      {
        type: 'Matching',
        title: 'Map Symbols',
        left: ['Hospital', 'Airport', 'Bridge', 'School'],
        right: ['Runway sign', 'Crossing structure', 'Health facility sign', 'Education symbol'],
      },
      {
        type: 'Short Answer',
        title: 'Scale Conversion',
        prompt: 'If 1 cm represents 5 km, what distance does 7 cm represent?',
      },
      {
        type: 'Essay',
        title: 'Direction Skills',
        prompt: 'Describe how a learner can use bearings to move from the school gate to the football field.',
      },
    ],
    comments: [
      { id: 'g5', author: 'Miss Adu', text: 'Use the legend before making assumptions about any symbol.', likes: 4 },
    ],
    privateThread: [
      { id: 'p5', from: 'Student', text: 'Can I explain the final answer in steps?' },
      { id: 'p6', from: 'Teacher', text: 'Yes. Step-by-step explanations earn method marks.' },
    ],
  },
  {
    id: 'assign_5',
    title: 'Nursery Sound and Letter Hunt',
    subject: 'Phonics',
    className: 'Discoverers',
    due: 'Friday, 11:00 AM',
    status: 'Open',
    allowComments: true,
    allowTeacherChat: true,
    score: 'Pending',
    teacherFeedback: 'Listen for beginning sounds carefully before circling the answer.',
    types: ['Matching', 'Short Answer'],
    shuffledNotice: 'Prompt order changes slightly so each learner stays attentive.',
    sections: [
      {
        type: 'Matching',
        title: 'Letter Match',
        left: ['A', 'B', 'C'],
        right: ['ball', 'apple', 'cat'],
      },
      {
        type: 'Short Answer',
        title: 'Sound Practice',
        prompt: 'Say one word that starts with the sound /m/ and write it with help.',
      },
    ],
    comments: [
      { id: 'g6', author: 'Class Helper', text: 'Parents can let learners trace the letters first on paper.', likes: 1 },
    ],
    privateThread: [
      { id: 'p7', from: 'Teacher', text: 'Voice-note help is available if your learner needs pronunciation support.' },
    ],
  },
  {
    id: 'assign_6',
    title: 'Civic Rights Reflection',
    subject: 'Civic Education',
    className: 'SHS 2 Trailmasters',
    due: 'Next Monday, 09:00 AM',
    status: 'Open',
    allowComments: true,
    allowTeacherChat: true,
    score: 'Pending',
    teacherFeedback: 'Use one current example from school or community life.',
    types: ['Multiple Choice', 'Essay'],
    shuffledNotice: 'Objective items and essay prompts are balanced across learners.',
    sections: [
      {
        type: 'Multiple Choice',
        title: 'Rights Check',
        questions: [
          { no: 1, stem: 'Which right protects freedom of expression?', options: ['Civic right', 'Trade right', 'Market right', 'Travel permit'], answer: 'Civic right' },
          { no: 2, stem: 'Citizenship also comes with what?', options: ['Only benefits', 'Responsibilities', 'No duties', 'Private rewards'], answer: 'Responsibilities' },
        ],
      },
      {
        type: 'Essay',
        title: 'Community Reflection',
        prompt: 'Write a short reflection on why rights and responsibilities must grow together in a school community.',
      },
    ],
    comments: [
      { id: 'g7', author: 'Debate Group', text: 'Link your answer to real behaviour, not only textbook definitions.', likes: 6 },
    ],
    privateThread: [
      { id: 'p8', from: 'Teacher', text: 'Keep the reflection concise but practical.' },
    ],
  },
];

export const lessonNotesLibrary = [
  {
    id: 'note_chem_6',
    title: 'Chemical Bonding and Valency',
    subject: 'Chemistry',
    topic: 'Bonding Basics',
    week: 6,
    format: 'PDF',
    visibility: 'Student + Parent',
    duration: '12 min read',
    summary: 'AI summary covers ionic and covalent bonding with highlighted teacher notes and worked examples.',
    access: 'Encrypted, DRM offline ready',
    analytics: { views: 138, downloads: 92, completion: '78%' },
    versions: ['v3 current', 'v2 archived', 'v1 archived'],
  },
  {
    id: 'note_lit_6',
    title: 'Narrative Techniques in African Fiction',
    subject: 'Literature',
    topic: 'Narrative Voice',
    week: 6,
    format: 'Slides',
    visibility: 'Student-only',
    duration: '9 min read',
    summary: 'Breaks down tone, plot, and narrator perspective. Includes AI recommendations for follow-up notes.',
    access: 'Encrypted, view-only export blocked',
    analytics: { views: 101, downloads: 53, completion: '61%' },
    versions: ['v2 current', 'v1 archived'],
  },
  {
    id: 'note_geo_5',
    title: 'Map Reading and Scale Interpretation',
    subject: 'Geography',
    topic: 'Scale and Bearings',
    week: 5,
    format: 'Video',
    visibility: 'Teacher-only',
    duration: '18 min watch',
    summary: 'Recorded walkthrough for map scale interpretation and contour reading.',
    access: 'Internal reference only',
    analytics: { views: 15, downloads: 4, completion: '40%' },
    versions: ['v1 current'],
  },
];

export const practicePrograms = [
  {
    id: 'prac_1',
    title: 'Fractions Weak-Area Drill',
    subject: 'Mathematics',
    questions: 15,
    mode: 'Weak Area Mode',
    reward: '+12 Auras',
    note: 'Built from your last two quiz attempts with hint support.',
  },
  {
    id: 'prac_2',
    title: 'Past Questions: Cell Division',
    subject: 'Biology',
    questions: 20,
    mode: 'Exam Review Mode',
    reward: '+18 Auras',
    note: 'Objective and short-answer mix drawn from previous internal exams.',
  },
  {
    id: 'prac_3',
    title: 'Vocabulary Builder Challenge',
    subject: 'English Language',
    questions: 10,
    mode: 'Practice Mode',
    reward: '+8 Auras',
    note: 'Adaptive drill targeting comprehension and vocabulary gaps.',
  },
];

export const liveClasses = [
  {
    id: 'live_1',
    title: 'Biology Revision Live Class',
    mode: 'Student Lesson',
    schedule: 'Tomorrow, 09:00 AM',
    duration: '60 mins',
    attendees: 186,
    limit: 300,
    hosts: ['Mrs. Jane Smith', 'Mr. Samuel Okoro'],
    tools: ['Raise hand', 'Screen share', 'Digital backgrounds', 'Moderated live chat', 'Waiting room', 'Recording for 1 week'],
    note: 'If both host and assistant leave, the class stays alive for only 30 minutes before auto-ending.',
  },
  {
    id: 'live_2',
    title: 'PTF Quarterly Forum',
    mode: 'Parents-Teachers Forum',
    schedule: 'Saturday, 10:00 AM',
    duration: '90 mins',
    attendees: 243,
    limit: 300,
    hosts: ['Principal', 'PTF Secretary'],
    tools: ['Raise hand', 'Screen share', 'Attendance log', 'Parent microphone queue', 'Digital backgrounds', 'Meeting notes'],
    note: 'This same live-class system is available for staff meetings and leadership briefings.',
  },
];

export const resultSessions = [
  {
    "session": "2025/2026",
    "feeStatus": "Paid",
    "outstanding": "N0",
    "terms": [
      {
        "name": "Term 3",
        "summary": {
          "average": "81.5%",
          "grade": "A-",
          "position": "5rd of 120",
          "attendance": "96%",
          "promotion": "Promoted",
          "teacherRemark": "Consistent and focused.",
          "principalRemark": "Keep the academic discipline strong."
        },
        "subjects": [
          {
            "subject": "Mathematics",
            "ca": 21,
            "exam": 34,
            "total": 55,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "English Language",
            "ca": 32,
            "exam": 35,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Biology",
            "ca": 36,
            "exam": 31,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Chemistry",
            "ca": 27,
            "exam": 35,
            "total": 62,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Physics",
            "ca": 25,
            "exam": 29,
            "total": 54,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Civic Education",
            "ca": 24,
            "exam": 29,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Economics",
            "ca": 38,
            "exam": 13,
            "total": 51,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Geography",
            "ca": 25,
            "exam": 19,
            "total": 44,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Government",
            "ca": 21,
            "exam": 39,
            "total": 60,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "History",
            "ca": 29,
            "exam": 16,
            "total": 45,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Literature in English",
            "ca": 30,
            "exam": 38,
            "total": 68,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "C.R.S",
            "ca": 24,
            "exam": 29,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "I.R.S",
            "ca": 29,
            "exam": 23,
            "total": 52,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Agricultural Science",
            "ca": 27,
            "exam": 27,
            "total": 54,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Computer Science",
            "ca": 27,
            "exam": 29,
            "total": 56,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Phy & Health Education",
            "ca": 32,
            "exam": 35,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Social Studies",
            "ca": 31,
            "exam": 12,
            "total": 43,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Home Economics",
            "ca": 31,
            "exam": 35,
            "total": 66,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "French",
            "ca": 39,
            "exam": 31,
            "total": 70,
            "grade": "A",
            "remark": "Excellent"
          },
          {
            "subject": "Basic Tech",
            "ca": 26,
            "exam": 35,
            "total": 61,
            "grade": "B",
            "remark": "Very Good"
          }
        ],
        "trend": [
          "68",
          "74",
          "82"
        ]
      },
      {
        "name": "Term 2",
        "summary": {
          "average": "86.9%",
          "grade": "A-",
          "position": "7rd of 120",
          "attendance": "96%",
          "promotion": "Pass",
          "teacherRemark": "Consistent and focused.",
          "principalRemark": "Keep the academic discipline strong."
        },
        "subjects": [
          {
            "subject": "Mathematics",
            "ca": 29,
            "exam": 19,
            "total": 48,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "English Language",
            "ca": 34,
            "exam": 33,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Biology",
            "ca": 33,
            "exam": 25,
            "total": 58,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Chemistry",
            "ca": 39,
            "exam": 24,
            "total": 63,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Physics",
            "ca": 31,
            "exam": 36,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Civic Education",
            "ca": 38,
            "exam": 35,
            "total": 73,
            "grade": "A",
            "remark": "Excellent"
          },
          {
            "subject": "Economics",
            "ca": 23,
            "exam": 10,
            "total": 33,
            "grade": "F9",
            "remark": "Fail"
          },
          {
            "subject": "Geography",
            "ca": 22,
            "exam": 24,
            "total": 46,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Government",
            "ca": 24,
            "exam": 13,
            "total": 37,
            "grade": "F9",
            "remark": "Fail"
          },
          {
            "subject": "History",
            "ca": 25,
            "exam": 31,
            "total": 56,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Literature in English",
            "ca": 36,
            "exam": 32,
            "total": 68,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "C.R.S",
            "ca": 21,
            "exam": 30,
            "total": 51,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "I.R.S",
            "ca": 37,
            "exam": 31,
            "total": 68,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Agricultural Science",
            "ca": 22,
            "exam": 32,
            "total": 54,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Computer Science",
            "ca": 34,
            "exam": 10,
            "total": 44,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Phy & Health Education",
            "ca": 30,
            "exam": 12,
            "total": 42,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Social Studies",
            "ca": 38,
            "exam": 29,
            "total": 67,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Home Economics",
            "ca": 31,
            "exam": 12,
            "total": 43,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "French",
            "ca": 37,
            "exam": 20,
            "total": 57,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Basic Tech",
            "ca": 28,
            "exam": 21,
            "total": 49,
            "grade": "D",
            "remark": "Pass"
          }
        ],
        "trend": [
          "68",
          "74",
          "82"
        ]
      },
      {
        "name": "Term 1",
        "summary": {
          "average": "83.2%",
          "grade": "A-",
          "position": "8rd of 120",
          "attendance": "96%",
          "promotion": "Pass",
          "teacherRemark": "Consistent and focused.",
          "principalRemark": "Keep the academic discipline strong."
        },
        "subjects": [
          {
            "subject": "Mathematics",
            "ca": 34,
            "exam": 19,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "English Language",
            "ca": 32,
            "exam": 21,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Biology",
            "ca": 26,
            "exam": 11,
            "total": 37,
            "grade": "F9",
            "remark": "Fail"
          },
          {
            "subject": "Chemistry",
            "ca": 35,
            "exam": 18,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Physics",
            "ca": 26,
            "exam": 27,
            "total": 53,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Civic Education",
            "ca": 34,
            "exam": 15,
            "total": 49,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Economics",
            "ca": 20,
            "exam": 23,
            "total": 43,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Geography",
            "ca": 36,
            "exam": 20,
            "total": 56,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Government",
            "ca": 30,
            "exam": 39,
            "total": 69,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "History",
            "ca": 26,
            "exam": 30,
            "total": 56,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Literature in English",
            "ca": 25,
            "exam": 12,
            "total": 37,
            "grade": "F9",
            "remark": "Fail"
          },
          {
            "subject": "C.R.S",
            "ca": 33,
            "exam": 28,
            "total": 61,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "I.R.S",
            "ca": 25,
            "exam": 20,
            "total": 45,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Agricultural Science",
            "ca": 35,
            "exam": 30,
            "total": 65,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "Computer Science",
            "ca": 21,
            "exam": 27,
            "total": 48,
            "grade": "D",
            "remark": "Pass"
          },
          {
            "subject": "Phy & Health Education",
            "ca": 31,
            "exam": 20,
            "total": 51,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Social Studies",
            "ca": 26,
            "exam": 28,
            "total": 54,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Home Economics",
            "ca": 37,
            "exam": 32,
            "total": 69,
            "grade": "B",
            "remark": "Very Good"
          },
          {
            "subject": "French",
            "ca": 28,
            "exam": 29,
            "total": 57,
            "grade": "C",
            "remark": "Credit"
          },
          {
            "subject": "Basic Tech",
            "ca": 36,
            "exam": 10,
            "total": 46,
            "grade": "D",
            "remark": "Pass"
          }
        ],
        "trend": [
          "68",
          "74",
          "82"
        ]
      }
    ]
  }
];

export const teacherClasses = [
  { id: 'JSS1-A', name: 'JSS 1 Gold', subject: 'Integrated Classroom', students: 42, nextPeriod: 'Tomorrow, 08:00', alerts: '2 at-risk students' },
  { id: 'JSS2-B', name: 'JSS 2 Blue', subject: 'Integrated Classroom', students: 38, nextPeriod: 'Today, 11:00', alerts: 'CA draft pending' },
  { id: 'SSS1-C', name: 'SS 1 Science', subject: 'Integrated Classroom', students: 25, nextPeriod: 'Friday, 09:30', alerts: 'Live class scheduled' },
];

export const teacherAttendanceSettings = {
  defaultMode: 'Class-wide',
  schoolChoice: 'Attendance is currently taken per class. Subject mode can be enabled by school policy.',
  policy: 'All teachers may take attendance when the school enables school-wide attendance rights. Class Teacher can still review and override archived exceptions.',
  alerts: ['Highlight students with 3+ absences', 'Enable bulk entry', 'Export PDF / CSV', 'Offline sync available'],
};

export const teacherAttendanceRegister = [
  { id: 'stu_01', name: 'Adekunle Gold', roll: '001', status: 'Present', risk: 'Normal' },
  { id: 'stu_02', name: 'Bisi Adebayo', roll: '002', status: 'Late', risk: 'Watchlist' },
  { id: 'stu_03', name: 'Chinedu Okoro', roll: '003', status: 'Absent', risk: 'At Risk' },
  { id: 'stu_04', name: 'Damilola Adeyemi', roll: '004', status: 'Excused', risk: 'Normal' },
  { id: 'stu_05', name: 'Emeka Nwosu', roll: '005', status: 'Present', risk: 'Normal' },
  { id: 'stu_06', name: 'Fatima Bello', roll: '006', status: 'Present', risk: 'Normal' },
];

export const attendanceHistory = [
  { date: '2026-03-05', status: 'Present', time: '07:45 AM', reason: 'On time' },
  { date: '2026-03-04', status: 'Present', time: '07:50 AM', reason: 'On time' },
  { date: '2026-03-03', status: 'Late', time: '08:15 AM', reason: 'Traffic delay recorded by class teacher' },
  { date: '2026-03-02', status: 'Present', time: '07:40 AM', reason: 'On time' },
  { date: '2026-02-28', status: 'Absent', time: '-', reason: 'Sick leave recorded' },
];


export const studentResultSessions = [
  {
    "id": "std_01",
    "name": "Amaka Adebayo",
    "sessions": [
      {
        "session": "2025/2026",
        "feeStatus": "Paid",
        "outstanding": "N0",
        "terms": [
          {
            "name": "Term 3",
            "summary": {
              "average": "81.5%",
              "grade": "A-",
              "position": "5rd of 120",
              "attendance": "96%",
              "promotion": "Promoted",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 21,
                "exam": 34,
                "total": 55,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "English Language",
                "ca": 32,
                "exam": 35,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Biology",
                "ca": 36,
                "exam": 31,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Chemistry",
                "ca": 27,
                "exam": 35,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Physics",
                "ca": 25,
                "exam": 29,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Civic Education",
                "ca": 24,
                "exam": 29,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Economics",
                "ca": 38,
                "exam": 13,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Geography",
                "ca": 25,
                "exam": 19,
                "total": 44,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Government",
                "ca": 21,
                "exam": 39,
                "total": 60,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "History",
                "ca": 29,
                "exam": 16,
                "total": 45,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Literature in English",
                "ca": 30,
                "exam": 38,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "C.R.S",
                "ca": 24,
                "exam": 29,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "I.R.S",
                "ca": 29,
                "exam": 23,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Agricultural Science",
                "ca": 27,
                "exam": 27,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Computer Science",
                "ca": 27,
                "exam": 29,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 32,
                "exam": 35,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Social Studies",
                "ca": 31,
                "exam": 12,
                "total": 43,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Home Economics",
                "ca": 31,
                "exam": 35,
                "total": 66,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "French",
                "ca": 39,
                "exam": 31,
                "total": 70,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Basic Tech",
                "ca": 26,
                "exam": 35,
                "total": 61,
                "grade": "B",
                "remark": "Very Good"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 2",
            "summary": {
              "average": "86.9%",
              "grade": "A-",
              "position": "7rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 29,
                "exam": 19,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "English Language",
                "ca": 34,
                "exam": 33,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Biology",
                "ca": 33,
                "exam": 25,
                "total": 58,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Chemistry",
                "ca": 39,
                "exam": 24,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Physics",
                "ca": 31,
                "exam": 36,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Civic Education",
                "ca": 38,
                "exam": 35,
                "total": 73,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Economics",
                "ca": 23,
                "exam": 10,
                "total": 33,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Geography",
                "ca": 22,
                "exam": 24,
                "total": 46,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Government",
                "ca": 24,
                "exam": 13,
                "total": 37,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "History",
                "ca": 25,
                "exam": 31,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Literature in English",
                "ca": 36,
                "exam": 32,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "C.R.S",
                "ca": 21,
                "exam": 30,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "I.R.S",
                "ca": 37,
                "exam": 31,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Agricultural Science",
                "ca": 22,
                "exam": 32,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Computer Science",
                "ca": 34,
                "exam": 10,
                "total": 44,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 30,
                "exam": 12,
                "total": 42,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Social Studies",
                "ca": 38,
                "exam": 29,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Home Economics",
                "ca": 31,
                "exam": 12,
                "total": 43,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "French",
                "ca": 37,
                "exam": 20,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Basic Tech",
                "ca": 28,
                "exam": 21,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 1",
            "summary": {
              "average": "83.2%",
              "grade": "A-",
              "position": "8rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 34,
                "exam": 19,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "English Language",
                "ca": 32,
                "exam": 21,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Biology",
                "ca": 26,
                "exam": 11,
                "total": 37,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Chemistry",
                "ca": 35,
                "exam": 18,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Physics",
                "ca": 26,
                "exam": 27,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Civic Education",
                "ca": 34,
                "exam": 15,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Economics",
                "ca": 20,
                "exam": 23,
                "total": 43,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Geography",
                "ca": 36,
                "exam": 20,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Government",
                "ca": 30,
                "exam": 39,
                "total": 69,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "History",
                "ca": 26,
                "exam": 30,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Literature in English",
                "ca": 25,
                "exam": 12,
                "total": 37,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "C.R.S",
                "ca": 33,
                "exam": 28,
                "total": 61,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "I.R.S",
                "ca": 25,
                "exam": 20,
                "total": 45,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Agricultural Science",
                "ca": 35,
                "exam": 30,
                "total": 65,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Computer Science",
                "ca": 21,
                "exam": 27,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 31,
                "exam": 20,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Social Studies",
                "ca": 26,
                "exam": 28,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Home Economics",
                "ca": 37,
                "exam": 32,
                "total": 69,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "French",
                "ca": 28,
                "exam": 29,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Basic Tech",
                "ca": 36,
                "exam": 10,
                "total": 46,
                "grade": "D",
                "remark": "Pass"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "std_02",
    "name": "Bisi Olawale",
    "sessions": [
      {
        "session": "2025/2026",
        "feeStatus": "Paid",
        "outstanding": "N0",
        "terms": [
          {
            "name": "Term 3",
            "summary": {
              "average": "81.5%",
              "grade": "A-",
              "position": "5rd of 120",
              "attendance": "96%",
              "promotion": "Promoted",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 26,
                "exam": 38,
                "total": 64,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "English Language",
                "ca": 26,
                "exam": 17,
                "total": 43,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Biology",
                "ca": 33,
                "exam": 31,
                "total": 64,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Chemistry",
                "ca": 26,
                "exam": 23,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Physics",
                "ca": 22,
                "exam": 21,
                "total": 43,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Civic Education",
                "ca": 21,
                "exam": 38,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Economics",
                "ca": 37,
                "exam": 16,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Geography",
                "ca": 38,
                "exam": 25,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Government",
                "ca": 35,
                "exam": 16,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "History",
                "ca": 35,
                "exam": 24,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Literature in English",
                "ca": 20,
                "exam": 35,
                "total": 55,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "C.R.S",
                "ca": 32,
                "exam": 10,
                "total": 42,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "I.R.S",
                "ca": 29,
                "exam": 24,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Agricultural Science",
                "ca": 32,
                "exam": 18,
                "total": 50,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Computer Science",
                "ca": 38,
                "exam": 21,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 33,
                "exam": 21,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Social Studies",
                "ca": 20,
                "exam": 32,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Home Economics",
                "ca": 20,
                "exam": 19,
                "total": 39,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "French",
                "ca": 22,
                "exam": 22,
                "total": 44,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Basic Tech",
                "ca": 29,
                "exam": 25,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 2",
            "summary": {
              "average": "86.9%",
              "grade": "A-",
              "position": "7rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 27,
                "exam": 22,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "English Language",
                "ca": 33,
                "exam": 22,
                "total": 55,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Biology",
                "ca": 21,
                "exam": 18,
                "total": 39,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Chemistry",
                "ca": 39,
                "exam": 31,
                "total": 70,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Physics",
                "ca": 20,
                "exam": 34,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Civic Education",
                "ca": 28,
                "exam": 22,
                "total": 50,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Economics",
                "ca": 25,
                "exam": 12,
                "total": 37,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Geography",
                "ca": 25,
                "exam": 28,
                "total": 53,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Government",
                "ca": 21,
                "exam": 30,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "History",
                "ca": 21,
                "exam": 14,
                "total": 35,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Literature in English",
                "ca": 26,
                "exam": 26,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "C.R.S",
                "ca": 24,
                "exam": 24,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "I.R.S",
                "ca": 30,
                "exam": 18,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Agricultural Science",
                "ca": 34,
                "exam": 38,
                "total": 72,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Computer Science",
                "ca": 22,
                "exam": 27,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 33,
                "exam": 27,
                "total": 60,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Social Studies",
                "ca": 32,
                "exam": 30,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Home Economics",
                "ca": 37,
                "exam": 14,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "French",
                "ca": 30,
                "exam": 29,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Basic Tech",
                "ca": 38,
                "exam": 12,
                "total": 50,
                "grade": "C",
                "remark": "Credit"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 1",
            "summary": {
              "average": "83.2%",
              "grade": "A-",
              "position": "8rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 25,
                "exam": 19,
                "total": 44,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "English Language",
                "ca": 29,
                "exam": 23,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Biology",
                "ca": 26,
                "exam": 12,
                "total": 38,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Chemistry",
                "ca": 36,
                "exam": 23,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Physics",
                "ca": 24,
                "exam": 38,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Civic Education",
                "ca": 32,
                "exam": 19,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Economics",
                "ca": 26,
                "exam": 32,
                "total": 58,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Geography",
                "ca": 37,
                "exam": 17,
                "total": 54,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Government",
                "ca": 35,
                "exam": 35,
                "total": 70,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "History",
                "ca": 37,
                "exam": 10,
                "total": 47,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Literature in English",
                "ca": 32,
                "exam": 36,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "C.R.S",
                "ca": 28,
                "exam": 29,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "I.R.S",
                "ca": 30,
                "exam": 15,
                "total": 45,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Agricultural Science",
                "ca": 20,
                "exam": 17,
                "total": 37,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Computer Science",
                "ca": 26,
                "exam": 24,
                "total": 50,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 22,
                "exam": 30,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Social Studies",
                "ca": 31,
                "exam": 28,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Home Economics",
                "ca": 33,
                "exam": 14,
                "total": 47,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "French",
                "ca": 24,
                "exam": 27,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Basic Tech",
                "ca": 25,
                "exam": 30,
                "total": 55,
                "grade": "C",
                "remark": "Credit"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "std_03",
    "name": "Chukwudi Nwosu",
    "sessions": [
      {
        "session": "2025/2026",
        "feeStatus": "Paid",
        "outstanding": "N0",
        "terms": [
          {
            "name": "Term 3",
            "summary": {
              "average": "81.5%",
              "grade": "A-",
              "position": "5rd of 120",
              "attendance": "96%",
              "promotion": "Promoted",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 20,
                "exam": 39,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "English Language",
                "ca": 30,
                "exam": 32,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Biology",
                "ca": 34,
                "exam": 23,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Chemistry",
                "ca": 33,
                "exam": 31,
                "total": 64,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Physics",
                "ca": 32,
                "exam": 30,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Civic Education",
                "ca": 30,
                "exam": 35,
                "total": 65,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Economics",
                "ca": 31,
                "exam": 30,
                "total": 61,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Geography",
                "ca": 23,
                "exam": 16,
                "total": 39,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Government",
                "ca": 24,
                "exam": 33,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "History",
                "ca": 38,
                "exam": 38,
                "total": 76,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Literature in English",
                "ca": 21,
                "exam": 15,
                "total": 36,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "C.R.S",
                "ca": 29,
                "exam": 19,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "I.R.S",
                "ca": 28,
                "exam": 34,
                "total": 62,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Agricultural Science",
                "ca": 29,
                "exam": 34,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Computer Science",
                "ca": 20,
                "exam": 28,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 28,
                "exam": 11,
                "total": 39,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Social Studies",
                "ca": 22,
                "exam": 24,
                "total": 46,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Home Economics",
                "ca": 25,
                "exam": 38,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "French",
                "ca": 30,
                "exam": 28,
                "total": 58,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Basic Tech",
                "ca": 39,
                "exam": 38,
                "total": 77,
                "grade": "A",
                "remark": "Excellent"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 2",
            "summary": {
              "average": "86.9%",
              "grade": "A-",
              "position": "7rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 20,
                "exam": 36,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "English Language",
                "ca": 35,
                "exam": 33,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Biology",
                "ca": 30,
                "exam": 18,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Chemistry",
                "ca": 34,
                "exam": 14,
                "total": 48,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Physics",
                "ca": 34,
                "exam": 11,
                "total": 45,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Civic Education",
                "ca": 26,
                "exam": 26,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Economics",
                "ca": 32,
                "exam": 35,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Geography",
                "ca": 25,
                "exam": 11,
                "total": 36,
                "grade": "F9",
                "remark": "Fail"
              },
              {
                "subject": "Government",
                "ca": 28,
                "exam": 32,
                "total": 60,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "History",
                "ca": 22,
                "exam": 22,
                "total": 44,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Literature in English",
                "ca": 24,
                "exam": 23,
                "total": 47,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "C.R.S",
                "ca": 26,
                "exam": 26,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "I.R.S",
                "ca": 28,
                "exam": 37,
                "total": 65,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Agricultural Science",
                "ca": 31,
                "exam": 28,
                "total": 59,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Computer Science",
                "ca": 34,
                "exam": 15,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 27,
                "exam": 18,
                "total": 45,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Social Studies",
                "ca": 31,
                "exam": 37,
                "total": 68,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Home Economics",
                "ca": 24,
                "exam": 32,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "French",
                "ca": 35,
                "exam": 32,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Basic Tech",
                "ca": 36,
                "exam": 15,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          },
          {
            "name": "Term 1",
            "summary": {
              "average": "83.2%",
              "grade": "A-",
              "position": "8rd of 120",
              "attendance": "96%",
              "promotion": "Pass",
              "teacherRemark": "Consistent and focused.",
              "principalRemark": "Keep the academic discipline strong."
            },
            "subjects": [
              {
                "subject": "Mathematics",
                "ca": 23,
                "exam": 29,
                "total": 52,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "English Language",
                "ca": 20,
                "exam": 37,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Biology",
                "ca": 31,
                "exam": 20,
                "total": 51,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Chemistry",
                "ca": 24,
                "exam": 32,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Physics",
                "ca": 38,
                "exam": 12,
                "total": 50,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Civic Education",
                "ca": 29,
                "exam": 20,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Economics",
                "ca": 34,
                "exam": 29,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Geography",
                "ca": 34,
                "exam": 13,
                "total": 47,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Government",
                "ca": 39,
                "exam": 24,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "History",
                "ca": 35,
                "exam": 30,
                "total": 65,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Literature in English",
                "ca": 29,
                "exam": 38,
                "total": 67,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "C.R.S",
                "ca": 29,
                "exam": 28,
                "total": 57,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "I.R.S",
                "ca": 34,
                "exam": 35,
                "total": 69,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Agricultural Science",
                "ca": 27,
                "exam": 29,
                "total": 56,
                "grade": "C",
                "remark": "Credit"
              },
              {
                "subject": "Computer Science",
                "ca": 30,
                "exam": 33,
                "total": 63,
                "grade": "B",
                "remark": "Very Good"
              },
              {
                "subject": "Phy & Health Education",
                "ca": 23,
                "exam": 23,
                "total": 46,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "Social Studies",
                "ca": 39,
                "exam": 37,
                "total": 76,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Home Economics",
                "ca": 22,
                "exam": 27,
                "total": 49,
                "grade": "D",
                "remark": "Pass"
              },
              {
                "subject": "French",
                "ca": 38,
                "exam": 32,
                "total": 70,
                "grade": "A",
                "remark": "Excellent"
              },
              {
                "subject": "Basic Tech",
                "ca": 26,
                "exam": 13,
                "total": 39,
                "grade": "F9",
                "remark": "Fail"
              }
            ],
            "trend": [
              "68",
              "74",
              "82"
            ]
          }
        ]
      }
    ]
  }
];

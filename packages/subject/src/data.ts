import { Subject } from './types';

export const initialSubjects: Subject[] = [
  {
    id: '1',
    name: 'Mathematics',
    code: 'MTH101',
    teacherName: 'Mr. Anderson',
    color: 'from-amber-500 to-orange-600',
    pattern: 'radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px)',
    neonColor: 'rgba(245, 158, 11, 0.6)', // amber
    curriculum: {
      term1: [
        { id: 't1', title: 'Algebraic Expressions', isTreated: true },
        { id: 't2', title: 'Linear Equations', isTreated: false },
        { id: 't3', title: 'Quadratic Equations', isTreated: false },
      ],
      term2: [],
      term3: []
    },
    classworks: [
      { id: 'cw1', title: 'Algebra Practice', description: 'Solve equations 1-10 on page 42.', date: new Date().toISOString() }
    ],
    assignments: [
      {
        id: 'a1',
        title: 'Linear Equations Problem Set',
        description: 'Complete the attached worksheet.',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        points: 100,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            prompt: 'What is the value of x in 2x = 4?',
            options: ['1', '2', '3', '4'],
            points: 50
          },
          {
            id: 'q2',
            type: 'short_answer',
            prompt: 'Explain what a linear equation is.',
            points: 50
          }
        ],
        submissions: []
      }
    ],
    liveClasses: [
      { id: 'lc1', title: 'Weekly Math Review', startTime: new Date().toISOString(), status: 'live' }
    ],
    unreadCounts: {
      stream: 2,
      classwork: 1,
      assignment: 3,
      live: 1
    }
  },
  {
    id: '2',
    name: 'Physics',
    code: 'PHY101',
    teacherName: 'Mrs. Smith',
    color: 'from-rose-500 to-red-600',
    pattern: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
    neonColor: 'rgba(244, 63, 94, 0.6)', // rose
    curriculum: {
      term1: [
        { id: 'p1', title: 'Kinematics', isTreated: true },
        { id: 'p2', title: 'Dynamics', isTreated: true },
        { id: 'p3', title: 'Work, Energy and Power', isTreated: false },
      ],
      term2: [],
      term3: []
    },
    classworks: [],
    assignments: [],
    liveClasses: []
  },
  {
    id: '3',
    name: 'Literature',
    code: 'LIT101',
    teacherName: 'Ms. Davis',
    color: 'from-yellow-500 to-amber-600',
    pattern: 'radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px)',
    neonColor: 'rgba(234, 179, 8, 0.6)', // yellow
    curriculum: {
      term1: [
        { id: 'l1', title: 'Introduction to Poetry', isTreated: false },
      ],
      term2: [],
      term3: []
    },
    classworks: [],
    assignments: [],
    liveClasses: []
  },
  {
    id: '4',
    name: 'Computer Science',
    code: 'CSC101',
    teacherName: 'Mr. Turing',
    color: 'from-emerald-500 to-teal-600',
    pattern: 'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
    neonColor: 'rgba(16, 185, 129, 0.6)', // emerald
    curriculum: {
      term1: [
        { id: 'c1', title: 'Introduction to Algorithms', isTreated: true },
        { id: 'c2', title: 'Data Structures', isTreated: false },
      ],
      term2: [],
      term3: []
    },
    classworks: [],
    assignments: [],
    liveClasses: []
  }
];

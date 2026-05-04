export const classroomTabs = [
  { id: 'stream', label: 'Stream' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'materials', label: 'Materials' },
  { id: 'practice', label: 'Practice' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'live', label: 'Live' },
  { id: 'classmates', label: 'Classmates' },
  { id: 'teachers', label: 'Teachers' },
];

export const streamPostTypes = [
  'Announcement',
  'Question',
  'Discussion',
  'Resource Share',
  'Assignment Notification',
  'Live Session Notification',
];

export const streamPostsSeed = [];
export const subjects = [];

export const materials = {
  notes: [],
  videos: [],
  images: [],
};

export const practice = {
  weakTopics: [],
  drills: [],
  mistakes: [],
  questions: [],
  topicPerformanceMap: {},
};

export const assignmentData = {
  normal: [],
  quiz: {
    title: '',
    durationMins: 0,
    randomized: false,
    questions: [],
  },
  matching: {
    title: '',
    pairs: [],
  },
  policy: {
    latePenalty: 'Configured by school policy',
    retake: 'Configured by school policy',
    antiCheat: 'Configured by school policy',
  },
};

export const liveSessionSeed = {
  className: 'Live Classroom',
  sessionTitle: '',
  host: '',
  participants: [],
  chats: [],
  polls: [],
};

export const classmates = [];
export const teachers = [];

export const auraBalances = {};
export const farmingModeStatus = {};
export const auraTransactions = [];
export const staffToStaffGifts = [];

export const auraSpendingOptions = [
  {
    id: 'SPEND-001',
    category: 'ai_tutor',
    name: 'AI Tutor - Homework Help',
    description: 'Get step-by-step solutions and guidance for homework problems',
    costAuras: 1,
    icon: '🤖',
    available: true,
    userRole: ['student'],
  },
  {
    id: 'SPEND-002',
    category: 'ai_tutor',
    name: 'AI Tutor - Lesson Explanation',
    description: 'Get simplified or deeper explanations for complex topics',
    costAuras: 2,
    icon: '📚',
    available: true,
    userRole: ['student'],
  },
  {
    id: 'SPEND-003',
    category: 'ai_tutor',
    name: 'AI Tutor - Exam Prep',
    description: 'Access practice tests, tips, and focused revision materials',
    costAuras: 2,
    icon: '✏️',
    available: true,
    userRole: ['student'],
  },
  {
    id: 'SPEND-004',
    category: 'library',
    name: 'Premium Library Book',
    description: 'Access premium books in the Global Library',
    costAuras: 3,
    icon: '📖',
    available: true,
    userRole: ['student', 'parent'],
  },
  {
    id: 'SPEND-005',
    category: 'ai_school_health',
    name: 'AI School Health - Premium Report',
    description: 'Access premium analytics on student performance and trends',
    costAuras: 5,
    icon: '📊',
    available: true,
    userRole: ['teacher', 'admin'],
  },
  {
    id: 'SPEND-006',
    category: 'ai_teacher',
    name: 'AI Teacher Assistant - Lesson Planning',
    description: 'AI-generated lesson plans based on syllabus and class level',
    costAuras: 3,
    icon: '🎯',
    available: true,
    userRole: ['teacher'],
  },
];

export const auraRewardTiers = [
  {
    tier: 'bronze',
    minAuras: 0,
    maxAuras: 99,
    color: '#CD7F32',
    badge: '🥉',
    description: 'Beginner Learner',
  },
  {
    tier: 'silver',
    minAuras: 100,
    maxAuras: 249,
    color: '#C0C0C0',
    badge: '🥈',
    description: 'Dedicated Learner',
  },
  {
    tier: 'gold',
    minAuras: 250,
    maxAuras: 499,
    color: '#FFD700',
    badge: '🥇',
    description: 'Excellent Performer',
  },
  {
    tier: 'platinum',
    minAuras: 500,
    maxAuras: 999,
    color: '#E5E4E2',
    badge: '💎',
    description: 'Elite Scholar',
  },
  {
    tier: 'diamond',
    minAuras: 1000,
    maxAuras: Infinity,
    color: '#B9F2FF',
    badge: '✨',
    description: 'Master Scholar',
  },
];

export const resetSchedules = [];
export const cashoutRequests = [];

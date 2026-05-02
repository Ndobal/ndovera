export const libraryTabs = ['ebooks','offline','studio'];

export const ebooks = [
  {
    id: 'book-ndovera-about',
    title: 'About Ndovera',
    author: 'Ndovera',
    subject: 'Platform',
    class: 'All',
    pages: 18,
    price: 0,
    status: 'official', // 🟣 Official
    pinned: true,
    type: 'guide',
    coverUrl: '/static/covers/about-ndovera.jpg',
    description: 'Official overview of the Ndovera platform, policies, and features.',
    aiReview: { passed: true, score: 98 },
    encrypted: true,
    downloadable: true,
    ownerId: 'ndovera',
  },
  {
    id: 'book-algebra-simplified',
    title: 'Algebra Simplified',
    author: 'Ndovera',
    subject: 'Mathematics',
    class: 'SS2',
    pages: 120,
    price: 0,
    status: 'approved', // 🟢 Approved
    pinned: false,
    type: 'textbook',
    coverUrl: '/static/covers/algebra.jpg',
    description: 'Concise algebra guide for SS2 students.',
    aiReview: { passed: true, score: 92 },
    encrypted: true,
    downloadable: true,
    ownerId: 'ndovera',
  },
  {
    id: 'book-waec-2010-23',
    title: 'WAEC Past Qs (2010–23)',
    author: 'Verified User',
    subject: 'Exams',
    class: 'SS3',
    pages: 340,
    price: 2000,
    status: 'paid', // 🔒 Paid
    pinned: false,
    type: 'exam',
    coverUrl: '/static/covers/waec.jpg',
    description: 'Collection of past WAEC questions from 2010–2023.',
    aiReview: { passed: true, score: 88 },
    encrypted: true,
    downloadable: true,
    ownerId: 'user-123',
  },
];

export const offlineLibrary = {
  schoolId: 'school-001',
  name: 'SS2 Gold - Offline Library',
  inventory: [
    { id: 'phys-001', title: 'Mathematics for JSS2', author: 'Author A', copies: 12, available: 5, shelf: 'B2', isbn: '978-1-23456-789-0' },
    { id: 'phys-002', title: 'Biology Practical', author: 'Author B', copies: 6, available: 0, shelf: 'C1', isbn: '978-1-98765-432-1' },
  ],
};

export const bookStudioTemplates = [
  { id: 'tpl-1', name: 'Standard Textbook', features: ['TOC','Chapters','Citations','Math'] },
  { id: 'tpl-2', name: 'Quick Guide', features: ['Cover','Chapters','Illustrations'] },
];

import { buildSearchIndex, searchIndex } from './sidebarSearch';

const OWNER = [
  { name: 'Overview', path: '/roles/owner' },
  { name: 'People', path: '/roles/owner/people' },
  { name: 'Fees & Billing', path: '/roles/owner/finance' },
  { name: 'Practice Passes', path: '/roles/owner/practice-passes' },
  { name: 'Settings', path: '/roles/owner/settings' },
];

test('finds pages by the words people use, and Settings sections with a direct link', () => {
  const index = buildSearchIndex('owner', OWNER);
  expect(searchIndex(index, 'receipt')[0].path).toBe('/roles/owner/finance');
  expect(searchIndex(index, 'unplaced')[0].path).toBe('/roles/owner/settings?tab=Class%20Register');
  expect(searchIndex(index, 'promote')[0].name).toBe('Settings › Promotion');
  expect(searchIndex(index, 'peo')[0].name).toBe('People');
  expect(searchIndex(index, 'jamb pass')[0].name).toBe('Practice Passes');
  expect(searchIndex(index, 'zzz')).toEqual([]);
  expect(searchIndex(index, '')).toEqual([]);
});

test('Settings sections are offered only to the Owner and Head of School', () => {
  const index = buildSearchIndex('student', [{ name: 'Practice', path: '/roles/student/practice' }, { name: 'Settings', path: '/roles/student/settings' }]);
  expect(searchIndex(index, 'class register')).toEqual([]);
  expect(searchIndex(index, 'quiz')[0].path).toBe('/roles/student/practice');
});

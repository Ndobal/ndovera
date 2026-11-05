// What Ndovera can do, as names only. A new feature reaches the public list three ways, none needing this
// file touched: a new page in any school role's menu appears by itself (under "More"); Ami can add a name
// (Reviews & Home Schools page), or hide one. To place a new feature in a better group, add it below.

export const FEATURE_GROUPS = [
  { key: 'learning', title: 'Teaching & Learning', names: ['Classroom', 'Materials', 'Assignments', 'Lesson Plans', 'Live Classes', 'Timetable', 'Offline Notes', 'Read Aloud', 'Topic Hub', 'Curriculum Library', 'Digital Library', 'Resource Library', 'Clubs', 'School Calendar', 'Terms Calendar'] },
  { key: 'ai', title: 'Ndovera AI', names: ['Ndovera AI', 'AI Tutor', 'AI Assessments', 'Teacher Review'] },
  { key: 'practice', title: 'Practice & Exams', names: ['Practice Arena', 'WAEC Practice', 'NECO Practice', 'JAMB Practice', 'BECE Practice', 'Common Entrance Practice', 'Mock Papers', 'Timed Mock Exams', 'Practice Passes', 'Free Pass Codes', 'Exam Requests', 'Leaderboards', 'Badges & Medals', 'Exams', 'Exam Readiness', 'Exam Letterhead', 'Invigilation', 'Championships', 'Competitions'] },
  { key: 'results', title: 'Results & Reports', names: ['Results', 'Report Cards', 'Subject Scores', 'C.A. Score Sheets', 'Offline C.A.', 'Class Report', 'Academic History', 'Analytics'] },
  { key: 'money', title: 'Fees & Finance', names: ['Fees & Billing', 'Receipts', 'Receipts by Email', 'Receipt Images for WhatsApp', 'Fee Reminders', 'Payment Claims', 'Reconciliation', 'Expenses', 'Financial Report', 'Payroll', 'Payslips', 'Staff Loans', 'Club & Excursion Fees', 'Payments in Your Currency', 'Ask Someone to Pay'] },
  { key: 'people', title: 'Parents & Communication', names: ['Parent Notifications', 'WhatsApp Notices', 'SMS Notices', 'Email Notices', 'Parent Invitation Links', 'Phone Notifications', 'Practice Pass Reminders', 'School Letterhead on Emails', 'School Email Templates', 'Messaging', 'Phone Sign-In for Parents', 'Family Table', 'PTA Attendance', 'Birthday Cards', 'School Notices'] },
  { key: 'staff', title: 'Staff', names: ['Attendance', 'Staff Punctuality', 'Staff Evaluation', 'Evaluate Colleagues', 'My Staff File', 'Submissions & Compliance', 'Training', 'Supervision'] },
  { key: 'school', title: 'Running the School', names: ['Admissions', 'Setup Centre', 'People', 'Classes & Subjects', 'Discipline', 'Tuck Shop', 'Store Keeper', 'Inventory', 'Assets', 'Requisitions', 'Library', 'Hostel', 'Security', 'Visits', 'Incidents', 'Emergencies'] },
  { key: 'care', title: 'Transport & Health', names: ['School Bus Routes', 'Driver Runs', 'Home Locations on Google Maps', 'Health Register', 'Medication', 'Hygiene', 'Welfare'] },
  { key: 'public', title: 'Website & Growth', names: ['School Website', 'Online Registration', 'Events', 'Gallery', 'News Headlines', 'Growth Partners'] },
  { key: 'access', title: 'Works Everywhere', names: ['Works Offline', 'Ndovera Lite for Older Phones', 'Light & Dark Mode'] },
];

/** The few shown on the home page. */
export const HOME_FEATURES = ['Fees & Billing', 'Results', 'Assignments', 'Practice Arena', 'Parent Notifications', 'Attendance', 'Ndovera AI', 'School Website'];

// Roles whose menus describe the product. Ndovera's own staff pages are not features schools buy.
export const SCHOOL_ROLES = ['student', 'parent', 'teacher', 'hos', 'owner', 'accountant', 'librarian', 'sanitation', 'tuckshopmanager', 'storekeeper', 'transport', 'hostel', 'admin'];

// Menu words that are not features, or are already listed under a clearer name.
const NOT_FEATURES = new Set(['overview', 'dashboard', 'home', 'settings', 'menu', 'support', 'more', 'give feedback', 'request an exam', 'my classes', 'children', 'class', 'classes', 'service', 'orders', 'sales', 'returns', 'receiving', 'systems', 'coordination', 'access', 'teams', 'integrity', 'quality', 'schedule', 'staff', 'teachers', 'notifications', 'communication', 'communications', 'fees', 'fees & receipts', 'payslip', 'my payslip', 'my medals', 'practice', 'live', 'academics', 'assessments', 'behavior', 'borrowing', 'catalogue', 'my submissions', 'submit work', 'teacher submissions', 'class teacher tuck shop', 'teacher tuck shop', 'library admin', 'farming mode', 'auras', 'rewards', 'audits', 'audit trail', 'reports', 'finance', 'fleet', 'routes', 'transport', 'school bus', 'my school runs', 'health', 'patients', 'report health incident', 'rooms', 'inspections', 'security help', 'security overview', 'staff evaluation', 'curriculum & ndovera ai', 'close school', 'approvals', 'events', 'newsroom', 'admissions chat', 'billing & pricing', 'pricing', 'schools', 'website']);

/** Every name from the role menus. Pass getRoleSidebarItems, so a new page is found by itself. */
export function menuFeatureNames(getItems) {
  const names = new Set();
  for (const role of SCHOOL_ROLES) {
    for (const item of getItems(role) || []) {
      const name = String(item?.name || '').trim();
      if (name && !String(item.path || '').startsWith('#')) names.add(name);
    }
  }
  return [...names];
}

const clean = list => (Array.isArray(list) ? list.map(name => String(name || '').trim()).filter(Boolean) : []);

/** The whole public list: the groups, new menu pages and Ami's additions, less anything Ami hid. */
export function buildFeatureGroups({ menuNames = [], added = [], hidden = [] } = {}) {
  const key = name => name.toLowerCase();
  const hide = new Set(clean(hidden).map(key));
  const listed = new Set(FEATURE_GROUPS.flatMap(group => group.names.map(key)));
  const extra = [];
  for (const name of [...clean(added), ...clean(menuNames)]) {
    const id = key(name);
    if (listed.has(id) || NOT_FEATURES.has(id)) continue;
    listed.add(id);
    extra.push(name);
  }
  const groups = FEATURE_GROUPS.map(group => ({ ...group, names: group.names.filter(name => !hide.has(key(name))) }));
  groups.push({ key: 'more', title: 'More', names: extra.filter(name => !hide.has(key(name))).sort((a, b) => a.localeCompare(b)) });
  return groups.filter(group => group.names.length);
}

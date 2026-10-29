/**
 * Versioned, reviewed UI instructions only. No tenant data, private records or
 * unverified destinations are stored in this catalogue.
 */
export const HELP_ARTICLE_VERSION = '2026-10-29.2';
export const HELP_ARTICLES = Object.freeze([
  { id: 'website', title: 'Edit your school website', roles: ['owner'], category: 'Website', keywords: 'photos gallery upload school homepage', steps: ['Open your Owner dashboard and select the school website editor.', 'Choose the section to update, then edit the text or upload media.', 'Select Save Section to publish your changes.'], route: '/roles/owner' },
  { id: 'gallery', title: 'Organise gallery photos and videos', roles: ['owner'], category: 'Website', keywords: 'album caption remove reorder media', steps: ['Open the Gallery section in your school website editor.', 'Upload photos or videos, enter captions and optional album names.', 'Use Earlier or Later to reorder; use Remove to unpublish an item.', 'Select Save Section to publish. Removing an item from the gallery does not delete its uploaded file.'], route: '/roles/owner' },
  { id: 'messages', title: 'Find your messages', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Communications', keywords: 'chat notifications inbox support', steps: ['Select the Messages icon in the dashboard header.', 'Choose a conversation to read it.', 'Only send information appropriate for the participants in that conversation.'] },
  { id: 'login', title: 'Sign in to Ndovera', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Account', keywords: 'password access login', steps: ['Open the Ndovera sign-in page.', 'Sign in using the credentials provided for your account.', 'If access fails, contact your school administrator rather than sharing your password.'] },
  { id: 'fees', title: 'Questions about school fees', roles: ['parent', 'owner', 'accountant', 'hos'], category: 'Finance', keywords: 'balance receipt payment arrears', steps: ['Open the relevant finance or fees area from your dashboard.', 'Check the displayed fee account and receipt information.', 'For missing payments or discrepancies, contact the school finance office. Do not make a second payment until the first is checked.'] },
  { id: 'results', title: 'Questions about results', roles: ['student', 'parent', 'teacher', 'hos', 'owner'], category: 'Academics', keywords: 'report grades marks examination', steps: ['Open the results area available to your role.', 'Select the correct academic session and term.', 'If a result is missing, ask the school to confirm whether it has been published.'] },
  { id: 'attendance', title: 'Check attendance records', roles: ['teacher', 'hos', 'owner', 'parent'], category: 'Academics', keywords: 'register present absent daily attendance', steps: ['Open the attendance area available to your role.', 'Choose the relevant class, date and academic term where applicable.', 'If a record is missing or incorrect, request verification by an authorised school staff member.'] },
  { id: 'assignments', title: 'Find assignments and learning materials', roles: ['student', 'teacher', 'parent', 'hos', 'owner'], category: 'Academics', keywords: 'homework notes topic material submit task', steps: ['Open the class or learning area in your dashboard.', 'Select the relevant subject and topic.', 'Look for available notes, materials or assignments.', 'If the item is not visible, ask the teacher whether it has been published to your class.'] },
  { id: 'school-session', title: 'Understand sessions and terms', roles: ['owner', 'hos', 'teacher', 'accountant'], category: 'School setup', keywords: 'new term session previous year archive class assignments', steps: ['Check the academic session and term shown in your dashboard.', 'Review records against the correct period before editing.', 'Do not recreate existing class or teacher assignments solely because a new session begins.', 'If historical records are missing, ask an authorised administrator to investigate rather than entering duplicates.'] },
  { id: 'staff-pay', title: 'Review your payslip', roles: ['teacher', 'hos', 'accountant', 'owner'], category: 'Finance', keywords: 'salary payroll earnings deduction dispute payslip', steps: ['Open the payslip area available to your staff account.', 'Review the selected month and year before comparing earnings and deductions.', 'Use your school’s authorised payroll enquiry process for discrepancies. Avoid sending bank details in a general help message.'] },
  { id: 'access', title: 'Why can’t I open a feature?', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Account', keywords: 'forbidden permission access denied 403 role', steps: ['Check that you signed in to the correct school account.', 'If your account supports more than one role, select the role appropriate for the task.', 'If access is still denied, contact the school administrator to review permissions.', 'Do not use another person’s credentials to bypass restrictions.'] },
  { id: 'privacy', title: 'Protect student information', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Safety', keywords: 'privacy security student data', steps: ['Use only your own account.', 'Do not share passwords, student records or private messages in a help request.', 'Report suspected unauthorised access to your school administrator.'] },
]);

export function getContextualHelpQuery(path = '') {
  const normalized = String(path || '').toLowerCase();
  const routes = [
    [/website|gallery/, 'gallery'],
    [/payslip|payroll/, 'payslip'],
    [/attendance/, 'attendance'],
    [/assignment|material|classroom/, 'assignments'],
    [/result|report-card/, 'results'],
    [/finance|fee|receipt|payment/, 'fees'],
    [/message|chat|conversation/, 'messages'],
    [/session|term|calendar/, 'session'],
  ];
  return routes.find(([pattern]) => pattern.test(normalized))?.[1] || '';
}

export function findHelpArticles(query, role, currentPath = '') {
  const normalizedRole = String(role || '').toLowerCase();
  const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.filter(article => article.roles.includes(normalizedRole))
    .map(article => {
      const haystack = [article.title, article.category, article.keywords, ...article.steps].join(' ').toLowerCase();
      const title = article.title.toLowerCase();
      const score = terms.length ? terms.reduce((n, term) => n + (title.includes(term) ? 3 : haystack.includes(term) ? 1 : 0), 0) : 1;
      return { article, score: score + (article.route && currentPath.startsWith(article.route) ? 0.1 : 0) };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.article);
}

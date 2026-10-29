/**
 * Versioned, reviewed UI instructions only. No tenant data, private records or
 * unverified destinations are stored in this catalogue.
 */
export const HELP_ARTICLE_VERSION = '2026-10-29.1';
export const HELP_ARTICLES = Object.freeze([
  { id: 'website', title: 'Edit your school website', roles: ['owner'], category: 'Website', keywords: 'photos gallery upload school homepage', steps: ['Open your Owner dashboard and select the school website editor.', 'Choose the section to update, then edit the text or upload media.', 'Select Save Section to publish your changes.'], route: '/roles/owner' },
  { id: 'gallery', title: 'Organise gallery photos and videos', roles: ['owner'], category: 'Website', keywords: 'album caption remove reorder media', steps: ['Open the Gallery section in your school website editor.', 'Upload photos or videos, enter captions and optional album names.', 'Use Earlier or Later to reorder; use Remove to unpublish an item.', 'Select Save Section to publish. Removing an item from the gallery does not delete its uploaded file.'], route: '/roles/owner' },
  { id: 'messages', title: 'Find your messages', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Communications', keywords: 'chat notifications inbox support', steps: ['Select the Messages icon in the dashboard header.', 'Choose a conversation to read it.', 'Only send information appropriate for the participants in that conversation.'] },
  { id: 'login', title: 'Sign in to Ndovera', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Account', keywords: 'password access login', steps: ['Open the Ndovera sign-in page.', 'Sign in using the credentials provided for your account.', 'If access fails, contact your school administrator rather than sharing your password.'] },
  { id: 'fees', title: 'Questions about school fees', roles: ['parent', 'owner', 'accountant', 'hos'], category: 'Finance', keywords: 'balance receipt payment arrears', steps: ['Open the relevant finance or fees area from your dashboard.', 'Check the displayed fee account and receipt information.', 'For missing payments or discrepancies, contact the school finance office. Do not make a second payment until the first is checked.'] },
  { id: 'results', title: 'Questions about results', roles: ['student', 'parent', 'teacher', 'hos', 'owner'], category: 'Academics', keywords: 'report grades marks examination', steps: ['Open the results area available to your role.', 'Select the correct academic session and term.', 'If a result is missing, ask the school to confirm whether it has been published.'] },
  { id: 'privacy', title: 'Protect student information', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], category: 'Safety', keywords: 'privacy security student data', steps: ['Use only your own account.', 'Do not share passwords, student records or private messages in a help request.', 'Report suspected unauthorised access to your school administrator.'] },
]);

export function findHelpArticles(query, role, currentPath = '') {
  const normalizedRole = String(role || '').toLowerCase();
  const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.filter(article => article.roles.includes(normalizedRole))
    .map(article => {
      const haystack = [article.title, article.category, article.keywords, ...article.steps].join(' ').toLowerCase();
      const score = terms.length ? terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0) : 1;
      return { article, score: score + (article.route && currentPath.startsWith(article.route) ? 0.1 : 0) };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.article);
}

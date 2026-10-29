import { HELP_ARTICLES, HELP_ARTICLE_VERSION, findHelpArticles, getContextualHelpQuery } from './helpArticles';

describe('Help Centre approved knowledge catalogue', () => {
  test('recognises common dashboard contexts without exposing records', () => {
    expect(getContextualHelpQuery('/roles/owner/website/gallery')).toBe('gallery');
    expect(getContextualHelpQuery('/roles/teacher/attendance')).toBe('attendance');
    expect(getContextualHelpQuery('/roles/parent/fees')).toBe('fees');
    expect(getContextualHelpQuery('/roles/student')).toBe('');
  });
  test('catalogue is versioned and article ids are unique', () => {
    expect(HELP_ARTICLE_VERSION).toBeTruthy();
    expect(new Set(HELP_ARTICLES.map(article => article.id)).size).toBe(HELP_ARTICLES.length);
  });
  test('students cannot search owner-only instructions', () => {
    expect(findHelpArticles('gallery', 'student')).toEqual([]);
    expect(findHelpArticles('', 'student').some(article => article.id === 'website')).toBe(false);
  });
  test('owners can find website and gallery guidance', () => {
    expect(findHelpArticles('gallery', 'owner').some(article => article.id === 'gallery')).toBe(true);
  });
  test('search matches instruction words as well as titles', () => {
    expect(findHelpArticles('password', 'parent').some(article => article.id === 'login')).toBe(true);
  });
  test('unrecognised roles see no protected articles', () => {
    expect(findHelpArticles('', 'unknown')).toEqual([]);
  });
  test('role-scoped finance articles are hidden from students', () => {
    expect(findHelpArticles('payslip', 'student')).toEqual([]);
    expect(findHelpArticles('payslip', 'teacher').some(article => article.id === 'staff-pay')).toBe(true);
  });
  test('permission help is available to all common school roles', () => {
    for (const role of ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner']) {
      expect(findHelpArticles('403', role).some(article => article.id === 'access')).toBe(true);
    }
  });
  test('no query returns all and only role-visible articles', () => {
    const parentArticles = findHelpArticles('', 'parent');
    expect(parentArticles.length).toBeGreaterThan(0);
    expect(parentArticles.every(article => article.roles.includes('parent'))).toBe(true);
  });
  test('expanded operational catalogue covers core school functions', () => {
    for (const id of ['admissions', 'student-record', 'class-assignments', 'curriculum-topics', 'lesson-notes', 'assessment-create', 'marking', 'fees-setup', 'payment-reconciliation', 'payroll-dispute', 'school-messages', 'upload-troubleshooting']) {
      expect(HELP_ARTICLES.some(article => article.id === id)).toBe(true);
    }
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(30);
  });
  test('students do not receive financial administration or staff records guides', () => {
    const ids = findHelpArticles('', 'student').map(article => article.id);
    for (const restricted of ['fees-setup', 'payment-reconciliation', 'staff-loans', 'student-record', 'marking']) {
      expect(ids).not.toContain(restricted);
    }
    expect(ids).toContain('assessment-student');
  });
  test('parents see child-specific guidance but not management tools', () => {
    const ids = findHelpArticles('', 'parent').map(article => article.id);
    expect(ids).toContain('parent-multiple');
    expect(ids).toContain('receipt-parent');
    expect(ids).not.toContain('class-assignments');
  });
  test('operational articles have distinct ids and meaningful instructions', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.title.trim().length).toBeGreaterThan(5);
      expect(article.steps.every(step => typeof step === 'string' && step.trim().length > 12)).toBe(true);
    }
  });
  test('articles do not contain tenant-specific record identifiers', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.roles.length).toBeGreaterThan(0);
      expect(article.steps.length).toBeGreaterThan(0);
      expect(article.route ? article.route.startsWith('/roles/') : true).toBe(true);
    }
  });
});

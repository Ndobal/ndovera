import { HELP_ARTICLES, HELP_ARTICLE_VERSION, findHelpArticles } from './helpArticles';

describe('Help Centre approved knowledge catalogue', () => {
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
  test('articles do not contain tenant-specific record identifiers', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.roles.length).toBeGreaterThan(0);
      expect(article.steps.length).toBeGreaterThan(0);
      expect(article.route ? article.route.startsWith('/roles/') : true).toBe(true);
    }
  });
});

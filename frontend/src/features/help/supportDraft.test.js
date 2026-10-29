import { buildHelpSupportSummary } from './supportDraft';

describe('privacy-aware support request draft', () => {
  test('includes a clear statement that credentials and student records must be excluded', () => {
    const result = buildHelpSupportSummary({ articleTitle: 'Gallery', page: '/roles/owner' });
    expect(result).toContain('Gallery');
    expect(result).toContain('Please do not include passwords');
  });
  test('does not include arbitrary external URLs in the page field', () => {
    const result = buildHelpSupportSummary({ page: 'https://untrusted.example/private' });
    expect(result).toContain('Page: (not provided)');
    expect(result).not.toContain('untrusted.example');
  });
  test('collapses newlines and bounds free text length', () => {
    const result = buildHelpSupportSummary({ query: 'broken\nquery', error: 'x'.repeat(500) });
    expect(result).toContain('broken query');
    expect(result).not.toContain('x'.repeat(161));
  });
});

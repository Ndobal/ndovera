/**
 * Keep support drafts free of personal records. This utility never sends data
 * to a server and never includes the user's question without their review.
 */
export function buildHelpSupportSummary({ articleTitle = '', query = '', page = '', error = '' } = {}) {
  const clean = value => String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
  const safePage = /^\/roles\/[a-z-]+(?:\/[a-z0-9/_-]+)*$/i.test(page) ? page : '(not provided)';
  return [
    'Ndovera Help Centre — support request draft',
    `Topic: ${clean(articleTitle) || 'Unresolved question'}`,
    `Search terms (review before sharing): ${clean(query) || '(none)'}`,
    `Page: ${safePage}`,
    `Error message (remove any private information): ${clean(error) || '(none)'}`,
    'What happened: ',
    'What I expected: ',
    'Please do not include passwords, payment credentials, student records or other sensitive details.',
  ].join('\n');
}

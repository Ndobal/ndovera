import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader, getStoredAuth } from '../auth/services/authApi';

export async function loadPublishedHelpArticles() {
  const auth = getStoredAuth();
  if (!auth?.token) throw new Error('Sign in to view school help articles.');
  const response = await fetch(getApiUrl('/api/help/articles/published'), {
    credentials: 'include',
    headers: { Authorization: `Bearer ${auth.token}`, ...buildSelectedRoleHeader() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Published help articles are unavailable.');
  if (!Array.isArray(data.articles)) throw new Error('Invalid article response.');
  return data.articles.filter(article => article && typeof article.id === 'string'
    && typeof article.title === 'string' && typeof article.category === 'string'
    && Array.isArray(article.roles) && Array.isArray(article.steps));
}

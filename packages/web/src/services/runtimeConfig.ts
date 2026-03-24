const env = ((import.meta as any)?.env || {}) as Record<string, string | undefined>;

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function getBrowserOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export const WEB_API_BASE_URL = trimTrailingSlash(env.VITE_API_URL || '');
export const SUPER_ADMIN_URL = trimTrailingSlash(env.VITE_SUPER_ADMIN_URL || getBrowserOrigin());
export const SUPER_ADMIN_API_BASE_URL = trimTrailingSlash(env.VITE_SUPER_ADMIN_API_URL || '');

export const SIGNALING_WS_URL = env.VITE_SIGNALING_WS_URL || (() => {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
})();

export function buildAppUrl(path: string, baseUrl = '') {
  if (!path) return baseUrl || '';
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedBase = trimTrailingSlash(baseUrl || '');
  if (!normalizedBase) return path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
}
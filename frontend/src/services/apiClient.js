const DEFAULT_TIMEOUT_MS = 7000;
const AUTH_TOKEN_KEY = 'token';
const AUTH_COOKIE_KEY = 'ndovera_token';
// Keep this aligned with the backend/authApi session window to avoid shortening auth unexpectedly.
const AUTH_SESSION_MAX_AGE_SECONDS = 10 * 60;

function getCookie(name) {
  const match = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setAuthCookie(token) {
  document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; domain=.ndovera.com; max-age=${AUTH_SESSION_MAX_AGE_SECONDS}; secure; samesite=lax`;
}

function getStoredToken() {
  const localToken = window.localStorage?.getItem(AUTH_TOKEN_KEY) || '';
  const cookieToken = getCookie(AUTH_COOKIE_KEY);

  if (cookieToken && cookieToken !== localToken) {
    window.localStorage?.setItem(AUTH_TOKEN_KEY, cookieToken);
  }

  return cookieToken || localToken;
}

function syncRefreshedToken(response) {
  const refreshedToken = response?.headers?.get?.('X-Refresh-Token');
  if (!refreshedToken) return;
  window.localStorage?.setItem(AUTH_TOKEN_KEY, refreshedToken);
  setAuthCookie(refreshedToken);
}

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getJson(url, fallbackData, options = {}) {
  try {
    const token = getStoredToken();
    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      }),
      options.timeoutMs
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    syncRefreshedToken(response);
    return await response.json();
  } catch (error) {
    return {
      ...fallbackData,
      _meta: {
        source: 'fallback',
        reason: error.message,
      },
    };
  }
}

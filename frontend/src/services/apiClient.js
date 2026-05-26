const DEFAULT_TIMEOUT_MS = 7000;
const AUTH_TOKEN_KEY = 'token';
const AUTH_COOKIE_KEY = 'ndovera_token';
const AUTH_USER_KEY = 'authUser';
const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const JSON_RESPONSE_CACHE_PREFIX = 'ndovera:getjson-cache:';

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

function getCachedUserId() {
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(AUTH_USER_KEY) || '{}');
    return String(parsed?.id || parsed?.email || 'guest').trim().toLowerCase() || 'guest';
  } catch {
    return 'guest';
  }
}

function buildJsonCacheKey(url) {
  return `${JSON_RESPONSE_CACHE_PREFIX}${getCachedUserId()}:${String(url || '').trim()}`;
}

function readCachedJson(url) {
  try {
    const raw = window.localStorage?.getItem(buildJsonCacheKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedJson(url, data) {
  try {
    window.localStorage?.setItem(buildJsonCacheKey(url), JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {}
}

function withResponseMeta(payload, meta) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { data: payload, _meta: meta };
  }
  return { ...payload, _meta: meta };
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
  const cached = readCachedJson(url);

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
    const data = await response.json();
    writeCachedJson(url, data);
    return data;
  } catch (error) {
    if (cached?.data) {
      return withResponseMeta(cached.data, {
        source: 'cache',
        cachedAt: cached.cachedAt || 0,
        reason: error.message,
      });
    }

    return {
      ...fallbackData,
      _meta: {
        source: 'fallback',
        reason: error.message,
      },
    };
  }
}

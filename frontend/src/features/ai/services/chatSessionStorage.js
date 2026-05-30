const CHAT_SESSION_STORAGE_PREFIX = 'ndovera.ai.chat.';

function resolveStorageKey(key) {
  return `${CHAT_SESSION_STORAGE_PREFIX}${String(key || '').trim()}`;
}

export function readChatSession(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(resolveStorageKey(key));
    if (!rawValue) {
      return fallbackValue;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object') {
      return fallbackValue;
    }

    if (fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue)) {
      return { ...fallbackValue, ...parsedValue };
    }

    return parsedValue;
  } catch {
    return fallbackValue;
  }
}

export function writeChatSession(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(resolveStorageKey(key), JSON.stringify(value));
  } catch {}
}

export function clearChatSession(key) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(resolveStorageKey(key));
  } catch {}
}
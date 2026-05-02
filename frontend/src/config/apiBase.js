const rawApiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || '').trim();
const normalizedApiBase = rawApiBase.replace(/\/$/, '');

export function getApiBase(defaultBase = '/api') {
  return normalizedApiBase || defaultBase;
}

export function getApiUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with '/': ${path}`);
  }

  if (!normalizedApiBase) {
    return path;
  }

  if (normalizedApiBase.endsWith('/api') && path.startsWith('/api/')) {
    return `${normalizedApiBase}${path.slice(4)}`;
  }

  return `${normalizedApiBase}${path}`;
}
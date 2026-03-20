import { NSMS_API_BASE } from './nsmsApi';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
};

function getAuthHeaders() {
  const token = localStorage.getItem('nsms_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${NSMS_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...defaultHeaders,
      ...getAuthHeaders(),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Request failed');
  }

  return res.json() as Promise<T>;
}

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
};

export default api;

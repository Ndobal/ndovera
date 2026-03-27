const env = ((import.meta as any)?.env || {}) as Record<string, string | undefined>
const API_BASE = (env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const ACTIVE_SCHOOL_STORAGE_KEY = 'ndovera_active_school_id'
export const ACTIVE_SCHOOL_CHANGED_EVENT = 'ndovera:active-school-changed'

export function resolveApiUrl(url: string) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (!url.startsWith('/')) return url
  return API_BASE ? `${API_BASE}${url}` : url
}

export function getStoredActiveSchoolId() {
  try {
    return localStorage.getItem(ACTIVE_SCHOOL_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredActiveSchoolId(schoolId?: string | null) {
  try {
    const normalized = String(schoolId || '').trim()
    if (normalized) {
      localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, normalized)
    } else {
      localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY)
    }
    window.dispatchEvent(new CustomEvent(ACTIVE_SCHOOL_CHANGED_EVENT, { detail: normalized || null }))
  } catch {
    // Ignore storage failures and continue with the in-memory session.
  }
}

export function clearStoredActiveSchoolId() {
  setStoredActiveSchoolId(null)
}

export async function fetchWithAuth(url: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers as HeadersInit || {})
  const method = (opts.method || 'GET').toUpperCase()
  const isMutating = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)
  const requestUrl = resolveApiUrl(url)
  const activeSchoolId = getStoredActiveSchoolId()
  if (activeSchoolId && !headers.has('X-Active-School-Id')) {
    headers.set('X-Active-School-Id', activeSchoolId)
  }
  if (isMutating && !headers.has('X-CSRF-Token')) {
    try {
      const response = await fetch(resolveApiUrl('/csrf-token'), { credentials: 'include' })
      if (response.ok) {
        const payload = await response.json().catch(() => ({})) as { csrfToken?: string }
        if (payload.csrfToken) headers.set('X-CSRF-Token', payload.csrfToken)
      }
    } catch {
      // fall through; the server will reject unsafe requests if CSRF is required
    }
  }
  const res = await fetch(requestUrl, { ...opts, headers, credentials: 'include' })
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const payload = await res.json()
        message = payload?.error || payload?.message || message
      } else {
        const text = await res.text()
        if (text) message = text
      }
    } catch {
      // keep fallback message when the response body cannot be parsed
    }
    if (res.status >= 500) {
      message = 'Something went wrong. Please try again.'
    }
    const error = new Error(message) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return res.json()
}

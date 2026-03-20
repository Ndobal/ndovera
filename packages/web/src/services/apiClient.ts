import { loadUser } from './authLocal'

type ReqInit = RequestInit & { url: string }

export async function fetchWithAuth(url: string, opts: RequestInit = {}) {
  const user = loadUser()
  const headers = new Headers(opts.headers as HeadersInit || {})
  if (user) {
    headers.set('x-user-id', user.id)
    headers.set('x-user-roles', user.roles.join(','))
    if (user.activeRole) headers.set('x-active-role', user.activeRole)
    if (user.schoolId) headers.set('x-school-id', user.schoolId)
  }

  const res = await fetch(url, { ...opts, headers })
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
    throw new Error(message)
  }
  return res.json()
}

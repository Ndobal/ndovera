import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export type SuperUser = {
  id: string
  name?: string
  email?: string
  roles: string[]
  activeRole?: string
}

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || 'ndovera_super_admin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 8

const superRolesPath = path.resolve(process.cwd(), 'roles', 'ndovera-roles.json')
let superRolesMap: Record<string, string[]> = {}
try {
  const raw = fs.readFileSync(superRolesPath, 'utf8')
  superRolesMap = JSON.parse(raw)
} catch (err) {
  superRolesMap = {}
}

export function attachSuperUserFromHeaders(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.NDOVERA_SUPER_ADMIN_AUTH_SECRET?.trim() || process.env.NDOVERA_AUTH_SECRET?.trim() || null
  if (!secret) return next()

  const cookieHeader = req.header('cookie') || ''
  const cookies: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies[name] = rest.join('=')
  }

  const rawSession = cookies[SESSION_COOKIE]
  if (!rawSession) return next()
  const [encodedPayload, signature] = rawSession.split('.')
  if (!encodedPayload || !signature) return next()
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  if (signature.length !== expectedSignature.length) return next()
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return next()

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as { id?: string; name?: string; email?: string; roles?: string[]; activeRole?: string; exp?: number }
    if (!payload.id || !Array.isArray(payload.roles) || payload.roles.length === 0) return next()
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return next()
    ;(req as any).superUser = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      roles: payload.roles,
      activeRole: payload.activeRole || payload.roles[0],
    } as SuperUser
  } catch {
    return next()
  }
  next()
}

export function createSuperSessionCookie(user: SuperUser, rememberMe = false) {
  const secret = process.env.NDOVERA_SUPER_ADMIN_AUTH_SECRET?.trim() || process.env.NDOVERA_AUTH_SECRET?.trim()
  if (!secret) throw new Error('NDOVERA_SUPER_ADMIN_AUTH_SECRET is not configured.')
  const ttl = rememberMe ? SESSION_TTL_MS * 7 : SESSION_TTL_MS
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    activeRole: user.activeRole,
    exp: Date.now() + ttl,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const parts = [
    `${SESSION_COOKIE}=${payload}.${signature}`,
    process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly',
    'Path=/',
    `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`,
    `Max-Age=${Math.floor(ttl / 1000)}`,
  ]
  const secureFlag = process.env.SESSION_COOKIE_SECURE
  if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production')) parts.splice(2, 0, 'Secure')
  return parts.filter(Boolean).join('; ')
}

export function clearSuperSessionCookie() {
  const parts = [`${SESSION_COOKIE}=`, process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly', 'Path=/', `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`, 'Max-Age=0']
  const secureFlag = process.env.SESSION_COOKIE_SECURE
  if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production')) parts.splice(2, 0, 'Secure')
  return parts.filter(Boolean).join('; ')
}

export function requireSuperRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).superUser as SuperUser | undefined
    if (!user) return res.status(401).json({ error: 'Unauthenticated' })
    const roleToCheck = user.activeRole || user.roles[0]
    if (!roleToCheck) return res.status(403).json({ error: 'No active role selected' })
    if (allowed.includes(roleToCheck)) return next()
    return res.status(403).json({ error: 'Forbidden - insufficient role' })
  }
}

export function superHasPermission(user: SuperUser | undefined, permission: string) {
  if (!user) return false
  const active = user.activeRole || user.roles[0]
  if (!active) return false
  const perms = superRolesMap[active] || []
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

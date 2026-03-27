import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { getAccessibleSchoolContext } from './src/modules/ownership/ownership.store.js'

export type User = {
  id: string
  name?: string
  email?: string
  school_id?: string
  base_school_id?: string
  effective_school_id?: string
  accessible_school_ids?: string[]
  owner_account_id?: string | null
  roles: string[]
  activeRole?: string
}

const ACTIVE_SCHOOL_HEADER = 'x-active-school-id'

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || 'ndovera_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 8

const normalizeRole = (role?: string) => {
  if (!role) return role
  const lower = role.toLowerCase()
  if (lower === 'hos') return 'HoS'
  return role
}

const rolesPath = path.resolve(process.cwd(), 'roles', 'ndovera-roles.json')
let rolesMap: Record<string, string[]> = {}
try {
  const raw = fs.readFileSync(rolesPath, 'utf8')
  rolesMap = JSON.parse(raw)
} catch (err) {
  // fallback empty map
  rolesMap = {}
}

function getAuthSecret() {
  return process.env.NDOVERA_AUTH_SECRET?.trim() || null
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signSession(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function parseCookies(cookieHeader?: string | null) {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies[name] = rest.join('=')
  }
  return cookies
}

function readSessionUser(req: Request): User | undefined {
  const secret = getAuthSecret()
  if (!secret) return undefined
  const cookies = parseCookies(req.header('cookie'))
  const rawSession = cookies[SESSION_COOKIE]
  if (!rawSession) return undefined
  const [encodedPayload, signature] = rawSession.split('.')
  if (!encodedPayload || !signature) return undefined
  const expectedSignature = signSession(encodedPayload, secret)
  if (signature.length !== expectedSignature.length) return undefined
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return undefined
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { id?: string; name?: string; email?: string; school_id?: string; roles?: string[]; activeRole?: string; exp?: number }
    if (!payload.id || !Array.isArray(payload.roles) || payload.roles.length === 0) return undefined
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return undefined
    const roles = payload.roles.map((role) => normalizeRole(role) || role)
    const activeRole = normalizeRole(payload.activeRole) || payload.activeRole || roles[0]
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      school_id: payload.school_id,
      base_school_id: payload.school_id,
      effective_school_id: payload.school_id,
      roles,
      activeRole,
    }
  } catch {
    return undefined
  }
}

export function createSessionCookie(user: User, rememberMe = false) {
  const secret = getAuthSecret()
  if (!secret) {
    throw new Error('NDOVERA_AUTH_SECRET is not configured.')
  }
  const ttl = rememberMe ? SESSION_TTL_MS * 7 : SESSION_TTL_MS
  const payload = base64UrlEncode(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    school_id: user.school_id,
    roles: user.roles,
    activeRole: user.activeRole,
    exp: Date.now() + ttl,
  }))
  const signature = signSession(payload, secret)
  const cookieParts = [
    `${SESSION_COOKIE}=${payload}.${signature}`,
    process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly',
    'Path=/',
    `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`,
    `Max-Age=${Math.floor(ttl / 1000)}`,
  ]
  const secureFlag = process.env.SESSION_COOKIE_SECURE
  if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production')) cookieParts.splice(2, 0, 'Secure')
  return cookieParts.filter(Boolean).join('; ')
}

export function clearSessionCookie() {
  const cookieParts = [`${SESSION_COOKIE}=`, process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly', 'Path=/', `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`, 'Max-Age=0']
  const secureFlag = process.env.SESSION_COOKIE_SECURE
  if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production')) cookieParts.splice(2, 0, 'Secure')
  return cookieParts.filter(Boolean).join('; ')
}

export function attachUserFromHeaders(req: Request, res: Response, next: NextFunction) {
  const user = readSessionUser(req)
  if (user) {
    ;(req as any).user = user
  }
  next()
}

export async function resolveEffectiveSchoolContext(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User | undefined
  if (!user) return next()
  try {
    const selectedSchoolId = String(req.header(ACTIVE_SCHOOL_HEADER) || '').trim()
    const baseSchoolId = String(user.base_school_id || user.school_id || '').trim() || undefined
    const { accessibleSchools, account } = await getAccessibleSchoolContext({
      id: user.id,
      name: user.name,
      email: user.email,
      school_id: baseSchoolId,
      roles: user.roles,
    })
    const accessibleSchoolIds = accessibleSchools.map((school) => school.id)
    const fallbackSchoolId = baseSchoolId || accessibleSchoolIds[0] || user.school_id
    if (selectedSchoolId && !accessibleSchoolIds.includes(selectedSchoolId)) {
      return res.status(403).json({ error: 'Selected school is not available for this account.' })
    }
    const effectiveSchoolId = selectedSchoolId || fallbackSchoolId
    ;(req as any).user = {
      ...user,
      school_id: effectiveSchoolId,
      base_school_id: fallbackSchoolId,
      effective_school_id: effectiveSchoolId,
      accessible_school_ids: accessibleSchoolIds,
      owner_account_id: account?.id || null,
    } satisfies User
    return next()
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to resolve school context.' })
  }
}

export function requireRoles(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as User | undefined
    if (!user) return res.status(401).json({ error: 'Unauthenticated' })

    const roleToCheck = normalizeRole(user.activeRole) || normalizeRole(user.roles[0])
    if (!roleToCheck) return res.status(403).json({ error: 'No active role selected' })

    if (allowed.includes(roleToCheck)) return next()
    return res.status(403).json({ error: 'Forbidden - insufficient role' })
  }
}

export function hasPermission(user: User | undefined, permission: string) {
  if (!user) return false
  const active = normalizeRole(user.activeRole) || normalizeRole(user.roles[0])
  if (!active) return false
  const perms = rolesMap[active] || []
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

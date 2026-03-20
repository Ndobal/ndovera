import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'

export type User = {
  id: string
  school_id?: string
  roles: string[]
  activeRole?: string
}

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

// For this scaffold we trust headers (in production use JWT)
export function attachUserFromHeaders(req: Request, res: Response, next: NextFunction) {
  const id = req.header('x-user-id')
  const rolesHeader = req.header('x-user-roles')
  const active = req.header('x-active-role')
  const schoolId = req.header('x-school-id')

  if (!id) {
    // unauthenticated — proceed as guest
    return next()
  }

  const roles = rolesHeader ? rolesHeader.split(',').map(s => normalizeRole(s.trim()) || s.trim()) : []
  ;(req as any).user = { id, school_id: schoolId || undefined, roles, activeRole: normalizeRole(active) || active } as User
  next()
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

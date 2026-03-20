import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'

export type SuperUser = {
  id: string
  roles: string[]
  activeRole?: string
}

const superRolesPath = path.resolve(process.cwd(), 'roles', 'ndovera-roles.json')
let superRolesMap: Record<string, string[]> = {}
try {
  const raw = fs.readFileSync(superRolesPath, 'utf8')
  superRolesMap = JSON.parse(raw)
} catch (err) {
  superRolesMap = {}
}

export function attachSuperUserFromHeaders(req: Request, res: Response, next: NextFunction) {
  const id = req.header('x-super-user-id')
  const rolesHeader = req.header('x-super-user-roles')
  const active = req.header('x-super-active-role')

  if (!id) return next()
  const roles = rolesHeader ? rolesHeader.split(',').map(s => s.trim()) : []
  ;(req as any).superUser = { id, roles, activeRole: active } as SuperUser
  next()
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

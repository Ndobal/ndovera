export type StoredUser = {
  id: string;
  schoolId?: string;
  roles: string[];
  activeRole?: string;
}

const KEY = 'ndovera_user'

export function saveUser(user: StoredUser) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch (e) {}
}

export function loadUser(): StoredUser | null {
  try {
    const v = localStorage.getItem(KEY)
    if (!v) return null
    const parsed = JSON.parse(v) as Partial<StoredUser>
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id.trim()) return null
    if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) return null
    return {
      id: parsed.id,
      schoolId: parsed.schoolId,
      roles: parsed.roles,
      activeRole: parsed.activeRole,
    }
  } catch (e) { return null }
}

export function clearUser() {
  try { localStorage.removeItem(KEY) } catch (e) {}
}

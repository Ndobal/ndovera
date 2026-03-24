export type StoredUser = {
  id: string;
  ndoveraId?: string;
  schoolId?: string;
  roles: string[];
  activeRole?: string;
  name?: string;
  email?: string;
  alternateEmail?: string | null;
  avatarUrl?: string | null;
  statusText?: string | null;
  statusAvailability?: 'available' | 'busy' | 'away' | 'offline';
  statusUpdatedAt?: string | null;
  school?: {
    id?: string;
    name?: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    primaryColor?: string;
  } | null;
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
      ndoveraId: typeof parsed.ndoveraId === 'string' ? parsed.ndoveraId : parsed.id,
      schoolId: parsed.schoolId,
      roles: parsed.roles,
      activeRole: parsed.activeRole,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      alternateEmail: typeof parsed.alternateEmail === 'string' ? parsed.alternateEmail : null,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
      statusText: typeof parsed.statusText === 'string' ? parsed.statusText : null,
      statusAvailability: parsed.statusAvailability === 'busy' || parsed.statusAvailability === 'away' || parsed.statusAvailability === 'offline' ? parsed.statusAvailability : 'available',
      statusUpdatedAt: typeof parsed.statusUpdatedAt === 'string' ? parsed.statusUpdatedAt : null,
      school: parsed.school && typeof parsed.school === 'object' ? {
        id: typeof (parsed.school as any).id === 'string' ? (parsed.school as any).id : undefined,
        name: typeof (parsed.school as any).name === 'string' ? (parsed.school as any).name : undefined,
        logoUrl: typeof (parsed.school as any).logoUrl === 'string' ? (parsed.school as any).logoUrl : null,
        websiteUrl: typeof (parsed.school as any).websiteUrl === 'string' ? (parsed.school as any).websiteUrl : null,
        primaryColor: typeof (parsed.school as any).primaryColor === 'string' ? (parsed.school as any).primaryColor : undefined,
      } : null,
    }
  } catch (e) { return null }
}

export function clearUser() {
  try { localStorage.removeItem(KEY) } catch (e) {}
}

export function logout(redirectTo = '/') {
  clearUser()
  try {
    if (typeof window !== 'undefined') {
      window.location.assign(redirectTo)
    }
  } catch (e) {}
}

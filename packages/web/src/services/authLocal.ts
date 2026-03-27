export type StoredUser = {
  id: string;
  ndoveraId?: string;
  schoolId?: string;
  baseSchoolId?: string;
  activeSchoolId?: string;
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
  accessibleSchools?: Array<{
    id: string;
    name: string;
    subdomain?: string;
    accessLevel?: 'member' | 'owner';
    logoUrl?: string | null;
    websiteUrl?: string | null;
    primaryColor?: string;
  }>;
  ownerAccount?: {
    id: string;
    tier: 'growth' | 'pro' | 'enterprise';
    policyControl: 'none' | 'limited' | 'full';
    maxSchools: number | null;
    allowedSchoolCount: number | null;
    extraSchoolSlots: number;
    ownedSchoolCount: number;
    canAddSchools: boolean;
    upgradeRequired: boolean;
    ownerName: string;
    ownerEmail: string | null;
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
      baseSchoolId: typeof parsed.baseSchoolId === 'string' ? parsed.baseSchoolId : undefined,
      activeSchoolId: typeof parsed.activeSchoolId === 'string' ? parsed.activeSchoolId : undefined,
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
      accessibleSchools: Array.isArray(parsed.accessibleSchools) ? parsed.accessibleSchools
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && typeof (entry as any).id === 'string' && typeof (entry as any).name === 'string')
        .map((entry) => ({
          id: String(entry.id),
          name: String(entry.name),
          subdomain: typeof entry.subdomain === 'string' ? entry.subdomain : undefined,
          accessLevel: entry.accessLevel === 'owner' ? 'owner' : 'member',
          logoUrl: typeof entry.logoUrl === 'string' ? entry.logoUrl : null,
          websiteUrl: typeof entry.websiteUrl === 'string' ? entry.websiteUrl : null,
          primaryColor: typeof entry.primaryColor === 'string' ? entry.primaryColor : undefined,
        })) : [],
      ownerAccount: parsed.ownerAccount && typeof parsed.ownerAccount === 'object' ? {
        id: String((parsed.ownerAccount as any).id || ''),
        tier: (parsed.ownerAccount as any).tier === 'enterprise' ? 'enterprise' : (parsed.ownerAccount as any).tier === 'pro' ? 'pro' : 'growth',
        policyControl: (parsed.ownerAccount as any).policyControl === 'full' ? 'full' : (parsed.ownerAccount as any).policyControl === 'limited' ? 'limited' : 'none',
        maxSchools: typeof (parsed.ownerAccount as any).maxSchools === 'number' ? (parsed.ownerAccount as any).maxSchools : null,
        allowedSchoolCount: typeof (parsed.ownerAccount as any).allowedSchoolCount === 'number' ? (parsed.ownerAccount as any).allowedSchoolCount : null,
        extraSchoolSlots: Number((parsed.ownerAccount as any).extraSchoolSlots || 0) || 0,
        ownedSchoolCount: Number((parsed.ownerAccount as any).ownedSchoolCount || 0) || 0,
        canAddSchools: Boolean((parsed.ownerAccount as any).canAddSchools),
        upgradeRequired: Boolean((parsed.ownerAccount as any).upgradeRequired),
        ownerName: String((parsed.ownerAccount as any).ownerName || ''),
        ownerEmail: typeof (parsed.ownerAccount as any).ownerEmail === 'string' ? (parsed.ownerAccount as any).ownerEmail : null,
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

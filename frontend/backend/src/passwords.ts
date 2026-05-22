const PASSWORD_HASH_VERSION = 1
const PASSWORD_HASH_ITERATIONS = 1000          // CF Workers CPU-safe (was 100000)
const WORKER_PBKDF2_MAX_ITERATIONS = 100000    // hard cap check — do not exceed
const PASSWORD_SALT_BYTES = 16
const PASSWORD_HASH_BITS = 256

const textEncoder = new TextEncoder()

export type PasswordHashRecord = {
  version: number
  algorithm: 'pbkdf2-sha256'
  iterations: number
  salt: string
  hash: string
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, key, PASSWORD_HASH_BITS)

  return new Uint8Array(bits)
}

function assertSupportedIterations(iterations: number) {
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('Unsupported password hash iterations.')
  }

  if (iterations > WORKER_PBKDF2_MAX_ITERATIONS) {
    throw new Error(
      `Password hash iterations ${iterations} exceed the Cloudflare Worker PBKDF2 limit of ${WORKER_PBKDF2_MAX_ITERATIONS}.`
    )
  }
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }

  return diff === 0
}

export function isPasswordHashRecord(value: unknown): value is PasswordHashRecord {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return candidate.algorithm === 'pbkdf2-sha256'
    && typeof candidate.version === 'number'
    && typeof candidate.iterations === 'number'
    && typeof candidate.salt === 'string'
    && typeof candidate.hash === 'string'
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES))
  const hash = await deriveHash(password, salt, PASSWORD_HASH_ITERATIONS)

  return {
    version: PASSWORD_HASH_VERSION,
    algorithm: 'pbkdf2-sha256' as const,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt: toBase64(salt),
    hash: toBase64(hash),
  }
}

export async function verifyPasswordCandidate(password: string, settings: Record<string, any> | null) {
  if (!settings) return false

  if (isPasswordHashRecord(settings.passwordHash)) {
    assertSupportedIterations(settings.passwordHash.iterations)
    const expected = fromBase64(settings.passwordHash.hash)
    const derived = await deriveHash(password, fromBase64(settings.passwordHash.salt), settings.passwordHash.iterations)
    return timingSafeEqual(derived, expected)
  }

  // Fallback: plain initial password stored for mustChangePassword users (created before PBKDF2 fix)
  if (typeof settings.initialPassword === 'string') {
    return settings.initialPassword === password
  }

  if (typeof settings.password === 'string') {
    return settings.password === password
  }

  return false
}

export async function migrateLegacyPasswordIfNeeded(settings: Record<string, any>, password: string) {
  if (typeof settings.password !== 'string' || isPasswordHashRecord(settings.passwordHash)) {
    return null
  }

  if (settings.password !== password) {
    return null
  }

  const nextSettings = { ...settings }
  delete nextSettings.password
  nextSettings.passwordHash = await hashPassword(password)
  nextSettings.passwordUpdatedAt = new Date().toISOString()
  return nextSettings
}

export async function withHashedPassword(settings: Record<string, any>, password: string) {
  const nextSettings = { ...settings }
  delete nextSettings.password
  delete nextSettings.passwordState
  nextSettings.passwordHash = await hashPassword(password)
  nextSettings.passwordUpdatedAt = new Date().toISOString()
  return nextSettings
}

const MERGED_ADMIN_ROLE_KEYS = new Set([
  'accountant',
  'librarian',
  'sanitation',
  'tuckshopmanager',
  'storekeeper',
  'transport',
  'hostel',
  'cafeteria',
  'clinic',
  'ict',
  'examofficer',
  'sportsmaster',
])

const STAFF_EXCLUDED_ROLES = new Set(['student', 'parent'])

const ROLE_CAPABILITIES: Record<string, string[]> = {
  owner: ['manage_admissions', 'manage_payroll', 'teach_subjects', 'manage_fees', 'assign_classes', 'approve_results', 'manage_users'],
  hos: ['manage_admissions', 'manage_payroll', 'teach_subjects', 'manage_fees', 'assign_classes', 'approve_results', 'manage_users'],
  admin: ['manage_admissions', 'manage_fees', 'assign_classes', 'manage_users'],
  teacher: ['teach_subjects'],
  classteacher: ['teach_subjects', 'assign_classes'],
  principal: ['manage_admissions', 'teach_subjects', 'assign_classes', 'approve_results', 'manage_users'],
  viceprincipal: ['manage_admissions', 'teach_subjects', 'assign_classes', 'approve_results', 'manage_users'],
  headteacher: ['manage_admissions', 'teach_subjects', 'assign_classes', 'approve_results', 'manage_users'],
  nurseryhead: ['manage_admissions', 'teach_subjects', 'assign_classes', 'approve_results', 'manage_users'],
  hod: ['teach_subjects', 'assign_classes', 'approve_results'],
  hodassistant: ['teach_subjects', 'assign_classes'],
  accountant: ['manage_payroll', 'manage_fees'],
  ict: ['manage_users', 'assign_classes'],
  ict_manager: ['manage_users', 'assign_classes', 'approve_results'],
  examofficer: ['approve_results'],
  librarian: ['assign_classes'],
}

export function normalizeRoleValues(value: string | string[] | undefined | null) {
  if (Array.isArray(value)) {
    return value
      .map(entry => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
  }

  return String(value || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function getUserRoles(...values: Array<string | string[] | undefined | null>) {
  const roles: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    for (const role of normalizeRoleValues(value)) {
      if (seen.has(role)) continue
      seen.add(role)
      roles.push(role)
    }
  }

  return roles
}

export function deriveCapabilities(userRole: string | string[] | undefined, extraRoles: string | string[] | undefined = undefined) {
  const roles = getUserRoles(userRole, extraRoles)
  const capabilities = new Set<string>()

  if (roles.includes('ami')) {
    capabilities.add('manage_admissions')
    capabilities.add('manage_payroll')
    capabilities.add('teach_subjects')
    capabilities.add('manage_fees')
    capabilities.add('assign_classes')
    capabilities.add('approve_results')
    capabilities.add('manage_users')
  }

  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role] || []) {
      capabilities.add(capability)
    }
  }

  return Array.from(capabilities)
}

export function hasRequiredCapability(
  userRole: string | string[] | undefined,
  requiredCapability: string,
  extraRoles: string | string[] | undefined = undefined,
) {
  return deriveCapabilities(userRole, extraRoles).includes(String(requiredCapability || '').trim())
}

export function isStaffRole(role: string) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  return normalizedRole !== '' && !STAFF_EXCLUDED_ROLES.has(normalizedRole)
}

export function isStaff(userRole: string | string[] | undefined, extraRoles: string | string[] | undefined = undefined) {
  const roles = getUserRoles(userRole, extraRoles)
  return roles.some(role => isStaffRole(role))
}

export function canTeach(userRole: string | string[] | undefined, extraRoles: string | string[] | undefined = undefined) {
  return hasRequiredCapability(userRole, 'teach_subjects', extraRoles)
}

export function deriveEmploymentCategory(
  userRole: string | string[] | undefined,
  preferredCategory: unknown = '',
  extraRoles: string | string[] | undefined = undefined,
) {
  const explicit = String(preferredCategory || '').trim().toLowerCase()
  if (['academic', 'administrative', 'support', 'contract'].includes(explicit)) {
    return explicit
  }

  const roles = getUserRoles(userRole, extraRoles)
  if (roles.includes('contract')) return 'contract'
  if (canTeach(userRole, extraRoles)) return 'academic'
  if (roles.some(role => ['owner', 'hos', 'admin', 'principal', 'viceprincipal', 'headteacher', 'nurseryhead', 'hod', 'hodassistant', 'accountant', 'ict', 'ict_manager', 'examofficer'].includes(role))) {
    return 'administrative'
  }
  return 'support'
}

export function hasRequiredRole(userRole: string | string[] | undefined, allowedRoles: string[]) {
  const roles = getUserRoles(userRole)
  if (roles.length === 0) return false
  if (roles.includes('ami')) return true
  if (roles.some(role => allowedRoles.includes(role))) return true
  if (allowedRoles.includes('admin') && roles.some(role => MERGED_ADMIN_ROLE_KEYS.has(role))) return true
  return false
}

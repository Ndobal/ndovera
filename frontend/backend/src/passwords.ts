const PASSWORD_HASH_VERSION = 1
const PASSWORD_HASH_ITERATIONS = 100000
const WORKER_PBKDF2_MAX_ITERATIONS = 100000
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

export function hasRequiredRole(userRole: string | undefined, allowedRoles: string[]) {
  if (!userRole) return false
  return userRole === 'ami' || allowedRoles.includes(userRole)
}
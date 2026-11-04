// Invitations for parents: a private link holding their children and student codes. The parent fills in their
// details and can then sign in by email or phone. Only the link's hash is stored; a link works once, for 30 days.

export class InviteError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(message: string, status = 400, details: Record<string, unknown> = {}) { super(message); this.status = status; this.details = details }
}

export const INVITE_DAYS = 30
export const MAX_CHILDREN = 6
const MAX_TRIES = 10
const ready = new WeakSet<object>()

export async function ensureInviteTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS parent_invites (token_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_ids TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, used_by TEXT, tries INTEGER NOT NULL DEFAULT 0)`).run()
  ready.add(db as object)
}

async function hashOf(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createInvite(db: D1Database, tenantId: string, studentIds: string[], actor: string) {
  await ensureInviteTable(db)
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const now = Date.now()
  await db.prepare(`INSERT INTO parent_invites (token_hash, tenant_id, student_ids, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(await hashOf(token), tenantId, JSON.stringify(studentIds), actor, new Date(now).toISOString(), new Date(now + INVITE_DAYS * 86400_000).toISOString()).run()
  return token
}

/** The invite behind a link, if it can still be used. */
export async function readInvite(db: D1Database, token: string) {
  await ensureInviteTable(db)
  const row = await db.prepare(`SELECT * FROM parent_invites WHERE token_hash = ?`).bind(await hashOf(String(token || ''))).first() as Record<string, any> | null
  if (!row) throw new InviteError('This invitation link is not valid. Ask the school for a new one.', 404)
  if (row.used_at) throw new InviteError('This invitation has already been used. Sign in with your email or phone number.', 410)
  if (String(row.expires_at) <= new Date().toISOString()) throw new InviteError('This invitation has expired. Ask the school for a new one.', 410)
  if (Number(row.tries) >= MAX_TRIES) throw new InviteError('This invitation has had too many failed tries. Ask the school for a new one.', 429)
  return { hash: String(row.token_hash), tenantId: String(row.tenant_id), studentIds: JSON.parse(String(row.student_ids)) as string[] }
}

export async function countFailedTry(db: D1Database, hash: string) {
  await db.prepare(`UPDATE parent_invites SET tries = tries + 1 WHERE token_hash = ?`).bind(hash).run()
}

/** Only one request can use a link. */
export async function claimInvite(db: D1Database, hash: string, by: string) {
  const done = await db.prepare(`UPDATE parent_invites SET used_at = ?, used_by = ? WHERE token_hash = ? AND used_at IS NULL`).bind(new Date().toISOString(), by, hash).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new InviteError('This invitation has already been used. Sign in with your email or phone number.', 410)
}

export async function releaseInvite(db: D1Database, hash: string) {
  await db.prepare(`UPDATE parent_invites SET used_at = NULL, used_by = NULL WHERE token_hash = ?`).bind(hash).run()
}

/** The parent's form, checked before anything is saved. */
export function checkInviteForm(input: Record<string, any>, normalizePhone: (value: unknown) => string) {
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 160)
  const email = String(input.email || '').trim().toLowerCase()
  const phone = normalizePhone(input.phone)
  const dateOfBirth = String(input.dateOfBirth || '').trim()
  const occupation = String(input.occupation || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const password = String(input.password || '')
  if (name.length < 2) throw new InviteError('Enter your full name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InviteError('Enter your email address.')
  if (!phone) throw new InviteError('Enter your phone number. Outside Nigeria, start with your country code, such as +233.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth)) || dateOfBirth >= new Date().toISOString().slice(0, 10)) throw new InviteError('Enter your date of birth.')
  if (occupation.length < 2) throw new InviteError('Enter your occupation.')
  if (password.length < 8) throw new InviteError('Choose a password of at least 8 characters.')
  return { name, email, phone, dateOfBirth, occupation, password }
}

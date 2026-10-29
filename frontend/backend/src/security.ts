// Security: login protection, sessions that can be revoked, emergency controls, and the
// security event log with alerts.
//
// Login protection (per account and per IP, 15-minute windows):
//   account: 3 failures → a Turnstile check is required; 8 → locked 15 minutes; 15 → 1 hour
//   IP:      10 failures → Turnstile required; 40 → blocked 30 minutes
// A blocked IP is refused before any database write, so an attack cannot spend the daily
// write budget. (Cloudflare's own rate-limiting rule in front of /api/auth/* is the cheapest
// first line; this is the second.)
//
// Sessions: the 30-day sliding session is kept. Each sign-in is a row; the token carries its
// id (sid). A session can be signed out, a person can be signed out everywhere, a school can
// be locked, and Ndovera can sign everyone out at once (the emergency lock). Checking costs
// one small query per session per minute per Worker, not one per request.
//
// Events: failed-login spikes, lockouts, emergency actions, sign-ins by privileged accounts
// from a new device and blocked script reports are logged; serious ones email Ndovera (at
// most one email per kind per hour).

export const ACCOUNT_CHALLENGE_AT = 3
export const ACCOUNT_LOCK_AT = 8
export const ACCOUNT_LONG_LOCK_AT = 15
export const IP_CHALLENGE_AT = 10
export const IP_BLOCK_AT = 40
const WINDOW_MS = 15 * 60_000
const CHECK_CACHE_MS = 60_000
const TOUCH_EVERY_MS = 6 * 3600_000
export const PRIVILEGED_ROLES = ['ami', 'owner', 'hos', 'accountant', 'bursar', 'admin']

const nowIso = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

const readyDbs = new WeakSet<object>()
export async function ensureSecurityTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, window_start TEXT NOT NULL, locked_until TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT, role TEXT, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
      ip TEXT, user_agent TEXT, revoked_at TEXT, revoked_by TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at)`,
    `CREATE TABLE IF NOT EXISTS security_controls (scope TEXT PRIMARY KEY, revoked_before TEXT, logins_paused INTEGER NOT NULL DEFAULT 0, reason TEXT, updated_by TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, risk TEXT NOT NULL, actor TEXT, target TEXT, user_id TEXT, tenant_id TEXT, ip TEXT, detail TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_at ON security_events(at)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_kind ON security_events(kind, at)`,
    `CREATE TABLE IF NOT EXISTS security_alerts (kind TEXT PRIMARY KEY, last_sent_at TEXT NOT NULL, suppressed INTEGER NOT NULL DEFAULT 0)`,
  ]) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

// ─── Events and alerts ──────────────────────────────────────────────────────

export type Risk = 'low' | 'medium' | 'high' | 'critical'
export type SecurityEvent = { kind: string, risk: Risk, actor?: string, target?: string, userId?: string, tenantId?: string, ip?: string, detail?: string }
export type Alerter = (subject: string, text: string) => Promise<void>

/** Record an event; high and critical ones email Ndovera, at most once per kind per hour. */
export async function logSecurityEvent(db: D1Database, event: SecurityEvent, alert?: Alerter | null) {
  await ensureSecurityTables(db)
  await db.prepare(`INSERT INTO security_events (id, at, kind, risk, actor, target, user_id, tenant_id, ip, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId('sev'), nowIso(), event.kind, event.risk, event.actor || null, event.target || null, event.userId || null, event.tenantId || null, event.ip || null, (event.detail || '').slice(0, 1000)).run()
  if (alert && (event.risk === 'high' || event.risk === 'critical')) {
    const cutoff = new Date(Date.now() - 3600_000).toISOString()
    const claim = await db.prepare(`INSERT INTO security_alerts (kind, last_sent_at) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET last_sent_at = excluded.last_sent_at, suppressed = 0 WHERE security_alerts.last_sent_at < ?`)
      .bind(event.kind, nowIso(), cutoff).run()
    if (Number(claim.meta?.changes)) {
      await alert(`Ndovera security: ${event.kind.replace(/_/g, ' ')}`, [
        `Risk: ${event.risk}`, `What: ${event.detail || event.kind}`, event.actor ? `Who: ${event.actor}` : '', event.target ? `Target: ${event.target}` : '',
        event.ip ? `IP: ${event.ip}` : '', event.tenantId ? `School: ${event.tenantId}` : '', `When: ${nowIso()}`,
        'Further alerts of this kind are held for an hour; see Super Admin → Security for everything.',
      ].filter(Boolean).join('\n')).catch(error => console.error('Security alert email failed', error))
    } else {
      await db.prepare(`UPDATE security_alerts SET suppressed = suppressed + 1 WHERE kind = ?`).bind(event.kind).run()
    }
  }
}

export async function listSecurityEvents(db: D1Database, filters: { risk?: string, search?: string, limit?: number } = {}) {
  await ensureSecurityTables(db)
  const where: string[] = []
  const values: unknown[] = []
  if (filters.risk && ['low', 'medium', 'high', 'critical'].includes(filters.risk)) { where.push('risk = ?'); values.push(filters.risk) }
  if (filters.search) { where.push(`(lower(coalesce(actor,'')) LIKE ? OR lower(kind) LIKE ? OR lower(coalesce(target,'')) LIKE ? OR coalesce(ip,'') LIKE ?)`); const q = `%${filters.search.toLowerCase().slice(0, 80)}%`; values.push(q, q, q, q) }
  const rows = ((await db.prepare(`SELECT * FROM security_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC LIMIT ?`).bind(...values, Math.min(1000, filters.limit || 300)).all()).results || []) as Record<string, any>[]
  return rows.map(row => ({ id: row.id, timestamp: row.at, action: String(row.kind).replace(/_/g, ' '), kind: row.kind, riskLevel: row.risk, actor: row.actor || '', target: row.target || '', ip: row.ip || '', detail: row.detail || '', tenantId: row.tenant_id || '' }))
}

// ─── Login attempts ─────────────────────────────────────────────────────────

export const accountKey = (identifier: string) => `acct:${String(identifier || '').trim().toLowerCase().slice(0, 200)}`
export const ipKey = (ip: string) => `ip:${String(ip || 'unknown').slice(0, 64)}`

type AttemptRow = { key: string, failures: number, window_start: string, locked_until: string | null }

async function readAttempts(db: D1Database, keys: string[]) {
  await ensureSecurityTables(db)
  const rows = ((await db.prepare(`SELECT key, failures, window_start, locked_until FROM auth_attempts WHERE key IN (${keys.map(() => '?').join(', ')})`).bind(...keys).all()).results || []) as AttemptRow[]
  const now = Date.now()
  const out = new Map<string, { failures: number, lockedUntil: string | null }>()
  for (const row of rows) {
    const fresh = now - Date.parse(row.window_start) < WINDOW_MS
    const locked = row.locked_until && Date.parse(row.locked_until) > now ? row.locked_until : null
    out.set(row.key, { failures: fresh ? Number(row.failures) : 0, lockedUntil: locked })
  }
  return out
}

export type LoginGate = { allowed: boolean, challenge: boolean, retryAfterSeconds?: number, reason?: 'ip' | 'account' }

/** Before checking a password: is this IP or account blocked, and is a Turnstile check due? */
export async function loginGate(db: D1Database, ip: string, identifier: string): Promise<LoginGate> {
  const attempts = await readAttempts(db, [ipKey(ip), accountKey(identifier)])
  const ipState = attempts.get(ipKey(ip))
  const account = attempts.get(accountKey(identifier))
  const retry = (until: string) => Math.max(1, Math.ceil((Date.parse(until) - Date.now()) / 1000))
  if (ipState?.lockedUntil) return { allowed: false, challenge: false, retryAfterSeconds: retry(ipState.lockedUntil), reason: 'ip' }
  if (account?.lockedUntil) return { allowed: false, challenge: false, retryAfterSeconds: retry(account.lockedUntil), reason: 'account' }
  return { allowed: true, challenge: (account?.failures || 0) >= ACCOUNT_CHALLENGE_AT || (ipState?.failures || 0) >= IP_CHALLENGE_AT }
}

/** After a wrong password: count it for the IP and the account; lock when the limits are reached. */
export async function recordLoginFailure(db: D1Database, ip: string, identifier: string, alert?: Alerter | null) {
  await ensureSecurityTables(db)
  const now = Date.now()
  const at = nowIso()
  const windowCutoff = new Date(now - WINDOW_MS).toISOString()
  for (const key of [ipKey(ip), accountKey(identifier)]) {
    await db.prepare(`INSERT INTO auth_attempts (key, failures, window_start, updated_at) VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET failures = CASE WHEN auth_attempts.window_start < ? THEN 1 ELSE auth_attempts.failures + 1 END,
        window_start = CASE WHEN auth_attempts.window_start < ? THEN excluded.window_start ELSE auth_attempts.window_start END, updated_at = excluded.updated_at`)
      .bind(key, at, at, windowCutoff, windowCutoff).run()
  }
  const attempts = await readAttempts(db, [ipKey(ip), accountKey(identifier)])
  const account = attempts.get(accountKey(identifier))?.failures || 0
  const ipFailures = attempts.get(ipKey(ip))?.failures || 0
  if (account === ACCOUNT_LOCK_AT || account === ACCOUNT_LONG_LOCK_AT) {
    const minutes = account >= ACCOUNT_LONG_LOCK_AT ? 60 : 15
    await db.prepare(`UPDATE auth_attempts SET locked_until = ? WHERE key = ?`).bind(new Date(now + minutes * 60_000).toISOString(), accountKey(identifier)).run()
    await logSecurityEvent(db, { kind: 'account_locked', risk: account >= ACCOUNT_LONG_LOCK_AT ? 'high' : 'medium', target: identifier, ip, detail: `${account} wrong passwords in 15 minutes; locked for ${minutes} minutes.` }, alert)
  }
  if (ipFailures === IP_BLOCK_AT) {
    await db.prepare(`UPDATE auth_attempts SET locked_until = ? WHERE key = ?`).bind(new Date(now + 30 * 60_000).toISOString(), ipKey(ip)).run()
    await logSecurityEvent(db, { kind: 'ip_blocked', risk: 'high', ip, detail: `${ipFailures} failed sign-ins from one address in 15 minutes; blocked for 30 minutes.` }, alert)
  }
  return { accountFailures: account, ipFailures }
}

export async function recordLoginSuccess(db: D1Database, identifier: string) {
  await ensureSecurityTables(db)
  await db.prepare(`DELETE FROM auth_attempts WHERE key = ?`).bind(accountKey(identifier)).run()
}

/** A simple bucket for other endpoints (password reset): true when this key may proceed. */
export async function allowAction(db: D1Database, key: string, limit: number, windowMs: number) {
  await ensureSecurityTables(db)
  const at = nowIso()
  const cutoff = new Date(Date.now() - windowMs).toISOString()
  await db.prepare(`INSERT INTO auth_attempts (key, failures, window_start, updated_at) VALUES (?, 1, ?, ?)
    ON CONFLICT(key) DO UPDATE SET failures = CASE WHEN auth_attempts.window_start < ? THEN 1 ELSE auth_attempts.failures + 1 END,
      window_start = CASE WHEN auth_attempts.window_start < ? THEN excluded.window_start ELSE auth_attempts.window_start END, updated_at = excluded.updated_at`)
    .bind(key, at, at, cutoff, cutoff).run()
  const row = await db.prepare(`SELECT failures FROM auth_attempts WHERE key = ?`).bind(key).first() as { failures: number } | null
  return Number(row?.failures || 0) <= limit
}

/** Cloudflare Turnstile: the token from the widget, checked with Cloudflare. */
export async function verifyTurnstile(secret: string, token: string, ip: string) {
  if (!secret) return true // not configured: the account and IP locks still apply
  if (!token) return false
  try {
    const body = new FormData()
    body.append('secret', secret)
    body.append('response', token)
    if (ip) body.append('remoteip', ip)
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    const data = await response.json() as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

// ─── Sessions and controls ──────────────────────────────────────────────────

export async function createSession(db: D1Database, input: { userId: string, tenantId?: string | null, role?: string, ip?: string, userAgent?: string }) {
  await ensureSecurityTables(db)
  const id = newId('ses')
  const at = nowIso()
  await db.prepare(`INSERT INTO auth_sessions (id, user_id, tenant_id, role, created_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.userId, input.tenantId || null, input.role || null, at, at, (input.ip || '').slice(0, 64), (input.userAgent || '').slice(0, 300)).run()
  return id
}

/** Has this person signed in from this device (user agent) before? Used for new-device alerts on privileged accounts. */
export async function knownDevice(db: D1Database, userId: string, userAgent: string) {
  await ensureSecurityTables(db)
  return Boolean(await db.prepare(`SELECT 1 FROM auth_sessions WHERE user_id = ? AND user_agent = ? LIMIT 1`).bind(userId, (userAgent || '').slice(0, 300)).first())
}

type SessionCheck = { valid: boolean, reason?: string, lastSeenAt?: string, exists: boolean }
const checkCache = new Map<string, { at: number, result: SessionCheck }>()

/**
 * Is a token still good? It is not if its session was signed out, or it was issued before
 * the person, their school or everyone was signed out. Cached for a minute per Worker.
 */
export async function checkSession(db: D1Database, input: { sid?: string, userId: string, tenantId?: string, issuedAtSeconds?: number, role?: string }): Promise<SessionCheck> {
  const cacheKey = `${input.sid || '-'}|${input.userId}|${input.tenantId || ''}`
  const cached = checkCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CHECK_CACHE_MS) return evaluate(cached.result, input)
  await ensureSecurityTables(db)
  const scopes = ['global', input.tenantId ? `tenant:${input.tenantId}` : '', `user:${String(input.userId).toLowerCase()}`].filter(Boolean)
  const [session, controls] = await Promise.all([
    input.sid ? db.prepare(`SELECT revoked_at, last_seen_at FROM auth_sessions WHERE id = ?`).bind(input.sid).first() as Promise<{ revoked_at: string | null, last_seen_at: string } | null> : Promise.resolve(null),
    db.prepare(`SELECT scope, revoked_before FROM security_controls WHERE scope IN (${scopes.map(() => '?').join(', ')})`).bind(...scopes).all(),
  ])
  const revokedBefore: Record<string, string> = {}
  for (const row of (controls.results || []) as Array<{ scope: string, revoked_before: string | null }>) if (row.revoked_before) revokedBefore[row.scope] = row.revoked_before
  const result: SessionCheck & { revokedBefore?: Record<string, string> } = {
    valid: !(session?.revoked_at), reason: session?.revoked_at ? 'session_revoked' : undefined, lastSeenAt: session?.last_seen_at, exists: Boolean(session), revokedBefore,
  }
  checkCache.set(cacheKey, { at: Date.now(), result })
  if (checkCache.size > 5000) checkCache.clear()
  return evaluate(result, input)
}

function evaluate(result: SessionCheck & { revokedBefore?: Record<string, string> }, input: { tenantId?: string, issuedAtSeconds?: number, role?: string, userId: string }): SessionCheck {
  if (!result.valid) return result
  const issued = input.issuedAtSeconds ? input.issuedAtSeconds * 1000 : 0
  const before = result.revokedBefore || {}
  // The emergency sign-out never locks Ndovera itself out.
  const scopes = [input.role === 'ami' ? '' : 'global', input.tenantId ? `tenant:${input.tenantId}` : '', `user:${String(input.userId).toLowerCase()}`].filter(Boolean)
  for (const scope of scopes) {
    if (before[scope] && issued < Date.parse(before[scope])) return { ...result, valid: false, reason: `${scope.split(':')[0]}_signed_out` }
  }
  return result
}

export function forgetSessionChecks() {
  checkCache.clear()
}

/** Last-seen is written at most every 6 hours per session (not on every request). */
export async function touchSession(db: D1Database, sid: string, lastSeenAt: string | undefined, ip: string) {
  if (!sid || (lastSeenAt && Date.now() - Date.parse(lastSeenAt) < TOUCH_EVERY_MS)) return
  await db.prepare(`UPDATE auth_sessions SET last_seen_at = ?, ip = ? WHERE id = ?`).bind(nowIso(), (ip || '').slice(0, 64), sid).run()
  forgetSessionChecks()
}

export async function revokeSession(db: D1Database, sid: string, by: string, userId?: string) {
  await ensureSecurityTables(db)
  const result = await db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoked_by = ? WHERE id = ? AND revoked_at IS NULL ${userId ? 'AND user_id = ?' : ''}`)
    .bind(nowIso(), by, sid, ...(userId ? [userId] : [])).run()
  forgetSessionChecks()
  return Number(result.meta?.changes || 0) > 0
}

export async function listSessions(db: D1Database, userId: string) {
  await ensureSecurityTables(db)
  return ((await db.prepare(`SELECT id, created_at AS createdAt, last_seen_at AS lastSeenAt, ip, user_agent AS userAgent, role FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50`).bind(userId).all()).results || []) as Record<string, any>[]
}

/**
 * Sign out a person, a school, or everyone (scope 'global'): every token issued before now
 * stops working. pauseLogins also refuses new sign-ins until lifted.
 */
export async function setControl(db: D1Database, input: { scope: string, signOut: boolean, pauseLogins?: boolean, reason: string, by: string }) {
  await ensureSecurityTables(db)
  const at = nowIso()
  await db.prepare(`INSERT INTO security_controls (scope, revoked_before, logins_paused, reason, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope) DO UPDATE SET revoked_before = COALESCE(excluded.revoked_before, security_controls.revoked_before), logins_paused = excluded.logins_paused,
      reason = excluded.reason, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(input.scope, input.signOut ? at : null, input.pauseLogins ? 1 : 0, input.reason.slice(0, 300), input.by, at).run()
  forgetSessionChecks()
}

export async function liftLoginPause(db: D1Database, scope: string, by: string) {
  await ensureSecurityTables(db)
  await db.prepare(`UPDATE security_controls SET logins_paused = 0, updated_by = ?, updated_at = ? WHERE scope = ?`).bind(by, nowIso(), scope).run()
}

export async function listControls(db: D1Database) {
  await ensureSecurityTables(db)
  return ((await db.prepare(`SELECT scope, revoked_before AS revokedBefore, logins_paused AS loginsPaused, reason, updated_by AS updatedBy, updated_at AS updatedAt FROM security_controls ORDER BY updated_at DESC`).all()).results || []) as Record<string, any>[]
}

/** Are new sign-ins paused for this person (globally, for their school, or for them)? Ndovera is never paused globally. */
export async function loginsPaused(db: D1Database, input: { userId: string, tenantId?: string, role?: string }) {
  await ensureSecurityTables(db)
  const scopes = [input.role === 'ami' ? '' : 'global', input.tenantId ? `tenant:${input.tenantId}` : '', `user:${String(input.userId).toLowerCase()}`].filter(Boolean)
  const row = await db.prepare(`SELECT scope, reason FROM security_controls WHERE logins_paused = 1 AND scope IN (${scopes.map(() => '?').join(', ')}) LIMIT 1`).bind(...scopes).first() as { scope: string, reason: string } | null
  return row
}

/** Failed sign-ins in the last 10 minutes, for spike alerts. */
export async function recentFailureCount(db: D1Database) {
  await ensureSecurityTables(db)
  const row = await db.prepare(`SELECT COALESCE(SUM(failures), 0) AS n FROM auth_attempts WHERE key LIKE 'ip:%' AND updated_at >= ?`).bind(new Date(Date.now() - 10 * 60_000).toISOString()).first() as { n: number } | null
  return Number(row?.n || 0)
}

// ─── Security headers ───────────────────────────────────────────────────────

export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://ndovera.com https://*.ndovera.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://challenges.cloudflare.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://view.officeapps.live.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://*.flutterwave.com",
  'upgrade-insecure-requests',
  'report-uri /api/security/csp-report',
].join('; ')

export const API_CSP = "default-src 'none'; frame-ancestors 'none'"

/** The headers every response gets; HTML gets the page CSP, everything else a locked-down one. */
export function securityHeaders(contentType: string) {
  const html = /text\/html/i.test(contentType)
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    ...(html ? { 'Content-Security-Policy': APP_CSP } : /application\/json/i.test(contentType) ? { 'Content-Security-Policy': API_CSP } : {}),
  }
}

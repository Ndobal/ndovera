// "Ask someone to pay": a link a student or parent can send, so that an aunt, an uncle or a friend can buy the pass
// without an account. Only the link's hash is stored. It shows the child's first name and nothing else about them.

export const PAY_LINK_DAYS = 14
const LINKS_PER_DAY = 20
const ready = new WeakSet<object>()

export class PayLinkError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export async function ensurePayLinkTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS practice_pay_links (token_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT, class_id TEXT, bundle TEXT NOT NULL, options_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_tx TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_practice_pay_links_by ON practice_pay_links(created_by, created_at)`).run()
  ready.add(db as object)
}

async function hashOf(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function createPayLink(db: D1Database, input: { tenantId: string, studentId: string, studentName: string, classId: string, bundle: string, options: Record<string, unknown>, createdBy: string }) {
  await ensurePayLinkTable(db)
  const since = new Date(Date.now() - 86400_000).toISOString()
  const recent = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM practice_pay_links WHERE created_by = ? AND created_at >= ? LIMIT ${LINKS_PER_DAY})`).bind(input.createdBy, since).first() as Record<string, any> | null
  if (Number(recent?.n || 0) >= LINKS_PER_DAY) throw new PayLinkError('You have made many payment links today. Please try again tomorrow.', 429)
  const token = [...crypto.getRandomValues(new Uint8Array(20))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const now = Date.now()
  await db.prepare(`INSERT INTO practice_pay_links (token_hash, tenant_id, student_id, student_name, class_id, bundle, options_json, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(await hashOf(token), input.tenantId, input.studentId, input.studentName, input.classId, input.bundle, JSON.stringify(input.options), input.createdBy, new Date(now).toISOString(), new Date(now + PAY_LINK_DAYS * 86400_000).toISOString()).run()
  return token
}

export async function readPayLink(db: D1Database, token: string) {
  await ensurePayLinkTable(db)
  const hash = await hashOf(String(token || ''))
  const row = await db.prepare(`SELECT * FROM practice_pay_links WHERE token_hash = ?`).bind(hash).first() as Record<string, any> | null
  if (!row) throw new PayLinkError('This payment link is not valid.', 404)
  let options: Record<string, any> = {}
  try { options = JSON.parse(String(row.options_json || '{}')) || {} } catch { options = {} }
  return { hash, tenantId: String(row.tenant_id), studentId: String(row.student_id), studentName: String(row.student_name || ''), classId: String(row.class_id || ''), bundle: String(row.bundle), options, expired: String(row.expires_at) <= new Date().toISOString(), lastTx: String(row.last_tx || '') }
}

export async function rememberPayLinkTx(db: D1Database, hash: string, txRef: string) {
  await db.prepare(`UPDATE practice_pay_links SET last_tx = ? WHERE token_hash = ?`).bind(txRef, hash).run()
}

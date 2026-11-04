// What growth partners need to tell schools: updates Ami publishes, and the messages in their Toolkit.
//
// Cost: no polling. The unread count is one row for what the partner last saw plus at most UNREAD_CAP index rows,
// and comes with the partner's dashboard. Lists are bounded, and the Toolkit messages are one row.

export class PartnerUpdateError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

const LIST_LIMIT = 30
const UNREAD_CAP = 50
const MAX_MESSAGES = 12

/** {link}, {setupFee}, {perUser} and {code} become the partner's own when shown. Nothing here may promise what is not proven yet. */
export const DEFAULT_TOOLKIT_MESSAGES = [
  { title: 'Introduce Ndovera', body: 'Hello! I can help your school get online with NDOVERA: school website, results, fees, attendance and parent access in one place.\n\nOnboarding: {setupFee}\nThen {perUser} per active user each term.\n\nRegister here: {link}' },
  { title: 'A school that already has a website', body: 'Hello! Your school can keep its own website and still use the NDOVERA portal for results, fees, attendance and parents. You only add a link or button to your site, so no technical work is needed.\n\nOnboarding: {setupFee}\nThen {perUser} per active user each term.\n\nRegister here: {link}' },
  { title: 'Fees and parents', body: 'Hello! With NDOVERA, parents see their children\'s fees, receipts and results in one place, and your school sends polite fee reminders by email on its own letterhead. Parents join from an invitation link.\n\nOnboarding: {setupFee}\nThen {perUser} per active user each term.\n\nRegister here: {link}' },
  { title: 'Practice and exams', body: 'Hello! NDOVERA gives students practice questions in their class subjects. If your school prepares for an exam we do not have yet, you can send a request with the curriculum for Ndovera to look at.\n\nOnboarding: {setupFee}\nThen {perUser} per active user each term.\n\nRegister here: {link}' },
]

const ready = new WeakSet<object>()
async function ensureTables(db: D1Database) {
  if (ready.has(db as object)) return
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS partner_updates (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, explain TEXT, status TEXT NOT NULL DEFAULT 'draft', published_at TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_partner_updates_published ON partner_updates(status, published_at)`,
    `CREATE TABLE IF NOT EXISTS partner_update_seen (partner_id TEXT PRIMARY KEY, seen_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS partner_toolkit (id INTEGER PRIMARY KEY, messages_json TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL)`,
  ]) await db.prepare(sql).run()
  ready.add(db as object)
}

const view = (row: Record<string, any>) => ({
  id: String(row.id), title: String(row.title), body: String(row.body), explain: String(row.explain || ''), status: String(row.status), publishedAt: row.published_at ? String(row.published_at) : '',
})

function fields(input: Record<string, unknown>) {
  const title = String(input.title ?? '').trim().slice(0, 120)
  const body = String(input.body ?? '').trim().slice(0, 4000)
  if (title.length < 3) throw new PartnerUpdateError('Give the update a title.')
  if (body.length < 10) throw new PartnerUpdateError('Say what changed.')
  return { title, body, explain: String(input.explain ?? '').trim().slice(0, 2000) }
}

export async function listAllPartnerUpdates(db: D1Database) {
  await ensureTables(db)
  const rows = await db.prepare(`SELECT * FROM partner_updates ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`).all()
  return ((rows.results || []) as Record<string, any>[]).map(view)
}

export async function savePartnerUpdate(db: D1Database, input: Record<string, unknown>, actor: string, id = '') {
  await ensureTables(db)
  const { title, body, explain } = fields(input)
  const at = new Date().toISOString()
  if (id) {
    const done = await db.prepare(`UPDATE partner_updates SET title = ?, body = ?, explain = ?, updated_at = ? WHERE id = ?`).bind(title, body, explain, at, id).run()
    if (!Number((done as any)?.meta?.changes || 0)) throw new PartnerUpdateError('Update not found.', 404)
    return id
  }
  const newId = `pup_${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO partner_updates (id, title, body, explain, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`).bind(newId, title, body, explain, actor, at, at).run()
  return newId
}

/** Publishing counts as new for every partner once. Taking it down and publishing again does not count again. */
export async function setPartnerUpdatePublished(db: D1Database, id: string, published: boolean) {
  await ensureTables(db)
  const at = new Date().toISOString()
  const done = await db.prepare(`UPDATE partner_updates SET status = ?, published_at = CASE WHEN ? = 1 THEN COALESCE(published_at, ?) ELSE published_at END, updated_at = ? WHERE id = ?`)
    .bind(published ? 'published' : 'draft', published ? 1 : 0, at, at, id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new PartnerUpdateError('Update not found.', 404)
}

export async function deletePartnerUpdate(db: D1Database, id: string) {
  await ensureTables(db)
  await db.prepare(`DELETE FROM partner_updates WHERE id = ?`).bind(id).run()
}

async function seenAt(db: D1Database, partnerId: string) {
  const row = await db.prepare(`SELECT seen_at FROM partner_update_seen WHERE partner_id = ?`).bind(partnerId).first() as Record<string, any> | null
  return String(row?.seen_at || '')
}

export async function partnerUpdatesUnread(db: D1Database, partnerId: string) {
  await ensureTables(db)
  const seen = await seenAt(db, partnerId)
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM partner_updates WHERE status = 'published' AND published_at > ? LIMIT ${UNREAD_CAP})`).bind(seen).first() as Record<string, any> | null
  return Number(row?.n || 0)
}

/** The partner's list, marking which are new. Opening it counts as having seen them. */
export async function partnerUpdatesFor(db: D1Database, partnerId: string) {
  await ensureTables(db)
  const seen = await seenAt(db, partnerId)
  const rows = await db.prepare(`SELECT * FROM partner_updates WHERE status = 'published' ORDER BY published_at DESC LIMIT ${LIST_LIMIT}`).all()
  const updates = ((rows.results || []) as Record<string, any>[]).map(row => ({ ...view(row), isNew: String(row.published_at) > seen }))
  if (updates.some(item => item.isNew)) {
    await db.prepare(`INSERT INTO partner_update_seen (partner_id, seen_at) VALUES (?, ?) ON CONFLICT(partner_id) DO UPDATE SET seen_at = excluded.seen_at`).bind(partnerId, new Date().toISOString()).run()
  }
  return updates
}

export async function toolkitMessages(db: D1Database) {
  await ensureTables(db)
  const row = await db.prepare(`SELECT messages_json FROM partner_toolkit WHERE id = 1`).first() as Record<string, any> | null
  if (!row) return DEFAULT_TOOLKIT_MESSAGES
  try {
    const saved = JSON.parse(String(row.messages_json))
    return Array.isArray(saved) && saved.length ? saved as typeof DEFAULT_TOOLKIT_MESSAGES : DEFAULT_TOOLKIT_MESSAGES
  } catch { return DEFAULT_TOOLKIT_MESSAGES }
}

export async function saveToolkitMessages(db: D1Database, input: unknown, actor: string) {
  await ensureTables(db)
  const list = (Array.isArray(input) ? input : []).map((item: any) => ({ title: String(item?.title ?? '').trim().slice(0, 80), body: String(item?.body ?? '').trim().slice(0, 2000) })).filter(item => item.title || item.body)
  if (!list.length) throw new PartnerUpdateError('Keep at least one message.')
  if (list.length > MAX_MESSAGES) throw new PartnerUpdateError(`Keep to ${MAX_MESSAGES} messages.`)
  if (list.some(item => !item.title || !item.body)) throw new PartnerUpdateError('Every message needs a title and words.')
  if (list.some(item => !item.body.includes('{link}'))) throw new PartnerUpdateError('Every message needs {link}, so the school reaches the partner\'s own registration page.')
  await db.prepare(`INSERT INTO partner_toolkit (id, messages_json, updated_by, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET messages_json = excluded.messages_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(JSON.stringify(list), actor, new Date().toISOString()).run()
  return list
}

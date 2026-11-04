// The home page's scrolling strips: the schools using Ndovera, and reviews Ami has approved.
// Users write reviews from their dashboards; nothing shows until Ami approves it. Students are
// never named. The public read is cached, so visitors don't touch the database.

export class ShowcaseError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export const SHOWCASE_SCHOOLS = 60
export const SHOWCASE_REVIEWS = 30
const AMI_LIST = 100
const REVIEW_MIN = 15
const REVIEW_MAX = 400
const STATUSES = ['pending', 'approved', 'rejected']
const ready = new WeakSet<object>()

export async function ensureShowcaseTables(db: D1Database) {
  if (ready.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS platform_reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, tenant_id TEXT, school_name TEXT, role TEXT, user_name TEXT, show_name INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_platform_reviews_status ON platform_reviews(status, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_platform_reviews_shown ON platform_reviews(status, reviewed_at)`,
    `CREATE TABLE IF NOT EXISTS showcase_hidden_schools (tenant_id TEXT PRIMARY KEY, hidden_at TEXT, hidden_by TEXT)`,
  ]) await db.prepare(statement).run()
  ready.add(db as object)
}

const ROLE_LABELS: Record<string, string> = { student: 'Student', parent: 'Parent', teacher: 'Teacher', owner: 'School owner', hos: 'Head of School', hod: 'Head of Department', accountant: 'Accountant', librarian: 'Librarian' }
const roleLabel = (role: unknown) => ROLE_LABELS[String(role || '').toLowerCase()] || 'School staff'

/** Who a review is shown as. Students stay unnamed whatever was stored. */
export function reviewerLabel(row: Record<string, any>) {
  const school = String(row.school_name || '').trim()
  const named = Number(row.show_name) === 1 && String(row.role || '').toLowerCase() !== 'student' && String(row.user_name || '').trim()
  return { name: named ? String(row.user_name).trim() : roleLabel(row.role), detail: named ? `${roleLabel(row.role)}${school ? `, ${school}` : ''}` : school }
}

export async function myReview(db: D1Database, userId: string) {
  await ensureShowcaseTables(db)
  const row = await db.prepare(`SELECT rating, body, status, show_name, updated_at FROM platform_reviews WHERE user_id = ?`).bind(userId).first() as Record<string, any> | null
  return row ? { rating: Number(row.rating), body: String(row.body), status: String(row.status), showName: Number(row.show_name) === 1, updatedAt: String(row.updated_at) } : null
}

/** One review per person. Changing it sends it back to Ami, so only approved words are ever shown. */
export async function saveMyReview(db: D1Database, person: { userId: string, tenantId: string, schoolName: string, role: string, name: string }, input: { rating?: unknown, body?: unknown, showName?: unknown, consent?: unknown }) {
  await ensureShowcaseTables(db)
  const rating = Math.round(Number(input.rating))
  const body = String(input.body || '').replace(/\s+/g, ' ').trim()
  if (!person.userId || !person.tenantId) throw new ShowcaseError('Reviews come from people using Ndovera at a school.', 403)
  if (!(rating >= 1 && rating <= 5)) throw new ShowcaseError('Choose a rating from 1 to 5.')
  if (body.length < REVIEW_MIN) throw new ShowcaseError(`Please write at least ${REVIEW_MIN} characters.`)
  if (body.length > REVIEW_MAX) throw new ShowcaseError(`Please keep your review under ${REVIEW_MAX} characters.`)
  if (input.consent !== true) throw new ShowcaseError('Tick the box to let Ndovera show this review on its home page.')
  const showName = input.showName === true && person.role !== 'student' ? 1 : 0
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO platform_reviews (id, user_id, tenant_id, school_name, role, user_name, show_name, rating, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tenant_id = excluded.tenant_id, school_name = excluded.school_name, role = excluded.role, user_name = excluded.user_name, show_name = excluded.show_name,
      rating = excluded.rating, body = excluded.body, status = 'pending', updated_at = excluded.updated_at, reviewed_at = NULL, reviewed_by = NULL`)
    .bind(`rev_${crypto.randomUUID()}`, person.userId, person.tenantId, person.schoolName, person.role, person.name, showName, rating, body, now, now).run()
  return myReview(db, person.userId)
}

export async function listReviews(db: D1Database, status: string) {
  await ensureShowcaseTables(db)
  const chosen = STATUSES.includes(status) ? status : 'pending'
  const rows = await db.prepare(`SELECT id, school_name, role, user_name, show_name, rating, body, status, updated_at FROM platform_reviews WHERE status = ? ORDER BY updated_at DESC LIMIT ${AMI_LIST}`).bind(chosen).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ id: String(row.id), rating: Number(row.rating), body: String(row.body), status: String(row.status), updatedAt: String(row.updated_at), ...reviewerLabel(row) }))
}

export async function setReviewStatus(db: D1Database, id: string, status: string, actor: string) {
  await ensureShowcaseTables(db)
  if (!STATUSES.includes(status)) throw new ShowcaseError('Choose approve or reject.')
  const done = await db.prepare(`UPDATE platform_reviews SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`).bind(status, new Date().toISOString(), actor, id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new ShowcaseError('Review not found.', 404)
}

/** Schools for Ami to choose from. Bounded; opened only on Ami's own page. */
export async function listShowcaseSchools(db: D1Database) {
  await ensureShowcaseTables(db)
  const rows = await db.prepare(`SELECT t.id, t.school_name, b.logo_url, h.tenant_id AS hidden FROM tenants t
    LEFT JOIN tenant_branding b ON b.tenant_id = t.id LEFT JOIN showcase_hidden_schools h ON h.tenant_id = t.id
    WHERE t.status = 'active' ORDER BY t.school_name LIMIT 300`).all().catch(() => ({ results: [] }))
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ id: String(row.id), name: String(row.school_name || ''), logoUrl: String(row.logo_url || ''), hidden: Boolean(row.hidden) }))
}

export async function setSchoolHidden(db: D1Database, tenantId: string, hidden: boolean, actor: string) {
  await ensureShowcaseTables(db)
  if (hidden) await db.prepare(`INSERT OR REPLACE INTO showcase_hidden_schools (tenant_id, hidden_at, hidden_by) VALUES (?, ?, ?)`).bind(tenantId, new Date().toISOString(), actor).run()
  else await db.prepare(`DELETE FROM showcase_hidden_schools WHERE tenant_id = ?`).bind(tenantId).run()
}

/** What the home page shows: names and logos only, and approved reviews. */
export async function publicShowcase(db: D1Database) {
  await ensureShowcaseTables(db)
  const [schools, reviews] = await db.batch([
    db.prepare(`SELECT t.school_name, b.logo_url FROM tenants t LEFT JOIN tenant_branding b ON b.tenant_id = t.id
      WHERE t.status = 'active' AND NOT EXISTS (SELECT 1 FROM showcase_hidden_schools h WHERE h.tenant_id = t.id) ORDER BY t.school_name LIMIT ${SHOWCASE_SCHOOLS}`),
    db.prepare(`SELECT school_name, role, user_name, show_name, rating, body FROM platform_reviews WHERE status = 'approved' ORDER BY reviewed_at DESC LIMIT ${SHOWCASE_REVIEWS}`),
  ])
  return {
    schools: ((schools.results || []) as Record<string, any>[]).map(row => ({ name: String(row.school_name || ''), logoUrl: String(row.logo_url || '') })).filter(row => row.name),
    reviews: ((reviews.results || []) as Record<string, any>[]).map(row => ({ rating: Number(row.rating), body: String(row.body), ...reviewerLabel(row) })),
  }
}

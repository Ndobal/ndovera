// Student sign-in addresses: first.surname@ending, where the ending is the one the school set (or, until it
// sets one, its Ndovera address). They are for signing in only: students never receive email.

const ready = new WeakSet<object>()

async function ensureTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_student_email (tenant_id TEXT PRIMARY KEY, domain TEXT NOT NULL, updated_by TEXT, updated_at TEXT)`).run()
  ready.add(db as object)
}

const slug = (value: unknown) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** What the school typed ("@xyz.com", "XYZ.com"), or '' if it is not an email ending. */
export function cleanDomain(value: unknown) {
  const text = String(value || '').trim().toLowerCase().replace(/^@+/, '')
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(text) && text.length <= 100 ? text : ''
}

export async function schoolDomainSetting(db: D1Database, tenantId: string) {
  await ensureTable(db)
  const row = await db.prepare(`SELECT domain FROM school_student_email WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return String(row?.domain || '')
}

export async function saveSchoolDomain(db: D1Database, tenantId: string, domain: string, actor: string) {
  await ensureTable(db)
  await db.prepare(`INSERT INTO school_student_email (tenant_id, domain, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET domain = excluded.domain, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, domain, actor, new Date().toISOString()).run()
}

/** The ending in use: the school's own, else its Ndovera address, which can never reach a stranger. */
export async function studentEmailDomain(db: D1Database, tenant: Record<string, any> | null) {
  const own = tenant?.id ? await schoolDomainSetting(db, String(tenant.id)) : ''
  if (own) return own
  return `${slug(tenant?.requestedSubdomain || tenant?.schoolSlug || tenant?.schoolName) || 'school'}.ndovera.com`
}

/** First name and surname: the first and last words of the name. */
export function studentEmailLocalPart(name: unknown) {
  const words = String(name || '').trim().split(/\s+/).map(slug).filter(Boolean)
  if (!words.length) return 'student'
  return words.length === 1 ? words[0] : `${words[0]}.${words[words.length - 1]}`
}

/** An address nobody else holds: a second Ada Obi becomes ada.obi2. The person's own current address counts as free. */
export async function freeStudentEmail(db: D1Database, name: unknown, domain: string, ownerId = '') {
  const local = studentEmailLocalPart(name)
  for (let number = 1; number < 200; number += 1) {
    const email = `${local}${number > 1 ? number : ''}@${domain}`
    const holder = await db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).bind(email).first() as Record<string, any> | null
    if (!holder || String(holder.id) === ownerId) return email
  }
  throw new Error('Could not find a free email for this student.')
}

// Columns that may hold a person's sign-in address, because records were once keyed by it.
const PERSON_COLUMN = /^(student|user|parent|guardian|member|person|learner)_?(id|email)$/i
const SKIP_TABLES = /^(sqlite_|_cf_|d1_|settings$|users$|login_phones$)/i
const BATCH = 50

/**
 * Everything stored under an old address moves to the new one, so no record is left behind. This reads the
 * school database's whole schema and checks each person column, so it is for occasional corrections.
 */
export async function moveRecordsToEmail(db: D1Database, oldEmail: string, newEmail: string) {
  const tables = await db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'table'`).all()
  const statements: D1PreparedStatement[] = []
  for (const table of (tables.results || []) as Array<{ name: string, sql: string }>) {
    if (SKIP_TABLES.test(table.name) || !table.sql) continue
    const body = table.sql.slice(table.sql.indexOf('(') + 1)
    const columns = new Set(body.split(',').map(part => part.trim().split(/\s+/)[0].replace(/["'`[\]]/g, '')).filter(name => PERSON_COLUMN.test(name)))
    for (const column of columns) statements.push(db.prepare(`UPDATE OR IGNORE "${table.name}" SET "${column}" = ? WHERE "${column}" = ?`).bind(newEmail, oldEmail))
  }
  for (let start = 0; start < statements.length; start += BATCH) await db.batch(statements.slice(start, start + BATCH))
  return statements.length
}

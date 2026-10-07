// Teaching-material lifecycle: status, version history and the audit trail.
//
//   DRAFT ──publish──▶ PUBLISHED ◀──show── HIDDEN
//                         └──────hide─────────▲
//   any of the above ──delete──▶ DELETED (terminal)
//
// Audience is a separate axis. `visibility = 'teacher'` is a TEACHER_ONLY
// resource that was never meant for students; a HIDDEN material is a student
// resource that is temporarily withdrawn. Students see a material only when it
// is PUBLISHED, released, and addressed to them.
//
// Deleting keeps the row (and any R2 file another reuse may still reference) and
// drops it from every normal view. `material_audit` is append-only: nothing in
// the Worker updates or deletes its rows, so the trail lives as long as the
// school's account does.

export const MATERIAL_STATUSES = ['draft', 'published', 'hidden', 'deleted'] as const
export type MaterialStatus = typeof MATERIAL_STATUSES[number]

export const MATERIAL_BLOCK_TYPES = [
  'topic', 'subtopic', 'heading', 'subheading', 'paragraph', 'definition',
  'example', 'note', 'list', 'exercise', 'assignment',
  // Prepared with Ndovera AI (materialGenerator.ts): typed, and still carrying rich text.
  'formula', 'table', 'figure', 'image', 'worked_example', 'exam_tip', 'common_mistake', 'summary', 'question', 'flashcard',
] as const

const STATUS_TRANSITIONS: Record<MaterialStatus, MaterialStatus[]> = {
  draft: ['published', 'deleted'],
  published: ['hidden', 'deleted'],
  hidden: ['published', 'draft', 'deleted'],
  deleted: [],
}

export function materialStatus(metadata: Record<string, any> | undefined): MaterialStatus {
  const status = String(metadata?.status || '').trim().toLowerCase()
  return (MATERIAL_STATUSES as readonly string[]).includes(status) ? status as MaterialStatus : 'published'
}

export function materialAudience(visibility: unknown) {
  return String(visibility || '').trim().toLowerCase() === 'teacher' ? 'teacher_only' : 'student_published'
}

export function canTransitionMaterial(from: MaterialStatus, to: MaterialStatus) {
  return STATUS_TRANSITIONS[from].includes(to)
}

/** Structured content from the composer. The teacher's words are kept verbatim. */
export function sanitizeMaterialBlocks(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 400).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []
    const type = String((raw as any).type || '')
    if (!(MATERIAL_BLOCK_TYPES as readonly string[]).includes(type)) return []
    const text = String((raw as any).text || '').slice(0, 20000)
    const items = Array.isArray((raw as any).items)
      ? (raw as any).items.slice(0, 200).map((item: unknown) => String(item || '').slice(0, 4000)).filter(Boolean)
      : []
    if (!text.trim() && !items.length) return []
    // A practice question's answer or a flashcard's back, shown to students only when they choose to see it.
    const answer = (type === 'question' || type === 'flashcard') ? String((raw as any).answer || '').slice(0, 12000) : ''
    return [{ type, text, ...(items.length ? { items, ordered: Boolean((raw as any).ordered) } : {}), ...(answer.trim() ? { answer } : {}) }]
  })
}

/** Plain-text rendering of blocks, so older clients that only read `description` still work. */
export function blocksToPlainText(blocks: Array<Record<string, any>>) {
  return blocks.map(block => {
    const lines = block.text ? [block.text] : []
    for (const [index, item] of (block.items || []).entries()) lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`)
    return lines.join('\n')
  }).join('\n\n')
}

let _tablesReady = false
export function resetMaterialLifecycleCache() {
  _tablesReady = false
}

export async function ensureMaterialLifecycleTables(db: D1Database) {
  if (_tablesReady) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS material_versions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT,
    url TEXT,
    metadata TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(material_id, version)
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS material_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    actor_role TEXT,
    supervisory INTEGER NOT NULL DEFAULT 0,
    owner_id TEXT,
    class_id TEXT,
    class_name TEXT,
    subject_id TEXT,
    subject_name TEXT,
    session_id TEXT,
    term_id TEXT,
    title TEXT,
    status_before TEXT,
    status_after TEXT,
    version INTEGER,
    details TEXT,
    created_at TEXT NOT NULL
  )`).run()
  for (const statement of [
    `CREATE INDEX IF NOT EXISTS idx_material_versions_material ON material_versions(tenant_id, material_id, version)`,
    `CREATE INDEX IF NOT EXISTS idx_material_audit_material ON material_audit(tenant_id, material_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_material_audit_tenant ON material_audit(tenant_id, action, created_at)`,
    `ALTER TABLE material_audit ADD COLUMN actor_role TEXT`,
    `ALTER TABLE material_audit ADD COLUMN supervisory INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try { await db.prepare(statement).run() } catch {}
  }
  _tablesReady = true
}

// `supervisory` marks an Owner/HOS intervention in a class they do not teach,
// so the trail reads "Owner → JSS 2A → Mathematics → edited" rather than as
// the class teacher's own change.
type Actor = { id: string, name: string, role?: string, supervisory?: boolean }
type MaterialRecord = { id: string, classId: string, title?: string, url?: string | null, metadata?: Record<string, any> }

export async function recordMaterialVersion(db: D1Database, tenantId: string, material: MaterialRecord, actor: Actor) {
  await ensureMaterialLifecycleTables(db)
  const latest = await db.prepare(`SELECT MAX(version) AS version FROM material_versions WHERE tenant_id = ? AND material_id = ?`)
    .bind(tenantId, material.id).first() as Record<string, any> | null
  const version = Number(latest?.version || 0) + 1
  await db.prepare(`INSERT INTO material_versions (id, tenant_id, material_id, version, title, url, metadata, created_by, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `matver-${crypto.randomUUID()}`, tenantId, material.id, version, material.title || null, material.url || null,
    JSON.stringify({ ...(material.metadata || {}), version }), actor.id || null, actor.name || null, new Date().toISOString(),
  ).run()
  return version
}

/**
 * Snapshot a material that predates version history, so its first edit still
 * leaves the original wording on record.
 */
export async function ensureBaselineVersion(db: D1Database, tenantId: string, material: MaterialRecord & { uploadedAt?: string, uploadedBy?: string }) {
  await ensureMaterialLifecycleTables(db)
  const existing = await db.prepare(`SELECT 1 FROM material_versions WHERE tenant_id = ? AND material_id = ? LIMIT 1`)
    .bind(tenantId, material.id).first()
  if (existing) return
  await db.prepare(`INSERT INTO material_versions (id, tenant_id, material_id, version, title, url, metadata, created_by, created_by_name, created_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`).bind(
    `matver-${crypto.randomUUID()}`, tenantId, material.id, material.title || null, material.url || null,
    JSON.stringify({ ...(material.metadata || {}), version: 1 }), material.metadata?.uploadedById || null,
    material.metadata?.uploadedByName || material.uploadedBy || null, material.uploadedAt || new Date().toISOString(),
  ).run()
}

export async function recordMaterialAudit(db: D1Database, options: {
  tenantId: string
  material: MaterialRecord
  action: string
  actor: Actor
  statusBefore?: string
  statusAfter?: string
  details?: Record<string, any>
}) {
  await ensureMaterialLifecycleTables(db)
  const metadata = options.material.metadata || {}
  await db.prepare(`INSERT INTO material_audit (id, tenant_id, material_id, action, actor_id, actor_name, actor_role, supervisory, owner_id,
      class_id, class_name, subject_id, subject_name, session_id, term_id, title, status_before, status_after, version, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `mataud-${crypto.randomUUID()}`, options.tenantId, options.material.id, options.action,
    options.actor.id || null, options.actor.name || null, options.actor.role || null, options.actor.supervisory ? 1 : 0,
    metadata.uploadedById || null,
    options.material.classId || null, metadata.className || null, metadata.subjectId || null, metadata.subjectName || null,
    metadata.academicSessionId || null, metadata.academicTermId || null, options.material.title || null,
    options.statusBefore || null, options.statusAfter || null, Number(metadata.version || 1),
    JSON.stringify(options.details || {}), new Date().toISOString(),
  ).run()
}

export async function listMaterialHistory(db: D1Database, tenantId: string, materialId: string) {
  await ensureMaterialLifecycleTables(db)
  const [versions, events] = await Promise.all([
    db.prepare(`SELECT version, title, url, metadata, created_by AS createdBy, created_by_name AS createdByName, created_at AS createdAt
      FROM material_versions WHERE tenant_id = ? AND material_id = ? ORDER BY version DESC`).bind(tenantId, materialId).all(),
    db.prepare(`SELECT action, actor_name AS actorName, actor_role AS actorRole, supervisory, status_before AS statusBefore, status_after AS statusAfter,
        version, details, created_at AS createdAt
      FROM material_audit WHERE tenant_id = ? AND material_id = ? ORDER BY created_at DESC`).bind(tenantId, materialId).all(),
  ])
  const parse = (value: unknown) => { try { return JSON.parse(String(value || '{}')) } catch { return {} } }
  return {
    versions: ((versions.results || []) as Record<string, any>[]).map(row => ({ ...row, metadata: parse(row.metadata) })),
    events: ((events.results || []) as Record<string, any>[]).map(row => ({ ...row, details: parse(row.details) })),
  }
}

export async function listMaterialAudit(db: D1Database, tenantId: string, options: { action?: string, supervisoryOnly?: boolean, limit?: number } = {}) {
  await ensureMaterialLifecycleTables(db)
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000)
  const filters = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (options.action) { filters.push('action = ?'); params.push(options.action) }
  if (options.supervisoryOnly) filters.push('supervisory = 1')
  const rows = await db.prepare(`SELECT * FROM material_audit WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).bind(...params, limit).all()
  return (rows.results || []) as Record<string, any>[]
}

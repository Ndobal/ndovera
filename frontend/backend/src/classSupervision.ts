// Class supervision: Owner and Head of School access to classes they do not teach.
//
// Teacher assignment and class supervision are different things and live in
// different tables:
//
//   * Teacher assignment (subjects.teacherId, classes.classTeacherId, teacher
//     class_memberships, and the per-session teaching_assignments ledger) says
//     who is officially responsible for teaching a class or subject.
//   * Class supervision (this module) is role-based access by the Owner or HOS.
//     Joining a class only adds it to the supervisor's workspace; exiting only
//     removes it. Neither ever writes an assignment, touches students, or edits
//     history, and every join and exit stays on record.
//
// Permission model, always inside one school (tenant):
//   Owner — school-wide supervision, intervention and publishing.
//   HOS   — supervision of every class; intervention only when the school's
//           policy grants it (`hos_mode = 'intervene'`), otherwise view only.
//   Other staff with legacy supervisory roles keep their existing access.

export const SUPERVISION_ROLES = ['owner', 'hos'] as const
export type HosMode = 'view' | 'intervene'

export const SUPERVISOR_LABELS: Record<string, string> = {
  owner: 'School Owner',
  hos: 'Head of School',
  admin: 'School Administrator',
  ict: 'ICT',
  ict_manager: 'ICT',
  ami: 'Ndovera Support',
  hod: 'Head of Department',
  hodassistant: 'Assistant Head of Department',
}

let _tablesReady = false
export function resetClassSupervisionCache() {
  _tablesReady = false
}

export async function ensureSupervisionTables(db: D1Database) {
  if (_tablesReady) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS supervision_policies (
    tenant_id TEXT PRIMARY KEY,
    hos_mode TEXT NOT NULL DEFAULT 'intervene',
    updated_by TEXT,
    updated_at TEXT NOT NULL
  )`).run()
  // One row per visit: a join opens it, an exit closes it, nothing is deleted.
  await db.prepare(`CREATE TABLE IF NOT EXISTS class_supervision (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    class_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    exited_at TEXT
  )`).run()
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_class_supervision_user ON class_supervision(tenant_id, user_id, exited_at)`).run()
  } catch {}
  _tablesReady = true
}

// The policy is read on every write a supervisor makes, so cache it briefly.
const POLICY_TTL_MS = 60 * 1000
const _policyCache = new Map<string, { mode: HosMode, at: number }>()

export async function getHosMode(db: D1Database, tenantId: string): Promise<HosMode> {
  const cached = _policyCache.get(tenantId)
  if (cached && Date.now() - cached.at < POLICY_TTL_MS) return cached.mode
  await ensureSupervisionTables(db)
  const row = await db.prepare(`SELECT hos_mode FROM supervision_policies WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  // Schools that never chose keep the access HOS has always had.
  const mode: HosMode = row?.hos_mode === 'view' ? 'view' : 'intervene'
  _policyCache.set(tenantId, { mode, at: Date.now() })
  return mode
}

export async function setHosMode(db: D1Database, tenantId: string, mode: HosMode, actorId: string) {
  await ensureSupervisionTables(db)
  const normalized: HosMode = mode === 'view' ? 'view' : 'intervene'
  await db.prepare(`INSERT INTO supervision_policies (tenant_id, hos_mode, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET hos_mode = excluded.hos_mode, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, normalized, actorId || null, new Date().toISOString()).run()
  _policyCache.set(tenantId, { mode: normalized, at: Date.now() })
  return normalized
}

/** Whether a supervisory role may change class content, not just view it. */
export async function supervisorMayIntervene(db: D1Database, tenantId: string, role: string) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized !== 'hos') return true
  return (await getHosMode(db, tenantId)) === 'intervene'
}

export async function joinClass(db: D1Database, options: { tenantId: string, userId: string, role: string, classId: string }) {
  await ensureSupervisionTables(db)
  const open = await db.prepare(`SELECT id FROM class_supervision WHERE tenant_id = ? AND lower(user_id) = lower(?) AND class_id = ? AND exited_at IS NULL`)
    .bind(options.tenantId, options.userId, options.classId).first()
  if (open) return false
  await db.prepare(`INSERT INTO class_supervision (id, tenant_id, user_id, role, class_id, joined_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(`supv-${crypto.randomUUID()}`, options.tenantId, options.userId, options.role, options.classId, new Date().toISOString()).run()
  return true
}

export async function exitClass(db: D1Database, options: { tenantId: string, userId: string, classId: string }) {
  await ensureSupervisionTables(db)
  const result = await db.prepare(`UPDATE class_supervision SET exited_at = ? WHERE tenant_id = ? AND lower(user_id) = lower(?) AND class_id = ? AND exited_at IS NULL`)
    .bind(new Date().toISOString(), options.tenantId, options.userId, options.classId).run()
  return Number(result.meta?.changes || 0) > 0
}

export async function listSupervisedClassIds(db: D1Database, tenantId: string, userId: string) {
  await ensureSupervisionTables(db)
  const rows = await db.prepare(`SELECT DISTINCT class_id FROM class_supervision WHERE tenant_id = ? AND lower(user_id) = lower(?) AND exited_at IS NULL`)
    .bind(tenantId, userId).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => String(row.class_id))
}

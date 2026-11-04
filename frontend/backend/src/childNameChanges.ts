// A parent may correct their child's name once. The child's email stays as it is until the school chooses to change it.

export const CHILD_NAME_USED = 'You have already changed this child\'s name once. Please ask the school to change it again.'

const ready = new WeakSet<object>()
async function ensureTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS child_name_changes (student_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, parent_id TEXT, old_name TEXT, new_name TEXT, changed_at TEXT NOT NULL)`).run()
  ready.add(db as object)
}

/** Only one request can take a child's change, however many parents try. */
export async function takeChildNameChange(db: D1Database, change: { tenantId: string, studentId: string, parentId: string, oldName: string, newName: string }) {
  await ensureTable(db)
  const done = await db.prepare(`INSERT INTO child_name_changes (student_id, tenant_id, parent_id, old_name, new_name, changed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(student_id) DO NOTHING`)
    .bind(change.studentId, change.tenantId, change.parentId, change.oldName, change.newName, new Date().toISOString()).run()
  return Boolean(Number((done as any)?.meta?.changes || 0))
}

export async function childNameChange(db: D1Database, studentId: string) {
  await ensureTable(db)
  const row = await db.prepare(`SELECT old_name, new_name, changed_at FROM child_name_changes WHERE student_id = ?`).bind(studentId).first() as Record<string, any> | null
  return row ? { oldName: String(row.old_name || ''), newName: String(row.new_name || ''), changedAt: String(row.changed_at) } : null
}

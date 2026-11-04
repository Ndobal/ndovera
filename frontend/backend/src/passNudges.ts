// Monthly reminders about practice passes. Each school is worked through a few students at a time, once a month,
// so the job stays within a day's limits. A student who already holds a pass hears nothing. Schools can turn it off.

export const NUDGE_BATCH = 5
const ready = new WeakSet<object>()

export async function ensureNudgeTables(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS practice_nudge_runs (tenant_id TEXT NOT NULL, month TEXT NOT NULL, cursor TEXT NOT NULL DEFAULT '', done_at TEXT, PRIMARY KEY (tenant_id, month))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS practice_nudge_off (tenant_id TEXT PRIMARY KEY, off_at TEXT, off_by TEXT)`).run()
  ready.add(db as object)
}

export const nudgeMonth = (at = new Date()) => new Date(at.getTime() + 3600_000).toISOString().slice(0, 7)

export async function nudgesAreOff(db: D1Database, tenantId: string) {
  await ensureNudgeTables(db)
  return Boolean(await db.prepare(`SELECT 1 AS off FROM practice_nudge_off WHERE tenant_id = ?`).bind(tenantId).first())
}

export async function setNudgesOff(db: D1Database, tenantId: string, off: boolean, actor: string) {
  await ensureNudgeTables(db)
  if (off) await db.prepare(`INSERT OR REPLACE INTO practice_nudge_off (tenant_id, off_at, off_by) VALUES (?, ?, ?)`).bind(tenantId, new Date().toISOString(), actor).run()
  else await db.prepare(`DELETE FROM practice_nudge_off WHERE tenant_id = ?`).bind(tenantId).run()
}

/** The next school still to be reminded this month, with where it had reached. */
export async function nextNudgeSchool(db: D1Database, month: string) {
  await ensureNudgeTables(db)
  return await db.prepare(`SELECT t.id AS tenant_id, COALESCE(r.cursor, '') AS cursor FROM tenants t
    LEFT JOIN practice_nudge_runs r ON r.tenant_id = t.id AND r.month = ?
    WHERE t.status = 'active' AND r.done_at IS NULL AND NOT EXISTS (SELECT 1 FROM practice_nudge_off o WHERE o.tenant_id = t.id) LIMIT 1`).bind(month).first() as { tenant_id: string, cursor: string } | null
}

export async function saveNudgeProgress(db: D1Database, tenantId: string, month: string, cursor: string, done: boolean) {
  await db.prepare(`INSERT INTO practice_nudge_runs (tenant_id, month, cursor, done_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id, month) DO UPDATE SET cursor = excluded.cursor, done_at = excluded.done_at`).bind(tenantId, month, cursor, done ? new Date().toISOString() : null).run()
}

const firstName = (name: string) => String(name || '').trim().split(/\s+/)[0] || 'your child'

export const studentNudge = () => ({
  title: 'Keep practising with a pass',
  body: 'A practice pass gives you as many new questions as you want, and more XP. Tap to get yours.',
  link: '/roles/student/practice?tab=passes',
})

export const parentNudge = (childName: string) => ({
  title: `A practice pass for ${firstName(childName)}`,
  body: `Help ${firstName(childName)} practise as much as they need with a practice pass. Tap to buy one.`,
  link: '/roles/parent/practice-passes',
})

/** The monthly email to parents of senior students, in the words of the exams that are on sale now. */
export function seniorParentEmail(input: { parentName: string, childName: string, schoolName: string, exams: string[] }) {
  const exams = input.exams.join(', ').replace(/, ([^,]*)$/, ' and $1')
  return {
    subject: `${firstName(input.childName)}: prepare for ${exams} with Ndovera practice`,
    text: `Dear ${input.parentName || 'Parent/Guardian'},\n\nWe hope you are well. ${input.childName} can prepare for ${exams} with timed mock exams and practice questions of the exam standard on Ndovera.\n\nAn exam pass lasts 12 months and works on your child's own account at ${input.schoolName}.`,
  }
}

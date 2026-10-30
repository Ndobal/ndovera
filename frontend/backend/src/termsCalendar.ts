// Terms Calendar (docs/premium-upgrade-implementation-plan.md §5).
//
// One calendar per academic session: breaks, school holidays, C.A. tests, exams, events, open
// days, result publication and fee deadlines, laid over the session's term dates and the
// national public holidays. It is drafted, submitted, and approved by a head of school before
// it is published; every version is kept, so the published calendar is an accountable record.
//
//   draft → submitted → published (the version before it becomes "superseded", never deleted)
//                     ↘ returned (back to draft with the approver's note)
//
// Publishing writes the session's own entries into the live school calendar (holidays and
// breaks there stop attendance being marked) and public entries onto the school website. It
// only ever touches entries this calendar made for that session: another session's calendar,
// events typed straight into the school calendar, and Sessions & Terms breaks are left alone.

import { nationalDaysBetween } from './nationalCalendar'

export class CalendarError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export const ENTRY_TYPES: Record<string, { label: string, closesSchool: boolean, needsSchoolDay: boolean }> = {
  break: { label: 'Mid-term break', closesSchool: true, needsSchoolDay: false },
  holiday: { label: 'School holiday', closesSchool: true, needsSchoolDay: false },
  test: { label: 'C.A. test', closesSchool: false, needsSchoolDay: true },
  exam: { label: 'Examinations', closesSchool: false, needsSchoolDay: true },
  event: { label: 'School event', closesSchool: false, needsSchoolDay: false },
  open_day: { label: 'Open day / PTA', closesSchool: false, needsSchoolDay: false },
  results: { label: 'Results published', closesSchool: false, needsSchoolDay: false },
  fee_deadline: { label: 'Fee deadline', closesSchool: false, needsSchoolDay: false },
}
const AUDIENCES = ['everyone', 'staff', 'parents', 'internal']
const REMINDER_DAYS = [1, 2, 3, 7, 14]
const DRAFTERS = ['owner', 'hos', 'ict', 'ict_manager']
const APPROVERS = ['owner', 'hos']

export type CalendarEntry = {
  id: string, type: string, title: string, startDate: string, endDate: string,
  audience: string, showOnWebsite: boolean, reminderDays: number | null, note: string,
}
export type Conflict = { severity: 'error' | 'warning', entryId: string | null, message: string }
type Actor = { id: string, name: string, role: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const clean = (value: unknown, max: number) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max)
const overlaps = (a: { startDate: string, endDate: string }, b: { startDate: string, endDate: string }) => a.startDate <= b.endDate && b.startDate <= a.endDate
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

export async function ensureTermsCalendarTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS terms_calendar_versions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, session_id TEXT NOT NULL, session_name TEXT, version INTEGER NOT NULL, status TEXT NOT NULL, entries_json TEXT NOT NULL, conflicts_json TEXT NOT NULL DEFAULT '[]', drafted_by TEXT, drafted_by_name TEXT, drafted_by_role TEXT, submitted_at TEXT, decided_by TEXT, decided_by_name TEXT, decided_at TEXT, decision_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(tenant_id, session_id, version))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_terms_calendar_session ON terms_calendar_versions (tenant_id, session_id, version)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS terms_calendar_reminders (tenant_id TEXT NOT NULL, entry_key TEXT NOT NULL, sent_at TEXT NOT NULL, recipients INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, entry_key))`),
  ])
}

export function normalizeEntries(raw: unknown): CalendarEntry[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 300).map((item: any) => {
    const type = item?.type in ENTRY_TYPES ? item.type : ''
    const startDate = clean(item?.startDate, 10)
    const endDate = clean(item?.endDate, 10) || startDate
    const reminder = Number(item?.reminderDays)
    return {
      id: /^[A-Za-z0-9_-]{6,60}$/.test(String(item?.id || '')) ? String(item.id) : crypto.randomUUID(),
      type, title: clean(item?.title, 160) || (ENTRY_TYPES[type]?.label || ''), startDate, endDate,
      audience: AUDIENCES.includes(item?.audience) ? item.audience : 'everyone',
      showOnWebsite: item?.showOnWebsite === true && item?.audience !== 'internal' && item?.audience !== 'staff',
      reminderDays: REMINDER_DAYS.includes(reminder) ? reminder : null,
      note: clean(item?.note, 1000),
    }
  })
}

type Context = {
  session: { id: string, name: string, start_date: string, end_date: string }
  terms: Array<{ id: string, name: string, start_date: string, end_date: string, resumption_date?: string | null }>
  // Things already on file that this calendar does not own but must respect.
  closures: Array<{ title: string, startDate: string, endDate: string, source: string }>
}

/** Problems that block submission (errors) and ones the approver should see (warnings). */
export function findConflicts(entries: CalendarEntry[], context: Context): Conflict[] {
  const out: Conflict[] = []
  const add = (severity: Conflict['severity'], entry: CalendarEntry | null, message: string) => out.push({ severity, entryId: entry?.id || null, message })
  const { session, terms } = context
  const termOf = (date: string) => terms.find(term => date >= term.start_date && date <= term.end_date) || null
  const ownClosures = entries.filter(entry => ENTRY_TYPES[entry.type]?.closesSchool)
  const closures = [...context.closures, ...ownClosures.map(entry => ({ title: entry.title, startDate: entry.startDate, endDate: entry.endDate, source: 'this calendar' }))]
  const publicHolidays = nationalDaysBetween(session.start_date, session.end_date).filter(day => day.kind === 'holiday')

  for (const entry of entries) {
    const name = `"${entry.title || ENTRY_TYPES[entry.type]?.label || 'Entry'}"`
    if (!entry.type) { add('error', entry, `${name} has no type.`); continue }
    if (!DATE.test(entry.startDate) || !DATE.test(entry.endDate)) { add('error', entry, `${name} needs a start and end date.`); continue }
    if (entry.endDate < entry.startDate) { add('error', entry, `${name} ends before it starts.`); continue }
    if (entry.startDate < session.start_date || entry.endDate > session.end_date) add('error', entry, `${name} falls outside ${session.name} (${session.start_date} to ${session.end_date}).`)
    const type = ENTRY_TYPES[entry.type]
    if (type.needsSchoolDay) {
      if (!termOf(entry.startDate) || !termOf(entry.endDate)) add('error', entry, `${name} is not inside a term.`)
      for (const closure of closures) {
        if (closure.startDate === entry.startDate && closure.endDate === entry.endDate && closure.title === entry.title) continue
        if (overlaps(entry, closure)) add('error', entry, `${name} falls during ${closure.title} (${closure.startDate} to ${closure.endDate}).`)
      }
      for (const day of publicHolidays) if (day.date >= entry.startDate && day.date <= entry.endDate) add('error', entry, `${name} falls on ${day.title} (${day.date}), a public holiday.`)
      if (entry.startDate === entry.endDate && [0, 6].includes(weekday(entry.startDate))) add('warning', entry, `${name} is on a weekend.`)
    }
    if (entry.type === 'event' || entry.type === 'open_day') {
      for (const day of publicHolidays) if (day.date >= entry.startDate && day.date <= entry.endDate) add('warning', entry, `${name} is on ${day.title} (${day.date}), a public holiday.`)
    }
    if (type.closesSchool) {
      const term = termOf(entry.startDate) || termOf(entry.endDate)
      if (term && (entry.startDate < term.start_date || entry.endDate > term.end_date)) add('warning', entry, `${name} runs past the dates of ${term.name}.`)
    }
    if (entry.type === 'fee_deadline') {
      const term = termOf(entry.startDate)
      if (!term) add('warning', entry, `${name} is not inside a term.`)
    }
    if (entry.type === 'results') {
      const term = termOf(entry.startDate) || [...terms].reverse().find(item => item.end_date <= entry.startDate) || null
      const exams = entries.filter(other => other.type === 'exam' && term && other.startDate >= term.start_date && other.startDate <= term.end_date)
      const lastExam = exams.map(other => other.endDate).sort().pop()
      if (lastExam && entry.startDate <= lastExam) add('error', entry, `${name} is before the examinations end (${lastExam}).`)
    }
  }
  const exams = entries.filter(entry => entry.type === 'exam' && DATE.test(entry.startDate))
  for (let i = 0; i < exams.length; i += 1) for (let j = i + 1; j < exams.length; j += 1) {
    if (overlaps(exams[i], exams[j]) && (exams[i].audience === exams[j].audience || [exams[i].audience, exams[j].audience].includes('everyone'))) add('warning', exams[j], `"${exams[j].title}" overlaps "${exams[i].title}".`)
  }
  return out
}

// ─── Reading ─────────────────────────────────────────────────────────────────

async function sessionById(db: D1Database, tenantId: string, sessionId: string) {
  const session = await db.prepare(`SELECT id, name, start_date, end_date, status FROM academic_sessions WHERE tenant_id = ? AND id = ?`).bind(tenantId, sessionId).first() as any
  if (!session) throw new CalendarError('Session not found.', 404)
  return session
}

async function loadContext(db: D1Database, tenantId: string, session: any): Promise<Context & { reference: any[] }> {
  const safe = async (sql: string, ...binds: unknown[]) => {
    try { return ((await db.prepare(sql).bind(...binds).all()).results || []) as any[] } catch (error) {
      if (/no such table/i.test(String((error as Error)?.message))) return []
      throw error
    }
  }
  const [terms, breaks, manual] = await Promise.all([
    safe(`SELECT id, name, sequence, start_date, end_date, resumption_date FROM academic_terms WHERE tenant_id = ? AND session_id = ? ORDER BY sequence`, tenantId, session.id),
    safe(`SELECT name, start_date, end_date, break_type FROM academic_breaks WHERE tenant_id = ? AND session_id = ?`, tenantId, session.id),
    safe(`SELECT id, title, type, start_date, end_date FROM school_calendar_events WHERE tenant_id = ? AND COALESCE(status, 'published') != 'cancelled' AND COALESCE(source, 'school') != 'terms_calendar' AND start_date <= ? AND COALESCE(end_date, start_date) >= ?`, tenantId, session.end_date, session.start_date),
  ])
  const closures = [
    ...breaks.map(row => ({ title: String(row.name), startDate: String(row.start_date), endDate: String(row.end_date || row.start_date), source: 'Sessions & Terms' })),
    ...manual.filter(row => ['holiday', 'break'].includes(String(row.type))).map(row => ({ title: String(row.title), startDate: String(row.start_date), endDate: String(row.end_date || row.start_date), source: 'School calendar' })),
  ]
  // Shown beside the calendar so the head sees the whole session at once (not editable here).
  const reference = [
    ...terms.flatMap(term => [
      { kind: 'term_start', title: `${term.name} begins`, startDate: term.start_date, endDate: term.start_date, source: 'Sessions & Terms' },
      ...(term.resumption_date ? [{ kind: 'resumption', title: `${term.name}: resumption`, startDate: term.resumption_date, endDate: term.resumption_date, source: 'Sessions & Terms' }] : []),
      { kind: 'term_end', title: `${term.name} ends`, startDate: term.end_date, endDate: term.end_date, source: 'Sessions & Terms' },
    ]),
    ...closures.map(item => ({ kind: 'closure', title: item.title, startDate: item.startDate, endDate: item.endDate, source: item.source })),
    ...manual.filter(row => !['holiday', 'break'].includes(String(row.type))).map(row => ({ kind: 'event', title: String(row.title), startDate: String(row.start_date), endDate: String(row.end_date || row.start_date), source: 'School calendar' })),
    ...nationalDaysBetween(session.start_date, session.end_date).filter(day => day.kind === 'holiday').map(day => ({ kind: 'public_holiday', title: day.title, startDate: day.date, endDate: day.date, source: 'Public holiday' })),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return { session, terms, closures, reference }
}

function versionOut(row: any) {
  if (!row) return null
  return {
    id: row.id, version: Number(row.version), status: row.status, entries: JSON.parse(row.entries_json || '[]'), conflicts: JSON.parse(row.conflicts_json || '[]'),
    draftedBy: row.drafted_by_name || row.drafted_by, draftedById: row.drafted_by, submittedAt: row.submitted_at,
    decidedBy: row.decided_by_name || row.decided_by, decidedAt: row.decided_at, decisionNote: row.decision_note, updatedAt: row.updated_at,
  }
}

export async function getCalendar(db: D1Database, tenantId: string, sessionId: string) {
  await ensureTermsCalendarTables(db)
  const session = await sessionById(db, tenantId, sessionId)
  const context = await loadContext(db, tenantId, session)
  const versions = ((await db.prepare(`SELECT * FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? ORDER BY version DESC LIMIT 60`).bind(tenantId, sessionId).all()).results || []) as any[]
  const published = versions.find(row => row.status === 'published') || null
  const working = versions.find(row => ['draft', 'submitted'].includes(row.status) && (!published || Number(row.version) > Number(published.version))) || null
  const workingOut = versionOut(working)
  if (workingOut) workingOut.conflicts = findConflicts(workingOut.entries, context)
  return {
    session: { id: session.id, name: session.name, startDate: session.start_date, endDate: session.end_date, status: session.status },
    terms: context.terms, reference: context.reference, types: ENTRY_TYPES,
    published: versionOut(published), working: workingOut,
    history: versions.map(row => ({ version: Number(row.version), status: row.status, draftedBy: row.drafted_by_name, decidedBy: row.decided_by_name, decidedAt: row.decided_at, submittedAt: row.submitted_at, decisionNote: row.decision_note, entries: JSON.parse(row.entries_json || '[]').length })),
  }
}

export async function getVersion(db: D1Database, tenantId: string, sessionId: string, version: number) {
  await ensureTermsCalendarTables(db)
  const row = await db.prepare(`SELECT * FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? AND version = ?`).bind(tenantId, sessionId, version).first()
  if (!row) throw new CalendarError('Version not found.', 404)
  return versionOut(row)
}

// ─── Writing ─────────────────────────────────────────────────────────────────

async function workingRow(db: D1Database, tenantId: string, sessionId: string) {
  const published = await db.prepare(`SELECT version FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? AND status = 'published' ORDER BY version DESC LIMIT 1`).bind(tenantId, sessionId).first() as any
  return await db.prepare(`SELECT * FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? AND status IN ('draft', 'submitted') AND version > ? ORDER BY version DESC LIMIT 1`).bind(tenantId, sessionId, Number(published?.version || 0)).first() as any
}

/** Save the working draft (a new version number the first time after a publish). */
export async function saveDraft(db: D1Database, tenantId: string, sessionId: string, actor: Actor, rawEntries: unknown) {
  if (!DRAFTERS.includes(actor.role)) throw new CalendarError('Only the Owner, Head of School or ICT can draft the calendar.', 403)
  await ensureTermsCalendarTables(db)
  const session = await sessionById(db, tenantId, sessionId)
  if (session.status === 'completed' || session.status === 'archived') throw new CalendarError(`${session.name} has ended; its calendar is kept as it was published.`, 409)
  const entries = normalizeEntries(rawEntries)
  const context = await loadContext(db, tenantId, session)
  const conflicts = findConflicts(entries, context)
  const at = new Date().toISOString()
  const working = await workingRow(db, tenantId, sessionId)
  if (working?.status === 'submitted') throw new CalendarError('This version is waiting for approval. Ask the approver to return it before changing it.', 409)
  if (working) {
    await db.prepare(`UPDATE terms_calendar_versions SET entries_json = ?, conflicts_json = ?, drafted_by = ?, drafted_by_name = ?, drafted_by_role = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(entries), JSON.stringify(conflicts), actor.id, actor.name, actor.role, at, working.id).run()
    return { version: Number(working.version), conflicts }
  }
  const latest = await db.prepare(`SELECT MAX(version) AS v FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ?`).bind(tenantId, sessionId).first() as any
  const version = Number(latest?.v || 0) + 1
  await db.prepare(`INSERT INTO terms_calendar_versions (id, tenant_id, session_id, session_name, version, status, entries_json, conflicts_json, drafted_by, drafted_by_name, drafted_by_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), tenantId, sessionId, session.name, version, JSON.stringify(entries), JSON.stringify(conflicts), actor.id, actor.name, actor.role, at, at).run()
  return { version, conflicts }
}

export async function submitDraft(db: D1Database, tenantId: string, sessionId: string, actor: Actor) {
  if (!DRAFTERS.includes(actor.role)) throw new CalendarError('Only the Owner, Head of School or ICT can submit the calendar.', 403)
  await ensureTermsCalendarTables(db)
  const session = await sessionById(db, tenantId, sessionId)
  const working = await workingRow(db, tenantId, sessionId)
  if (!working || working.status !== 'draft') throw new CalendarError('There is no draft to submit.', 409)
  const entries = JSON.parse(working.entries_json || '[]')
  if (!entries.length) throw new CalendarError('Add at least one entry before submitting.', 400)
  const conflicts = findConflicts(entries, await loadContext(db, tenantId, session))
  const errors = conflicts.filter(item => item.severity === 'error')
  if (errors.length) throw new CalendarError(`Fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before submitting: ${errors[0].message}`, 409)
  const at = new Date().toISOString()
  await db.prepare(`UPDATE terms_calendar_versions SET status = 'submitted', conflicts_json = ?, submitted_at = ?, drafted_by = ?, drafted_by_name = ?, drafted_by_role = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(conflicts), at, actor.id, actor.name, actor.role, at, working.id).run()
  return { version: Number(working.version), warnings: conflicts.length }
}

/** The approver must be another head, unless the school has only one (an Owner with no Head of School). */
async function assertIndependentApprover(db: D1Database, tenantId: string, working: any, actor: Actor) {
  if (String(working.drafted_by) !== actor.id) return
  const others = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE tenantId = ? AND id != ? AND lower(COALESCE(role, '')) IN ('owner', 'hos') AND COALESCE(status, 'active') != 'inactive'`).bind(tenantId, actor.id).first() as any
  if (Number(others?.n || 0) > 0) throw new CalendarError('Another head must approve a calendar you submitted (the Owner or Head of School).', 403)
}

export async function returnDraft(db: D1Database, tenantId: string, sessionId: string, actor: Actor, note: unknown) {
  if (!APPROVERS.includes(actor.role)) throw new CalendarError('Only the Owner or Head of School can return the calendar.', 403)
  await ensureTermsCalendarTables(db)
  const working = await workingRow(db, tenantId, sessionId)
  if (!working || working.status !== 'submitted') throw new CalendarError('Nothing is waiting for approval.', 409)
  const reason = clean(note, 1000)
  if (!reason) throw new CalendarError('Say what needs changing.', 400)
  const at = new Date().toISOString()
  await db.prepare(`UPDATE terms_calendar_versions SET status = 'draft', decided_by = ?, decided_by_name = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE id = ?`)
    .bind(actor.id, actor.name, at, `Returned: ${reason}`, at, working.id).run()
  return { version: Number(working.version) }
}

/** Approve and publish: the live school calendar and the school website follow this version. */
export async function approveAndPublish(db: D1Database, tenantId: string, sessionId: string, actor: Actor, note: unknown) {
  if (!APPROVERS.includes(actor.role)) throw new CalendarError('Only the Owner or Head of School can approve the calendar.', 403)
  await ensureTermsCalendarTables(db)
  const session = await sessionById(db, tenantId, sessionId)
  const working = await workingRow(db, tenantId, sessionId)
  if (!working || working.status !== 'submitted') throw new CalendarError('Nothing is waiting for approval.', 409)
  await assertIndependentApprover(db, tenantId, working, actor)
  const entries: CalendarEntry[] = JSON.parse(working.entries_json || '[]')
  const conflicts = findConflicts(entries, await loadContext(db, tenantId, session))
  if (conflicts.some(item => item.severity === 'error')) throw new CalendarError('The calendar now has problems (a date changed elsewhere). Return it to be fixed.', 409)
  const previous = await db.prepare(`SELECT * FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? AND status = 'published' ORDER BY version DESC LIMIT 1`).bind(tenantId, sessionId).first() as any
  const previousEntries: CalendarEntry[] = previous ? JSON.parse(previous.entries_json || '[]') : []
  const at = new Date().toISOString()
  const liveId = (entryId: string) => `tc:${sessionId}:${entryId}`
  const keep = new Set(entries.map(entry => entry.id))
  const statements: D1PreparedStatement[] = []

  for (const entry of entries) {
    const closes = ENTRY_TYPES[entry.type]?.closesSchool
    const calendarType = entry.type === 'break' ? 'break' : entry.type === 'holiday' ? 'holiday' : 'event'
    const roles = entry.audience === 'staff' || entry.audience === 'internal' ? ['staff'] : entry.audience === 'parents' ? ['parent'] : []
    const description = [ENTRY_TYPES[entry.type]?.label, entry.note].filter(Boolean).join(' — ')
    statements.push(db.prepare(`INSERT INTO school_calendar_events (id, tenant_id, title, type, start_date, end_date, description, audience_json, reminder_minutes, status, recurring_annual, source, created_by, created_at, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, 'terms_calendar', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, type = excluded.type, start_date = excluded.start_date, end_date = excluded.end_date, description = excluded.description, audience_json = excluded.audience_json, reminder_minutes = excluded.reminder_minutes, status = 'published', cancelled_at = NULL, cancel_reason = NULL, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(liveId(entry.id), tenantId, entry.title, calendarType, entry.startDate, entry.endDate, description, JSON.stringify({ roles, classIds: [] }), entry.reminderDays ? entry.reminderDays * 1440 : null, actor.id, at, at, actor.id))
    if (entry.showOnWebsite && !closes) {
      statements.push(db.prepare(`INSERT INTO school_events (id, tenant_id, title, description, event_date, media_urls, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)
        ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, event_date = excluded.event_date, updated_at = excluded.updated_at`)
        .bind(liveId(entry.id), tenantId, entry.title, entry.note || ENTRY_TYPES[entry.type]?.label || '', entry.startDate, at, at))
    } else {
      statements.push(db.prepare(`DELETE FROM school_events WHERE id = ? AND tenant_id = ?`).bind(liveId(entry.id), tenantId))
    }
  }
  // Entries the earlier version had and this one dropped: cancelled on the school calendar
  // (kept on file with the reason) and taken off the website. Only this session's own entries.
  for (const entry of previousEntries) {
    if (keep.has(entry.id)) continue
    statements.push(db.prepare(`UPDATE school_calendar_events SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND source = 'terms_calendar'`)
      .bind(at, actor.id, `Removed in the terms calendar, version ${working.version}`, at, liveId(entry.id), tenantId))
    statements.push(db.prepare(`DELETE FROM school_events WHERE id = ? AND tenant_id = ?`).bind(liveId(entry.id), tenantId))
  }
  if (previous) statements.push(db.prepare(`UPDATE terms_calendar_versions SET status = 'superseded', updated_at = ? WHERE id = ?`).bind(at, previous.id))
  statements.push(db.prepare(`UPDATE terms_calendar_versions SET status = 'published', conflicts_json = ?, decided_by = ?, decided_by_name = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(conflicts), actor.id, actor.name, at, clean(note, 1000) || null, at, working.id))
  // One transaction: the calendar and the live entries change together or not at all.
  await db.batch(statements)
  return { version: Number(working.version), published: entries.length, removed: previousEntries.filter(entry => !keep.has(entry.id)).length }
}

// ─── Reminders: in the app, once each, only for published entries ────────────

export async function sendDueReminders(db: D1Database, deliver: (userIds: string[], tenantId: string, title: string, body: string, key: string) => Promise<number>, at = new Date()) {
  await ensureTermsCalendarTables(db)
  const today = new Date(at.getTime() + 3600_000).toISOString().slice(0, 10)
  const published = ((await db.prepare(`SELECT v.tenant_id, v.session_id, v.version, v.entries_json FROM terms_calendar_versions v JOIN academic_sessions s ON s.id = v.session_id AND s.tenant_id = v.tenant_id WHERE v.status = 'published' AND s.status = 'active' LIMIT 500`).all()).results || []) as any[]
  let sent = 0
  for (const row of published) {
    for (const entry of JSON.parse(row.entries_json || '[]') as CalendarEntry[]) {
      if (!entry.reminderDays || entry.startDate <= today) continue
      const due = new Date(Date.parse(`${entry.startDate}T00:00:00Z`) - entry.reminderDays * 86_400_000).toISOString().slice(0, 10)
      if (due !== today) continue
      const key = `tc:${row.session_id}:${entry.id}:${entry.startDate}:${entry.reminderDays}`
      // Claimed first: a second run the same day finds the claim and sends nothing.
      const claim = await db.prepare(`INSERT OR IGNORE INTO terms_calendar_reminders (tenant_id, entry_key, sent_at) VALUES (?, ?, ?)`).bind(row.tenant_id, key, at.toISOString()).run()
      if (!Number(claim?.meta?.changes || 0)) continue
      const roleFilter = entry.audience === 'parents' ? `= 'parent'` : entry.audience === 'staff' || entry.audience === 'internal' ? `NOT IN ('parent', 'student', '')` : `!= ''`
      const users = ((await db.prepare(`SELECT id FROM users WHERE tenantId = ? AND lower(COALESCE(role, '')) ${roleFilter} AND lower(COALESCE(role, '')) != 'student' AND COALESCE(status, 'active') != 'inactive' LIMIT 5000`).bind(row.tenant_id).all()).results || []) as any[]
      const when = entry.startDate === entry.endDate ? entry.startDate : `${entry.startDate} to ${entry.endDate}`
      const count = await deliver(users.map(user => String(user.id)), row.tenant_id, `Coming up: ${entry.title}`, `${ENTRY_TYPES[entry.type]?.label || 'Calendar'}: ${entry.title}, ${when}.${entry.note ? ` ${entry.note}` : ''}`, key)
      await db.prepare(`UPDATE terms_calendar_reminders SET recipients = ? WHERE tenant_id = ? AND entry_key = ?`).bind(count, row.tenant_id, key).run()
      sent += count
    }
  }
  return { sent }
}

// Uploads Ndovera AI reads overnight: a school's term calendar (PDF, Word or photo) becomes
// calendar events, and a class timetable becomes the class's timetable. Files are kept; each
// upload waits until midnight (Lagos), is read, and reports what was added or why it was not.

export type ImportKind = 'calendar' | 'timetable'

export async function ensureImportTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_ai_imports (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, class_id TEXT, class_name TEXT,
    file_key TEXT NOT NULL, file_name TEXT, content_type TEXT, status TEXT NOT NULL DEFAULT 'pending', message TEXT,
    result_json TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL, processed_at TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_school_ai_imports ON school_ai_imports (tenant_id, kind, created_at)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_school_ai_imports_status ON school_ai_imports (status, created_at)`).run()
}

export function mapImport(row: Record<string, any>) {
  let result: unknown = null
  try { result = row.result_json ? JSON.parse(String(row.result_json)) : null } catch {}
  return {
    id: String(row.id), kind: String(row.kind), classId: String(row.class_id || ''), className: String(row.class_name || ''),
    fileName: String(row.file_name || ''), status: String(row.status), message: String(row.message || ''), result,
    by: String(row.created_by_name || ''), at: String(row.created_at), processedAt: String(row.processed_at || ''),
  }
}

export const IMPORT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/** "12th – 16th Jan 2026", "Sat. 3rd Jan 2026", "30th Mar – 2nd Apr 2026", "2026-01-12" → { start, end }. */
export function parseDateRange(text: string, fallbackYear = new Date().getUTCFullYear()): { start: string, end: string } | null {
  const clean = String(text || '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
  const isoDates = clean.match(/\d{4}-\d{2}-\d{2}/g)
  if (isoDates?.length) return { start: isoDates[0], end: isoDates[isoDates.length - 1] }
  const parts = [...clean.matchAll(/(\d{1,2})\s*(?:([A-Za-z]{3,})\.?,?\s*)?(\d{4})?/g)].filter(match => match[1])
  if (!parts.length) return null
  const yearOf = (index: number) => Number(parts.slice(index).find(part => part[3])?.[3] || fallbackYear)
  const monthOf = (index: number) => {
    for (const part of parts.slice(index)) {
      const month = part[2] ? MONTHS[part[2].slice(0, 3).toLowerCase()] : 0
      if (month) return month
    }
    return 0
  }
  const make = (index: number) => {
    const month = monthOf(index)
    const day = Number(parts[index][1])
    if (!month || !day || day > 31) return ''
    return `${yearOf(index)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const start = make(0)
  const end = parts.length > 1 ? make(parts.length - 1) : start
  if (!start) return null
  return { start, end: end && end >= start ? end : start }
}

/** The calendar event type an activity is. */
export function activityType(activity: string) {
  const text = activity.toLowerCase()
  if (/mid-?\s*term|half-?\s*term/.test(text)) return 'break'
  if (/\bholiday|vacation|public holiday/.test(text)) return 'holiday'
  if (/\bresum|school (re)?opens|first day/.test(text) && /student|pupil|term|session|resum/.test(text) && !/staff|cleaner|teacher/.test(text)) return 'term_start'
  if (/school closes|end of term|vacation begins|closing/.test(text)) return 'term_end'
  return 'event'
}

export const CALENDAR_PROMPT = [
  'You read a Nigerian school\'s term calendar (it may be a table: Week | Date | Activity).',
  'Return ONLY a JSON array, one item per row: [{"week":"3rd Week","date":"26th - 30th Jan 2026","activity":"Submission of Examination & C.A Questions"}].',
  'Copy the date text exactly as written (keep the year). Leave "week" empty when there is none. Do not invent rows.',
].join('\n')

export const TIMETABLE_PROMPT = [
  'You read a Nigerian school class timetable. Days are Monday to Friday (sometimes Saturday).',
  'Return ONLY a JSON array, one item per lesson or break: [{"day":"Monday","start":"08:00","end":"08:40","subject":"Mathematics","teacher":"Mr Okafor","break":false}].',
  'Times in 24-hour HH:MM. For breaks, assembly or lunch set "break": true and put the name in "subject". Leave "teacher" empty if not shown. Do not invent lessons.',
].join('\n')

export function parseJsonArray(text: string): Array<Record<string, any>> {
  const raw = String(text || '')
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : []
  } catch { return [] }
}

/** Calendar rows → events (dates parsed by Ndovera, not the AI). */
export function calendarEventsFrom(rows: Array<Record<string, any>>, fallbackYear: number) {
  const events: Array<{ title: string, type: string, startDate: string, endDate: string, description: string }> = []
  const skipped: string[] = []
  for (const row of rows.slice(0, 120)) {
    const title = String(row.activity || row.title || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const range = parseDateRange(String(row.date || ''), fallbackYear)
    if (!title || !range) { if (title || row.date) skipped.push(`${row.date || ''} ${title}`.trim()); continue }
    events.push({ title, type: activityType(title), startDate: range.start, endDate: range.end, description: String(row.week || '').trim() ? `${String(row.week).trim()} · from the uploaded school calendar` : 'From the uploaded school calendar' })
  }
  return { events, skipped }
}

const DAYS: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }
const hhmm = (value: unknown) => {
  const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i)
  if (!match) return ''
  let hour = Number(match[1])
  if (match[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
  if (match[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
  return hour < 24 ? `${String(hour).padStart(2, '0')}:${match[2]}` : ''
}

/** Timetable rows → timetable entries, subjects and teachers matched to the class's own. */
export function timetableEntriesFrom(rows: Array<Record<string, any>>, subjects: Array<{ id: string, name: string, teacherId: string, teacherName: string }>) {
  const norm = (text: string) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
  const byDay = new Map<number, Array<Record<string, any>>>()
  const unmatched = new Set<string>()
  for (const row of rows.slice(0, 120)) {
    const day = DAYS[String(row.day || '').trim().slice(0, 3).toLowerCase()]
    const start = hhmm(row.start)
    if (!day || !start) continue
    const name = String(row.subject || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const isBreak = row.break === true || /\b(break|lunch|assembly|recess|devotion)\b/i.test(name)
    const subject = isBreak ? null : subjects.find(item => norm(item.name) === norm(name)) || subjects.find(item => norm(item.name).includes(norm(name)) || norm(name).includes(norm(item.name)))
    if (!isBreak && name && !subject) unmatched.add(name)
    const list = byDay.get(day) || []
    list.push({ dayOfWeek: day, startTime: start, endTime: hhmm(row.end), subjectId: subject?.id || '', subjectName: subject?.name || (isBreak ? '' : name), teacherId: subject?.teacherId || '', teacherName: subject?.teacherName || String(row.teacher || '').trim().slice(0, 80), isBreak, label: isBreak ? name || 'Break' : '' })
    byDay.set(day, list)
  }
  const entries = [...byDay.values()].flatMap(list => list.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((entry, index) => ({ ...entry, periodIndex: index })))
  return { entries, unmatched: [...unmatched] }
}

// Birthday celebrations (spec: ndovera_birthdays/README.md; tables adapted from its
// backend/001_birthdays.sql).
//
// Each enabled school announces the day's birthdays at its own time (default 07:00 in
// its timezone), from 10 October 2026 on — never cards for earlier birthdays. Staff are
// celebrated unless they opt out; students only with consent (theirs or a parent's).
// Nobody's age, year of birth or contact details are ever shown.
//
// Cards are drawn by Ndovera, not by an image model: 16 original design families, each
// with its own imagery (confetti, balloons, adire, kente, laurel…), in 10 palettes and 3
// layouts. A person never gets the same family twice in 13 years, and never the same
// message twice. The real photo (only from the person's own avatar folder) or their
// initials is placed in the card; nothing redraws a face. The design is stored as a few
// parameters and drawn as SVG when viewed — nothing to store, nothing to pay for — and
// the viewer's device turns it into a PNG to save.
//
// Wishes: anyone in the school may send one (students' wishes wait for approval when the
// school says so); only the birthday person reads them; anyone who can see a wish can
// report it, which hides it until a Head looks at it.

export class BirthdayError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const START_DATE = '2026-10-10'
export const STYLES = ['cheerful', 'warm', 'formal', 'short', 'faith'] as const
export type Settings = {
  enabled: boolean, students: boolean, staff: boolean, wishes: boolean, aiCards: boolean, moderateStudentWishes: boolean,
  timezone: string, announcementTime: string, leapDayPolicy: 'feb28' | 'mar01', faithStyles: boolean, version: number,
}
export const DEFAULT_SETTINGS: Settings = {
  enabled: false, students: false, staff: true, wishes: true, aiCards: true, moderateStudentWishes: true,
  timezone: 'Africa/Lagos', announcementTime: '07:00', leapDayPolicy: 'feb28', faithStyles: false, version: 1,
}

const NON_CELEBRATED_ROLES = new Set(['parent', 'ami', 'growth_partner', 'growthpartner'])
const MODERATOR_ROLES = ['owner', 'hos']
const MAX_WISHES_PER_SENDER = 3

const nowIso = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
const json = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

const readyDbs = new WeakSet<object>()
export async function ensureBirthdayTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS birthday_settings (
      school_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, students INTEGER NOT NULL DEFAULT 0, staff INTEGER NOT NULL DEFAULT 1,
      wishes INTEGER NOT NULL DEFAULT 1, ai_cards INTEGER NOT NULL DEFAULT 1, moderate_student_wishes INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Africa/Lagos', announcement_time TEXT NOT NULL DEFAULT '07:00',
      leap_day_policy TEXT NOT NULL DEFAULT 'feb28' CHECK(leap_day_policy IN ('feb28','mar01')), faith_styles INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1, updated_by TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_settings_enabled ON birthday_settings(enabled)`,
    `CREATE TABLE IF NOT EXISTS birthday_celebrations (
      school_id TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL, celebration_year INTEGER NOT NULL, local_date TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','generating','ready','published','paused','failed')),
      name TEXT NOT NULL, role TEXT, message TEXT, design_family TEXT, design TEXT, visual_fingerprint TEXT,
      consent_version TEXT NOT NULL, published_at TEXT, created_at TEXT NOT NULL,
      PRIMARY KEY(school_id, id), UNIQUE(school_id, user_id, celebration_year))`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_feed ON birthday_celebrations(school_id, local_date, state)`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_memories ON birthday_celebrations(school_id, user_id, celebration_year)`,
    `CREATE TABLE IF NOT EXISTS birthday_design_history (
      school_id TEXT NOT NULL, user_id TEXT NOT NULL, celebration_id TEXT NOT NULL, celebration_year INTEGER NOT NULL,
      design_family TEXT NOT NULL, visual_fingerprint TEXT NOT NULL, message_hash TEXT NOT NULL,
      PRIMARY KEY(school_id, user_id, celebration_year))`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_history_user ON birthday_design_history(user_id, celebration_year)`,
    `CREATE TABLE IF NOT EXISTS birthday_wishes (
      school_id TEXT NOT NULL, id TEXT NOT NULL, celebration_id TEXT NOT NULL, sender_id TEXT NOT NULL, sender_name TEXT, sender_role TEXT,
      request_id TEXT NOT NULL, message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')), created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT,
      PRIMARY KEY(school_id, id), UNIQUE(school_id, sender_id, request_id))`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_wish_feed ON birthday_wishes(school_id, celebration_id, state, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_birthday_wish_queue ON birthday_wishes(school_id, state, created_at)`,
    `CREATE TABLE IF NOT EXISTS birthday_reports (
      school_id TEXT NOT NULL, id TEXT NOT NULL, wish_id TEXT NOT NULL, reporter_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(school_id, id), UNIQUE(school_id, wish_id, reporter_id))`,
    `CREATE TABLE IF NOT EXISTS birthday_consents (school_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL, set_by TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(school_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS birthday_runs (school_id TEXT NOT NULL, local_date TEXT NOT NULL, ran_at TEXT NOT NULL, celebrated INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(school_id, local_date))`,
    `CREATE TABLE IF NOT EXISTS birthday_audit (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, actor TEXT, action TEXT NOT NULL, data TEXT, created_at TEXT NOT NULL)`,
  ]) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

async function audit(db: D1Database, schoolId: string, actor: string, action: string, data: Record<string, unknown> = {}) {
  await db.prepare(`INSERT INTO birthday_audit (id, school_id, actor, action, data, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(newId('bau'), schoolId, actor, action, JSON.stringify(data), nowIso()).run()
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(db: D1Database, schoolId: string): Promise<Settings> {
  await ensureBirthdayTables(db)
  const row = await db.prepare(`SELECT * FROM birthday_settings WHERE school_id = ?`).bind(schoolId).first() as Record<string, any> | null
  if (!row) return { ...DEFAULT_SETTINGS }
  return {
    enabled: Boolean(row.enabled), students: Boolean(row.students), staff: Boolean(row.staff), wishes: Boolean(row.wishes), aiCards: Boolean(row.ai_cards),
    moderateStudentWishes: Boolean(row.moderate_student_wishes), timezone: String(row.timezone), announcementTime: String(row.announcement_time),
    leapDayPolicy: row.leap_day_policy === 'mar01' ? 'mar01' : 'feb28', faithStyles: Boolean(row.faith_styles), version: Number(row.version),
  }
}

const validTimezone = (zone: string) => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true } catch { return false } }

/** Compare-and-swap on version: a stale form gets 409 and must refresh. */
export async function saveSettings(db: D1Database, schoolId: string, input: Record<string, any>, actor: string) {
  const current = await getSettings(db, schoolId)
  if (Number(input.version) !== current.version) throw new BirthdayError('These settings changed. Refresh and try again.', 409)
  const bool = (key: keyof Settings) => (typeof input[key] === 'boolean' ? input[key] : current[key]) as boolean
  const timezone = String(input.timezone ?? current.timezone)
  if (!validTimezone(timezone)) throw new BirthdayError('Unknown timezone.')
  const announcementTime = String(input.announcementTime ?? current.announcementTime)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(announcementTime)) throw new BirthdayError('The announcement time must be HH:MM.')
  const leap = String(input.leapDayPolicy ?? current.leapDayPolicy)
  if (!['feb28', 'mar01'].includes(leap)) throw new BirthdayError('Choose 28 February or 1 March.')
  const next = { enabled: bool('enabled'), students: bool('students'), staff: bool('staff'), wishes: bool('wishes'), aiCards: bool('aiCards'), moderateStudentWishes: bool('moderateStudentWishes'), faithStyles: bool('faithStyles') }
  const result = await db.prepare(`INSERT INTO birthday_settings (school_id, enabled, students, staff, wishes, ai_cards, moderate_student_wishes, timezone, announcement_time, leap_day_policy, faith_styles, version, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?)
      ON CONFLICT(school_id) DO UPDATE SET enabled = excluded.enabled, students = excluded.students, staff = excluded.staff, wishes = excluded.wishes, ai_cards = excluded.ai_cards,
        moderate_student_wishes = excluded.moderate_student_wishes, timezone = excluded.timezone, announcement_time = excluded.announcement_time, leap_day_policy = excluded.leap_day_policy,
        faith_styles = excluded.faith_styles, version = birthday_settings.version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      WHERE birthday_settings.version = ?`)
    .bind(schoolId, next.enabled ? 1 : 0, next.students ? 1 : 0, next.staff ? 1 : 0, next.wishes ? 1 : 0, next.aiCards ? 1 : 0, next.moderateStudentWishes ? 1 : 0, timezone, announcementTime, leap, next.faithStyles ? 1 : 0, actor, nowIso(), current.version).run()
  if (!Number(result.meta?.changes)) throw new BirthdayError('These settings changed. Refresh and try again.', 409)
  await audit(db, schoolId, actor, 'settings_changed', { ...next, timezone, announcementTime, leap })
  return getSettings(db, schoolId)
}

// ─── Consent ────────────────────────────────────────────────────────────────

export async function consentStatus(db: D1Database, schoolId: string, userId: string) {
  await ensureBirthdayTables(db)
  const row = await db.prepare(`SELECT status FROM birthday_consents WHERE school_id = ? AND user_id = ?`).bind(schoolId, userId).first() as { status: string } | null
  return row?.status || ''
}

export async function setConsent(db: D1Database, schoolId: string, userId: string, celebrate: boolean, setBy: string) {
  await ensureBirthdayTables(db)
  const status = celebrate ? 'granted' : 'withdrawn'
  await db.prepare(`INSERT INTO birthday_consents (school_id, user_id, status, set_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(school_id, user_id) DO UPDATE SET status = excluded.status, set_by = excluded.set_by, updated_at = excluded.updated_at`)
    .bind(schoolId, userId, status, setBy, nowIso()).run()
  // Withdrawal takes effect at once: this year's celebration leaves the dashboard.
  if (!celebrate) await db.prepare(`UPDATE birthday_celebrations SET state = 'paused' WHERE school_id = ? AND user_id = ? AND state = 'published'`).bind(schoolId, userId).run()
  else await db.prepare(`UPDATE birthday_celebrations SET state = 'published' WHERE school_id = ? AND user_id = ? AND state = 'paused' AND consent_version LIKE 'consent:%'`).bind(schoolId, userId).run()
  await audit(db, schoolId, setBy, celebrate ? 'consent_granted' : 'consent_withdrawn', { userId })
  return status
}

/** Staff are celebrated unless they opt out; students only with consent. Checked again at every read. */
export function consentAllows(kind: 'student' | 'staff', status: string) {
  return kind === 'staff' ? status !== 'withdrawn' : status === 'granted'
}

// ─── Who has a birthday today ───────────────────────────────────────────────

export function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value || '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}` }
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Does a date of birth fall on this local date? 29 February follows the school's policy in other years. */
export function birthdayMatches(dateOfBirth: string, localDate: string, policy: 'feb28' | 'mar01') {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) return false
  const monthDay = dateOfBirth.slice(5, 10)
  const year = Number(localDate.slice(0, 4))
  if (monthDay === '02-29' && !isLeap(year)) return localDate.slice(5) === (policy === 'mar01' ? '03-01' : '02-28')
  return localDate.slice(5) === monthDay
}

export type Person = { id: string, name: string, role: string, kind: 'student' | 'staff', dateOfBirth: string, avatar: string }

export async function schoolPeople(db: D1Database, schoolId: string): Promise<Person[]> {
  const rows = ((await db.prepare(`SELECT u.id, u.name, u.role, s.payload FROM users u LEFT JOIN settings s ON s.studentId IN (u.email, lower(u.email))
    WHERE u.tenantId = ? AND (u.status IS NULL OR u.status NOT IN ('inactive', 'deleted', 'archived'))`).bind(schoolId).all()).results || []) as Array<Record<string, any>>
  return rows.map(row => {
    const payload = json<Record<string, any>>(row.payload, {})
    const role = String(row.role || payload.role || '').toLowerCase()
    return {
      id: String(row.id), name: String(row.name || payload.name || '').trim(), role,
      kind: role === 'student' ? 'student' as const : 'staff' as const,
      dateOfBirth: String(payload.dateOfBirth || payload.profile?.dateOfBirth || '').slice(0, 10),
      avatar: String(payload.avatar || payload.profile?.avatar || payload.avatarUrl || ''),
    }
  }).filter(person => person.name && !NON_CELEBRATED_ROLES.has(person.role))
}

// ─── Designs ────────────────────────────────────────────────────────────────

export const FAMILIES = ['confetti', 'balloons', 'sunburst', 'waves', 'geometric', 'bunting', 'stars', 'ribbons', 'bokeh', 'mosaic', 'floral', 'adire', 'kente', 'papercut', 'laurel', 'fireworks'] as const
export type Family = typeof FAMILIES[number]
export const PALETTES = [
  ['#800000', '#c9a96e', '#fff8f0', '#191970'], ['#1a5c38', '#f5deb3', '#ffffff', '#c9a96e'], ['#191970', '#ffd166', '#f8f9ff', '#ef476f'],
  ['#3d1a78', '#ff9f1c', '#fff4e6', '#2ec4b6'], ['#0b525b', '#f4a261', '#fefae0', '#e76f51'], ['#5e0b15', '#d4af37', '#fffaf0', '#90323d'],
  ['#14213d', '#fca311', '#e5e5e5', '#ffffff'], ['#2b2d42', '#ef233c', '#edf2f4', '#8d99ae'], ['#006d77', '#ffddd2', '#edf6f9', '#e29578'],
  ['#283618', '#dda15e', '#fefae0', '#bc6c25'],
]
export const LAYOUTS = ['left', 'centre', 'top'] as const
export type Design = { family: Family, palette: number, layout: typeof LAYOUTS[number], seed: number }

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hashString = (text: string) => Array.from(text).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261)
export async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

/**
 * A design no earlier card of this person (this year and the 12 before, in any school)
 * used: a family not seen in that window. With 16 families there is always one.
 */
export function chooseDesign(usedFamilies: string[], seed: number): Design {
  const random = seededRandom(seed)
  const available = FAMILIES.filter(family => !usedFamilies.includes(family))
  if (!available.length) throw new BirthdayError('No unused design family is left for this person.', 409)
  return { family: available[Math.floor(random() * available.length)], palette: Math.floor(random() * PALETTES.length), layout: LAYOUTS[Math.floor(random() * LAYOUTS.length)], seed }
}
export const fingerprint = (design: Design) => `${design.family}:${design.layout}:${design.palette}`

const escapeXml = (value: string) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] as string)

/** The artwork of a family: genuinely different imagery, not a recolour. */
function artwork(design: Design, width: number, height: number) {
  const [deep, accent, light, extra] = PALETTES[design.palette]
  const random = seededRandom(design.seed)
  const r = (min: number, max: number) => min + random() * (max - min)
  const parts: string[] = [`<rect width="${width}" height="${height}" fill="${light}"/>`]
  const many = (n: number, draw: (i: number) => string) => { for (let i = 0; i < n; i += 1) parts.push(draw(i)) }
  switch (design.family) {
    case 'confetti': many(90, i => (i % 2 ? `<rect x="${r(0, width)}" y="${r(0, height)}" width="${r(8, 22)}" height="${r(4, 10)}" fill="${[deep, accent, extra][i % 3]}" transform="rotate(${r(0, 180)} ${r(0, width)} ${r(0, height)})" opacity="0.8"/>` : `<circle cx="${r(0, width)}" cy="${r(0, height)}" r="${r(4, 9)}" fill="${[accent, extra, deep][i % 3]}" opacity="0.75"/>`)); break
    case 'balloons': many(9, i => { const x = r(40, width - 40); const y = r(60, height * 0.55); const color = [deep, accent, extra][i % 3]; return `<path d="M${x} ${y + 70} q ${r(-30, 30)} 120 ${r(-20, 20)} 260" stroke="${deep}" stroke-width="2" fill="none" opacity="0.5"/><ellipse cx="${x}" cy="${y}" rx="52" ry="68" fill="${color}" opacity="0.88"/><ellipse cx="${x - 16}" cy="${y - 22}" rx="10" ry="18" fill="#fff" opacity="0.35"/>` }); break
    case 'sunburst': { const cx = width / 2; const cy = height * 0.35; many(28, i => { const a1 = (i / 28) * Math.PI * 2; const a2 = ((i + 0.5) / 28) * Math.PI * 2; const R = height; return `<path d="M${cx} ${cy} L${cx + Math.cos(a1) * R} ${cy + Math.sin(a1) * R} L${cx + Math.cos(a2) * R} ${cy + Math.sin(a2) * R} Z" fill="${i % 2 ? accent : light}" opacity="0.6"/>` }); break }
    case 'waves': many(6, i => { const y = height * (0.45 + i * 0.1); const amp = r(25, 60); return `<path d="M0 ${y} C ${width * 0.25} ${y - amp}, ${width * 0.5} ${y + amp}, ${width * 0.75} ${y - amp / 2} S ${width} ${y + amp}, ${width} ${y} V ${height} H 0 Z" fill="${[deep, accent, extra][i % 3]}" opacity="${0.18 + i * 0.1}"/>` }); break
    case 'geometric': { const size = 120; for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) parts.push(`<polygon points="${x},${y} ${x + size},${y} ${x + (random() > 0.5 ? size : 0)},${y + size}" fill="${[deep, accent, extra, light][Math.floor(random() * 4)]}" opacity="0.35"/>`); break }
    case 'bunting': many(3, row => { const y = 80 + row * 110; const flags = 9; let svg = `<path d="M0 ${y} Q ${width / 2} ${y + 60} ${width} ${y}" stroke="${deep}" stroke-width="3" fill="none"/>`; for (let i = 0; i < flags; i += 1) { const x = (i + 0.5) * (width / flags); const sag = 60 * (1 - Math.pow((x - width / 2) / (width / 2), 2)) / 2; svg += `<polygon points="${x - 34},${y + sag} ${x + 34},${y + sag} ${x},${y + sag + 70}" fill="${[accent, extra, deep][(i + row) % 3]}"/>` } return svg }); break
    case 'stars': many(40, i => { const cx = r(0, width); const cy = r(0, height); const R = r(8, 26); const pts = Array.from({ length: 10 }, (_, k) => { const a = (k * Math.PI) / 5 - Math.PI / 2; const rad = k % 2 ? R / 2.4 : R; return `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}` }).join(' '); return `<polygon points="${pts}" fill="${[accent, deep, extra][i % 3]}" opacity="0.8"/>` }); break
    case 'ribbons': many(7, i => `<path d="M ${-50} ${r(0, height)} C ${width * 0.3} ${r(0, height)}, ${width * 0.6} ${r(0, height)}, ${width + 50} ${r(0, height)}" stroke="${[deep, accent, extra][i % 3]}" stroke-width="${r(14, 34)}" fill="none" stroke-linecap="round" opacity="0.55"/>`); break
    case 'bokeh': many(45, i => `<circle cx="${r(0, width)}" cy="${r(0, height)}" r="${r(20, 110)}" fill="${[accent, extra, deep][i % 3]}" opacity="${r(0.08, 0.3)}"/>`); break
    case 'mosaic': { const size = 90; for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) if (random() > 0.45) parts.push(`<rect x="${x + 4}" y="${y + 4}" width="${size - 8}" height="${size - 8}" rx="14" fill="${[deep, accent, extra][Math.floor(random() * 3)]}" opacity="0.28"/>`); break }
    case 'floral': many(14, i => { const cx = r(0, width); const cy = r(0, height); const R = r(26, 60); const color = [accent, extra, deep][i % 3]; return Array.from({ length: 6 }, (_, k) => `<ellipse cx="${cx + Math.cos(k * Math.PI / 3) * R * 0.6}" cy="${cy + Math.sin(k * Math.PI / 3) * R * 0.6}" rx="${R * 0.45}" ry="${R * 0.25}" transform="rotate(${k * 60} ${cx + Math.cos(k * Math.PI / 3) * R * 0.6} ${cy + Math.sin(k * Math.PI / 3) * R * 0.6})" fill="${color}" opacity="0.55"/>`).join('') + `<circle cx="${cx}" cy="${cy}" r="${R * 0.22}" fill="${deep}" opacity="0.7"/>` }); break
    case 'adire': { parts.push(`<rect width="${width}" height="${height}" fill="${deep}" opacity="0.92"/>`); for (let y = 60; y < height; y += 150) for (let x = 60; x < width; x += 150) for (let k = 1; k <= 4; k += 1) parts.push(`<circle cx="${x}" cy="${y}" r="${k * 14}" fill="none" stroke="${light}" stroke-width="3" opacity="${0.55 - k * 0.1}" stroke-dasharray="${k % 2 ? '6 6' : '0'}"/>`); break }
    case 'kente': { const band = 60; for (let y = 0; y < height; y += band) { parts.push(`<rect y="${y}" width="${width}" height="${band}" fill="${[accent, deep, extra, light][(y / band) % 4]}" opacity="0.5"/>`); for (let x = 0; x < width; x += 80) if ((x / 80 + y / band) % 2 === 0) parts.push(`<rect x="${x}" y="${y + 10}" width="40" height="${band - 20}" fill="${[deep, accent][(y / band) % 2]}" opacity="0.6"/>`) } break }
    case 'papercut': many(5, i => { const base = height * (0.5 + i * 0.12); return `<path d="M0 ${base} ${Array.from({ length: 7 }, (_, k) => `Q ${(k + 0.5) * width / 6} ${base - r(40, 140)} ${(k + 1) * width / 6} ${base}`).join(' ')} V ${height} H 0 Z" fill="${[extra, accent, deep][i % 3]}" opacity="${0.25 + i * 0.12}"/>` }); break
    case 'laurel': { const cx = width / 2; const cy = height * 0.33; many(28, i => { const side = i < 14 ? -1 : 1; const t = (i % 14) / 13; const a = Math.PI * (0.6 + t * 0.8); const x = cx + side * Math.cos(a - Math.PI / 2) * 290; const y = cy + Math.sin(a - Math.PI / 2) * -290 + 60; return `<ellipse cx="${x}" cy="${y}" rx="34" ry="13" transform="rotate(${side * (t * 160 - 60)} ${x} ${y})" fill="${[deep, accent][i % 2]}" opacity="0.75"/>` }); break }
    case 'fireworks':
    default: { parts.push(`<rect width="${width}" height="${height}" fill="${deep}" opacity="0.95"/>`); many(6, i => { const cx = r(100, width - 100); const cy = r(80, height * 0.6); const color = [accent, light, extra][i % 3]; return Array.from({ length: 18 }, (_, k) => { const a = (k / 18) * Math.PI * 2; const len = r(50, 110); return `<line x1="${cx + Math.cos(a) * 14}" y1="${cy + Math.sin(a) * 14}" x2="${cx + Math.cos(a) * len}" y2="${cy + Math.sin(a) * len}" stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>` }).join('') }); break }
  }
  return parts.join('')
}

/** Word-wrap for SVG text. */
function wrap(text: string, max: number) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max) { if (line) lines.push(line); line = word } else line = `${line} ${word}`.trim()
  }
  if (line) lines.push(line)
  return lines.slice(0, 7)
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '★'
const dark = (family: Family) => family === 'adire' || family === 'fireworks'

/** The card as SVG (1080 × 1350): the real photo, or initials — never another person's image. */
export function renderCard(input: { design: Design, name: string, displayDate: string, message: string, schoolName: string, photoDataUri?: string | null }) {
  const width = 1080
  const height = 1350
  const { design } = input
  const [deep, accent, light] = PALETTES[design.palette]
  const ink = dark(design.family) ? light : deep
  const photo = design.layout === 'left' ? { x: 230, y: 330, r: 170 } : design.layout === 'top' ? { x: 540, y: 300, r: 190 } : { x: 540, y: 420, r: 200 }
  const textX = design.layout === 'left' ? 450 : 540
  const anchor = design.layout === 'left' ? 'start' : 'middle'
  const titleY = design.layout === 'left' ? 280 : photo.y + photo.r + 110
  const portrait = input.photoDataUri
    ? `<clipPath id="p"><circle cx="${photo.x}" cy="${photo.y}" r="${photo.r}"/></clipPath><image href="${input.photoDataUri}" x="${photo.x - photo.r}" y="${photo.y - photo.r}" width="${photo.r * 2}" height="${photo.r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#p)"/>`
    : `<circle cx="${photo.x}" cy="${photo.y}" r="${photo.r}" fill="${deep}"/><text x="${photo.x}" y="${photo.y + photo.r * 0.32}" font-family="Georgia, serif" font-size="${photo.r * 0.9}" font-weight="700" fill="${light}" text-anchor="middle">${escapeXml(initials(input.name))}</text>`
  const lines = wrap(input.message, design.layout === 'left' ? 30 : 38)
  const messageY = design.layout === 'left' ? 640 : titleY + 210
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${artwork(design, width, height)}
<rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="48" fill="none" stroke="${accent}" stroke-width="6" opacity="0.9"/>
<circle cx="${photo.x}" cy="${photo.y}" r="${photo.r + 14}" fill="${light}" stroke="${accent}" stroke-width="10"/>
${portrait}
<text x="${textX}" y="${titleY}" font-family="Georgia, serif" font-size="78" font-weight="700" fill="${ink}" text-anchor="${anchor}">Happy Birthday</text>
<text x="${textX}" y="${titleY + 80}" font-family="Georgia, serif" font-size="58" font-weight="700" fill="${accent}" text-anchor="${anchor}">${escapeXml(input.name.slice(0, 40))}</text>
<text x="${textX}" y="${titleY + 130}" font-family="Arial, sans-serif" font-size="30" fill="${ink}" text-anchor="${anchor}" opacity="0.85">${escapeXml(input.displayDate)}</text>
${lines.map((line, index) => `<text x="${textX}" y="${messageY + index * 46}" font-family="Arial, sans-serif" font-size="34" fill="${ink}" text-anchor="${anchor}">${escapeXml(line)}</text>`).join('\n')}
<text x="540" y="${height - 80}" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${ink}" text-anchor="middle" opacity="0.9">${escapeXml(input.schoolName.slice(0, 60))} · Ndovera</text>
</svg>`
}

export const displayDate = (localDate: string) => new Date(`${localDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

// ─── Messages ───────────────────────────────────────────────────────────────

export const MESSAGES = [
  'Wishing you a year full of joy, good health and new discoveries.',
  'May this new year of your life bring you peace, laughter and many reasons to smile.',
  'Thank you for all you bring to our school. Have a wonderful birthday.',
  'Here is to a bright year ahead, filled with success and happy moments.',
  'May your day be as special as you are to everyone around you.',
  'Celebrating you today and cheering you on for the year ahead.',
  'Wishing you happiness in everything you do this year.',
  'May every step you take this year lead you somewhere wonderful.',
  'Today we celebrate you. May the year ahead be your best yet.',
  'Wishing you strength, joy and good friends all year long.',
  'Have a day full of fun and a year full of blessings.',
  'May your new year be rich in learning, kindness and laughter.',
  'Sending you warm wishes for a happy birthday and a great year.',
  'We are glad you are part of our school family. Enjoy your special day.',
  'Wishing you a birthday as bright as your smile.',
  'May this year bring you closer to every dream you hold.',
]
export const SUGGESTIONS: Record<string, string[]> = {
  cheerful: ['Happy birthday! Have a fantastic day full of fun and cake!', 'Wishing you the happiest of birthdays — enjoy every moment!', 'Happy birthday! May your day be full of smiles and surprises.'],
  warm: ['Wishing you a warm and wonderful birthday, surrounded by people who care about you.', 'Happy birthday. Thank you for being such a kind presence in our school.', 'May your birthday be filled with love and your year with joy.'],
  formal: ['Warm congratulations on your birthday. Best wishes for the year ahead.', 'Please accept my sincere wishes for a happy birthday and a successful year.', 'Wishing you good health and continued success on your birthday.'],
  short: ['Happy birthday!', 'Have a great birthday!', 'Best wishes on your birthday!'],
  faith: ['Happy birthday. May God bless you and keep you this year and always.', 'Wishing you a blessed birthday and a year full of grace.', 'May this new year be full of blessings for you and your family.'],
}

/** One cheap text call for the year's message, stored; never a repeat for this person. Falls back to the written library. */
async function chooseMessage(runAi: ((prompt: string) => Promise<string>) | null, person: Person, usedHashes: Set<string>, seed: number) {
  if (runAi) {
    try {
      const text = String(await runAi(`Write one warm, school-appropriate birthday message (max 30 words) for ${person.name.split(/\s+/)[0]}, a ${person.kind === 'student' ? 'student' : 'staff member'} at a Nigerian school. No age, no year, no religion, no emojis. Reply with the message only.`) || '')
        .replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 220)
      if (text.length >= 20 && !/\d{2}/.test(text) && !usedHashes.has(await sha256(text.toLowerCase()))) return text
    } catch { /* the library always works */ }
  }
  const random = seededRandom(seed)
  const order = [...MESSAGES].sort(() => random() - 0.5)
  for (const message of order) if (!usedHashes.has(await sha256(message.toLowerCase()))) return message
  // All 16 used (an extraordinary run of years): make it personal so it is still new.
  return `${order[0]} Happy birthday, ${person.name.split(/\s+/)[0]}!`
}

// ─── The daily run ──────────────────────────────────────────────────────────

export type BirthdayDeps = {
  db: D1Database
  schoolName: (schoolId: string) => Promise<string>
  runAi?: ((prompt: string) => Promise<string>) | null
  notify?: (schoolId: string, userId: string, title: string, body: string) => Promise<void>
  now?: () => Date
}

/** Once a day per school, at its announcement time: create and publish today's celebrations. */
export async function runSchoolBirthdays(deps: BirthdayDeps, schoolId: string) {
  const { db } = deps
  const settings = await getSettings(db, schoolId)
  if (!settings.enabled || (!settings.staff && !settings.students)) return 0
  const clock = localClock(deps.now?.() || new Date(), settings.timezone)
  if (clock.date < START_DATE || clock.time < settings.announcementTime) return 0
  const claim = await db.prepare(`INSERT OR IGNORE INTO birthday_runs (school_id, local_date, ran_at) VALUES (?, ?, ?)`).bind(schoolId, clock.date, nowIso()).run()
  if (!Number(claim.meta?.changes)) return 0
  const year = Number(clock.date.slice(0, 4))
  const people = (await schoolPeople(db, schoolId)).filter(person => birthdayMatches(person.dateOfBirth, clock.date, settings.leapDayPolicy) && (person.kind === 'student' ? settings.students : settings.staff))
  let celebrated = 0
  for (const person of people) {
    const status = await consentStatus(db, schoolId, person.id)
    if (!consentAllows(person.kind, status)) continue
    // History across every school this person has been in (by their global user id), never shown.
    const history = ((await db.prepare(`SELECT design_family, message_hash FROM birthday_design_history WHERE user_id = ? AND celebration_year BETWEEN ? AND ?`).bind(person.id, year - 12, year).all()).results || []) as Array<{ design_family: string, message_hash: string }>
    const id = newId('bdy')
    const seed = hashString(`${schoolId}:${person.id}:${year}`)
    const design = chooseDesign(history.map(row => row.design_family), seed)
    const message = await chooseMessage(settings.aiCards ? deps.runAi || null : null, person, new Set(history.map(row => row.message_hash)), seed)
    const at = nowIso()
    const result = await db.batch([
      db.prepare(`INSERT OR IGNORE INTO birthday_celebrations (school_id, id, user_id, celebration_year, local_date, state, name, role, message, design_family, design, visual_fingerprint, consent_version, published_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(schoolId, id, person.id, year, clock.date, person.name, person.kind, message, design.family, JSON.stringify(design), fingerprint(design), `consent:${status || 'default'}`, at, at),
      db.prepare(`INSERT OR IGNORE INTO birthday_design_history (school_id, user_id, celebration_id, celebration_year, design_family, visual_fingerprint, message_hash)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM birthday_celebrations WHERE school_id = ? AND id = ?)`).bind(schoolId, person.id, id, year, design.family, fingerprint(design), await sha256(message.toLowerCase()), schoolId, id),
    ])
    if (!Number(result[0]?.meta?.changes)) continue
    celebrated += 1
    await deps.notify?.(schoolId, person.id, 'Happy birthday!', 'Your school is celebrating you today. Open Birthdays to see your card and your wishes.').catch(() => null)
  }
  await db.prepare(`UPDATE birthday_runs SET celebrated = ? WHERE school_id = ? AND local_date = ?`).bind(celebrated, schoolId, clock.date).run()
  if (celebrated) await audit(db, schoolId, 'system', 'celebrations_published', { date: clock.date, count: celebrated })
  return celebrated
}

/** The cron calls this: only schools that turned birthdays on are looked at. */
export async function runDueBirthdays(deps: BirthdayDeps) {
  await ensureBirthdayTables(deps.db)
  const schools = ((await deps.db.prepare(`SELECT school_id FROM birthday_settings WHERE enabled = 1 LIMIT 1000`).all()).results || []) as Array<{ school_id: string }>
  let total = 0
  for (const { school_id: schoolId } of schools) total += await runSchoolBirthdays(deps, schoolId).catch(error => { console.error('Birthdays failed', schoolId, error); return 0 })
  return total
}

// ─── Reading (always scoped to the viewer's school) ─────────────────────────

export type Viewer = { schoolId: string, userId: string, name: string, role: string }

type Celebration = { id: string, schoolId: string, userId: string, year: number, localDate: string, state: string, name: string, role: string, message: string, design: Design }
const mapCelebration = (row: Record<string, any>): Celebration => ({
  id: String(row.id), schoolId: String(row.school_id), userId: String(row.user_id), year: Number(row.celebration_year), localDate: String(row.local_date),
  state: String(row.state), name: String(row.name), role: String(row.role || ''), message: String(row.message || ''), design: json<Design>(row.design, { family: 'confetti', palette: 0, layout: 'centre', seed: 1 }),
})

/** A celebration the viewer may see: same school (composite key), published, consent still valid. 404 otherwise. */
async function visibleCelebration(db: D1Database, viewer: Viewer, id: string, options: { ownArchive?: boolean } = {}) {
  await ensureBirthdayTables(db)
  const row = await db.prepare(`SELECT * FROM birthday_celebrations WHERE school_id = ? AND id = ?`).bind(viewer.schoolId, id).first() as Record<string, any> | null
  if (!row) throw new BirthdayError('This celebration is unavailable.', 404)
  const celebration = mapCelebration(row)
  const own = celebration.userId === viewer.userId
  if (celebration.state !== 'published' && !(own && options.ownArchive)) throw new BirthdayError('This celebration is unavailable.', 404)
  if (!own) {
    const status = await consentStatus(db, viewer.schoolId, celebration.userId)
    if (!consentAllows(celebration.role === 'student' ? 'student' : 'staff', status)) throw new BirthdayError('This celebration is unavailable.', 404)
    // Others see a celebration on its day (and the day after, for late visitors).
    const settings = await getSettings(db, viewer.schoolId)
    const today = localClock(new Date(), settings.timezone).date
    const yesterday = localClock(new Date(Date.now() - 86400_000), settings.timezone).date
    if (![today, yesterday].includes(celebration.localDate) && !MODERATOR_ROLES.includes(viewer.role)) throw new BirthdayError('This celebration is unavailable.', 404)
  }
  return celebration
}

export async function todayFeed(db: D1Database, viewer: Viewer) {
  const settings = await getSettings(db, viewer.schoolId)
  if (!settings.enabled) return []
  const today = localClock(new Date(), settings.timezone).date
  const rows = ((await db.prepare(`SELECT * FROM birthday_celebrations WHERE school_id = ? AND local_date = ? AND state = 'published' ORDER BY name LIMIT 100`).bind(viewer.schoolId, today).all()).results || []) as Record<string, any>[]
  const out = []
  for (const row of rows) {
    const celebration = mapCelebration(row)
    const status = await consentStatus(db, viewer.schoolId, celebration.userId)
    if (consentAllows(celebration.role === 'student' ? 'student' : 'staff', status)) out.push({ id: celebration.id, name: celebration.name, displayDate: displayDate(celebration.localDate) })
  }
  return out
}

export async function memories(db: D1Database, viewer: Viewer) {
  await ensureBirthdayTables(db)
  const rows = ((await db.prepare(`SELECT * FROM birthday_celebrations WHERE school_id = ? AND user_id = ? AND state IN ('published', 'paused') ORDER BY celebration_year DESC LIMIT 100`).bind(viewer.schoolId, viewer.userId).all()).results || []) as Record<string, any>[]
  return rows.map(mapCelebration).map(item => ({ id: item.id, name: item.name, displayDate: `${displayDate(item.localDate)} ${item.year}` }))
}

export async function celebrationDetail(db: D1Database, viewer: Viewer, id: string) {
  const celebration = await visibleCelebration(db, viewer, id, { ownArchive: true })
  const settings = await getSettings(db, viewer.schoolId)
  const own = celebration.userId === viewer.userId
  const moderator = MODERATOR_ROLES.includes(viewer.role)
  const countSql = own ? `state = 'approved'` : moderator ? `state IN ('approved', 'pending')` : `sender_id = ?`
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM birthday_wishes WHERE school_id = ? AND celebration_id = ? AND ${countSql}`).bind(viewer.schoolId, id, ...(own || moderator ? [] : [viewer.userId])).first() as { n: number }
  return {
    id: celebration.id, name: celebration.name, displayDate: displayDate(celebration.localDate), message: celebration.message,
    wishCount: Number(count?.n || 0),
    canSendWish: settings.wishes && !own && celebration.state === 'published',
    canReadWishes: own || moderator,
    allowedStyles: STYLES.filter(style => style !== 'faith' || settings.faithStyles),
  }
}

/** The person's own photo only: an avatar stored under avatars/<school>/<their id>/. Otherwise initials. */
export function ownAvatarKey(avatarUrl: string, schoolId: string, userId: string) {
  const match = String(avatarUrl || '').match(/\/files\/(avatars\/[^?#]+)/)
  const key = match ? decodeURIComponent(match[1]) : ''
  return key.startsWith(`avatars/${schoolId}/${userId}/`) && !key.includes('..') ? key : ''
}

export async function cardSvg(deps: BirthdayDeps & { bucket?: { get(key: string): Promise<any> } }, viewer: Viewer, id: string) {
  const celebration = await visibleCelebration(deps.db, viewer, id, { ownArchive: true })
  const person = (await deps.db.prepare(`SELECT u.id, s.payload FROM users u LEFT JOIN settings s ON s.studentId IN (u.email, lower(u.email)) WHERE u.id = ? AND u.tenantId = ?`).bind(celebration.userId, viewer.schoolId).first()) as Record<string, any> | null
  const payload = json<Record<string, any>>(person?.payload, {})
  const key = ownAvatarKey(String(payload.avatar || payload.profile?.avatar || payload.avatarUrl || ''), viewer.schoolId, celebration.userId)
  let photo: string | null = null
  if (key && deps.bucket) {
    const object = await deps.bucket.get(key).catch(() => null)
    if (object && Number(object.size || 0) < 1_500_000) {
      const bytes = new Uint8Array(await object.arrayBuffer())
      const type = String(object.httpMetadata?.contentType || (key.endsWith('.png') ? 'image/png' : 'image/jpeg'))
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      photo = `data:${type};base64,${btoa(binary)}`
    }
  }
  return renderCard({ design: celebration.design, name: celebration.name, displayDate: displayDate(celebration.localDate), message: celebration.message, schoolName: await deps.schoolName(viewer.schoolId), photoDataUri: photo })
}

// ─── Wishes ─────────────────────────────────────────────────────────────────

const cleanText = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max + 1)

export async function sendWish(db: D1Database, viewer: Viewer, id: string, input: { message?: unknown, requestId?: unknown }) {
  const celebration = await visibleCelebration(db, viewer, id)
  const settings = await getSettings(db, viewer.schoolId)
  if (!settings.wishes) throw new BirthdayError('Birthday wishes are turned off at this school.', 403)
  if (celebration.userId === viewer.userId) throw new BirthdayError('You cannot send a wish to yourself.', 403)
  const message = cleanText(input.message, 1000)
  if (message.length < 1 || message.length > 1000) throw new BirthdayError('A wish is 1 to 1000 characters.')
  const requestId = cleanText(input.requestId, 100)
  if (!requestId) throw new BirthdayError('Missing request id.')
  // A replay returns the original result; the same id with different words is refused.
  const replay = await db.prepare(`SELECT message, state FROM birthday_wishes WHERE school_id = ? AND sender_id = ? AND request_id = ?`).bind(viewer.schoolId, viewer.userId, requestId).first() as { message: string, state: string } | null
  if (replay) {
    if (replay.message !== message) throw new BirthdayError('This request was already used for a different wish.', 409)
    return { status: replay.state === 'approved' ? 'approved' : 'pending' }
  }
  const sent = await db.prepare(`SELECT COUNT(*) AS n FROM birthday_wishes WHERE school_id = ? AND celebration_id = ? AND sender_id = ?`).bind(viewer.schoolId, id, viewer.userId).first() as { n: number }
  if (Number(sent?.n || 0) >= MAX_WISHES_PER_SENDER) throw new BirthdayError('You have already sent your wishes for this birthday.', 429)
  const state = viewer.role === 'student' && settings.moderateStudentWishes ? 'pending' : 'approved'
  await db.prepare(`INSERT INTO birthday_wishes (school_id, id, celebration_id, sender_id, sender_name, sender_role, request_id, message, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(viewer.schoolId, newId('bwi'), id, viewer.userId, viewer.name, viewer.role, requestId, message, state, nowIso()).run()
  return { status: state }
}

export async function listWishes(db: D1Database, viewer: Viewer, id: string) {
  const celebration = await visibleCelebration(db, viewer, id, { ownArchive: true })
  const own = celebration.userId === viewer.userId
  const moderator = MODERATOR_ROLES.includes(viewer.role)
  if (!own && !moderator) throw new BirthdayError('Only the birthday person can read these wishes.', 403)
  const rows = ((await db.prepare(`SELECT id, sender_name, message, state FROM birthday_wishes WHERE school_id = ? AND celebration_id = ? AND ${own ? `state = 'approved'` : `state IN ('approved', 'pending')`} ORDER BY created_at ASC LIMIT 200`).bind(viewer.schoolId, id).all()).results || []) as Array<Record<string, string>>
  return rows.map(row => ({ id: row.id, senderName: row.sender_name || 'Someone at school', message: row.message, ...(own ? {} : { state: row.state }) }))
}

/** A report hides the wish until a Head decides. */
export async function reportWish(db: D1Database, viewer: Viewer, id: string, wishId: string, input: { reason?: unknown }) {
  const celebration = await visibleCelebration(db, viewer, id, { ownArchive: true })
  if (celebration.userId !== viewer.userId && !MODERATOR_ROLES.includes(viewer.role)) throw new BirthdayError('This celebration is unavailable.', 404)
  const reason = cleanText(input.reason, 500)
  if (reason.length < 1 || reason.length > 500) throw new BirthdayError('Give a reason (up to 500 characters).')
  const wish = await db.prepare(`SELECT id FROM birthday_wishes WHERE school_id = ? AND id = ? AND celebration_id = ?`).bind(viewer.schoolId, wishId, id).first()
  if (!wish) throw new BirthdayError('Wish not found.', 404)
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO birthday_reports (school_id, id, wish_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(viewer.schoolId, newId('brp'), wishId, viewer.userId, reason, nowIso()),
    db.prepare(`UPDATE birthday_wishes SET state = 'pending' WHERE school_id = ? AND id = ? AND state = 'approved'`).bind(viewer.schoolId, wishId),
  ])
  await audit(db, viewer.schoolId, viewer.name, 'wish_reported', { wishId, celebrationId: id })
  return { status: 'received' }
}

export async function moderationQueue(db: D1Database, viewer: Viewer) {
  if (!MODERATOR_ROLES.includes(viewer.role)) throw new BirthdayError('Only the Owner or Head of School can review wishes.', 403)
  await ensureBirthdayTables(db)
  const rows = ((await db.prepare(`SELECT w.id, w.message, w.sender_name, w.sender_role, w.created_at, c.name AS recipient, c.id AS celebration_id,
      (SELECT reason FROM birthday_reports r WHERE r.school_id = w.school_id AND r.wish_id = w.id ORDER BY created_at DESC LIMIT 1) AS report_reason
    FROM birthday_wishes w JOIN birthday_celebrations c ON c.school_id = w.school_id AND c.id = w.celebration_id
    WHERE w.school_id = ? AND w.state = 'pending' ORDER BY w.created_at ASC LIMIT 100`).bind(viewer.schoolId).all()).results || []) as Record<string, any>[]
  return rows.map(row => ({ id: row.id, message: row.message, senderName: row.sender_name, senderRole: row.sender_role, recipient: row.recipient, celebrationId: row.celebration_id, reportReason: row.report_reason || '', createdAt: row.created_at }))
}

export async function decideWish(db: D1Database, viewer: Viewer, wishId: string, decision: unknown) {
  if (!MODERATOR_ROLES.includes(viewer.role)) throw new BirthdayError('Only the Owner or Head of School can review wishes.', 403)
  if (!['approve', 'reject'].includes(String(decision))) throw new BirthdayError('Choose approve or reject.')
  const state = decision === 'approve' ? 'approved' : 'rejected'
  const result = await db.prepare(`UPDATE birthday_wishes SET state = ?, decided_by = ?, decided_at = ? WHERE school_id = ? AND id = ? AND state = 'pending'`).bind(state, viewer.name, nowIso(), viewer.schoolId, wishId).run()
  if (!Number(result.meta?.changes)) throw new BirthdayError('Wish not found.', 404)
  await audit(db, viewer.schoolId, viewer.name, `wish_${state}`, { wishId })
  return { status: state }
}

export function suggestion(style: unknown, allowed: string[], seed: number) {
  const key = allowed.includes(String(style)) ? String(style) : 'cheerful'
  const list = SUGGESTIONS[key] || SUGGESTIONS.cheerful
  return list[Math.floor(seededRandom(seed)() * list.length)]
}

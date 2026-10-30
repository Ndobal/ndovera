// Competitions shared by link. A school (Owner/HoS) or Ndovera (Ami) writes up a competition —
// details, rules, prizes, dates, fliers and an entry form — and, while it is active, makes a
// link to send to people. The page is not listed or searchable: only someone holding the link
// sees it. Making a new link kills the old one; closing the competition stops new entries.

export class CompetitionError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export type FormField = { key: string, label: string, type: 'text' | 'number' | 'choice' | 'long', required: boolean, options?: string[] }

// Asked on every entry form; the school chooses which of the optional ones to show.
export const STANDARD_FIELDS: FormField[] = [
  { key: 'fullName', label: 'Full name', type: 'text', required: true },
  { key: 'phone', label: 'Phone number', type: 'text', required: false },
  { key: 'email', label: 'Email address', type: 'text', required: false },
  { key: 'school', label: 'School', type: 'text', required: false },
  { key: 'classOrAge', label: 'Class or age', type: 'text', required: false },
]

const STATUSES = ['draft', 'active', 'closed']
const clean = (value: unknown, max: number) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max)

export async function ensureCompetitionLinkTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS link_competitions (id TEXT PRIMARY KEY, owner_scope TEXT NOT NULL, host_name TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, details TEXT, rules TEXT, prizes TEXT, venue TEXT, starts_at TEXT, ends_at TEXT, entries_close_at TEXT, fliers_json TEXT NOT NULL DEFAULT '[]', fields_json TEXT NOT NULL DEFAULT '[]', max_entries INTEGER, status TEXT NOT NULL DEFAULT 'draft', link_token TEXT UNIQUE, link_made_at TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_link_competitions_scope ON link_competitions (owner_scope, updated_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_competition_entries (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT, email TEXT, answers_json TEXT NOT NULL, client_key TEXT, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_link_competition_entries ON link_competition_entries (competition_id, created_at)`),
  ])
}

function normalizeFields(raw: unknown, standardShown: unknown): FormField[] {
  const shown = new Set(Array.isArray(standardShown) ? standardShown.map(String) : STANDARD_FIELDS.map(field => field.key))
  const standard = STANDARD_FIELDS.filter(field => field.key === 'fullName' || shown.has(field.key))
    .map(field => ({ ...field, required: field.key === 'fullName' ? true : Boolean((Array.isArray(raw) ? raw : []).find((item: any) => item?.key === field.key)?.required) }))
  const custom = (Array.isArray(raw) ? raw : [])
    .filter((item: any) => item && typeof item === 'object' && !STANDARD_FIELDS.some(field => field.key === item.key))
    .slice(0, 15)
    .map((item: any, index: number) => {
      const type = ['text', 'number', 'choice', 'long'].includes(item.type) ? item.type : 'text'
      const options = type === 'choice' ? [...new Set((Array.isArray(item.options) ? item.options : String(item.options || '').split(/\n|,/)).map((option: unknown) => clean(option, 80)).filter(Boolean))].slice(0, 20) as string[] : undefined
      return { key: `q${index + 1}`, label: clean(item.label, 160), type, required: Boolean(item.required), ...(options ? { options } : {}) } as FormField
    })
    .filter(field => field.label && (field.type !== 'choice' || field.options?.length))
  return [...standard, ...custom]
}

function normalizeFliers(raw: unknown) {
  return (Array.isArray(raw) ? raw : []).map(url => clean(url, 500))
    .filter(url => /^https:\/\/(ndovera\.com|[a-z0-9-]+\.ndovera\.com)\/files\//i.test(url)).slice(0, 6)
}

const isoOrNull = (value: unknown) => {
  const text = clean(value, 40)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function rowToCompetition(row: any, { forPublic = false } = {}) {
  if (!row) return null
  const base = {
    title: row.title, hostName: row.host_name, summary: row.summary || '', details: row.details || '', rules: row.rules || '', prizes: row.prizes || '',
    venue: row.venue || '', startsAt: row.starts_at, endsAt: row.ends_at, entriesCloseAt: row.entries_close_at,
    fliers: JSON.parse(row.fliers_json || '[]'), fields: JSON.parse(row.fields_json || '[]'), status: row.status,
  }
  if (forPublic) return base
  return { ...base, id: row.id, maxEntries: row.max_entries, linkToken: row.link_token, linkMadeAt: row.link_made_at, createdAt: row.created_at, updatedAt: row.updated_at, entries: Number(row.entries || 0) }
}

export async function listCompetitions(db: D1Database, scope: string) {
  await ensureCompetitionLinkTables(db)
  const rows = ((await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM link_competition_entries e WHERE e.competition_id = c.id) AS entries FROM link_competitions c WHERE owner_scope = ? ORDER BY updated_at DESC LIMIT 100`).bind(scope).all()).results || [])
  return rows.map(row => rowToCompetition(row))
}

async function ownRow(db: D1Database, scope: string, id: string) {
  const row = await db.prepare(`SELECT * FROM link_competitions WHERE id = ? AND owner_scope = ?`).bind(id, scope).first()
  if (!row) throw new CompetitionError('Competition not found.', 404)
  return row as any
}

/** Create or update (with `id`). */
export async function saveCompetition(db: D1Database, scope: string, hostName: string, actor: string, input: Record<string, any>) {
  await ensureCompetitionLinkTables(db)
  const title = clean(input.title, 160)
  if (!title) throw new CompetitionError('Give the competition a title.')
  const fields = normalizeFields(input.fields, input.standardFields)
  const maxEntries = Number(input.maxEntries) > 0 ? Math.min(100000, Math.round(Number(input.maxEntries))) : null
  const at = new Date().toISOString()
  const values = [title, clean(input.summary, 400), clean(input.details, 8000), clean(input.rules, 6000), clean(input.prizes, 3000), clean(input.venue, 300),
    isoOrNull(input.startsAt), isoOrNull(input.endsAt), isoOrNull(input.entriesCloseAt), JSON.stringify(normalizeFliers(input.fliers)), JSON.stringify(fields), maxEntries]
  if (input.id) {
    await ownRow(db, scope, String(input.id))
    await db.prepare(`UPDATE link_competitions SET title = ?, summary = ?, details = ?, rules = ?, prizes = ?, venue = ?, starts_at = ?, ends_at = ?, entries_close_at = ?, fliers_json = ?, fields_json = ?, max_entries = ?, host_name = ?, updated_at = ? WHERE id = ? AND owner_scope = ?`)
      .bind(...values, hostName, at, String(input.id), scope).run()
    return String(input.id)
  }
  const id = crypto.randomUUID()
  await db.prepare(`INSERT INTO link_competitions (id, owner_scope, host_name, title, summary, details, rules, prizes, venue, starts_at, ends_at, entries_close_at, fliers_json, fields_json, max_entries, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`)
    .bind(id, scope, hostName, ...values, actor, at, at).run()
  return id
}

export async function setCompetitionStatus(db: D1Database, scope: string, id: string, status: string) {
  if (!STATUSES.includes(status)) throw new CompetitionError('Choose draft, active or closed.')
  await ensureCompetitionLinkTables(db)
  await ownRow(db, scope, id)
  await db.prepare(`UPDATE link_competitions SET status = ?, updated_at = ? WHERE id = ? AND owner_scope = ?`).bind(status, new Date().toISOString(), id, scope).run()
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A link only for an active competition. A new link replaces (kills) the old one. */
export async function makeLink(db: D1Database, scope: string, id: string) {
  await ensureCompetitionLinkTables(db)
  const row = await ownRow(db, scope, id)
  if (row.status !== 'active') throw new CompetitionError('Make the competition active first, then make its link.', 409)
  const token = newToken()
  await db.prepare(`UPDATE link_competitions SET link_token = ?, link_made_at = ?, updated_at = ? WHERE id = ? AND owner_scope = ?`).bind(token, new Date().toISOString(), new Date().toISOString(), id, scope).run()
  return token
}

export async function turnOffLink(db: D1Database, scope: string, id: string) {
  await ensureCompetitionLinkTables(db)
  await ownRow(db, scope, id)
  await db.prepare(`UPDATE link_competitions SET link_token = NULL, updated_at = ? WHERE id = ? AND owner_scope = ?`).bind(new Date().toISOString(), id, scope).run()
}

async function byToken(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null
  await ensureCompetitionLinkTables(db)
  return await db.prepare(`SELECT * FROM link_competitions WHERE link_token = ?`).bind(token).first() as any
}

function entriesOpen(row: any, now = new Date()) {
  if (row.status !== 'active') return { open: false, reason: row.status === 'closed' ? 'Entries for this competition have closed.' : 'This competition is not open yet.' }
  if (row.entries_close_at && new Date(row.entries_close_at) < now) return { open: false, reason: 'Entries for this competition have closed.' }
  return { open: true, reason: '' }
}

/** What someone holding the link sees. A draft or a dead link shows nothing. */
export async function publicCompetition(db: D1Database, token: string) {
  const row = await byToken(db, token)
  if (!row || row.status === 'draft') throw new CompetitionError('This link is not valid. Ask the organiser for the current link.', 404)
  const state = entriesOpen(row)
  return { competition: rowToCompetition(row, { forPublic: true }), entriesOpen: state.open, closedReason: state.reason }
}

export async function submitEntry(db: D1Database, token: string, input: Record<string, any>, clientKey: string) {
  const row = await byToken(db, token)
  if (!row || row.status === 'draft') throw new CompetitionError('This link is not valid. Ask the organiser for the current link.', 404)
  const state = entriesOpen(row)
  if (!state.open) throw new CompetitionError(state.reason, 409)
  // A hidden field people never see: filled in only by spam robots.
  if (clean(input.website, 200)) return { id: 'ok' }
  const fields: FormField[] = JSON.parse(row.fields_json || '[]')
  const answers: Record<string, string> = {}
  for (const field of fields) {
    const value = clean(input.answers?.[field.key], field.type === 'long' ? 3000 : 300)
    if (field.required && !value) throw new CompetitionError(`Please fill in: ${field.label}.`)
    if (value && field.type === 'number' && !/^-?\d+(\.\d+)?$/.test(value)) throw new CompetitionError(`${field.label} should be a number.`)
    if (value && field.type === 'choice' && !(field.options || []).includes(value)) throw new CompetitionError(`Choose one of the options for: ${field.label}.`)
    if (value && field.key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new CompetitionError('Enter a valid email address.')
    if (value) answers[field.key] = value
  }
  const since = new Date(Date.now() - 3600_000).toISOString()
  const [count, recent, duplicate] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM link_competition_entries WHERE competition_id = ?`).bind(row.id),
    db.prepare(`SELECT COUNT(*) AS n FROM link_competition_entries WHERE competition_id = ? AND client_key = ? AND created_at >= ?`).bind(row.id, clientKey, since),
    db.prepare(`SELECT 1 AS found FROM link_competition_entries WHERE competition_id = ? AND ((? <> '' AND phone = ?) OR (? <> '' AND lower(email) = lower(?))) LIMIT 1`).bind(row.id, answers.phone || '', answers.phone || '', answers.email || '', answers.email || ''),
  ])
  if (row.max_entries && Number((count.results as any[])?.[0]?.n || 0) >= Number(row.max_entries)) throw new CompetitionError('This competition has reached the most entries it can take.', 409)
  if (Number((recent.results as any[])?.[0]?.n || 0) >= 10) throw new CompetitionError('Too many entries from this device in the last hour. Please try again later.', 429)
  if ((duplicate.results || []).length) throw new CompetitionError('An entry with this phone number or email is already in.', 409)
  const id = crypto.randomUUID()
  await db.prepare(`INSERT INTO link_competition_entries (id, competition_id, full_name, phone, email, answers_json, client_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, row.id, answers.fullName, answers.phone || null, answers.email || null, JSON.stringify(answers), clientKey, new Date().toISOString()).run()
  return { id }
}

export async function listEntries(db: D1Database, scope: string, id: string) {
  await ensureCompetitionLinkTables(db)
  const row = await ownRow(db, scope, id)
  const entries = ((await db.prepare(`SELECT id, full_name, phone, email, answers_json, created_at FROM link_competition_entries WHERE competition_id = ? ORDER BY created_at DESC LIMIT 5000`).bind(id).all()).results || []) as any[]
  return { competition: rowToCompetition(row), entries: entries.map(entry => ({ id: entry.id, fullName: entry.full_name, phone: entry.phone, email: entry.email, answers: JSON.parse(entry.answers_json || '{}'), createdAt: entry.created_at })) }
}

export function entriesCsv(fields: FormField[], entries: Array<{ answers: Record<string, string>, createdAt: string }>) {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [[...fields.map(field => field.label), 'Entered at'].map(cell).join(','), ...entries.map(entry => [...fields.map(field => entry.answers[field.key] || ''), entry.createdAt].map(cell).join(','))].join('\n')
}

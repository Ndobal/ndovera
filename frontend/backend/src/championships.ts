// NDOVERA Championship Engine.
//
// One configurable engine drives every competition — Spelling Bee, Mathematics, Essay,
// Debate, Young Innovators — rather than a hard-coded module per competition. Ami creates a
// championship, picks a category, sets eligibility, builds the stage sequence, and publishes.
// Nothing here is specific to any one competition.
//
// This file holds the schema, the pure logic (eligibility, stages, slugs) and the data
// access. Routes are registered in index.ts, matching how results/newsroom/questionBank work.

const CHAMPIONSHIPS_DDL = `CREATE TABLE IF NOT EXISTS championships (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  subject TEXT,
  summary TEXT,
  description TEXT,
  rules TEXT,
  terms TEXT,
  logo_url TEXT,
  cover_url TEXT,
  flyer_url TEXT,
  scope TEXT,
  mode TEXT,
  min_age INTEGER,
  max_age INTEGER,
  age_as_of TEXT,
  class_levels TEXT,
  eligible_tenant_ids TEXT,
  geo_states TEXT,
  allow_independent INTEGER DEFAULT 1,
  allow_school_students INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 0,
  registration_opens_at TEXT,
  registration_closes_at TEXT,
  competition_date TEXT,
  competition_time TEXT,
  timezone TEXT,
  registration_fee REAL DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  prize_structure TEXT,
  scholarship_note TEXT,
  sponsor_name TEXT,
  sponsor_logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'draft',
  promo_enabled INTEGER DEFAULT 1,
  published_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)`

const CHAMPIONSHIP_STAGES_DDL = `CREATE TABLE IF NOT EXISTS championship_stages (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  kind TEXT,
  starts_at TEXT,
  ends_at TEXT,
  instructions TEXT,
  is_public INTEGER DEFAULT 1,
  created_at TEXT
)`

const CHAMPIONSHIP_REGISTRATIONS_DDL = `CREATE TABLE IF NOT EXISTS championship_registrations (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  registration_code TEXT,
  participant_type TEXT,
  user_id TEXT,
  tenant_id TEXT,
  participant_name TEXT,
  date_of_birth TEXT,
  class_level TEXT,
  school_name TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  registered_by TEXT,
  status TEXT DEFAULT 'confirmed',
  payment_reference TEXT,
  amount_paid REAL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)`

// Ami picks a category when creating a championship. The list is data, not code paths — a new
// category needs no developer involvement beyond adding a label here, and "Other" already
// lets Ami name anything.
export const CHAMPIONSHIP_CATEGORIES = [
  'Mathematics', 'Science', 'English', 'Spelling Bee', 'General Knowledge',
  'ICT & Digital Skills', 'Coding & Robotics', 'STEM', 'Reading', 'Creative Writing',
  'Essay', 'Debate', 'Public Speaking', 'Poetry Recitation', 'Storytelling',
  'Quiz', 'Current Affairs', 'Art & Drawing', 'Music', 'Instrumental Performance',
  'Cultural Presentation', 'Young Innovators', 'Entrepreneurship', 'Other',
]

export const CHAMPIONSHIP_SCOPES = ['inter_school', 'school_only', 'regional', 'national', 'independent']
export const CHAMPIONSHIP_MODES = ['online', 'physical', 'hybrid']
export const CHAMPIONSHIP_STATUSES = ['draft', 'published', 'live', 'completed', 'archived']

export const STAGE_KINDS = [
  'registration', 'screening', 'qualifier', 'preliminary', 'round', 'quarter_final',
  'semi_final', 'final', 'physical_round', 'interview', 'presentation', 'judging',
  'winner_selection', 'awards',
]

const _championshipTablesReady = { done: false }

export async function ensureChampionshipTables(db: D1Database) {
  if (_championshipTablesReady.done) return
  // Mark ready only after every statement succeeds, so a partial failure does not leave the
  // isolate believing the tables exist.
  await db.prepare(CHAMPIONSHIPS_DDL).run()
  await db.prepare(CHAMPIONSHIP_STAGES_DDL).run()
  await db.prepare(CHAMPIONSHIP_REGISTRATIONS_DDL).run()
  // Added after the first release: the scoring rubric a judged championship uses. Kept as an
  // ALTER so existing databases pick it up without a migration step.
  try { await db.exec('ALTER TABLE championships ADD COLUMN judging_criteria TEXT') } catch { /* already present */ }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_championship_stages_parent ON championship_stages (championship_id, position)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_championship_regs_parent ON championship_registrations (championship_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_championship_regs_user ON championship_registrations (user_id)`).run()
  _championshipTablesReady.done = true
}

function text(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max)
}

function intOrZero(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function numberOrZero(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function bool(value: unknown, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback
  return value === true || value === 1 || value === '1' || value === 'true'
}

function jsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => text(item, 120)).filter(Boolean)
  const raw = text(value, 4000)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(item => text(item, 120)).filter(Boolean)
  } catch {
    return raw.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

export function slugifyChampionship(name: string, existingSuffix = '') {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'championship'
  return existingSuffix ? `${base}-${existingSuffix}` : base
}

// Age on a specific date, which is how competition eligibility is actually written
// ("aged 10-13 as of 31 August 2026") — not age today.
export function computeAgeAt(dateOfBirth: string, asOf: string) {
  const dob = new Date(`${String(dateOfBirth || '').slice(0, 10)}T00:00:00Z`)
  const at = asOf ? new Date(`${String(asOf).slice(0, 10)}T00:00:00Z`) : new Date()
  if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null
  let age = at.getUTCFullYear() - dob.getUTCFullYear()
  const monthDelta = at.getUTCMonth() - dob.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < dob.getUTCDate())) age -= 1
  return age
}

export function mapChampionshipRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    subject: String(row.subject || ''),
    summary: String(row.summary || ''),
    description: String(row.description || ''),
    rules: String(row.rules || ''),
    terms: String(row.terms || ''),
    logoUrl: String(row.logo_url || ''),
    coverUrl: String(row.cover_url || ''),
    flyerUrl: String(row.flyer_url || ''),
    scope: String(row.scope || 'inter_school'),
    mode: String(row.mode || 'online'),
    minAge: row.min_age === null || row.min_age === undefined ? null : Number(row.min_age),
    maxAge: row.max_age === null || row.max_age === undefined ? null : Number(row.max_age),
    ageAsOf: String(row.age_as_of || ''),
    classLevels: jsonList(row.class_levels),
    eligibleTenantIds: jsonList(row.eligible_tenant_ids),
    geoStates: jsonList(row.geo_states),
    allowIndependent: bool(row.allow_independent),
    allowSchoolStudents: bool(row.allow_school_students),
    maxParticipants: intOrZero(row.max_participants),
    registrationOpensAt: String(row.registration_opens_at || ''),
    registrationClosesAt: String(row.registration_closes_at || ''),
    competitionDate: String(row.competition_date || ''),
    competitionTime: String(row.competition_time || ''),
    timezone: String(row.timezone || 'Africa/Lagos'),
    registrationFee: numberOrZero(row.registration_fee),
    currency: String(row.currency || 'NGN'),
    prizeStructure: String(row.prize_structure || ''),
    scholarshipNote: String(row.scholarship_note || ''),
    sponsorName: String(row.sponsor_name || ''),
    sponsorLogoUrl: String(row.sponsor_logo_url || ''),
    contactEmail: String(row.contact_email || ''),
    contactPhone: String(row.contact_phone || ''),
    status: String(row.status || 'draft'),
    promoEnabled: bool(row.promo_enabled),
    // Empty means "use the default rubric" — normalizeEssayCriteria applies it.
    judgingCriteria: (() => {
      try { return row.judging_criteria ? JSON.parse(String(row.judging_criteria)) : [] } catch { return [] }
    })(),
    publishedAt: String(row.published_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapStageRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    position: intOrZero(row.position),
    name: String(row.name || ''),
    kind: String(row.kind || 'round'),
    startsAt: String(row.starts_at || ''),
    endsAt: String(row.ends_at || ''),
    instructions: String(row.instructions || ''),
    isPublic: bool(row.is_public),
  }
}

export function mapRegistrationRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    registrationCode: String(row.registration_code || ''),
    participantType: String(row.participant_type || 'student'),
    userId: String(row.user_id || ''),
    tenantId: String(row.tenant_id || ''),
    participantName: String(row.participant_name || ''),
    dateOfBirth: String(row.date_of_birth || ''),
    classLevel: String(row.class_level || ''),
    schoolName: String(row.school_name || ''),
    guardianName: String(row.guardian_name || ''),
    guardianPhone: String(row.guardian_phone || ''),
    guardianEmail: String(row.guardian_email || ''),
    contactEmail: String(row.contact_email || ''),
    contactPhone: String(row.contact_phone || ''),
    location: String(row.location || ''),
    status: String(row.status || 'confirmed'),
    paymentReference: String(row.payment_reference || ''),
    amountPaid: numberOrZero(row.amount_paid),
    createdAt: String(row.created_at || ''),
  }
}

export function normalizeChampionshipPayload(payload: Record<string, any>, existing: Record<string, any> | null) {
  const name = text(payload.name, 160) || String(existing?.name || '')
  const status = CHAMPIONSHIP_STATUSES.includes(text(payload.status, 20))
    ? text(payload.status, 20)
    : String(existing?.status || 'draft')

  return {
    name,
    category: text(payload.category, 80),
    subject: text(payload.subject, 80),
    summary: text(payload.summary, 400),
    description: text(payload.description, 8000),
    rules: text(payload.rules, 12000),
    terms: text(payload.terms, 12000),
    logoUrl: text(payload.logoUrl, 500),
    coverUrl: text(payload.coverUrl, 500),
    flyerUrl: text(payload.flyerUrl, 500),
    scope: CHAMPIONSHIP_SCOPES.includes(text(payload.scope, 40)) ? text(payload.scope, 40) : 'inter_school',
    mode: CHAMPIONSHIP_MODES.includes(text(payload.mode, 20)) ? text(payload.mode, 20) : 'online',
    minAge: payload.minAge === '' || payload.minAge === null || payload.minAge === undefined ? null : intOrZero(payload.minAge),
    maxAge: payload.maxAge === '' || payload.maxAge === null || payload.maxAge === undefined ? null : intOrZero(payload.maxAge),
    ageAsOf: text(payload.ageAsOf, 10),
    classLevels: jsonList(payload.classLevels),
    eligibleTenantIds: jsonList(payload.eligibleTenantIds),
    geoStates: jsonList(payload.geoStates),
    allowIndependent: bool(payload.allowIndependent, true),
    allowSchoolStudents: bool(payload.allowSchoolStudents, true),
    maxParticipants: intOrZero(payload.maxParticipants),
    registrationOpensAt: text(payload.registrationOpensAt, 30),
    registrationClosesAt: text(payload.registrationClosesAt, 30),
    competitionDate: text(payload.competitionDate, 30),
    competitionTime: text(payload.competitionTime, 20),
    timezone: text(payload.timezone, 60) || 'Africa/Lagos',
    registrationFee: numberOrZero(payload.registrationFee),
    currency: text(payload.currency, 8) || 'NGN',
    prizeStructure: text(payload.prizeStructure, 4000),
    scholarshipNote: text(payload.scholarshipNote, 4000),
    sponsorName: text(payload.sponsorName, 160),
    sponsorLogoUrl: text(payload.sponsorLogoUrl, 500),
    contactEmail: text(payload.contactEmail, 160),
    contactPhone: text(payload.contactPhone, 60),
    status,
    promoEnabled: bool(payload.promoEnabled, true),
    // Scoring rubric for judged championships. Only well-formed criteria are stored; anything
    // else falls back to the default rubric at review time rather than being half-saved.
    judgingCriteria: (() => {
      const source = Array.isArray(payload.judgingCriteria)
        ? payload.judgingCriteria
        : (existing?.judging_criteria ? (() => {
          try { return JSON.parse(String(existing.judging_criteria)) } catch { return [] }
        })() : [])
      if (!Array.isArray(source)) return []
      return source
        .map((item: any) => ({
          key: text(item?.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          label: text(item?.label, 60) || text(item?.key, 60),
          max: Math.max(1, Math.min(100, Number(item?.max) || 0)),
        }))
        .filter((item: any) => item.key && item.max > 0)
        .slice(0, 12)
    })(),
  }
}

export async function saveChampionship(
  db: D1Database,
  payload: Record<string, any>,
  actorId: string,
) {
  await ensureChampionshipTables(db)
  const now = new Date().toISOString()
  const id = text(payload.id, 80)

  const existing = id
    ? (await db.prepare(`SELECT * FROM championships WHERE id = ?`).bind(id).first()) as Record<string, any> | null
    : null

  const clean = normalizeChampionshipPayload(payload, existing)
  if (!clean.name) throw new Error('Championship name is required.')

  const championshipId = id || `champ_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  // Keep an existing slug stable so published links never break when Ami edits the name.
  let slug = String(existing?.slug || '')
  if (!slug) {
    slug = slugifyChampionship(clean.name)
    const clash = await db.prepare(`SELECT id FROM championships WHERE slug = ?`).bind(slug).first()
    if (clash) slug = slugifyChampionship(clean.name, String(Date.now()).slice(-5))
  }

  await db.prepare(
    `INSERT OR REPLACE INTO championships (
      id, slug, name, category, subject, summary, description, rules, terms,
      logo_url, cover_url, flyer_url, scope, mode,
      min_age, max_age, age_as_of, class_levels, eligible_tenant_ids, geo_states,
      allow_independent, allow_school_students, max_participants,
      registration_opens_at, registration_closes_at, competition_date, competition_time, timezone,
      registration_fee, currency, prize_structure, scholarship_note,
      sponsor_name, sponsor_logo_url, contact_email, contact_phone,
      status, promo_enabled, judging_criteria, published_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    championshipId, slug, clean.name, clean.category, clean.subject, clean.summary,
    clean.description, clean.rules, clean.terms,
    clean.logoUrl, clean.coverUrl, clean.flyerUrl, clean.scope, clean.mode,
    clean.minAge, clean.maxAge, clean.ageAsOf,
    JSON.stringify(clean.classLevels), JSON.stringify(clean.eligibleTenantIds), JSON.stringify(clean.geoStates),
    clean.allowIndependent ? 1 : 0, clean.allowSchoolStudents ? 1 : 0, clean.maxParticipants,
    clean.registrationOpensAt, clean.registrationClosesAt, clean.competitionDate, clean.competitionTime, clean.timezone,
    clean.registrationFee, clean.currency, clean.prizeStructure, clean.scholarshipNote,
    clean.sponsorName, clean.sponsorLogoUrl, clean.contactEmail, clean.contactPhone,
    clean.status, clean.promoEnabled ? 1 : 0, JSON.stringify(clean.judgingCriteria || []),
    String(existing?.published_at || ''), String(existing?.created_by || actorId),
    String(existing?.created_at || now), now,
  ).run()

  return getChampionshipById(db, championshipId)
}

export async function getChampionshipById(db: D1Database, id: string) {
  await ensureChampionshipTables(db)
  const row = await db.prepare(`SELECT * FROM championships WHERE id = ?`).bind(id).first() as Record<string, any> | null
  return row ? mapChampionshipRow(row) : null
}

export async function getChampionshipBySlug(db: D1Database, slug: string) {
  await ensureChampionshipTables(db)
  const row = await db.prepare(`SELECT * FROM championships WHERE slug = ?`).bind(slug).first() as Record<string, any> | null
  return row ? mapChampionshipRow(row) : null
}

export async function setChampionshipStatus(db: D1Database, id: string, status: string) {
  await ensureChampionshipTables(db)
  if (!CHAMPIONSHIP_STATUSES.includes(status)) throw new Error('Unknown championship status.')
  const now = new Date().toISOString()
  const existing = await db.prepare(`SELECT published_at FROM championships WHERE id = ?`).bind(id).first() as Record<string, any> | null
  // First publish stamps published_at; re-publishing later keeps the original date so the
  // "new championship" promo window is not reopened by an unrelated edit.
  const publishedAt = status === 'published' ? (String(existing?.published_at || '') || now) : String(existing?.published_at || '')
  await db.prepare(`UPDATE championships SET status = ?, published_at = ?, updated_at = ? WHERE id = ?`)
    .bind(status, publishedAt, now, id).run()
  return getChampionshipById(db, id)
}

export async function listChampionships(db: D1Database, options: Record<string, any> = {}) {
  await ensureChampionshipTables(db)
  const clauses: string[] = []
  const binds: any[] = []

  if (options.statuses?.length) {
    clauses.push(`status IN (${options.statuses.map(() => '?').join(', ')})`)
    binds.push(...options.statuses)
  }
  if (options.category) { clauses.push('category = ?'); binds.push(options.category) }
  if (options.mode) { clauses.push('mode = ?'); binds.push(options.mode) }
  if (options.scope) { clauses.push('scope = ?'); binds.push(options.scope) }
  if (options.freeOnly) clauses.push('(registration_fee IS NULL OR registration_fee <= 0)')

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await db.prepare(
    `SELECT * FROM championships ${where} ORDER BY COALESCE(competition_date, '9999') ASC, created_at DESC LIMIT 200`
  ).bind(...binds).all()

  return (((rows as any).results || []) as Record<string, any>[]).map(mapChampionshipRow)
}

export async function listStages(db: D1Database, championshipId: string) {
  await ensureChampionshipTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_stages WHERE championship_id = ? ORDER BY position ASC`
  ).bind(championshipId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapStageRow)
}

// Stages are saved as a complete ordered set: the visual builder sends the whole sequence, so
// replacing it wholesale keeps positions contiguous and avoids orphaned rows after a reorder.
export async function replaceStages(db: D1Database, championshipId: string, stages: any[]) {
  await ensureChampionshipTables(db)
  const now = new Date().toISOString()
  await db.prepare(`DELETE FROM championship_stages WHERE championship_id = ?`).bind(championshipId).run()

  const clean = (Array.isArray(stages) ? stages : [])
    .map((stage, index) => ({
      name: text(stage?.name, 120),
      kind: STAGE_KINDS.includes(text(stage?.kind, 40)) ? text(stage?.kind, 40) : 'round',
      startsAt: text(stage?.startsAt, 30),
      endsAt: text(stage?.endsAt, 30),
      instructions: text(stage?.instructions, 4000),
      isPublic: bool(stage?.isPublic, true),
      position: index,
    }))
    .filter(stage => stage.name)

  for (const stage of clean) {
    await db.prepare(
      `INSERT INTO championship_stages (id, championship_id, position, name, kind, starts_at, ends_at, instructions, is_public, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `stage_${championshipId}_${stage.position}_${Math.random().toString(36).slice(2, 6)}`,
      championshipId, stage.position, stage.name, stage.kind,
      stage.startsAt, stage.endsAt, stage.instructions, stage.isPublic ? 1 : 0, now,
    ).run()
  }

  return listStages(db, championshipId)
}

export async function countConfirmedRegistrations(db: D1Database, championshipId: string) {
  await ensureChampionshipTables(db)
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM championship_registrations WHERE championship_id = ? AND status IN ('confirmed', 'pending_payment')`
  ).bind(championshipId).first() as Record<string, any> | null
  return intOrZero(row?.n)
}

export async function findRegistration(db: D1Database, championshipId: string, userId: string) {
  await ensureChampionshipTables(db)
  if (!userId) return null
  const row = await db.prepare(
    `SELECT * FROM championship_registrations WHERE championship_id = ? AND user_id = ?`
  ).bind(championshipId, userId).first() as Record<string, any> | null
  return row ? mapRegistrationRow(row) : null
}

export async function listRegistrationsForChampionship(db: D1Database, championshipId: string) {
  await ensureChampionshipTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_registrations WHERE championship_id = ? ORDER BY created_at DESC LIMIT 1000`
  ).bind(championshipId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapRegistrationRow)
}

export async function listRegistrationsForUser(db: D1Database, userId: string) {
  await ensureChampionshipTables(db)
  if (!userId) return []
  const rows = await db.prepare(
    `SELECT * FROM championship_registrations WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(userId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapRegistrationRow)
}

/**
 * The eligibility engine. Returns every reason a participant cannot enter rather than the
 * first, so a parent fixes everything in one pass instead of resubmitting repeatedly.
 *
 * `needsDateOfBirth` is separated from the ordinary blocking reasons because it is fixable by
 * completing a profile, which is a different call to action from "your class is not eligible".
 */
// Every registration a school's students hold, newest first. Powers the school Championship
// Centre (championship.md section 36), which needs to see its own entries across every
// competition without reading other schools' rows.
export async function listRegistrationsForTenant(db: D1Database, tenantId: string, championshipId = '') {
  await ensureChampionshipTables(db)
  const normalizedTenantId = String(tenantId || '').trim()
  if (!normalizedTenantId) return []

  const rows = championshipId
    ? await db.prepare(
      `SELECT * FROM championship_registrations WHERE tenant_id = ? AND championship_id = ? ORDER BY created_at DESC`
    ).bind(normalizedTenantId, championshipId).all()
    : await db.prepare(
      `SELECT * FROM championship_registrations WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(normalizedTenantId).all()

  return (((rows as any).results || []) as Record<string, any>[]).map(mapRegistrationRow)
}

// How many of a school's students are entered in each championship, as one grouped query
// rather than a count per championship.
export async function countTenantRegistrationsByChampionship(db: D1Database, tenantId: string) {
  await ensureChampionshipTables(db)
  const counts = new Map<string, { total: number; confirmed: number; pendingPayment: number }>()
  const normalizedTenantId = String(tenantId || '').trim()
  if (!normalizedTenantId) return counts

  const rows = await db.prepare(
    `SELECT championship_id, status, COUNT(*) AS n
       FROM championship_registrations
      WHERE tenant_id = ?
      GROUP BY championship_id, status`
  ).bind(normalizedTenantId).all()

  for (const row of (((rows as any).results || []) as Record<string, any>[])) {
    const key = String(row.championship_id || '')
    const entry = counts.get(key) || { total: 0, confirmed: 0, pendingPayment: 0 }
    const n = intOrZero(row.n)
    entry.total += n
    if (String(row.status || '') === 'confirmed') entry.confirmed += n
    if (String(row.status || '') === 'pending_payment') entry.pendingPayment += n
    counts.set(key, entry)
  }

  return counts
}

// Registrations for a specific set of participants in one championship, keyed by user id, so a
// roster screen can show "already entered" without a query per student.
export async function findRegistrationsByUserIds(db: D1Database, championshipId: string, userIds: string[]) {
  await ensureChampionshipTables(db)
  const found = new Map<string, ReturnType<typeof mapRegistrationRow>>()
  const ids = Array.from(new Set((userIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (!championshipId || ids.length === 0) return found

  // Chunked to stay well inside SQLite's bound-variable limit on large rosters.
  const chunkSize = 100
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const placeholders = chunk.map(() => '?').join(', ')
    const rows = await db.prepare(
      `SELECT * FROM championship_registrations
        WHERE championship_id = ? AND user_id IN (${placeholders})`
    ).bind(championshipId, ...chunk).all()

    for (const row of (((rows as any).results || []) as Record<string, any>[])) {
      const mapped = mapRegistrationRow(row)
      if (mapped.userId) found.set(mapped.userId, mapped)
    }
  }

  return found
}

// A championship is offerable to a school when it is open and either unrestricted or has that
// school on its participating list.
export function championshipAcceptsTenant(
  championship: ReturnType<typeof mapChampionshipRow>,
  tenantId: string,
) {
  if (!championship.allowSchoolStudents) return false
  if (championship.eligibleTenantIds.length === 0) return true
  return championship.eligibleTenantIds.includes(String(tenantId || '').trim())
}

export function evaluateEligibility(
  championship: ReturnType<typeof mapChampionshipRow>,
  participant: {
    participantType?: string
    dateOfBirth?: string
    classLevel?: string
    tenantId?: string
    state?: string
  },
  context: { confirmedCount?: number; now?: Date } = {},
) {
  const reasons: string[] = []
  const now = context.now || new Date()
  const participantType = participant.participantType === 'independent' ? 'independent' : 'student'

  if (championship.status !== 'published' && championship.status !== 'live') {
    reasons.push('This championship is not open for registration yet.')
  }

  const opens = championship.registrationOpensAt ? new Date(championship.registrationOpensAt) : null
  const closes = championship.registrationClosesAt ? new Date(championship.registrationClosesAt) : null
  if (opens && !Number.isNaN(opens.getTime()) && now < opens) {
    reasons.push(`Registration opens on ${championship.registrationOpensAt.slice(0, 10)}.`)
  }
  if (closes && !Number.isNaN(closes.getTime()) && now > closes) {
    reasons.push('Registration has closed for this championship.')
  }

  if (participantType === 'independent' && !championship.allowIndependent) {
    reasons.push('This championship is only open to students of NDOVERA schools.')
  }
  if (participantType === 'student' && !championship.allowSchoolStudents) {
    reasons.push('This championship is only open to independent participants.')
  }

  if (championship.eligibleTenantIds.length && participantType === 'student') {
    if (!participant.tenantId || !championship.eligibleTenantIds.includes(participant.tenantId)) {
      reasons.push('Your school is not on the list of participating schools.')
    }
  }

  if (championship.geoStates.length) {
    const state = String(participant.state || '').trim().toLowerCase()
    const allowed = championship.geoStates.map(item => item.toLowerCase())
    if (!state) {
      reasons.push('This championship is limited by location, and no state is set on the profile.')
    } else if (!allowed.includes(state)) {
      reasons.push('This championship is not open in your state.')
    }
  }

  if (championship.classLevels.length) {
    const classLevel = String(participant.classLevel || '').trim().toLowerCase()
    const allowed = championship.classLevels.map(item => item.toLowerCase())
    if (!classLevel) {
      reasons.push('A class is required for this championship, and none is set on the profile.')
    } else if (!allowed.some(item => classLevel === item || classLevel.startsWith(item))) {
      reasons.push(`This championship is for ${championship.classLevels.join(', ')}.`)
    }
  }

  const needsAge = championship.minAge !== null || championship.maxAge !== null
  let needsDateOfBirth = false
  if (needsAge) {
    if (!participant.dateOfBirth) {
      // Not pushed into `reasons`: this is a profile-completion prompt, not a rejection.
      needsDateOfBirth = true
    } else {
      const age = computeAgeAt(participant.dateOfBirth, championship.ageAsOf)
      if (age === null) {
        needsDateOfBirth = true
      } else {
        if (championship.minAge !== null && age < championship.minAge) {
          reasons.push(`Participants must be at least ${championship.minAge}${championship.ageAsOf ? ` as of ${championship.ageAsOf}` : ''}.`)
        }
        if (championship.maxAge !== null && age > championship.maxAge) {
          reasons.push(`Participants must be ${championship.maxAge} or under${championship.ageAsOf ? ` as of ${championship.ageAsOf}` : ''}.`)
        }
      }
    }
  }

  if (championship.maxParticipants > 0 && intOrZero(context.confirmedCount) >= championship.maxParticipants) {
    reasons.push('This championship has reached its maximum number of participants.')
  }

  return {
    eligible: reasons.length === 0 && !needsDateOfBirth,
    reasons,
    needsDateOfBirth,
    requiresPayment: championship.registrationFee > 0,
  }
}

export async function createRegistration(
  db: D1Database,
  championship: ReturnType<typeof mapChampionshipRow>,
  participant: Record<string, any>,
  actorId: string,
) {
  await ensureChampionshipTables(db)
  const now = new Date().toISOString()
  const id = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  // Human-readable and safe to print on a ticket.
  const registrationCode = `NC-${String(championship.slug || 'x').slice(0, 6).toUpperCase()}-${String(Date.now()).slice(-6)}`
  const status = championship.registrationFee > 0 ? 'pending_payment' : 'confirmed'

  await db.prepare(
    `INSERT INTO championship_registrations (
      id, championship_id, registration_code, participant_type, user_id, tenant_id,
      participant_name, date_of_birth, class_level, school_name,
      guardian_name, guardian_phone, guardian_email, contact_email, contact_phone, location,
      registered_by, status, payment_reference, amount_paid, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, championship.id, registrationCode,
    participant.participantType === 'independent' ? 'independent' : 'student',
    text(participant.userId, 120), text(participant.tenantId, 120),
    text(participant.participantName, 160), text(participant.dateOfBirth, 10),
    text(participant.classLevel, 60), text(participant.schoolName, 160),
    text(participant.guardianName, 160), text(participant.guardianPhone, 40), text(participant.guardianEmail, 160),
    text(participant.contactEmail, 160), text(participant.contactPhone, 40), text(participant.location, 160),
    actorId, status, '', 0, now, now,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_registrations WHERE id = ?`).bind(id).first() as Record<string, any>
  return mapRegistrationRow(row)
}

/**
 * The championship promoted to a user on sign-in.
 *
 * championship.md section 11 asks for a promotional card on first login after publishing, and
 * section 12 requires it never disrupt the app. The server therefore only ever offers a
 * candidate — it returns the most recently published championship that is still inside its
 * promo window and still open for registration. Dismissal, frequency and rendering safety are
 * the client's job, so a server hiccup simply means no promo rather than a broken dashboard.
 */
export async function getPromotedChampionship(db: D1Database, windowHours = 3) {
  await ensureChampionshipTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championships
      WHERE status IN ('published', 'live')
        AND promo_enabled = 1
        AND published_at IS NOT NULL AND published_at != ''
      ORDER BY published_at DESC
      LIMIT 5`
  ).all()

  const now = Date.now()
  const candidates = (((rows as any).results || []) as Record<string, any>[]).map(mapChampionshipRow)

  for (const championship of candidates) {
    const closes = championship.registrationClosesAt ? Date.parse(championship.registrationClosesAt) : NaN
    if (!Number.isNaN(closes) && now > closes) continue
    return { championship, windowHours }
  }

  return null
}

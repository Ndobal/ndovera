// Free practice passes given out by one-time codes. Ami makes a batch with a date and time after
// which its codes stop working; each code gives one student one pass, and only one request can
// use it. A pass lasts as a paid one does, unless Ami sets its own end.

import { BUNDLES, ensurePassTables, PassError, priceFor } from './practicePasses'
import type { Entitlements, PassStudent } from './practicePasses'

const MAX_BATCH = 500
const MAX_BATCH_LIST = 50
const CODE_LENGTH = 10
const FAILED_TRIES_PER_DAY = 10
// No 0/O or 1/I/L, so a code read off paper can't be mistyped between them.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ready = new WeakSet<object>()

export async function ensureCodeTables(db: D1Database) {
  if (ready.has(db as object)) return
  await ensurePassTables(db)
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS practice_code_batches (id TEXT PRIMARY KEY, label TEXT, bundle TEXT NOT NULL, subject_key TEXT, total INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL, pass_ends_at TEXT, cancelled_at TEXT, created_by TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_code_batches_created ON practice_code_batches(created_at)`,
    `CREATE TABLE IF NOT EXISTS practice_pass_codes (code TEXT PRIMARY KEY, batch_id TEXT NOT NULL, redeemed_by TEXT, redeemed_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_pass_codes_batch ON practice_pass_codes(batch_id)`,
    `CREATE TABLE IF NOT EXISTS practice_code_tries (student_id TEXT NOT NULL, day TEXT NOT NULL, failed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, day))`,
  ]) await db.prepare(statement).run()
  ready.add(db as object)
}

function newCode() {
  let code = ''
  while (code.length < CODE_LENGTH) {
    // 248 is the largest multiple of the 31 letters under 256: taking only below it keeps every letter equally likely.
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH))) if (byte < 248 && code.length < CODE_LENGTH) code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

/** What a student typed, in the form codes are stored in. */
export const cleanCode = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)

export async function createCodeBatch(db: D1Database, input: Record<string, any>, actor: string) {
  await ensureCodeTables(db)
  const bundle = String(input.bundle || '')
  const count = Math.floor(Number(input.count))
  if (!(bundle in BUNDLES)) throw new PassError('Choose which pass these codes give.')
  if (!(count >= 1 && count <= MAX_BATCH)) throw new PassError(`Make between 1 and ${MAX_BATCH} codes at a time.`)
  const expiresMs = Date.parse(String(input.expiresAt || ''))
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) throw new PassError('Choose a date and time in the future for the codes to stop working.')
  let passEndsAt: string | null = null
  if (input.passEndsAt) {
    const endsMs = Date.parse(String(input.passEndsAt))
    if (!Number.isFinite(endsMs) || endsMs <= expiresMs) throw new PassError('The pass must end after the codes stop working, or a code used at the last minute gives nothing.')
    passEndsAt = new Date(endsMs).toISOString()
  }
  const batch = {
    id: `pcb_${crypto.randomUUID()}`, label: String(input.label || '').trim().slice(0, 120), bundle,
    subjectKey: bundle === 'subject' ? String(input.subjectKey || '').trim() || null : null,
    total: count, expiresAt: new Date(expiresMs).toISOString(), passEndsAt, createdAt: new Date().toISOString(),
  }
  const codes = Array.from(new Set(Array.from({ length: count + 5 }, newCode))).slice(0, count)
  await db.prepare(`INSERT INTO practice_code_batches (id, label, bundle, subject_key, total, expires_at, pass_ends_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(batch.id, batch.label, batch.bundle, batch.subjectKey, count, batch.expiresAt, passEndsAt, actor, batch.createdAt).run()
  // One statement for the whole batch: D1 caps bound values, and a request's queries, far below 500.
  await db.prepare(`INSERT INTO practice_pass_codes (code, batch_id) SELECT value, ? FROM json_each(?)`).bind(batch.id, JSON.stringify(codes)).run()
  return { ...batch, used: 0, codes }
}

const batchView = (row: Record<string, any>) => ({
  id: String(row.id), label: String(row.label || ''), bundle: String(row.bundle), bundleLabel: BUNDLES[row.bundle as keyof typeof BUNDLES]?.label || String(row.bundle),
  subjectKey: row.subject_key ? String(row.subject_key) : '', total: Number(row.total), used: Number(row.used), expiresAt: String(row.expires_at),
  passEndsAt: row.pass_ends_at ? String(row.pass_ends_at) : '', cancelledAt: row.cancelled_at ? String(row.cancelled_at) : '', createdAt: String(row.created_at),
})

export async function listCodeBatches(db: D1Database) {
  await ensureCodeTables(db)
  const rows = await db.prepare(`SELECT * FROM practice_code_batches ORDER BY created_at DESC LIMIT ${MAX_BATCH_LIST}`).all()
  return ((rows.results || []) as Record<string, any>[]).map(batchView)
}

export async function readCodeBatch(db: D1Database, id: string) {
  await ensureCodeTables(db)
  const batch = await db.prepare(`SELECT * FROM practice_code_batches WHERE id = ?`).bind(id).first() as Record<string, any> | null
  if (!batch) throw new PassError('Those codes were not found.', 404)
  const rows = await db.prepare(`SELECT code, redeemed_at FROM practice_pass_codes WHERE batch_id = ? LIMIT ${MAX_BATCH}`).bind(id).all()
  return { ...batchView(batch), codes: ((rows.results || []) as Record<string, any>[]).map(row => ({ code: String(row.code), usedAt: row.redeemed_at ? String(row.redeemed_at) : '' })) }
}

/** Stops every unused code in a batch at once. */
export async function cancelCodeBatch(db: D1Database, id: string) {
  await ensureCodeTables(db)
  const done = await db.prepare(`UPDATE practice_code_batches SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL`).bind(new Date().toISOString(), id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new PassError('Those codes were not found, or are already stopped.', 404)
}

async function countFailure(db: D1Database, studentId: string, day: string) {
  await db.prepare(`INSERT INTO practice_code_tries (student_id, day, failed) VALUES (?, ?, 1) ON CONFLICT(student_id, day) DO UPDATE SET failed = failed + 1`).bind(studentId, day).run()
}

/**
 * Use a code for a student. A wrong code counts against a daily limit, so codes can't be guessed.
 * A pass with a choice (a subject, JAMB's three) comes back asking for it, the code still unused.
 */
export async function redeemCode(db: D1Database, rawCode: unknown, student: PassStudent, input: Record<string, any>, context: { offered: string[], held: Entitlements }) {
  await ensureCodeTables(db)
  const code = cleanCode(rawCode)
  const now = new Date().toISOString()
  const day = now.slice(0, 10)
  const tries = await db.prepare(`SELECT failed FROM practice_code_tries WHERE student_id = ? AND day = ?`).bind(student.studentId, day).first() as Record<string, any> | null
  if (Number(tries?.failed || 0) >= FAILED_TRIES_PER_DAY) throw new PassError('Too many wrong codes today. Please try again tomorrow.', 429)
  const refuse = async (message: string, status = 400): Promise<never> => { await countFailure(db, student.studentId, day); throw new PassError(message, status) }
  if (!code) return refuse('Enter your code.')
  const row = await db.prepare(`SELECT c.code, c.redeemed_at, b.id AS batch_id, b.bundle, b.subject_key, b.expires_at, b.pass_ends_at, b.cancelled_at
    FROM practice_pass_codes c JOIN practice_code_batches b ON b.id = c.batch_id WHERE c.code = ?`).bind(code).first() as Record<string, any> | null
  if (!row) return refuse('That code is not right. Check it and try again.')
  if (row.redeemed_at) return refuse('That code has already been used.', 409)
  if (row.cancelled_at || String(row.expires_at) <= now) return refuse('That code has expired.', 410)

  const bundle = String(row.bundle) as keyof typeof BUNDLES
  const definition = BUNDLES[bundle]
  const subjectKey = row.subject_key ? String(row.subject_key) : String(input.subjectKey || '')
  if (bundle === 'subject' && !subjectKey) throw new PassError('Choose the subject for this pass.', 400, { needs: 'subject', bundle, label: definition.label })
  if ((bundle === 'jamb' || bundle === 'super') && !(Array.isArray(input.jambSubjects) && input.jambSubjects.length)) throw new PassError('Choose your three JAMB subjects.', 400, { needs: 'jamb', bundle, label: definition.label })
  // The same checks as a purchase: right section, a subject the class offers, ready to use, not already held.
  const quote = await priceFor(db, { bundle, subjectKey, jambSubjects: input.jambSubjects } as any, { section: student.section, students: 1, forSchool: false, offered: context.offered, held: context.held })

  // Only one request can take the code.
  const claimed = await db.prepare(`UPDATE practice_pass_codes SET redeemed_by = ?, redeemed_at = ? WHERE code = ? AND redeemed_at IS NULL`).bind(student.studentId, now, code).run()
  if (!Number((claimed as any)?.meta?.changes || 0)) throw new PassError('That code has already been used.', 409)
  const endsAt = row.pass_ends_at ? String(row.pass_ends_at) : definition.scope === 'year' ? new Date(Date.now() + 365 * 86400_000).toISOString() : null
  await db.batch([
    db.prepare(`INSERT INTO practice_passes (id, tenant_id, student_id, bundle, subject_key, subjects_json, term_id, starts_at, expires_at, source, payment_ref, amount_naira, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'code', ?, 0, ?)`)
      .bind(`ppass_${crypto.randomUUID()}`, student.tenantId, student.studentId, bundle, (quote.extra as any).subjectKey || null, JSON.stringify((quote.extra as any).jambSubjects || []),
        definition.scope === 'term' && !row.pass_ends_at ? student.termId : null, now, endsAt, `code:${code}`, now),
    db.prepare(`UPDATE practice_code_batches SET used = used + 1 WHERE id = ?`).bind(String(row.batch_id)),
  ])
  return { bundle, label: definition.label, expiresAt: endsAt }
}

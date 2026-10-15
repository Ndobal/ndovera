// Practice passes: what a student may practise, and what it costs.
//
//   Free             Every subject the class offers, at the student's own class level (Simple and
//                    Intermediate), FREE_QUESTIONS_PER_DAY questions a day across all subjects.
//   Subject Pass     ₦300  — 1 subject without the daily limit, this term.
//   All Subjects     ₦1,500 — every subject the class offers without the daily limit, this term.
//   Common Entrance  ₦2,000 — Primary: every subject at Common Entrance standard, 12 months.
//   BECE             ₦3,000 — JSS: every subject at BECE standard, 12 months.
//   WAEC / NECO      ₦3,000 — SS: every subject at WAEC and NECO standard, 12 months.
//   JAMB UTME        ₦3,000 — SS: Use of English + 3 chosen subjects, 180-question timed CBT, 12 months.
//   SS3 Super Pack   ₦5,000 — WAEC / NECO + JAMB.
//   A school buying any pass for a whole class pays 30% less per student.
//
// The rules are kept here, on the server, and nowhere else:
//   - a pass belongs to one student's account; paid content opens on at most 2 devices
//     (the school's Owner or Head of School can clear them for a new phone);
//   - prices are worked out here, never taken from the request; a payment is checked with
//     Flutterwave (status, amount, currency, reference) and grants its passes exactly once;
//   - an exam pass is sold only for the student's own section, and only once its exam has
//     enough checked questions in the bank (EXAM_MIN_STOCK) — nobody pays for an empty bank;
//   - free questions are counted when they are served (a pack holds no more than are left
//     today), not when they are answered, so asking again does not refill the day;
//   - a student downloads at most PACKS_PER_DAY packs a day, and a kept pack stops working
//     offline when the pass ends (or after 7 days, whichever is sooner);
//   - term passes end with the term they were bought in; exam passes 12 months after purchase.

export class PassError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(message: string, status = 400, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

export type ExamKey = 'common_entrance' | 'bece' | 'waec' | 'neco' | 'jamb'
export const EXAMS: Record<ExamKey, { label: string, section: string, standard: string, mcqOptions: number, mockQuestions: number, mockMinutes: number, style: string }> = {
  common_entrance: { label: 'Common Entrance', section: 'primary', standard: 'school', mcqOptions: 4, mockQuestions: 50, mockMinutes: 60, style: 'the National Common Entrance Examination (NCEE) into Federal Government Colleges: short, clear objective questions for Primary 5–6 pupils' },
  bece: { label: 'BECE (Junior WAEC)', section: 'junior', standard: 'school', mcqOptions: 4, mockQuestions: 50, mockMinutes: 60, style: 'the Basic Education Certificate Examination (BECE / Junior WAEC) for JSS 3 candidates, objective paper style' },
  waec: { label: 'WAEC (WASSCE)', section: 'senior', standard: 'waec', mcqOptions: 4, mockQuestions: 50, mockMinutes: 60, style: 'the WAEC West African Senior School Certificate Examination (WASSCE) objective paper, four options A–D' },
  neco: { label: 'NECO (SSCE)', section: 'senior', standard: 'neco', mcqOptions: 5, mockQuestions: 60, mockMinutes: 60, style: 'the NECO Senior School Certificate Examination objective paper, five options A–E' },
  jamb: { label: 'JAMB (UTME)', section: 'senior', standard: 'school', mcqOptions: 4, mockQuestions: 40, mockMinutes: 30, style: 'the JAMB Unified Tertiary Matriculation Examination (UTME) computer-based test: four options A–D, testing the UTME syllabus' },
}
export const EXAM_KEYS = Object.keys(EXAMS) as ExamKey[]
export const examsForSection = (section: string) => EXAM_KEYS.filter(key => EXAMS[key].section === section)
export const normalizeExam = (value: unknown): ExamKey | '' => (EXAM_KEYS as string[]).includes(String(value)) ? String(value) as ExamKey : ''

/** The JAMB mock: Use of English (60) and three subjects (40 each), 2 hours, as the UTME. */
export const JAMB_MOCK = { english: 60, perSubject: 40, minutes: 120 }
export const JAMB_ENGLISH_KEY = 'english'

export const BUNDLES = {
  subject: { label: 'Subject Pass', priceNaira: 300, scope: 'term', levels: ['simple', 'intermediate'], exams: [] as ExamKey[], blurb: 'One subject, as many questions as you like, this term' },
  all: { label: 'All Subjects Pass', priceNaira: 1500, scope: 'term', levels: ['simple', 'intermediate'], exams: [] as ExamKey[], blurb: 'Every subject your class offers, as many questions as you like, this term' },
  common_entrance: { label: 'Common Entrance Prep', priceNaira: 2000, scope: 'year', levels: [], exams: ['common_entrance'] as ExamKey[], section: 'primary', blurb: 'All subjects, Common Entrance standard, timed mocks — 12 months' },
  bece: { label: 'BECE Prep', priceNaira: 3000, scope: 'year', levels: [], exams: ['bece'] as ExamKey[], section: 'junior', blurb: 'All subjects, BECE standard, timed mocks — 12 months' },
  ssce: { label: 'WAEC / NECO Prep', priceNaira: 3000, scope: 'year', levels: [], exams: ['waec', 'neco'] as ExamKey[], section: 'senior', blurb: 'All SSCE subjects, WAEC and NECO standard, timed mocks — 12 months' },
  jamb: { label: 'JAMB UTME Prep', priceNaira: 3000, scope: 'year', levels: [], exams: ['jamb'] as ExamKey[], section: 'senior', blurb: 'Use of English + your 3 subjects, full 180-question CBT mocks — 12 months' },
  super: { label: 'SS3 Super Pack', priceNaira: 5000, scope: 'year', levels: [], exams: ['waec', 'neco', 'jamb'] as ExamKey[], section: 'senior', blurb: 'WAEC / NECO and JAMB together — 12 months' },
} as const
export type BundleKey = keyof typeof BUNDLES
export const SCHOOL_DISCOUNT = 0.3
export const EXAM_MIN_STOCK = 300
export const PACKS_PER_DAY = 30
export const FREE_QUESTIONS_PER_DAY = 10
export const MAX_DEVICES = 2
export const OFFLINE_DAYS = 7

const now = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const lagosDay = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10)

const readyDbs = new WeakSet<object>()
export async function ensurePassTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS practice_passes (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, bundle TEXT NOT NULL, subject_key TEXT, subjects_json TEXT,
      term_id TEXT, starts_at TEXT NOT NULL, expires_at TEXT, source TEXT NOT NULL, payment_ref TEXT, amount_naira REAL, created_at TEXT NOT NULL,
      UNIQUE (payment_ref, student_id))`,
    `CREATE INDEX IF NOT EXISTS idx_practice_passes_student ON practice_passes(student_id, expires_at)`,
    `CREATE TABLE IF NOT EXISTS practice_free_choice (student_id TEXT NOT NULL, term_id TEXT NOT NULL, subject_key TEXT NOT NULL, changes INTEGER NOT NULL DEFAULT 0, chosen_at TEXT NOT NULL, PRIMARY KEY (student_id, term_id))`,
    `CREATE TABLE IF NOT EXISTS practice_payments (
      tx_ref TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, buyer_id TEXT NOT NULL, buyer_role TEXT, bundle TEXT NOT NULL, student_ids_json TEXT NOT NULL,
      options_json TEXT, amount_naira REAL NOT NULL, status TEXT NOT NULL, provider_id TEXT, created_at TEXT NOT NULL, paid_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS practice_devices (student_id TEXT NOT NULL, device_id TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, cleared_at TEXT, PRIMARY KEY (student_id, device_id))`,
    `CREATE TABLE IF NOT EXISTS practice_pack_log (student_id TEXT NOT NULL, day TEXT NOT NULL, packs INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, day))`,
    `CREATE TABLE IF NOT EXISTS practice_free_daily (student_id TEXT NOT NULL, day TEXT NOT NULL, questions INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, day))`,
    `CREATE TABLE IF NOT EXISTS practice_exam_stock (exam TEXT NOT NULL, subject_key TEXT NOT NULL, ready INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (exam, subject_key))`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

// ─── What a student holds ────────────────────────────────────────────────────

export type PassStudent = { tenantId: string, studentId: string, section: string, termId: string }
export type Entitlements = {
  subjects: Set<string>, allSubjects: boolean, exams: Map<ExamKey, string>, jambSubjects: string[],
  passes: Array<{ id: string, bundle: string, label: string, subjectKey: string, subjects: string[], expiresAt: string | null, source: string }>,
  paidUntil: string | null,
}

export async function entitlements(db: D1Database, student: PassStudent): Promise<Entitlements> {
  await ensurePassTables(db)
  const stamp = now()
  const rows = await db.prepare(`SELECT * FROM practice_passes WHERE student_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at`).bind(student.studentId, stamp).all()
  const out: Entitlements = { subjects: new Set(), allSubjects: false, exams: new Map(), jambSubjects: [], passes: [], paidUntil: null }
  for (const row of (rows.results || []) as Record<string, any>[]) {
    const bundle = BUNDLES[row.bundle as BundleKey]
    if (!bundle) continue
    // A term pass counts only in the term it was bought for.
    if (bundle.scope === 'term' && row.term_id !== student.termId) continue
    if (row.bundle === 'subject' && row.subject_key) out.subjects.add(String(row.subject_key))
    if (row.bundle === 'all') out.allSubjects = true
    for (const exam of bundle.exams) {
      const until = String(row.expires_at || '')
      if (!out.exams.has(exam) || until > (out.exams.get(exam) || '')) out.exams.set(exam, until)
    }
    if (bundle.exams.includes('jamb')) out.jambSubjects = parse<string[]>(row.subjects_json, [])
    out.passes.push({ id: String(row.id), bundle: String(row.bundle), label: bundle.label, subjectKey: String(row.subject_key || ''), subjects: parse<string[]>(row.subjects_json, []), expiresAt: row.expires_at || null, source: String(row.source) })
    if (row.expires_at && (!out.paidUntil || row.expires_at > out.paidUntil)) out.paidUntil = row.expires_at
  }
  return out
}

/**
 * May this student open this subject at this level? Returns how (free / pass) or a reason.
 * School levels are free in every subject (FREE_QUESTIONS_PER_DAY a day); a pass lifts the limit.
 * JAMB packs are only the student's English and their three chosen subjects.
 */
export function canOpen(held: Entitlements, subjectKey: string, difficulty: string, exam: ExamKey | '') {
  if (difficulty === 'external') {
    if (!exam) return { ok: false as const, reason: 'Choose the examination.' }
    if (!held.exams.has(exam)) return { ok: false as const, reason: `${EXAMS[exam].label} practice needs the ${exam === 'jamb' ? 'JAMB UTME Prep' : exam === 'waec' || exam === 'neco' ? 'WAEC / NECO Prep' : EXAMS[exam].label + ' Prep'} pass.`, needs: exam }
    if (exam === 'jamb' && subjectKey !== JAMB_ENGLISH_KEY && !held.jambSubjects.includes(subjectKey)) return { ok: false as const, reason: 'Your JAMB pass covers Use of English and the three subjects you chose.' }
    return { ok: true as const, via: 'exam', paid: true }
  }
  if (held.allSubjects || held.subjects.has(subjectKey)) return { ok: true as const, via: 'pass', paid: true }
  return { ok: true as const, via: 'free', paid: false }
}

/** Free questions this student has left today (Lagos day). */
export async function freeQuestionsLeft(db: D1Database, studentId: string) {
  await ensurePassTables(db)
  const row = await db.prepare(`SELECT questions FROM practice_free_daily WHERE student_id = ? AND day = ?`).bind(studentId, lagosDay()).first() as Record<string, any> | null
  return Math.max(0, FREE_QUESTIONS_PER_DAY - Number(row?.questions || 0))
}

/** Count free questions served today. */
export async function useFreeQuestions(db: D1Database, studentId: string, served: number) {
  if (served <= 0) return
  await ensurePassTables(db)
  await db.prepare(`INSERT INTO practice_free_daily (student_id, day, questions) VALUES (?, ?, ?) ON CONFLICT(student_id, day) DO UPDATE SET questions = questions + excluded.questions`)
    .bind(studentId, lagosDay(), served).run()
}

export const FREE_LIMIT_REACHED = `You have practised your ${FREE_QUESTIONS_PER_DAY} free questions for today. Come back tomorrow for ${FREE_QUESTIONS_PER_DAY} more, or get a Subject Pass (₦300) or the All Subjects Pass (₦1,500) to practise as much as you like.`

// ─── Devices and downloads ───────────────────────────────────────────────────

/** Paid content opens on at most MAX_DEVICES devices per student. */
export async function checkDevice(db: D1Database, studentId: string, deviceId: string) {
  await ensurePassTables(db)
  const id = String(deviceId || '').trim().slice(0, 80)
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new PassError('This device could not be recognised. Update the app and try again.', 400)
  const stamp = now()
  const known = await db.prepare(`SELECT device_id FROM practice_devices WHERE student_id = ? AND cleared_at IS NULL`).bind(studentId).all()
  const ids = ((known.results || []) as Record<string, any>[]).map(row => String(row.device_id))
  if (ids.includes(id)) {
    await db.prepare(`UPDATE practice_devices SET last_seen = ? WHERE student_id = ? AND device_id = ?`).bind(stamp, studentId, id).run()
    return
  }
  if (ids.length >= MAX_DEVICES) throw new PassError(`Paid practice opens on ${MAX_DEVICES} devices, and this account already uses ${MAX_DEVICES}. Ask your school's Owner or Head of School to clear your devices if you changed phone.`, 403, { deviceLimit: true })
  await db.prepare(`INSERT INTO practice_devices (student_id, device_id, first_seen, last_seen) VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, device_id) DO UPDATE SET cleared_at = NULL, last_seen = excluded.last_seen`).bind(studentId, id, stamp, stamp).run()
}

export async function clearDevices(db: D1Database, studentId: string) {
  await ensurePassTables(db)
  await db.prepare(`UPDATE practice_devices SET cleared_at = ? WHERE student_id = ? AND cleared_at IS NULL`).bind(now(), studentId).run()
}

/** At most PACKS_PER_DAY downloads a day: enough to practise, too few to copy the bank. */
export async function countPack(db: D1Database, studentId: string) {
  await ensurePassTables(db)
  const day = lagosDay()
  const row = await db.prepare(`SELECT packs FROM practice_pack_log WHERE student_id = ? AND day = ?`).bind(studentId, day).first() as Record<string, any> | null
  if (Number(row?.packs || 0) >= PACKS_PER_DAY) throw new PassError(`You have downloaded ${PACKS_PER_DAY} sets of questions today. Practise those; more tomorrow.`, 429)
  await db.prepare(`INSERT INTO practice_pack_log (student_id, day, packs) VALUES (?, ?, 1) ON CONFLICT(student_id, day) DO UPDATE SET packs = packs + 1`).bind(studentId, day).run()
}

/** When a downloaded pack stops working offline. */
export function packValidUntil(held: Entitlements, difficulty: string, exam: ExamKey | '') {
  const week = new Date(Date.now() + OFFLINE_DAYS * 86400_000).toISOString()
  const until = difficulty === 'external' && exam ? held.exams.get(exam) || '' : held.paidUntil || ''
  return until && until < week ? until : week
}

// ─── Stock: an exam is sold once it has enough checked questions ─────────────

export async function examStock(db: D1Database) {
  await ensurePassTables(db)
  const rows = await db.prepare(`SELECT exam, SUM(ready) AS ready FROM practice_exam_stock GROUP BY exam`).all()
  const stock: Record<string, number> = Object.fromEntries(EXAM_KEYS.map(key => [key, 0]))
  for (const row of (rows.results || []) as Record<string, any>[]) stock[String(row.exam)] = Number(row.ready || 0)
  return stock
}

/** Rebuild the stock from the bank: checked (or upgraded) questions per exam and subject. Nightly. */
export async function rebuildExamStock(db: D1Database) {
  await ensurePassTables(db)
  const rows = await db.prepare(`SELECT exam, subject_key, COUNT(*) AS ready FROM question_bank WHERE exam IS NOT NULL AND exam != '' AND playable = 1 AND quality IN ('ok', 'upgraded') AND COALESCE(status, 'approved') = 'approved' GROUP BY exam, subject_key`).all()
  const stamp = now()
  await db.batch([
    db.prepare(`DELETE FROM practice_exam_stock`),
    ...((rows.results || []) as Record<string, any>[]).map(row => db.prepare(`INSERT INTO practice_exam_stock (exam, subject_key, ready, updated_at) VALUES (?, ?, ?, ?)`).bind(row.exam, row.subject_key || '', Number(row.ready), stamp)),
  ])
}

export async function addExamStock(db: D1Database, exam: string, subjectKey: string, ready: number) {
  if (!exam || !ready) return
  await ensurePassTables(db)
  await db.prepare(`INSERT INTO practice_exam_stock (exam, subject_key, ready, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(exam, subject_key) DO UPDATE SET ready = ready + excluded.ready, updated_at = excluded.updated_at`).bind(exam, subjectKey || '', ready, now()).run()
}

// ─── Buying ──────────────────────────────────────────────────────────────────

export type PurchaseInput = { bundle: string, subjectKey?: string, jambSubjects?: string[] }

/** Check a purchase and price it. `section` is the student's (or class's) section. */
export async function priceFor(db: D1Database, input: PurchaseInput, options: { section: string, students: number, forSchool: boolean, offered: string[], held?: Entitlements }) {
  const key = String(input.bundle || '') as BundleKey
  const bundle = BUNDLES[key]
  if (!bundle) throw new PassError('That pass does not exist.')
  if (!options.students) throw new PassError('There is nobody to buy this for.')
  if ('section' in bundle && bundle.section !== options.section) throw new PassError(`${bundle.label} is for ${bundle.section === 'primary' ? 'Primary' : bundle.section === 'junior' ? 'Junior Secondary' : 'Senior Secondary'} students.`)
  const extra: Record<string, unknown> = {}
  if (key === 'subject') {
    const subjectKey = String(input.subjectKey || '')
    if (!options.offered.includes(subjectKey)) throw new PassError('Choose one of the subjects the class offers.')
    if (options.held && (options.held.allSubjects || options.held.subjects.has(subjectKey))) throw new PassError('You already have this subject this term.', 409)
    extra.subjectKey = subjectKey
  }
  if (key === 'jamb' || key === 'super') {
    const chosen = Array.from(new Set((input.jambSubjects || []).map(String).filter(subject => subject && subject !== JAMB_ENGLISH_KEY)))
    if (chosen.length !== 3) throw new PassError('Choose your three JAMB subjects (Use of English is always included).')
    extra.jambSubjects = chosen
  }
  if (bundle.exams.length) {
    const stock = await examStock(db)
    const short = bundle.exams.filter(exam => (stock[exam] || 0) < EXAM_MIN_STOCK)
    if (short.length) throw new PassError(`${short.map(exam => EXAMS[exam].label).join(' and ')} practice is still being prepared (${short.map(exam => `${stock[exam] || 0} of ${EXAM_MIN_STOCK} checked questions`).join(', ')}). It goes on sale as soon as it is ready.`, 409, { notReady: short })
    if (options.held && bundle.exams.every(exam => options.held!.exams.has(exam))) throw new PassError('You already have this pass.', 409)
  }
  const each = options.forSchool ? Math.round(bundle.priceNaira * (1 - SCHOOL_DISCOUNT)) : bundle.priceNaira
  return { bundle: key, label: bundle.label, each, amountNaira: each * options.students, extra }
}

export async function recordCheckout(db: D1Database, input: { txRef: string, tenantId: string, buyerId: string, buyerRole: string, bundle: string, studentIds: string[], options: Record<string, unknown>, amountNaira: number }) {
  await ensurePassTables(db)
  await db.prepare(`INSERT INTO practice_payments (tx_ref, tenant_id, buyer_id, buyer_role, bundle, student_ids_json, options_json, amount_naira, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .bind(input.txRef, input.tenantId, input.buyerId, input.buyerRole, input.bundle, JSON.stringify(input.studentIds), JSON.stringify(input.options), input.amountNaira, now()).run()
}

export async function getCheckout(db: D1Database, txRef: string) {
  await ensurePassTables(db)
  const row = await db.prepare(`SELECT * FROM practice_payments WHERE tx_ref = ?`).bind(txRef).first() as Record<string, any> | null
  return row ? { txRef: String(row.tx_ref), tenantId: String(row.tenant_id), buyerId: String(row.buyer_id), bundle: String(row.bundle), studentIds: parse<string[]>(row.student_ids_json, []), options: parse<Record<string, any>>(row.options_json, {}), amountNaira: Number(row.amount_naira), status: String(row.status), paidAt: row.paid_at || null } : null
}

/**
 * Grant a verified payment's passes, exactly once (the payment row is claimed first).
 * `verified` is Flutterwave's own answer: status, amount, currency and reference must all match.
 */
export async function settleCheckout(db: D1Database, txRef: string, verified: { status: string, amount: number, currency: string, txRef: string, providerId: string }, terms: { termId: string }) {
  const payment = await getCheckout(db, txRef)
  if (!payment) throw new PassError('Payment not found.', 404)
  if (payment.status === 'paid') return { payment, granted: 0, alreadyPaid: true }
  const ok = ['successful', 'completed'].includes(String(verified.status).toLowerCase()) && verified.txRef === txRef
    && String(verified.currency).toUpperCase() === 'NGN' && Math.abs(Number(verified.amount) - payment.amountNaira) < 0.01
  if (!ok) {
    await db.prepare(`UPDATE practice_payments SET status = ? WHERE tx_ref = ? AND status != 'paid'`).bind(verified.status ? String(verified.status).toLowerCase() : 'failed', txRef).run()
    return { payment: { ...payment, status: 'unconfirmed' }, granted: 0, alreadyPaid: false }
  }
  // Claim the payment: only one request can turn it to paid.
  const claimed = await db.prepare(`UPDATE practice_payments SET status = 'paid', paid_at = ?, provider_id = ? WHERE tx_ref = ? AND status != 'paid'`).bind(now(), verified.providerId, txRef).run()
  if (!Number((claimed as any)?.meta?.changes || 0)) return { payment: await getCheckout(db, txRef), granted: 0, alreadyPaid: true }
  const bundle = BUNDLES[payment.bundle as BundleKey]
  const stamp = now()
  const expires = bundle.scope === 'year' ? new Date(Date.now() + 365 * 86400_000).toISOString() : null
  const each = payment.amountNaira / Math.max(1, payment.studentIds.length)
  await db.batch(payment.studentIds.map(studentId => db.prepare(`INSERT OR IGNORE INTO practice_passes (id, tenant_id, student_id, bundle, subject_key, subjects_json, term_id, starts_at, expires_at, source, payment_ref, amount_naira, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId('ppass'), payment.tenantId, studentId, payment.bundle, payment.options.subjectKey || null, JSON.stringify(payment.options.jambSubjects || []),
    bundle.scope === 'term' ? terms.termId : null, stamp, expires, payment.studentIds.length > 1 ? 'school' : 'payment', txRef, each, stamp)))
  return { payment: await getCheckout(db, txRef), granted: payment.studentIds.length, alreadyPaid: false }
}

export function bundleList(section: string, stock: Record<string, number>) {
  return (Object.entries(BUNDLES) as Array<[BundleKey, typeof BUNDLES[BundleKey]]>)
    .filter(([, bundle]) => !('section' in bundle) || bundle.section === section)
    .map(([key, bundle]) => ({
      key, label: bundle.label, priceNaira: bundle.priceNaira, schoolPriceNaira: Math.round(bundle.priceNaira * (1 - SCHOOL_DISCOUNT)), blurb: bundle.blurb, scope: bundle.scope,
      exams: bundle.exams, ready: bundle.exams.every(exam => (stock[exam] || 0) >= EXAM_MIN_STOCK),
      stock: bundle.exams.map(exam => ({ exam, label: EXAMS[exam].label, ready: stock[exam] || 0, needed: EXAM_MIN_STOCK })),
    }))
}

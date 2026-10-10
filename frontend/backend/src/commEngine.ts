// Parent notifications (N20) — events, recipients, batches, admission and dispatch.
//
//   1. Something happens (bills published, a payment verified, results published, an
//      assignment posted, a notice…): recordEvent() stores it once (a dedupe key).
//   2. The minute cron turns new events into batches: the eligible guardians, one
//      delivery per guardian and channel (in-app always, email when allowed, and one
//      paid channel — WhatsApp, or SMS under the school's policy).
//   3. Admission reserves every paid unit the batch needs at once, or none
//      (commCredits.reserveAll). Short of units:
//        PAUSE_BATCH        no WhatsApp at all from the batch; it waits (awaiting_credits)
//        SMS_FOR_REMAINDER  WhatsApp for as many as the units cover, SMS for the rest —
//                           but only if the SMS units cover ALL the rest; else it waits
//      Free channels (in-app, free email) go ahead regardless.
//   4. The dispatcher sends queued deliveries a few at a time, through the adapters,
//      and settles units: SMS on acceptance; WhatsApp on its sent/delivered webhook
//      (released on failed). A timeout is "unknown": reconciled, never resent blindly.
//   5. A purchase or gift re-admits waiting batches, oldest first, each only if fully
//      fundable; a credit pause lifts when nothing is left waiting for units.
//
// Queues: the existing minute cron and bounded pages do the work (no Cloudflare Queue
// is configured); every step is idempotent and claims rows with conditional updates.

import {
  CHANNEL_LABELS, consumeReservation, expireGrants, formatNaira, newId, nowIso, priceAt, releaseReservation, reserveAll, walletSummary,
  type Channel, type ReservationRequest,
} from './commCredits'
import {
  addToInbox, consentsFor, ensureMessageTables, EVENT_LABELS, getSettings, listTemplates, normalizeEmail, normalizePhone, renderMessage, setPause,
  type CommSettings, type EventType, type MessageFacts,
} from './commMessages'
import { sendPayHosSms, sendWhatsAppTemplate, type PayHosConfig, type SendOutcome, type WhatsAppConfig } from './commAdapters'

export type Scope =
  | { kind: 'school' }
  | { kind: 'class', classIds: string[] }
  | { kind: 'students', studentIds: string[] }

export type CommDeps = {
  db: D1Database
  whatsapp: WhatsAppConfig
  sms: PayHosConfig
  sendEmail: ((to: string, subject: string, html: string) => Promise<void>) | null
  /** https://<school>.ndovera.com — links point at the parent portal there. */
  portalBase: (tenantId: string) => Promise<string>
  schoolName: (tenantId: string) => Promise<string>
  /** Fee reminders: the account's current outstanding balance in kobo (the fee system's own figure). */
  balanceKobo?: (tenantId: string, studentId: string) => Promise<number | null>
  /** Is the thing still true and visible (results still published, assignment still open)? */
  stillValid?: (event: CommEvent) => Promise<boolean>
  notifyOwner?: (tenantId: string, subject: string, text: string) => Promise<void>
  now?: () => Date
}

export type CommEvent = {
  id: string, tenantId: string, type: EventType, scope: Scope, facts: MessageFacts & Record<string, any>, link: string,
  dedupeKey: string, status: string, createdBy: string, createdAt: string,
}

const BATCH_RETENTION_DAYS = 7
const RESERVATION_HOURS = 48
const DISPATCH_PER_TICK = 50
const MAX_ATTEMPTS = 5
const WHATSAPP_ACCEPTED_GRACE_HOURS = 72

const readyDbs = new WeakSet<object>()
export async function ensureEngineTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await ensureMessageTables(db)
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS comm_events (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, type TEXT NOT NULL, scope TEXT NOT NULL, facts TEXT, link TEXT, dedupe_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', created_by TEXT, created_at TEXT NOT NULL, processed_at TEXT, UNIQUE(tenant_id, dedupe_key))`,
    `CREATE INDEX IF NOT EXISTS idx_comm_events_status ON comm_events(status, created_at)`,
    `CREATE TABLE IF NOT EXISTS comm_batches (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL, policy TEXT NOT NULL, status TEXT NOT NULL,
      counts TEXT, requirement TEXT, shortfall TEXT, expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_batches_waiting ON comm_batches(tenant_id, status, created_at)`,
    `CREATE TABLE IF NOT EXISTS comm_deliveries (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, batch_id TEXT NOT NULL, event_id TEXT NOT NULL, guardian_id TEXT NOT NULL, channel TEXT NOT NULL,
      address TEXT, student_ids TEXT, units INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, financial TEXT NOT NULL DEFAULT 'none',
      provider_id TEXT, error TEXT, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, locked_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(event_id, guardian_id, channel))`,
    `CREATE INDEX IF NOT EXISTS idx_comm_deliveries_queue ON comm_deliveries(status, next_attempt_at)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_deliveries_batch ON comm_deliveries(batch_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_deliveries_provider ON comm_deliveries(provider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_deliveries_tenant ON comm_deliveries(tenant_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS comm_attempts (id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL, attempt INTEGER NOT NULL, outcome TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS comm_webhook_events (event_key TEXT PRIMARY KEY, provider TEXT NOT NULL, received_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS comm_reminder_state (tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, last_sent_at TEXT, next_due_at TEXT, paused INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, student_id))`,
    `CREATE TABLE IF NOT EXISTS comm_scheduler_runs (tenant_id TEXT NOT NULL, kind TEXT NOT NULL, run_date TEXT NOT NULL, PRIMARY KEY (tenant_id, kind, run_date))`,
  ]) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

const json = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const mapEvent = (row: Record<string, any>): CommEvent => ({
  id: String(row.id), tenantId: String(row.tenant_id), type: row.type, scope: json<Scope>(row.scope, { kind: 'school' }), facts: json(row.facts, { schoolName: '', children: [] }),
  link: String(row.link || ''), dedupeKey: String(row.dedupe_key), status: String(row.status), createdBy: String(row.created_by || ''), createdAt: String(row.created_at),
})

// ─── 1. Events ──────────────────────────────────────────────────────────────

/**
 * Record that something happened. The dedupe key makes a repeat (a retried request, a
 * re-publication of the same version) a no-op. Returns the event id, or null when the
 * school has that kind of notification turned off.
 */
export async function recordEvent(db: D1Database, input: { tenantId: string, type: EventType, scope: Scope, facts?: Record<string, any>, link?: string, dedupeKey: string, actor?: string }) {
  if (!input.tenantId) return null
  await ensureEngineTables(db)
  const settings = await getSettings(db, input.tenantId)
  if (!settings.events[input.type]) return null
  if (input.type === 'assignment' && settings.assignmentMode !== 'each') return null
  const id = newId('cev')
  const result = await db.prepare(`INSERT OR IGNORE INTO comm_events (id, tenant_id, type, scope, facts, link, dedupe_key, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`)
    .bind(id, input.tenantId, input.type, JSON.stringify(input.scope), JSON.stringify(input.facts || {}), input.link || '', input.dedupeKey.slice(0, 300), input.actor || 'system', nowIso()).run()
  return Number(result.meta?.changes) ? id : null
}

// ─── 2. Recipients ──────────────────────────────────────────────────────────

export type Recipient = {
  guardianId: string, name: string, email: string, phone: string, studentIds: string[], childNames: string[],
}
export type Excluded = { guardianId: string, reason: string }

async function inChunks<T>(values: string[], size: number, run: (slice: string[]) => Promise<T[]>) {
  const out: T[] = []
  for (let start = 0; start < values.length; start += size) {
    const slice = values.slice(start, start + size)
    if (slice.length) out.push(...await run(slice))
  }
  return out
}

/** The school's students in scope: { id, name }. Class membership lives in the settings payload. */
async function studentsInScope(db: D1Database, tenantId: string, scope: Scope) {
  if (scope.kind === 'students') {
    return inChunks(scope.studentIds, 90, async slice => ((await db.prepare(`SELECT id, name FROM users WHERE tenantId = ? AND id IN (${slice.map(() => '?').join(', ')})`).bind(tenantId, ...slice).all()).results || []) as Array<{ id: string, name: string }>)
  }
  const rows = ((await db.prepare(`SELECT u.id, u.name, s.payload FROM users u LEFT JOIN settings s ON s.studentId IN (u.email, lower(u.email))
    WHERE u.tenantId = ? AND lower(u.role) = 'student' AND (u.status IS NULL OR u.status != 'inactive')`).bind(tenantId).all()).results || []) as Array<Record<string, any>>
  const classes = scope.kind === 'class' ? new Set(scope.classIds.map(String)) : null
  return rows.filter(row => !classes || classes.has(String(json<Record<string, any>>(row.payload, {}).classId || ''))).map(row => ({ id: String(row.id), name: String(row.name || '') }))
}

/**
 * Who should hear about it: the authorised guardians of the students in scope, one
 * per student by default (the school's designated guardian, else the first linked),
 * or all linked guardians. A guardian with several children in scope gets one
 * message naming those children (they are linked to each of them).
 */
export async function resolveRecipients(db: D1Database, tenantId: string, scope: Scope, settings: CommSettings) {
  await ensureEngineTables(db)
  const students = await studentsInScope(db, tenantId, scope)
  const studentIds = students.map(student => student.id)
  const nameOf = new Map(students.map(student => [student.id, student.name]))
  const links = await inChunks(studentIds, 90, async slice => ((await db.prepare(`SELECT parent_id, student_id, created_at FROM parent_student_links WHERE tenant_id = ? AND student_id IN (${slice.map(() => '?').join(', ')}) ORDER BY created_at ASC`).bind(tenantId, ...slice).all()).results || []) as Array<Record<string, string>>)
    .catch(() => [] as Array<Record<string, string>>)
  const designations = new Map<string, string>()
  if (settings.guardianMode === 'designated') {
    for (const row of await inChunks(studentIds, 90, async slice => ((await db.prepare(`SELECT student_id, guardian_id FROM comm_designations WHERE tenant_id = ? AND student_id IN (${slice.map(() => '?').join(', ')})`).bind(tenantId, ...slice).all()).results || []) as Array<Record<string, string>>)) {
      designations.set(row.student_id, row.guardian_id)
    }
  }
  const byGuardian = new Map<string, string[]>()
  const noGuardian: string[] = []
  for (const studentId of studentIds) {
    const linked = links.filter(link => link.student_id === studentId).map(link => String(link.parent_id))
    if (!linked.length) { noGuardian.push(studentId); continue }
    const chosen = settings.guardianMode === 'all' ? linked : [linked.includes(designations.get(studentId) || '') ? designations.get(studentId)! : linked[0]]
    for (const guardianId of chosen) byGuardian.set(guardianId, Array.from(new Set([...(byGuardian.get(guardianId) || []), studentId])))
  }
  const guardianIds = Array.from(byGuardian.keys())
  const people = await inChunks(guardianIds, 90, async slice => ((await db.prepare(`SELECT u.id, u.name, u.email, u.status, s.payload FROM users u LEFT JOIN settings s ON s.studentId IN (u.email, lower(u.email)) WHERE u.id IN (${slice.map(() => '?').join(', ')})`).bind(...slice).all()).results || []) as Array<Record<string, any>>)
  const recipients: Recipient[] = []
  const excluded: Excluded[] = noGuardian.map(studentId => ({ guardianId: `student:${studentId}`, reason: 'no_guardian_linked' }))
  for (const guardianId of guardianIds) {
    const person = people.find(row => String(row.id) === guardianId)
    if (!person || String(person.status || '') === 'inactive') { excluded.push({ guardianId, reason: 'guardian_inactive' }); continue }
    const payload = json<Record<string, any>>(person.payload, {})
    const ids = byGuardian.get(guardianId) || []
    recipients.push({
      guardianId, name: String(person.name || payload.name || ''), email: normalizeEmail(person.email || payload.email),
      phone: normalizePhone(payload.phone ?? payload.profile?.phone), studentIds: ids, childNames: ids.map(id => nameOf.get(id) || ''),
    })
  }
  return { recipients, excluded }
}

// ─── 3. Planning and admission ──────────────────────────────────────────────

type PlannedDelivery = { guardianId: string, channel: Channel | 'inapp', address: string, studentIds: string[], units: number, text: string }

/** WhatsApp can carry this event only with an approved template. */
async function whatsappReady(db: D1Database, deps: CommDeps, type: EventType) {
  if (!deps.whatsapp.token || !deps.whatsapp.phoneNumberId) return false
  const template = (await listTemplates(db)).find(item => item.eventType === type)
  return template?.status === 'approved'
}

/**
 * The plan for one event: who gets what, on which channel, for how many units.
 * Deterministic (sorted by guardian), so re-planning the same snapshot routes the same way.
 */
export async function planEvent(deps: CommDeps, event: CommEvent, settings: CommSettings, spendableWhatsApp: number) {
  const { db } = deps
  const { recipients, excluded } = await resolveRecipients(db, event.tenantId, event.scope, settings)
  recipients.sort((a, b) => a.guardianId.localeCompare(b.guardianId))
  const consents = await consentsFor(db, event.tenantId, recipients.map(recipient => recipient.guardianId))
  const schoolName = event.facts.schoolName || await deps.schoolName(event.tenantId)
  const link = event.link || await deps.portalBase(event.tenantId)
  const waOk = settings.whatsappEnabled && !(settings.pauses.whatsapp || []).some(reason => reason !== 'credits') && await whatsappReady(db, deps, event.type)
  const smsOk = settings.smsEnabled && !(settings.pauses.sms || []).some(reason => reason !== 'credits') && Boolean(deps.sms.apiKey)
  const emailPrice = await priceAt(db, 'email')
  const deliveries: PlannedDelivery[] = []
  const unreachable: Excluded[] = []
  const paidAllowed = (guardianId: string, channel: Channel) => {
    const choice = consents.get(guardianId)?.[channel]
    return choice === 'granted' || (choice !== 'withdrawn' && settings.consentConfirmed)
  }
  const waCandidates: Recipient[] = []
  const smsOnly: Recipient[] = []
  for (const recipient of recipients) {
    const message = renderMessage(event.type, { ...event.facts, schoolName, children: recipient.childNames }, settings, link)
    deliveries.push({ guardianId: recipient.guardianId, channel: 'inapp', address: recipient.guardianId, studentIds: recipient.studentIds, units: 0, text: message.text })
    if (deps.sendEmail && settings.emailEnabled && recipient.email && consents.get(recipient.guardianId)?.email !== 'withdrawn') {
      deliveries.push({ guardianId: recipient.guardianId, channel: 'email', address: recipient.email, studentIds: recipient.studentIds, units: emailPrice.billingMode === 'FREE' ? 0 : 1, text: message.text })
    }
    if (recipient.phone && waOk && paidAllowed(recipient.guardianId, 'whatsapp')) waCandidates.push(recipient)
    else if (recipient.phone && smsOk && paidAllowed(recipient.guardianId, 'sms')) smsOnly.push(recipient)
    else unreachable.push({ guardianId: recipient.guardianId, reason: recipient.phone ? 'no_permitted_paid_channel' : 'no_valid_phone' })
  }
  const smsPolicy = settings.shortagePolicy === 'SMS_FOR_REMAINDER' && smsOk
  // WhatsApp is the paid channel; under SMS_FOR_REMAINDER, units decide who goes by SMS instead.
  const waTake = smsPolicy ? Math.min(waCandidates.length, Math.max(0, spendableWhatsApp)) : waCandidates.length
  const viaWhatsApp = waCandidates.slice(0, waTake)
  const viaSms = smsPolicy ? [...waCandidates.slice(waTake), ...smsOnly] : (waOk ? [] : smsOnly)
  if (!smsPolicy && waOk) for (const recipient of smsOnly) unreachable.push({ guardianId: recipient.guardianId, reason: 'sms_fallback_off' })
  for (const recipient of viaWhatsApp) {
    const message = renderMessage(event.type, { ...event.facts, schoolName, children: recipient.childNames }, settings, link)
    deliveries.push({ guardianId: recipient.guardianId, channel: 'whatsapp', address: recipient.phone, studentIds: recipient.studentIds, units: 1, text: message.text })
  }
  for (const recipient of viaSms) {
    const message = renderMessage(event.type, { ...event.facts, schoolName, children: recipient.childNames }, settings, link)
    deliveries.push({ guardianId: recipient.guardianId, channel: 'sms', address: recipient.phone, studentIds: recipient.studentIds, units: message.smsSegments, text: message.sms })
  }
  return { deliveries, excluded: [...excluded, ...unreachable], schoolName, link }
}

const sum = (deliveries: PlannedDelivery[], channel: Channel) => deliveries.filter(item => item.channel === channel).reduce((total, item) => total + item.units, 0)

/** Turn a new event into a batch with its deliveries, then try to admit it. */
async function createBatch(deps: CommDeps, event: CommEvent) {
  const { db } = deps
  const settings = await getSettings(db, event.tenantId)
  const wallet = await walletSummary(db, event.tenantId)
  const plan = await planEvent(deps, event, settings, wallet.whatsapp.spendable)
  const batchId = newId('cba')
  const at = nowIso()
  const counts = {
    recipients: new Set(plan.deliveries.map(item => item.guardianId)).size,
    inapp: plan.deliveries.filter(item => item.channel === 'inapp').length,
    email: plan.deliveries.filter(item => item.channel === 'email').length,
    whatsapp: plan.deliveries.filter(item => item.channel === 'whatsapp').length,
    sms: plan.deliveries.filter(item => item.channel === 'sms').length,
    smsSegments: sum(plan.deliveries, 'sms'),
    excluded: plan.excluded.length,
    excludedReasons: plan.excluded.reduce((map, item) => ({ ...map, [item.reason]: (map[item.reason] || 0) + 1 }), {} as Record<string, number>),
  }
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO comm_batches (id, tenant_id, event_id, type, policy, status, counts, requirement, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?)`)
      .bind(batchId, event.tenantId, event.id, event.type, settings.shortagePolicy, JSON.stringify(counts), JSON.stringify({ whatsapp: sum(plan.deliveries, 'whatsapp'), sms: sum(plan.deliveries, 'sms'), email: sum(plan.deliveries, 'email') }),
        new Date(Date.now() + BATCH_RETENTION_DAYS * 86400_000).toISOString(), at, at),
  ]
  for (const item of plan.deliveries) {
    statements.push(db.prepare(`INSERT OR IGNORE INTO comm_deliveries (id, tenant_id, batch_id, event_id, guardian_id, channel, address, student_ids, units, status, financial, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?)`).bind(newId('cde'), event.tenantId, batchId, event.id, item.guardianId, item.channel, item.address, JSON.stringify(item.studentIds), item.units, item.units ? 'unreserved' : 'none', at, at))
  }
  statements.push(db.prepare(`UPDATE comm_events SET status = 'planned', processed_at = ? WHERE id = ?`).bind(at, event.id))
  await db.batch(statements)
  await admitBatch(deps, batchId)
  return batchId
}

/**
 * Reserve everything the batch's paid deliveries need, or nothing. Free deliveries
 * are released for sending either way. Returns the batch's status afterwards.
 */
export async function admitBatch(deps: CommDeps, batchId: string): Promise<string> {
  const { db } = deps
  const batch = await db.prepare(`SELECT * FROM comm_batches WHERE id = ?`).bind(batchId).first() as Record<string, any> | null
  if (!batch || !['planned', 'awaiting_credits'].includes(batch.status)) return batch?.status || 'missing'
  const tenantId = String(batch.tenant_id)
  const at = nowIso()
  // Free work never waits for units.
  await db.prepare(`UPDATE comm_deliveries SET status = 'queued', next_attempt_at = ?, updated_at = ? WHERE batch_id = ? AND status = 'planned' AND units = 0`).bind(at, at, batchId).run()
  const paid = ((await db.prepare(`SELECT id, channel, units FROM comm_deliveries WHERE batch_id = ? AND status IN ('planned', 'awaiting_credits') AND units > 0`).bind(batchId).all()).results || []) as Array<{ id: string, channel: Channel, units: number }>
  if (!paid.length) {
    await db.prepare(`UPDATE comm_batches SET status = 'funded', shortfall = NULL, updated_at = ? WHERE id = ?`).bind(at, batchId).run()
    return 'funded'
  }
  const requests: ReservationRequest[] = paid.map(item => ({ deliveryId: item.id, channel: item.channel, units: Number(item.units) }))
  // Batches already waiting for units go first: a new one queues behind them rather than
  // spending the units they are waiting for.
  if (batch.status === 'planned') {
    const older = await db.prepare(`SELECT shortfall FROM comm_batches WHERE tenant_id = ? AND status = 'awaiting_credits' AND created_at <= ? AND id <> ?`).bind(tenantId, batch.created_at, batchId).all()
    const blocked = new Set<string>()
    for (const row of (older.results || []) as Array<{ shortfall: string }>) for (const channel of Object.keys(json<Record<string, number>>(row.shortfall, {}))) blocked.add(channel)
    const needs = Array.from(new Set(paid.map(item => item.channel))).filter(channel => blocked.has(channel))
    if (needs.length) {
      const queuedBehind = Object.fromEntries(needs.map(channel => [channel, 0]))
      await db.batch([
        db.prepare(`UPDATE comm_batches SET status = 'awaiting_credits', shortfall = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(queuedBehind), at, batchId),
        db.prepare(`UPDATE comm_deliveries SET status = 'awaiting_credits', updated_at = ? WHERE batch_id = ? AND status = 'planned' AND units > 0`).bind(at, batchId),
      ])
      return 'awaiting_credits'
    }
  }
  const reservationExpiry = new Date(Date.now() + RESERVATION_HOURS * 3600_000).toISOString()
  const ids = paid.map(item => item.id)
  const flip = (sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values)
  const result = await reserveAll(db, tenantId, batchId, requests, {
    expiresAt: reservationExpiry,
    // Only if the whole reservation commits do the paid deliveries become sendable.
    extra: [
      ...ids.map(id => flip(`UPDATE comm_deliveries SET status = 'queued', financial = 'reserved', next_attempt_at = ?, updated_at = ? WHERE id = ?`, at, at, id)),
      flip(`UPDATE comm_batches SET status = 'funded', shortfall = NULL, updated_at = ? WHERE id = ?`, at, batchId),
    ],
  })
  if (result.ok) {
    await refreshCreditPause(deps, tenantId)
    return 'funded'
  }
  await db.batch([
    db.prepare(`UPDATE comm_batches SET status = 'awaiting_credits', shortfall = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(result.shortfall), at, batchId),
    db.prepare(`UPDATE comm_deliveries SET status = 'awaiting_credits', updated_at = ? WHERE batch_id = ? AND status = 'planned' AND units > 0`).bind(at, batchId),
  ])
  for (const channel of Object.keys(result.shortfall) as Channel[]) await setPause(db, tenantId, channel, 'credits', true)
  if (batch.status === 'planned') await warnOwner(deps, tenantId, String(batch.type), result.shortfall)
  return 'awaiting_credits'
}

/** "WhatsApp sending paused. This notice needs 120 units; 10 are available. Buy 110 units for ₦1,672…" */
export async function shortfallMessage(db: D1Database, tenantId: string, type: string, shortfall: Record<string, number>) {
  const wallet = await walletSummary(db, tenantId)
  const parts: string[] = []
  for (const [channel, missing] of Object.entries(shortfall) as Array<[Channel, number]>) {
    const price = await priceAt(db, channel)
    const have = wallet[channel].spendable
    parts.push(`${CHANNEL_LABELS[channel]} sending paused. This ${EVENT_LABELS[type as EventType]?.toLowerCase() || 'notification'} needs ${have + missing} units; ${have} ${have === 1 ? 'is' : 'are'} available. Buy ${missing} units for ${formatNaira(missing * price.unitPriceKobo)}.`)
  }
  parts.push('Email and in-app notifications remain active.')
  return parts.join(' ')
}

async function warnOwner(deps: CommDeps, tenantId: string, type: string, shortfall: Record<string, number>) {
  if (!deps.notifyOwner) return
  const text = await shortfallMessage(deps.db, tenantId, type, shortfall)
  await deps.notifyOwner(tenantId, 'Parent notifications are waiting for message units', text).catch(() => null)
}

/** The credit pause lifts when nothing is waiting for units; other pause reasons are untouched. */
async function refreshCreditPause(deps: CommDeps, tenantId: string) {
  const waiting = await deps.db.prepare(`SELECT shortfall FROM comm_batches WHERE tenant_id = ? AND status = 'awaiting_credits'`).bind(tenantId).all()
  const short = new Set<string>()
  for (const row of (waiting.results || []) as Array<{ shortfall: string }>) for (const channel of Object.keys(json<Record<string, number>>(row.shortfall, {}))) short.add(channel)
  for (const channel of ['whatsapp', 'sms', 'email'] as Channel[]) await setPause(deps.db, tenantId, channel, 'credits', short.has(channel))
}

/**
 * After a purchase or gift: re-check waiting batches strictly oldest first, each admitted
 * only if fully fundable. The first that still cannot be funded stops the run, so units
 * go to the families who have waited longest and a small top-up cannot skip the queue.
 * Obsolete or expired batches are dropped on the way.
 */
export async function readmitWaiting(deps: CommDeps, tenantId: string) {
  const { db } = deps
  await ensureEngineTables(db)
  const rows = ((await db.prepare(`SELECT id, event_id, expires_at FROM comm_batches WHERE tenant_id = ? AND status = 'awaiting_credits' ORDER BY created_at ASC LIMIT 50`).bind(tenantId).all()).results || []) as Array<Record<string, string>>
  const outcome: Record<string, string> = {}
  for (const row of rows) {
    if (row.expires_at && row.expires_at <= nowIso()) { await expireBatch(deps, row.id, 'expired'); outcome[row.id] = 'expired'; continue }
    const event = mapEvent(await db.prepare(`SELECT * FROM comm_events WHERE id = ?`).bind(row.event_id).first() as Record<string, any>)
    if (deps.stillValid && !(await deps.stillValid(event).catch(() => true))) { await expireBatch(deps, row.id, 'cancelled'); outcome[row.id] = 'cancelled'; continue }
    outcome[row.id] = await admitBatch(deps, row.id)
    if (outcome[row.id] === 'awaiting_credits') break
  }
  await refreshCreditPause(deps, tenantId)
  return outcome
}

async function expireBatch(deps: CommDeps, batchId: string, status: 'expired' | 'cancelled') {
  const at = nowIso()
  const rows = ((await deps.db.prepare(`SELECT id, tenant_id FROM comm_deliveries WHERE batch_id = ? AND status IN ('planned', 'awaiting_credits', 'queued')`).bind(batchId).all()).results || []) as Array<Record<string, string>>
  for (const row of rows) await releaseReservation(deps.db, row.tenant_id, row.id, status)
  await deps.db.batch([
    deps.db.prepare(`UPDATE comm_deliveries SET status = ?, financial = CASE WHEN financial = 'reserved' THEN 'released' ELSE financial END, updated_at = ? WHERE batch_id = ? AND status IN ('planned', 'awaiting_credits', 'queued')`).bind(status, at, batchId),
    deps.db.prepare(`UPDATE comm_batches SET status = ?, updated_at = ? WHERE id = ?`).bind(status, at, batchId),
  ])
}

/** A preview for the school, before anything is recorded: the plan and both wallet impacts. */
export async function previewEvent(deps: CommDeps, input: { tenantId: string, type: EventType, scope: Scope, facts?: Record<string, any>, link?: string }) {
  await ensureEngineTables(deps.db)
  const settings = await getSettings(deps.db, input.tenantId)
  const wallet = await walletSummary(deps.db, input.tenantId)
  const event: CommEvent = { id: 'preview', tenantId: input.tenantId, type: input.type, scope: input.scope, facts: { schoolName: '', children: [], ...(input.facts || {}) }, link: input.link || '', dedupeKey: 'preview', status: 'preview', createdBy: '', createdAt: nowIso() }
  const plan = await planEvent(deps, event, settings, wallet.whatsapp.spendable)
  const need = { whatsapp: sum(plan.deliveries, 'whatsapp'), sms: sum(plan.deliveries, 'sms'), email: sum(plan.deliveries, 'email') }
  const shortfall = Object.fromEntries((Object.keys(need) as Channel[]).filter(channel => need[channel] > wallet[channel].spendable).map(channel => [channel, need[channel] - wallet[channel].spendable]))
  return {
    policy: settings.shortagePolicy,
    recipients: new Set(plan.deliveries.map(item => item.guardianId)).size,
    whatsapp: plan.deliveries.filter(item => item.channel === 'whatsapp').length,
    sms: plan.deliveries.filter(item => item.channel === 'sms').length,
    smsSegments: need.sms,
    email: plan.deliveries.filter(item => item.channel === 'email').length,
    inapp: plan.deliveries.filter(item => item.channel === 'inapp').length,
    excluded: plan.excluded.reduce((map, item) => ({ ...map, [item.reason]: (map[item.reason] || 0) + 1 }), {} as Record<string, number>),
    need, available: { whatsapp: wallet.whatsapp.spendable, sms: wallet.sms.spendable, email: wallet.email.spendable }, shortfall,
    warning: Object.keys(shortfall).length ? await shortfallMessage(deps.db, input.tenantId, input.type, shortfall) : '',
    sample: plan.deliveries.find(item => item.channel === 'sms')?.text || plan.deliveries[0]?.text || '',
  }
}

// ─── 4. Dispatch ────────────────────────────────────────────────────────────

async function claimDelivery(db: D1Database, id: string) {
  const until = new Date(Date.now() + 5 * 60_000).toISOString()
  const result = await db.prepare(`UPDATE comm_deliveries SET status = 'submitting', locked_until = ?, updated_at = ? WHERE id = ? AND status = 'queued'`).bind(until, nowIso(), id).run()
  return Boolean(result.meta?.changes)
}

async function recordAttempt(db: D1Database, deliveryId: string, attempt: number, outcome: SendOutcome) {
  await db.prepare(`INSERT INTO comm_attempts (id, delivery_id, attempt, outcome, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(newId('cat'), deliveryId, attempt, outcome.outcome, outcome.error || null, nowIso()).run()
}

/** Send one delivery through its channel and settle its units. */
async function sendDelivery(deps: CommDeps, row: Record<string, any>) {
  const { db } = deps
  if (!(await claimDelivery(db, row.id))) return
  const event = mapEvent(await db.prepare(`SELECT * FROM comm_events WHERE id = ?`).bind(row.event_id).first() as Record<string, any>)
  const settings = await getSettings(db, row.tenant_id)
  const attempt = Number(row.attempts || 0) + 1
  const at = nowIso()
  const finish = (status: string, extra: Record<string, unknown> = {}) => {
    const keys = Object.keys(extra)
    return db.prepare(`UPDATE comm_deliveries SET status = ?, attempts = ?, locked_until = NULL, updated_at = ?${keys.map(key => `, ${key} = ?`).join('')} WHERE id = ?`).bind(status, attempt, at, ...keys.map(key => extra[key]), row.id).run()
  }
  // Still worth sending? Obsolete work is cancelled and its units given back.
  if (deps.stillValid && !(await deps.stillValid(event).catch(() => true))) {
    await releaseReservation(db, row.tenant_id, row.id, 'cancelled')
    await finish('cancelled', { financial: row.financial === 'reserved' ? 'released' : row.financial })
    return
  }
  const studentIds = json<string[]>(row.student_ids, [])
  const names = studentIds.length ? (((await db.prepare(`SELECT name FROM users WHERE id IN (${studentIds.map(() => '?').join(', ')})`).bind(...studentIds).all()).results || []) as Array<{ name: string }>).map(item => String(item.name || '')) : []
  const schoolName = event.facts.schoolName || await deps.schoolName(row.tenant_id)
  const link = event.link || await deps.portalBase(row.tenant_id)
  const message = renderMessage(event.type, { ...event.facts, schoolName, children: names }, settings, link)

  if (row.channel === 'inapp') {
    await addToInbox(db, { tenantId: row.tenant_id, userId: row.guardian_id, eventId: event.id, title: message.title, body: message.text, link })
    await finish('delivered')
    return
  }
  if (row.channel === 'email') {
    if (!deps.sendEmail) { await finish('failed', { error: 'Email is not set up.' }); return }
    try {
      await deps.sendEmail(row.address, message.emailSubject, message.emailHtml)
      await recordAttempt(db, row.id, attempt, { outcome: 'accepted' })
      if (row.financial === 'reserved') await consumeReservation(db, row.tenant_id, row.id)
      await finish('sent', row.financial === 'reserved' ? { financial: 'consumed' } : {})
    } catch (error) {
      await recordAttempt(db, row.id, attempt, { outcome: 'retry', error: String((error as Error)?.message || error).slice(0, 300) })
      if (attempt >= MAX_ATTEMPTS) { await releaseReservation(db, row.tenant_id, row.id, 'failed'); await finish('failed', { error: 'Email could not be sent.', financial: row.financial === 'reserved' ? 'released' : row.financial }) }
      else await finish('queued', { next_attempt_at: new Date(Date.now() + backoff(attempt)).toISOString() })
    }
    return
  }

  // Paid channels: never without a reservation.
  const reserved = await db.prepare(`SELECT COUNT(*) AS n FROM comm_reservations WHERE delivery_id = ? AND status = 'reserved'`).bind(row.id).first() as { n: number } | null
  if (!Number(reserved?.n)) { await finish('failed', { error: 'No units were reserved for this message.' }); return }
  let outcome: SendOutcome
  if (row.channel === 'whatsapp') {
    const template = (await listTemplates(db)).find(item => item.eventType === event.type)
    if (template?.status !== 'approved') outcome = { outcome: 'rejected', error: 'The WhatsApp template is not approved.' }
    else outcome = await sendWhatsAppTemplate(deps.whatsapp, { to: row.address, template: template.metaName, language: template.language, params: message.whatsappParams })
  } else {
    outcome = await sendPayHosSms(deps.sms, { to: row.address, text: message.sms })
  }
  await recordAttempt(db, row.id, attempt, outcome)
  if (outcome.outcome === 'accepted') {
    if (row.channel === 'sms') {
      // PayHos bills on acceptance; it reports nothing more, so "accepted" is final.
      await consumeReservation(db, row.tenant_id, row.id)
      await finish('accepted', { financial: 'consumed' })
    } else {
      // WhatsApp: billed when Meta reports it sent/delivered; the units stay reserved until then.
      await finish('accepted', { provider_id: outcome.providerId || null })
    }
  } else if (outcome.outcome === 'rejected') {
    await releaseReservation(db, row.tenant_id, row.id, 'rejected')
    await finish('failed', { error: outcome.error || 'Refused by the provider.', financial: 'released' })
  } else if (outcome.outcome === 'retry' && attempt < MAX_ATTEMPTS) {
    await finish('queued', { error: outcome.error || null, next_attempt_at: new Date(Date.now() + backoff(attempt)).toISOString() })
  } else if (outcome.outcome === 'retry') {
    await releaseReservation(db, row.tenant_id, row.id, 'gave up')
    await finish('failed', { error: outcome.error || 'The provider stayed busy.', financial: 'released' })
  } else {
    // Unknown: it may have gone. Keep the units reserved and let reconciliation decide.
    await finish('unknown', { error: outcome.error || 'No answer from the provider.', financial: 'reconciliation_required' })
  }
}

const backoff = (attempt: number) => Math.min(60, 2 ** attempt) * 60_000

export async function dispatchDue(deps: CommDeps, limit = DISPATCH_PER_TICK) {
  const { db } = deps
  await ensureEngineTables(db)
  const at = nowIso()
  // Work stuck in "submitting" (a Worker died mid-send) is unknown, never resent blindly.
  await db.prepare(`UPDATE comm_deliveries SET status = 'unknown', financial = CASE WHEN financial = 'reserved' THEN 'reconciliation_required' ELSE financial END, error = 'Interrupted while sending.', locked_until = NULL, updated_at = ?
    WHERE status = 'submitting' AND locked_until < ? AND channel IN ('whatsapp', 'sms')`).bind(at, at).run()
  await db.prepare(`UPDATE comm_deliveries SET status = 'queued', locked_until = NULL, updated_at = ? WHERE status = 'submitting' AND locked_until < ? AND channel IN ('inapp', 'email')`).bind(at, at).run()
  const rows = ((await db.prepare(`SELECT * FROM comm_deliveries WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY CASE channel WHEN 'inapp' THEN 0 WHEN 'email' THEN 1 ELSE 2 END, created_at ASC LIMIT ?`).bind(at, limit).all()).results || []) as Record<string, any>[]
  for (const row of rows) await sendDelivery(deps, row).catch(error => console.error('Notification send failed', row.id, error))
  // Batches whose deliveries are all settled are done.
  await db.prepare(`UPDATE comm_batches SET status = 'done', updated_at = ? WHERE status = 'funded' AND NOT EXISTS (SELECT 1 FROM comm_deliveries d WHERE d.batch_id = comm_batches.id AND d.status IN ('planned', 'queued', 'submitting', 'awaiting_credits'))`).bind(at).run()
  return rows.length
}

// ─── Webhooks and reconciliation ────────────────────────────────────────────

/** Meta status webhooks: settle WhatsApp units (sent/delivered/read consume; failed releases). Each event once. */
export async function applyWhatsAppStatuses(db: D1Database, statuses: Array<{ providerId: string, status: string, at: string, error?: string, eventKey: string }>) {
  await ensureEngineTables(db)
  let applied = 0
  for (const item of statuses) {
    const fresh = await db.prepare(`INSERT OR IGNORE INTO comm_webhook_events (event_key, provider, received_at) VALUES (?, 'meta', ?)`).bind(item.eventKey, nowIso()).run()
    if (!Number(fresh.meta?.changes)) continue
    const row = await db.prepare(`SELECT * FROM comm_deliveries WHERE provider_id = ? AND channel = 'whatsapp'`).bind(item.providerId).first() as Record<string, any> | null
    if (!row) continue
    applied += 1
    if (item.status === 'failed') {
      if (row.financial !== 'consumed') await releaseReservation(db, row.tenant_id, row.id, 'failed')
      await db.prepare(`UPDATE comm_deliveries SET status = 'failed', error = ?, financial = CASE WHEN financial = 'consumed' THEN 'consumed' ELSE 'released' END, updated_at = ? WHERE id = ?`).bind(item.error || 'WhatsApp could not deliver it.', nowIso(), row.id).run()
      continue
    }
    await consumeReservation(db, row.tenant_id, row.id)
    // States only move forward: accepted → sent → delivered → read.
    const order = ['accepted', 'unknown', 'sent', 'delivered', 'read']
    const next = order.indexOf(item.status) > order.indexOf(String(row.status)) ? item.status : row.status
    await db.prepare(`UPDATE comm_deliveries SET status = ?, financial = 'consumed', updated_at = ? WHERE id = ?`).bind(next, nowIso(), row.id).run()
  }
  return applied
}

/** Stale reservations and long-silent WhatsApp acceptances go to a person, not a guess. */
export async function reconcile(deps: CommDeps) {
  const { db } = deps
  await ensureEngineTables(db)
  const at = nowIso()
  const silentBefore = new Date(Date.now() - WHATSAPP_ACCEPTED_GRACE_HOURS * 3600_000).toISOString()
  await db.prepare(`UPDATE comm_deliveries SET status = 'unknown', financial = 'reconciliation_required', error = 'WhatsApp never reported on this message.', updated_at = ? WHERE channel = 'whatsapp' AND status = 'accepted' AND financial = 'reserved' AND updated_at < ?`).bind(at, silentBefore).run()
  // Reservations past their window for work that never started: give the units back.
  const stale = ((await db.prepare(`SELECT DISTINCT r.delivery_id, r.tenant_id FROM comm_reservations r JOIN comm_deliveries d ON d.id = r.delivery_id WHERE r.status = 'reserved' AND r.expires_at <= ? AND d.status IN ('queued', 'awaiting_credits', 'cancelled', 'expired') LIMIT 100`).bind(at).all()).results || []) as Array<Record<string, string>>
  for (const row of stale) {
    await releaseReservation(db, row.tenant_id, row.delivery_id, 'stale')
    await db.prepare(`UPDATE comm_deliveries SET status = CASE WHEN status = 'queued' THEN 'expired' ELSE status END, financial = 'released', updated_at = ? WHERE id = ?`).bind(at, row.delivery_id).run()
  }
  // Waiting batches past their retention are dropped.
  const old = ((await db.prepare(`SELECT id FROM comm_batches WHERE status = 'awaiting_credits' AND expires_at <= ? LIMIT 50`).bind(at).all()).results || []) as Array<{ id: string }>
  for (const row of old) await expireBatch(deps, row.id, 'expired')
  await expireGrants(db)
}

/** Super Admin: settle an unknown delivery after checking with the provider. */
export async function resolveUnknown(db: D1Database, deliveryId: string, decision: 'sent' | 'not_sent', actor: string) {
  const row = await db.prepare(`SELECT * FROM comm_deliveries WHERE id = ?`).bind(deliveryId).first() as Record<string, any> | null
  if (!row || row.status !== 'unknown') throw new Error('Only an unknown delivery can be resolved.')
  if (decision === 'sent') await consumeReservation(db, row.tenant_id, row.id)
  else await releaseReservation(db, row.tenant_id, row.id, `resolved by ${actor}`)
  await db.prepare(`UPDATE comm_deliveries SET status = ?, financial = ?, error = ?, updated_at = ? WHERE id = ?`)
    .bind(decision === 'sent' ? 'sent' : 'failed', decision === 'sent' ? 'consumed' : 'released', `Resolved by ${actor}`, nowIso(), row.id).run()
}

// ─── 5. Scheduled notifications ─────────────────────────────────────────────

/** Local date and HH:MM for a school's timezone (Lagos by default). */
export function localClock(date: Date, timezone = 'Africa/Lagos') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value || '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}` }
}

async function claimRun(db: D1Database, tenantId: string, kind: string, runDate: string) {
  const result = await db.prepare(`INSERT OR IGNORE INTO comm_scheduler_runs (tenant_id, kind, run_date) VALUES (?, ?, ?)`).bind(tenantId, kind, runDate).run()
  return Boolean(result.meta?.changes)
}

/**
 * Fee reminders: checked daily (08:00 school time), sent per account every N days
 * while a balance is outstanding. The balance is the fee system's own figure, read
 * again just before sending. Missed reminders are never replayed: at most one current
 * reminder per account is ever pending.
 */
export async function scheduleFeeReminders(deps: CommDeps, tenantId: string, loadAccounts: () => Promise<Array<{ studentId: string, termName?: string }>>) {
  const { db } = deps
  const settings = await getSettings(db, tenantId)
  if (!settings.events.fee_reminder || !deps.balanceKobo) return 0
  const now = (deps.now?.() || new Date())
  const clock = localClock(now, settings.timezone)
  if (clock.time < '08:00' || !(await claimRun(db, tenantId, 'fee_reminders', clock.date))) return 0
  // Loaded only once the day's run is claimed: the accounts are read once a day, not every minute.
  const accounts = await loadAccounts()
  let created = 0
  for (const account of accounts) {
    const state = await db.prepare(`SELECT * FROM comm_reminder_state WHERE tenant_id = ? AND student_id = ?`).bind(tenantId, account.studentId).first() as Record<string, any> | null
    if (state?.paused) continue
    const firstDue = settings.initialReminderDate ? `${settings.initialReminderDate}T07:00:00.000Z` : null
    const due = state?.next_due_at || firstDue || (await firstReminderAfterBill(db, tenantId, account.studentId, settings.reminderIntervalDays))
    if (!due || due > now.toISOString()) continue
    const pending = await db.prepare(`SELECT 1 FROM comm_events WHERE tenant_id = ? AND type = 'fee_reminder' AND scope = ? AND status IN ('new', 'planned') AND id IN (SELECT event_id FROM comm_batches WHERE status IN ('planned', 'awaiting_credits')) LIMIT 1`)
      .bind(tenantId, JSON.stringify({ kind: 'students', studentIds: [account.studentId] })).first()
    if (pending) continue
    const balance = await deps.balanceKobo(tenantId, account.studentId).catch(() => null)
    if (!balance || balance <= 0) continue
    const id = await recordEvent(db, { tenantId, type: 'fee_reminder', scope: { kind: 'students', studentIds: [account.studentId] }, facts: { amountKobo: balance, term: account.termName || '' }, dedupeKey: `fee_reminder:${account.studentId}:${clock.date}` })
    if (!id) continue
    created += 1
    const next = new Date(now.getTime() + settings.reminderIntervalDays * 86400_000).toISOString()
    await db.prepare(`INSERT INTO comm_reminder_state (tenant_id, student_id, last_sent_at, next_due_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id, student_id) DO UPDATE SET last_sent_at = excluded.last_sent_at, next_due_at = excluded.next_due_at`)
      .bind(tenantId, account.studentId, now.toISOString(), next).run()
  }
  return created
}

/** The first reminder is due N days after the bill notice reached the family. */
async function firstReminderAfterBill(db: D1Database, tenantId: string, studentId: string, days: number) {
  const row = await db.prepare(`SELECT MIN(d.updated_at) AS at FROM comm_deliveries d JOIN comm_events e ON e.id = d.event_id
    WHERE e.tenant_id = ? AND e.type = 'fee_bill' AND d.status IN ('accepted', 'sent', 'delivered', 'read') AND d.student_ids LIKE ?`).bind(tenantId, `%"${studentId}"%`).first() as { at: string | null } | null
  return row?.at ? new Date(Date.parse(row.at) + days * 86400_000).toISOString() : null
}

/** Once a day at the school's digest time: one message per class listing the day's new work. */
export async function scheduleAssignmentDigest(deps: CommDeps, tenantId: string, loadAssignments: (localDate: string) => Promise<Array<{ classId: string, title: string, subject?: string }>>) {
  const { db } = deps
  const settings = await getSettings(db, tenantId)
  if (settings.assignmentMode !== 'digest' || !settings.events.assignment_digest) return 0
  const clock = localClock(deps.now?.() || new Date(), settings.timezone)
  if (clock.time < settings.digestTime || !(await claimRun(db, tenantId, 'assignment_digest', clock.date))) return 0
  const assignmentsToday = await loadAssignments(clock.date)
  const byClass = new Map<string, Array<{ title: string, subject?: string }>>()
  for (const item of assignmentsToday) byClass.set(item.classId, [...(byClass.get(item.classId) || []), item])
  let created = 0
  for (const [classId, items] of byClass) {
    const id = await recordEvent(db, {
      tenantId, type: 'assignment_digest', scope: { kind: 'class', classIds: [classId] },
      facts: { count: items.length, items: items.map(item => `${item.subject ? `${item.subject}: ` : ''}${item.title}`) }, dedupeKey: `digest:${classId}:${clock.date}`,
    })
    if (id) created += 1
  }
  return created
}

/**
 * Deadline reminders: once a day at the digest time, for work due within the school's
 * window. Families whose child already handed it in are left out (the caller passes the
 * students still to submit); each assignment is reminded once.
 */
export async function scheduleDeadlineReminders(deps: CommDeps, tenantId: string, loadDue: (untilIso: string) => Promise<Array<{ assignmentId: string, title: string, dueAt: string, pendingStudentIds: string[] }>>) {
  const { db } = deps
  const settings = await getSettings(db, tenantId)
  if (!settings.events.deadline || !settings.deadlineHoursBefore) return 0
  const now = deps.now?.() || new Date()
  const clock = localClock(now, settings.timezone)
  if (clock.time < settings.digestTime || !(await claimRun(db, tenantId, 'deadline_reminders', clock.date))) return 0
  let created = 0
  for (const item of await loadDue(new Date(now.getTime() + settings.deadlineHoursBefore * 3600_000).toISOString())) {
    if (!item.pendingStudentIds.length) continue
    const id = await recordEvent(db, { tenantId, type: 'deadline', scope: { kind: 'students', studentIds: item.pendingStudentIds }, facts: { title: item.title, dueAt: item.dueAt, assignmentId: item.assignmentId }, dedupeKey: `deadline:${item.assignmentId}` })
    if (id) created += 1
  }
  return created
}

// ─── The minute tick ────────────────────────────────────────────────────────

export async function processNewEvents(deps: CommDeps, limit = 10) {
  const { db } = deps
  await ensureEngineTables(db)
  const rows = ((await db.prepare(`SELECT * FROM comm_events WHERE status = 'new' ORDER BY created_at ASC LIMIT ?`).bind(limit).all()).results || []) as Record<string, any>[]
  for (const row of rows) {
    // Claim it first, so two ticks never plan the same event.
    const claim = await db.prepare(`UPDATE comm_events SET status = 'planning' WHERE id = ? AND status = 'new'`).bind(row.id).run()
    if (!Number(claim.meta?.changes)) continue
    try {
      await createBatch(deps, mapEvent(row))
    } catch (error) {
      console.error('Notification planning failed', row.id, error)
      await db.prepare(`UPDATE comm_events SET status = 'new' WHERE id = ? AND status = 'planning'`).bind(row.id).run()
    }
  }
  return rows.length
}

export async function commTick(deps: CommDeps) {
  await processNewEvents(deps)
  await dispatchDue(deps)
  if ((deps.now?.() || new Date()).getUTCMinutes() % 10 === 0) await reconcile(deps)
}

// ─── Reading it back (school screens) ───────────────────────────────────────

export async function overview(db: D1Database, tenantId: string) {
  await ensureEngineTables(db)
  const settings = await getSettings(db, tenantId)
  const wallet = await walletSummary(db, tenantId)
  const waiting = ((await db.prepare(`SELECT id, type, shortfall, counts, created_at FROM comm_batches WHERE tenant_id = ? AND status = 'awaiting_credits' ORDER BY created_at ASC`).bind(tenantId).all()).results || []) as Record<string, any>[]
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const stats = ((await db.prepare(`SELECT channel, status, COUNT(*) AS n FROM comm_deliveries WHERE tenant_id = ? AND created_at >= ? GROUP BY channel, status`).bind(tenantId, since).all()).results || []) as Array<{ channel: string, status: string, n: number }>
  const warnings: string[] = []
  for (const batch of waiting.slice(0, 3)) warnings.push(await shortfallMessage(db, tenantId, batch.type, json(batch.shortfall, {})))
  return {
    settings, wallet,
    waiting: waiting.map(batch => ({ id: batch.id, type: batch.type, label: EVENT_LABELS[batch.type as EventType] || batch.type, shortfall: json(batch.shortfall, {}), counts: json(batch.counts, {}), createdAt: batch.created_at })),
    warnings,
    last30Days: stats,
    automation: (['whatsapp', 'sms', 'email'] as Channel[]).map(channel => ({ channel, paused: (settings.pauses[channel] || []).length > 0, reasons: settings.pauses[channel] || [] })),
  }
}

export async function deliveryHistory(db: D1Database, tenantId: string, filters: { channel?: string, status?: string, limit?: number } = {}) {
  await ensureEngineTables(db)
  const where = ['d.tenant_id = ?']
  const values: unknown[] = [tenantId]
  if (filters.channel) { where.push('d.channel = ?'); values.push(filters.channel) }
  if (filters.status) { where.push('d.status = ?'); values.push(filters.status) }
  const rows = ((await db.prepare(`SELECT d.id, d.channel, d.status, d.financial, d.units, d.error, d.created_at AS createdAt, d.updated_at AS updatedAt, e.type, u.name AS guardianName
    FROM comm_deliveries d JOIN comm_events e ON e.id = d.event_id LEFT JOIN users u ON u.id = d.guardian_id
    WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT ?`).bind(...values, Math.min(500, filters.limit || 200)).all()).results || []) as Record<string, any>[]
  // A provider's acceptance is never shown as "delivered".
  return rows.map(row => ({ ...row, label: EVENT_LABELS[row.type as EventType] || row.type }))
}

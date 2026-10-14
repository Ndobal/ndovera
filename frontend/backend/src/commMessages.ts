// Parent notifications (N20) — school settings, contacts and consent, and the messages themselves.
//
// What a parent receives is short and discreet by default: it says information is
// available and links to Ndovera, where they sign in to see it. Children's names
// and amounts are included only when the school turns on detailed messages. Scores
// are never put in a message.

import { CommError, ensureCommTables, newId, nowIso, type Channel } from './commCredits'

export const EVENT_TYPES = ['fee_bill', 'fee_reminder', 'receipt', 'fee_cleared', 'results', 'assignment', 'assignment_digest', 'deadline', 'notice'] as const
export type EventType = typeof EVENT_TYPES[number]
export const EVENT_LABELS: Record<EventType, string> = {
  fee_bill: 'Term fees published', fee_reminder: 'Fee reminder', receipt: 'Payment receipt', fee_cleared: 'Fees fully paid',
  results: 'Results published', assignment: 'New assignment', assignment_digest: 'Daily assignment summary', deadline: 'Deadline reminder', notice: 'School notice',
}

export type ShortagePolicy = 'PAUSE_BATCH' | 'SMS_FOR_REMAINDER'

export type CommSettings = {
  tenantId: string
  /** Off until the school's Owner or HoS turns parent notifications on. */
  active: boolean
  whatsappEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  shortagePolicy: ShortagePolicy
  /** The school confirms it collected parents' agreement to WhatsApp/SMS messages at enrolment. */
  consentConfirmed: boolean
  guardianMode: 'designated' | 'all'
  detailedMessages: boolean
  assignmentMode: 'each' | 'digest' | 'off'
  digestTime: string
  deadlineHoursBefore: number
  reminderIntervalDays: number
  initialReminderDate: string
  arrearsNextTerm: boolean
  timezone: string
  events: Record<EventType, boolean>
  pauses: Record<string, string[]>
  updatedBy: string
  updatedAt: string
}

export const DEFAULT_SETTINGS: Omit<CommSettings, 'tenantId'> = {
  active: false,
  whatsappEnabled: true,
  smsEnabled: true,
  emailEnabled: true,
  shortagePolicy: 'PAUSE_BATCH',
  consentConfirmed: false,
  guardianMode: 'designated',
  detailedMessages: false,
  assignmentMode: 'digest',
  digestTime: '17:00',
  deadlineHoursBefore: 24,
  reminderIntervalDays: 14,
  initialReminderDate: '',
  arrearsNextTerm: false,
  timezone: 'Africa/Lagos',
  events: Object.fromEntries(EVENT_TYPES.map(type => [type, true])) as Record<EventType, boolean>,
  pauses: {},
  updatedBy: '',
  updatedAt: '',
}

const readyDbs = new WeakSet<object>()
export async function ensureMessageTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await ensureCommTables(db)
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS comm_settings (tenant_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS comm_consents (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, guardian_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL, source TEXT, actor TEXT, updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, guardian_id, channel))`,
    `CREATE TABLE IF NOT EXISTS comm_designations (tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, guardian_id TEXT NOT NULL, updated_by TEXT, updated_at TEXT, PRIMARY KEY (tenant_id, student_id))`,
    `CREATE TABLE IF NOT EXISTS comm_templates (event_type TEXT PRIMARY KEY, meta_name TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en', status TEXT NOT NULL DEFAULT 'pending', note TEXT, updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS comm_inbox (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, event_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT, read_at TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_inbox_user ON comm_inbox(user_id, created_at)`,
  ]) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

// ─── Settings ───────────────────────────────────────────────────────────────

const pickBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export async function getSettings(db: D1Database, tenantId: string): Promise<CommSettings> {
  await ensureMessageTables(db)
  const row = await db.prepare(`SELECT payload FROM comm_settings WHERE tenant_id = ?`).bind(tenantId).first() as { payload: string } | null
  let stored: Partial<CommSettings> = {}
  try { stored = row ? JSON.parse(row.payload) : {} } catch { stored = {} }
  return { ...DEFAULT_SETTINGS, ...stored, events: { ...DEFAULT_SETTINGS.events, ...(stored.events || {}) }, pauses: stored.pauses || {}, tenantId }
}

async function writeSettings(db: D1Database, settings: CommSettings) {
  await db.prepare(`INSERT INTO comm_settings (tenant_id, payload, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(settings.tenantId, JSON.stringify(settings), settings.updatedBy, settings.updatedAt).run()
}

/** What the Owner or HoS may change. SMS fallback needs the cost explanation acknowledged. */
export async function updateSettings(db: D1Database, tenantId: string, input: Record<string, any>, actor: string) {
  const current = await getSettings(db, tenantId)
  const next: CommSettings = { ...current }
  next.active = pickBool(input.active, current.active)
  next.whatsappEnabled = pickBool(input.whatsappEnabled, current.whatsappEnabled)
  next.smsEnabled = pickBool(input.smsEnabled, current.smsEnabled)
  next.emailEnabled = pickBool(input.emailEnabled, current.emailEnabled)
  next.consentConfirmed = pickBool(input.consentConfirmed, current.consentConfirmed)
  next.detailedMessages = pickBool(input.detailedMessages, current.detailedMessages)
  next.arrearsNextTerm = pickBool(input.arrearsNextTerm, current.arrearsNextTerm)
  if (input.shortagePolicy !== undefined) {
    if (!['PAUSE_BATCH', 'SMS_FOR_REMAINDER'].includes(input.shortagePolicy)) throw new CommError('Choose how to handle a WhatsApp shortage.')
    if (input.shortagePolicy === 'SMS_FOR_REMAINDER' && current.shortagePolicy !== 'SMS_FOR_REMAINDER' && input.acknowledgeSmsCost !== true) {
      throw new CommError('Confirm that SMS units will be used for parents WhatsApp cannot cover, at the SMS price per segment.')
    }
    next.shortagePolicy = input.shortagePolicy
  }
  if (input.guardianMode !== undefined) {
    if (!['designated', 'all'].includes(input.guardianMode)) throw new CommError('Choose who receives notifications.')
    next.guardianMode = input.guardianMode
  }
  if (input.assignmentMode !== undefined) {
    if (!['each', 'digest', 'off'].includes(input.assignmentMode)) throw new CommError('Choose how assignment notifications are sent.')
    next.assignmentMode = input.assignmentMode
  }
  if (input.digestTime !== undefined) {
    if (!TIME.test(String(input.digestTime))) throw new CommError('The digest time must be HH:MM.')
    next.digestTime = String(input.digestTime)
  }
  if (input.deadlineHoursBefore !== undefined) {
    const hours = Number(input.deadlineHoursBefore)
    if (!Number.isInteger(hours) || hours < 0 || hours > 168) throw new CommError('Deadline reminders: 0 to 168 hours before (0 turns them off).')
    next.deadlineHoursBefore = hours
  }
  if (input.reminderIntervalDays !== undefined) {
    const days = Number(input.reminderIntervalDays)
    if (!Number.isInteger(days) || days < 7 || days > 60) throw new CommError('Fee reminders: every 7 to 60 days.')
    next.reminderIntervalDays = days
  }
  if (input.initialReminderDate !== undefined) {
    const value = String(input.initialReminderDate || '')
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CommError('The first reminder date must be YYYY-MM-DD.')
    next.initialReminderDate = value
  }
  if (input.events && typeof input.events === 'object') {
    for (const type of EVENT_TYPES) if (typeof input.events[type] === 'boolean') next.events[type] = input.events[type]
  }
  next.updatedBy = actor
  next.updatedAt = nowIso()
  await writeSettings(db, next)
  return next
}

/** Pause reasons are kept per channel and are independent: a purchase clears only 'credits'. */
export async function setPause(db: D1Database, tenantId: string, channel: Channel, reason: string, on: boolean) {
  const settings = await getSettings(db, tenantId)
  const reasons = new Set(settings.pauses[channel] || [])
  if (on === reasons.has(reason)) return settings
  if (on) reasons.add(reason)
  else reasons.delete(reason)
  settings.pauses = { ...settings.pauses, [channel]: Array.from(reasons) }
  settings.updatedAt = nowIso()
  await writeSettings(db, settings)
  return settings
}

// ─── Contacts and consent ───────────────────────────────────────────────────

/** A phone number in international form (+234…), or '' when it cannot be one. */
export function normalizePhone(raw: unknown) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}` // Nigerian local form
  if (digits.startsWith('234')) return /^234[789][01]\d{8}$/.test(digits) ? `+${digits}` : ''
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : ''
}

export const normalizeEmail = (raw: unknown) => {
  const email = String(raw || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : ''
}

export async function consentsFor(db: D1Database, tenantId: string, guardianIds: string[]) {
  await ensureMessageTables(db)
  const out = new Map<string, Record<string, string>>()
  for (let start = 0; start < guardianIds.length; start += 90) {
    const slice = guardianIds.slice(start, start + 90)
    if (!slice.length) continue
    const rows = ((await db.prepare(`SELECT guardian_id, channel, status FROM comm_consents WHERE tenant_id = ? AND guardian_id IN (${slice.map(() => '?').join(', ')})`).bind(tenantId, ...slice).all()).results || []) as Array<Record<string, string>>
    for (const row of rows) out.set(row.guardian_id, { ...(out.get(row.guardian_id) || {}), [row.channel]: row.status })
  }
  return out
}

/** A parent (or the school for them) grants or withdraws a channel. Withdrawal always wins over the school's general confirmation. */
export async function setConsent(db: D1Database, tenantId: string, guardianId: string, channel: unknown, status: unknown, source: string, actor: string) {
  if (!['whatsapp', 'sms', 'email'].includes(String(channel))) throw new CommError('Choose WhatsApp, SMS or email.')
  if (!['granted', 'withdrawn'].includes(String(status))) throw new CommError('Choose granted or withdrawn.')
  await ensureMessageTables(db)
  await db.prepare(`INSERT INTO comm_consents (id, tenant_id, guardian_id, channel, status, source, actor, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, guardian_id, channel) DO UPDATE SET status = excluded.status, source = excluded.source, actor = excluded.actor, updated_at = excluded.updated_at`)
    .bind(newId('ccs'), tenantId, guardianId, channel, status, source, actor, nowIso()).run()
}

export async function setDesignation(db: D1Database, tenantId: string, studentId: string, guardianId: string, actor: string) {
  await ensureMessageTables(db)
  await db.prepare(`INSERT INTO comm_designations (tenant_id, student_id, guardian_id, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, student_id) DO UPDATE SET guardian_id = excluded.guardian_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, studentId, guardianId, actor, nowIso()).run()
}

// ─── WhatsApp templates ─────────────────────────────────────────────────────

/**
 * One approved Meta template per event, owned by Ndovera's WhatsApp number. The body
 * parameters are always, in order: school name, the information line, the link.
 * Meta must approve each template before WhatsApp can carry that event.
 */
export const TEMPLATE_DEFAULTS: Record<EventType, { name: string, body: string }> = {
  fee_bill: { name: 'ndovera_fee_bill', body: '{{1}}: {{2}} Sign in to view: {{3}}' },
  fee_reminder: { name: 'ndovera_fee_reminder', body: '{{1}}: {{2}} Sign in to view or pay: {{3}}' },
  receipt: { name: 'ndovera_payment_receipt', body: '{{1}}: {{2}} Your receipt: {{3}}' },
  fee_cleared: { name: 'ndovera_fees_cleared', body: '{{1}}: {{2}} Details: {{3}}' },
  results: { name: 'ndovera_results_published', body: '{{1}}: {{2}} Sign in to view: {{3}}' },
  assignment: { name: 'ndovera_new_assignment', body: '{{1}}: {{2}} Details: {{3}}' },
  assignment_digest: { name: 'ndovera_assignment_digest', body: '{{1}}: {{2}} Details: {{3}}' },
  deadline: { name: 'ndovera_deadline_reminder', body: '{{1}}: {{2}} Details: {{3}}' },
  notice: { name: 'ndovera_school_notice', body: '{{1}}: {{2}} Read it here: {{3}}' },
}

export async function listTemplates(db: D1Database) {
  await ensureMessageTables(db)
  const rows = ((await db.prepare(`SELECT * FROM comm_templates`).all()).results || []) as Record<string, any>[]
  return EVENT_TYPES.map(type => {
    const row = rows.find(item => item.event_type === type)
    return { eventType: type, label: EVENT_LABELS[type], metaName: row?.meta_name || TEMPLATE_DEFAULTS[type].name, language: row?.language || 'en', status: row?.status || 'pending', note: row?.note || '', body: TEMPLATE_DEFAULTS[type].body, updatedAt: row?.updated_at || null }
  })
}

export async function setTemplate(db: D1Database, eventType: unknown, input: { metaName?: unknown, language?: unknown, status?: unknown, note?: unknown }, actor: string) {
  if (!EVENT_TYPES.includes(eventType as EventType)) throw new CommError('Unknown notification type.', 404)
  const status = String(input.status || 'pending')
  if (!['pending', 'approved', 'rejected', 'paused'].includes(status)) throw new CommError('Status must be pending, approved, rejected or paused.')
  const metaName = String(input.metaName || TEMPLATE_DEFAULTS[eventType as EventType].name).trim().toLowerCase()
  if (!/^[a-z0-9_]{1,512}$/.test(metaName)) throw new CommError('Template names use lowercase letters, digits and underscores.')
  const language = String(input.language || 'en').trim()
  await ensureMessageTables(db)
  await db.prepare(`INSERT INTO comm_templates (event_type, meta_name, language, status, note, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_type) DO UPDATE SET meta_name = excluded.meta_name, language = excluded.language, status = excluded.status, note = excluded.note, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(eventType, metaName, language, status, String(input.note || '').slice(0, 500), actor, nowIso()).run()
  return listTemplates(db)
}

// ─── The words ──────────────────────────────────────────────────────────────

export type MessageFacts = {
  schoolName: string
  children: string[]
  term?: string
  amountKobo?: number
  title?: string
  subject?: string
  dueAt?: string
  count?: number
  items?: string[]
  // A receipt number says nothing about the child, so it is shown even in discreet messages.
  receiptNo?: string
}

const naira = (kobo: number) => `NGN ${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
const firstNames = (children: string[]) => children.map(name => String(name || '').trim().split(/\s+/)[0]).filter(Boolean)
const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
const shortDate = (iso?: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })
}

/**
 * The information line for an event. Discreet unless the school turned on detailed
 * messages; never a score.
 */
export function informationLine(type: EventType, facts: MessageFacts, detailed: boolean) {
  const who = detailed && facts.children.length ? listNames(firstNames(facts.children)) : ''
  const forWho = who ? ` for ${who}` : ''
  const amount = detailed && facts.amountKobo ? ` (${naira(facts.amountKobo)})` : ''
  const term = facts.term ? ` ${facts.term}` : ''
  switch (type) {
    case 'fee_bill': return `New${term} fee information${forWho} is available${amount}.`
    case 'fee_reminder': return `A fee balance${forWho} is outstanding${amount}.`
    case 'receipt': return `Payment received${forWho}${amount}.${facts.receiptNo ? ` Receipt ${facts.receiptNo} is in your Ndovera account.` : ''} Thank you.`
    case 'fee_cleared': return `Fees${forWho}${term ? ` for${term}` : ''} are fully paid. Thank you.`
    case 'results': return `${term ? `${term.trim()} r` : 'R'}esults${forWho} have been published.`
    case 'assignment': return detailed && facts.title ? `New ${facts.subject ? `${facts.subject} ` : ''}work${forWho}: ${facts.title}${facts.dueAt ? `, due ${shortDate(facts.dueAt)}` : ''}.` : `New school work${forWho} has been set.`
    case 'assignment_digest': return `${facts.count || 0} new assignment${facts.count === 1 ? '' : 's'}${forWho} today${detailed && facts.items?.length ? `: ${facts.items.slice(0, 3).join('; ')}${facts.items.length > 3 ? '…' : ''}` : ''}.`
    case 'deadline': return `Reminder: ${detailed && facts.title ? facts.title : 'school work'}${forWho} is due ${shortDate(facts.dueAt) || 'soon'}.`
    case 'notice':
    default: return detailed && facts.title ? `New notice: ${facts.title}.` : 'There is a new notice from the school.'
  }
}

/** SMS: plain characters only (no ₦, curly quotes or emoji, which make a message cost more). */
export function smsSafe(text: string) {
  return String(text || '')
    .replace(/₦/g, 'NGN ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '').replace(/[ \t]+/g, ' ').trim()
}

/** PayHos bills by 153-character page (its published rule); at least one page. */
export const SMS_PAGE_CHARS = 153
export const smsSegments = (text: string) => Math.max(1, Math.ceil(smsSafe(text).length / SMS_PAGE_CHARS))

export function renderMessage(type: EventType, facts: MessageFacts, settings: Pick<CommSettings, 'detailedMessages'>, link: string) {
  const line = informationLine(type, facts, settings.detailedMessages)
  const school = String(facts.schoolName || 'Your school').trim()
  const text = `${school}: ${line} ${link}`.trim()
  const sms = smsSafe(text)
  return {
    title: EVENT_LABELS[type],
    text,
    sms,
    smsSegments: smsSegments(sms),
    whatsappParams: [school, line, link],
    emailSubject: `${school}: ${EVENT_LABELS[type]}`,
    emailHtml: `<p>${escapeHtml(school)}</p><p>${escapeHtml(line)}</p><p><a href="${escapeHtml(link)}">Open Ndovera</a></p><p style="color:#666;font-size:12px">You receive this because you are a parent or guardian at ${escapeHtml(school)}. To stop these emails, change your notification choices in Ndovera.</p>`,
  }
}

const escapeHtml = (value: string) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

// ─── In-app inbox ───────────────────────────────────────────────────────────

export async function addToInbox(db: D1Database, input: { tenantId: string, userId: string, eventId: string, title: string, body: string, link: string }) {
  await ensureMessageTables(db)
  await db.prepare(`INSERT INTO comm_inbox (id, tenant_id, user_id, event_id, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId('cib'), input.tenantId, input.userId, input.eventId, input.title.slice(0, 200), input.body.slice(0, 2000), input.link, nowIso()).run()
}

export async function listInbox(db: D1Database, tenantId: string, userId: string, limit = 50) {
  await ensureMessageTables(db)
  return ((await db.prepare(`SELECT id, title, body, link, read_at AS readAt, created_at AS createdAt FROM comm_inbox WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, userId, limit).all()).results || []) as Record<string, any>[]
}

export async function markInboxRead(db: D1Database, tenantId: string, userId: string, ids: string[]) {
  await ensureMessageTables(db)
  const at = nowIso()
  if (!ids.length) await db.prepare(`UPDATE comm_inbox SET read_at = ? WHERE tenant_id = ? AND user_id = ? AND read_at IS NULL`).bind(at, tenantId, userId).run()
  else for (const id of ids.slice(0, 100)) await db.prepare(`UPDATE comm_inbox SET read_at = ? WHERE id = ? AND tenant_id = ? AND user_id = ? AND read_at IS NULL`).bind(at, id, tenantId, userId).run()
}

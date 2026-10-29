// Signing in with a phone number. Each number belongs to one account (`login_phones`), so a
// sign-in is one keyed read, never a scan of everyone's settings. Numbers are stored in one
// form (Nigerian numbers as 234…), so "0803 123 4567", "+234 803 123 4567" and
// "2348031234567" are the same number.

/** The stored form of a phone number, or '' when it is not one. */
export function normalizePhone(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw || /[a-z@]/i.test(raw)) return ''
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = `234${digits.slice(1)}`
  else if (digits.length === 10 && /^[789]/.test(digits)) digits = `234${digits}`
  return digits.length >= 10 && digits.length <= 15 ? digits : ''
}

/** A sign-in name that is a phone number rather than an email or an ID. */
export function looksLikePhone(value: unknown) {
  const raw = String(value ?? '').trim()
  return /^[+\d][\d\s().-]{8,}$/.test(raw) && Boolean(normalizePhone(raw))
}

const readyDbs = new WeakSet<object>()
export async function ensureLoginPhonesTable(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS login_phones (phone TEXT PRIMARY KEY, user_id TEXT NOT NULL, settings_key TEXT NOT NULL, tenant_id TEXT, updated_at TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_login_phones_user ON login_phones(user_id)`).run()
  readyDbs.add(db as object)
}

export class PhoneTakenError extends Error {}

/**
 * Make `phone` this account's sign-in number (replacing any number it had). A number that
 * already belongs to someone else is refused, naming them, so two people never share one.
 */
export async function registerLoginPhone(db: D1Database, options: { phone: unknown, userId: string, settingsKey: string, tenantId: string, takenBy?: (userId: string) => Promise<string> }) {
  const phone = normalizePhone(options.phone)
  if (!phone) return ''
  await ensureLoginPhonesTable(db)
  const holder = await db.prepare(`SELECT user_id FROM login_phones WHERE phone = ?`).bind(phone).first() as Record<string, any> | null
  if (holder && String(holder.user_id) !== options.userId) {
    const name = options.takenBy ? await options.takenBy(String(holder.user_id)).catch(() => '') : ''
    throw new PhoneTakenError(`${phone} is already the sign-in number of ${name || 'another account'}.`)
  }
  await db.batch([
    db.prepare(`DELETE FROM login_phones WHERE user_id = ? AND phone != ?`).bind(options.userId, phone),
    db.prepare(`INSERT INTO login_phones (phone, user_id, settings_key, tenant_id, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET user_id = excluded.user_id, settings_key = excluded.settings_key, tenant_id = excluded.tenant_id, updated_at = excluded.updated_at`)
      .bind(phone, options.userId, options.settingsKey, options.tenantId || null, new Date().toISOString()),
  ])
  return phone
}

/** The settings key to sign in with for a phone number, or '' when no account has it. */
export async function settingsKeyForPhone(db: D1Database, value: unknown) {
  const phone = normalizePhone(value)
  if (!phone) return ''
  await ensureLoginPhonesTable(db)
  const row = await db.prepare(`SELECT settings_key FROM login_phones WHERE phone = ?`).bind(phone).first() as Record<string, any> | null
  return String(row?.settings_key || '')
}

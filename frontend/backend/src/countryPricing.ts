// Prices outside Nigeria. Every Ndovera price is set in naira; a buyer abroad pays that amount
// plus 20% (nothing extra with a discount code), in their country's currency at the rate Ami
// set, or in dollars where their country has no rate.
// Rates are typed by Ami, so no rate service is called. Each payment keeps what it was charged.

export const FOREIGN_SURCHARGE = 0.2
export const DEFAULT_COUNTRY = '*'
const ZERO_DECIMAL = new Set(['RWF', 'UGX', 'XAF', 'XOF', 'TZS', 'MWK', 'SLE'])
const CACHE_MS = 5 * 60_000
/** Naira to the dollar, until Ami saves another. */
export const DEFAULT_DOLLAR_RATE = 1500

/** Countries Ami can price, with the currency Flutterwave lists for each. The first five are the launch countries. */
export const STARTER_COUNTRIES = ['GH', 'CI', 'KE', 'UG', 'CM']
export const COUNTRY_PRESETS: Array<{ code: string, name: string, currency: string }> = [
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'UG', name: 'Uganda', currency: 'UGX' },
  { code: 'CM', name: 'Cameroon', currency: 'XAF' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW' },
  { code: 'MW', name: 'Malawi', currency: 'MWK' },
  { code: 'EG', name: 'Egypt', currency: 'EGP' },
  { code: 'SN', name: 'Senegal', currency: 'XOF' },
  { code: 'BJ', name: 'Benin', currency: 'XOF' },
  { code: 'TG', name: 'Togo', currency: 'XOF' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF' },
  { code: 'ML', name: 'Mali', currency: 'XOF' },
  { code: 'GA', name: 'Gabon', currency: 'XAF' },
  { code: 'TD', name: 'Chad', currency: 'XAF' },
  { code: 'CG', name: 'Congo', currency: 'XAF' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
]

const NAMES: Record<string, string> = { NIGERIA: 'NG', 'UNITED STATES': 'US', USA: 'US', UK: 'GB', 'IVORY COAST': 'CI', 'COTE D\'IVOIRE': 'CI', 'COTE DIVOIRE': 'CI', ...Object.fromEntries(COUNTRY_PRESETS.map(item => [item.name.toUpperCase(), item.code])) }

/** A two-letter code from what a school typed ("Ghana", "gh"), or '' when it can't be told. */
export function countryCode(value: unknown) {
  const text = String(value || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(text)) return text
  return NAMES[text] || ''
}

export type PriceRule = { country: string, foreign: boolean, currency: string, nairaPerUnit: number, surcharge: number, decimals: number }
export type PricingRate = { country: string, name: string, currency: string, naira_per_unit: number, updated_at: string, updated_by: string }

const NIGERIA: PriceRule = { country: 'NG', foreign: false, currency: 'NGN', nairaPerUnit: 1, surcharge: 0, decimals: 2 }
let cached: { at: number, rates: PricingRate[] } | null = null
const ready = new WeakSet<object>()

export async function ensurePricingTables(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS pricing_rates (country TEXT PRIMARY KEY, name TEXT, currency TEXT NOT NULL, naira_per_unit REAL NOT NULL, updated_at TEXT, updated_by TEXT)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS payment_charges (tx_ref TEXT PRIMARY KEY, country TEXT, currency TEXT NOT NULL, amount REAL NOT NULL, naira_amount REAL NOT NULL, naira_per_unit REAL, surcharge REAL, created_at TEXT NOT NULL)`).run()
  ready.add(db as object)
}

/** The whole rate table: a few dozen rows at most, kept 5 minutes per worker. */
export async function listRates(db: D1Database, fresh = false) {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.rates
  await ensurePricingTables(db)
  const rows = await db.prepare(`SELECT * FROM pricing_rates ORDER BY country LIMIT 250`).all()
  cached = { at: Date.now(), rates: (rows.results || []) as PricingRate[] }
  return cached.rates
}

export function forgetRates() { cached = null }

export async function saveRate(db: D1Database, input: { country: string, name?: string, currency: string, nairaPerUnit: number }, actor: string) {
  await ensurePricingTables(db)
  const country = input.country === DEFAULT_COUNTRY ? DEFAULT_COUNTRY : countryCode(input.country)
  const currency = String(input.currency || '').trim().toUpperCase()
  const rate = Number(input.nairaPerUnit)
  if (!country || country === 'NG') throw new Error('Choose a country outside Nigeria.')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Enter a three-letter currency, such as GHS.')
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter how many naira one unit of this currency costs.')
  await db.prepare(`INSERT INTO pricing_rates (country, name, currency, naira_per_unit, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(country) DO UPDATE SET name = excluded.name, currency = excluded.currency, naira_per_unit = excluded.naira_per_unit, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(country, String(input.name || '').slice(0, 80), currency, rate, new Date().toISOString(), actor).run()
  forgetRates()
}

export async function deleteRate(db: D1Database, country: string) {
  await ensurePricingTables(db)
  await db.prepare(`DELETE FROM pricing_rates WHERE country = ?`).bind(country).run()
  forgetRates()
}

/** The rule for a country: its own rate, else dollars. */
export async function ruleFor(db: D1Database, country: string): Promise<PriceRule> {
  const code = String(country || '').toUpperCase()
  // XX is Cloudflare's "could not tell": nobody is charged abroad on a guess.
  if (!code || code === 'NG' || code === 'XX') return NIGERIA
  const rates = await listRates(db).catch(() => [] as PricingRate[])
  const rate = rates.find(item => item.country === code) || rates.find(item => item.country === DEFAULT_COUNTRY) || { currency: 'USD', naira_per_unit: DEFAULT_DOLLAR_RATE }
  return { country: code, foreign: true, currency: rate.currency, nairaPerUnit: Number(rate.naira_per_unit), surcharge: FOREIGN_SURCHARGE, decimals: ZERO_DECIMAL.has(rate.currency) ? 0 : 2 }
}

/** What a naira price comes to under a rule. Rounded up, so a sale never falls below the price. */
export function chargeFor(rule: PriceRule, naira: number, options: { discounted?: boolean } = {}) {
  const base = Number(naira) || 0
  const surcharge = rule.foreign && !options.discounted ? rule.surcharge : 0
  const units = (base * (1 + surcharge)) / rule.nairaPerUnit
  const scale = 10 ** rule.decimals
  // Guards against 1.1 * 3 style noise pushing a whole amount up a step.
  const amount = Math.ceil(Number((units * scale).toFixed(6))) / scale
  return { currency: rule.currency, amount, nairaAmount: base, surcharge, nairaPerUnit: rule.nairaPerUnit }
}

/** The buyer's country: the school's, else (visitors registering) where Cloudflare sees them. */
export function visitorCountry(c: any) {
  return String(c.req.raw?.cf?.country || c.req.header?.('CF-IPCountry') || '').toUpperCase()
}

export function countryForTenant(tenantCountry: unknown, fallback: string) {
  const text = String(tenantCountry || '').trim()
  // Schools with no country on file are the Nigerian schools that joined before this rule.
  if (!text) return 'NG'
  return countryCode(text) || fallback
}

export async function recordCharge(db: D1Database, txRef: string, country: string, charge: ReturnType<typeof chargeFor>) {
  await ensurePricingTables(db)
  await db.prepare(`INSERT OR REPLACE INTO payment_charges (tx_ref, country, currency, amount, naira_amount, naira_per_unit, surcharge, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(txRef, country, charge.currency, charge.amount, charge.nairaAmount, charge.nairaPerUnit, charge.surcharge, new Date().toISOString()).run()
}

/**
 * Flutterwave's answer for a payment charged abroad, in the naira terms the settling code checks.
 * Paid in full in the charged currency: reads as the naira price. Anything else reads as an
 * unknown currency, so every settling check refuses it.
 */
export async function normaliseVerification<T extends { data?: Record<string, any> }>(db: D1Database, txRef: string, verified: T): Promise<T> {
  await ensurePricingTables(db)
  const charge = await db.prepare(`SELECT currency, amount, naira_amount FROM payment_charges WHERE tx_ref = ?`).bind(txRef).first() as Record<string, any> | null
  if (!charge || !verified?.data) return verified
  const paidEnough = String(verified.data.currency || '').toUpperCase() === String(charge.currency)
    && Number(verified.data.amount || 0) + 0.005 >= Number(charge.amount)
  const data = paidEnough
    ? { ...verified.data, paid_currency: verified.data.currency, paid_amount: verified.data.amount, currency: 'NGN', amount: Number(charge.naira_amount), charged_amount: Number(charge.naira_amount) }
    : { ...verified.data, paid_currency: verified.data.currency, paid_amount: verified.data.amount, currency: 'UNMATCHED' }
  return { ...verified, data }
}

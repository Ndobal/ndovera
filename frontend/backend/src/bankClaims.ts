// Paying Ndovera by bank transfer, for any charge and any phone. A checkout asked for by bank records its usual pending
// payment and opens a claim here instead of a card page. The payer transfers, presses "I have paid" and sends the
// receipt on WhatsApp. Nothing is granted until Ami has checked the money arrived; approval settles it like a card payment.

export const NDOVERA_BANK = { bankName: 'Moniepoint', accountName: 'Ndovera Limited', accountNumber: '8064252542' }
export const NDOVERA_WHATSAPP = '2348128882800'
const LIST_LIMIT = 100
const ready = new WeakSet<object>()

export class BankClaimError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export async function ensureBankClaimTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS bank_claims (id TEXT PRIMARY KEY, tx_ref TEXT NOT NULL UNIQUE, tenant_id TEXT, payer_id TEXT, payer_name TEXT, payer_email TEXT, label TEXT, base_naira REAL NOT NULL, pay_naira REAL NOT NULL, reference TEXT, status TEXT NOT NULL DEFAULT 'opened', created_at TEXT NOT NULL, claimed_at TEXT, decided_by TEXT, decided_at TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_bank_claims_status ON bank_claims(status, claimed_at)`).run()
  ready.add(db as object)
}

/** basePrice is what settling expects; payNaira is what to transfer (abroad, the price plus 20%). */
export async function openBankClaim(db: D1Database, input: { txRef: string, tenantId: string, payerId: string, payerName: string, payerEmail: string, label: string, baseNaira: number, payNaira: number }) {
  await ensureBankClaimTable(db)
  const id = `NB${crypto.randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase()}`
  await db.prepare(`INSERT INTO bank_claims (id, tx_ref, tenant_id, payer_id, payer_name, payer_email, label, base_naira, pay_naira, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.txRef, input.tenantId, input.payerId, input.payerName, input.payerEmail, input.label, input.baseNaira, input.payNaira, new Date().toISOString()).run()
  return id
}

export async function readBankClaim(db: D1Database, id: string) {
  await ensureBankClaimTable(db)
  const row = await db.prepare(`SELECT * FROM bank_claims WHERE id = ?`).bind(id).first() as Record<string, any> | null
  if (!row) throw new BankClaimError('This payment was not found.', 404)
  return row
}

export function claimWhatsAppUrl(claim: { id: string, label: string, payNaira: number, schoolName: string }) {
  const text = `Hello Ndovera. I have paid N${Number(claim.payNaira).toLocaleString('en-NG')} for ${claim.label}${claim.schoolName ? ` (${claim.schoolName})` : ''}.\nClaim number: ${claim.id}\nMy payment receipt is attached.`
  return `https://wa.me/${NDOVERA_WHATSAPP}?text=${encodeURIComponent(text)}`
}

/** "I have paid". Only now does it reach Ami. */
export async function markBankClaimPaid(db: D1Database, id: string, reference: string) {
  await ensureBankClaimTable(db)
  await db.prepare(`UPDATE bank_claims SET status = 'waiting', reference = ?, claimed_at = ? WHERE id = ? AND status = 'opened'`).bind(reference.slice(0, 120), new Date().toISOString(), id).run()
  return readBankClaim(db, id)
}

export async function listBankClaims(db: D1Database, status: string) {
  await ensureBankClaimTable(db)
  const rows = await db.prepare(`SELECT * FROM bank_claims WHERE status = ? ORDER BY claimed_at DESC LIMIT ${LIST_LIMIT}`).bind(['waiting', 'approved', 'rejected'].includes(status) ? status : 'waiting').all()
  return (rows.results || []) as Record<string, any>[]
}

/** Only one request can decide a claim. */
export async function decideBankClaim(db: D1Database, id: string, status: 'approved' | 'rejected', actor: string) {
  await ensureBankClaimTable(db)
  const done = await db.prepare(`UPDATE bank_claims SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'waiting'`).bind(status, actor, new Date().toISOString(), id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new BankClaimError('That payment was not found, or has already been decided.', 404)
  return readBankClaim(db, id)
}

export async function reopenBankClaim(db: D1Database, id: string) {
  await db.prepare(`UPDATE bank_claims SET status = 'waiting', decided_by = NULL, decided_at = NULL WHERE id = ?`).bind(id).run()
}

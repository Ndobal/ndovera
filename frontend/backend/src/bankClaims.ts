// Paying Ndovera by bank transfer, for phones that cannot open the card page. The payer transfers, presses "I have paid"
// and sends the receipt on WhatsApp. Nothing is granted until Ami has checked the money arrived and approves.

export const NDOVERA_BANK = { bankName: 'Moniepoint', accountName: 'Ndovera Limited', accountNumber: '8064252542' }
export const NDOVERA_WHATSAPP = '2348128882800'
const OPEN_PER_PAYER = 5
const LIST_LIMIT = 100
const ready = new WeakSet<object>()

export class BankClaimError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export async function ensureBankClaimTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS practice_bank_claims (id TEXT PRIMARY KEY, tx_ref TEXT NOT NULL, tenant_id TEXT NOT NULL, payer_id TEXT NOT NULL, payer_name TEXT, student_name TEXT, label TEXT, amount_naira REAL NOT NULL, reference TEXT, status TEXT NOT NULL DEFAULT 'waiting', created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_practice_bank_claims ON practice_bank_claims(status, created_at)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_practice_bank_claims_payer ON practice_bank_claims(payer_id, status)`).run()
  ready.add(db as object)
}

export function claimWhatsAppUrl(input: { claimNo: string, label: string, studentName: string, schoolName: string, amountNaira: number }) {
  const text = `Hello Ndovera. I have paid ₦${input.amountNaira.toLocaleString('en-NG')} for ${input.label} for ${input.studentName} at ${input.schoolName}.\nClaim number: ${input.claimNo}\nMy payment receipt is attached.`
  return `https://wa.me/${NDOVERA_WHATSAPP}?text=${encodeURIComponent(text)}`
}

export async function addBankClaim(db: D1Database, input: { txRef: string, tenantId: string, payerId: string, payerName: string, studentName: string, label: string, amountNaira: number, reference: string }) {
  await ensureBankClaimTable(db)
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM practice_bank_claims WHERE payer_id = ? AND status = 'waiting' LIMIT ${OPEN_PER_PAYER})`).bind(input.payerId).first() as Record<string, any> | null
  if (Number(open?.n || 0) >= OPEN_PER_PAYER) throw new BankClaimError(`You have ${OPEN_PER_PAYER} payments waiting to be checked. Ndovera will check those first.`, 429)
  const id = `NB-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
  await db.prepare(`INSERT INTO practice_bank_claims (id, tx_ref, tenant_id, payer_id, payer_name, student_name, label, amount_naira, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.txRef, input.tenantId, input.payerId, input.payerName, input.studentName, input.label, input.amountNaira, input.reference, new Date().toISOString()).run()
  return id
}

export async function listBankClaims(db: D1Database, status: string) {
  await ensureBankClaimTable(db)
  const rows = await db.prepare(`SELECT * FROM practice_bank_claims WHERE status = ? ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`).bind(['waiting', 'approved', 'rejected'].includes(status) ? status : 'waiting').all()
  return (rows.results || []) as Record<string, any>[]
}

/** Only one request can decide a claim. */
export async function decideBankClaim(db: D1Database, id: string, status: 'approved' | 'rejected', actor: string) {
  await ensureBankClaimTable(db)
  const done = await db.prepare(`UPDATE practice_bank_claims SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'waiting'`).bind(status, actor, new Date().toISOString(), id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new BankClaimError('That payment was not found, or has already been decided.', 404)
  return await db.prepare(`SELECT * FROM practice_bank_claims WHERE id = ?`).bind(id).first() as Record<string, any>
}

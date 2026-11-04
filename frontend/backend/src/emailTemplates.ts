// The words a school sends to parents. Ndovera has polite defaults; a school may keep its own version of
// each, with {{placeholders}} filled in for every parent. Text is escaped when the email is built.

export class TemplateError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export const TEMPLATE_KINDS = ['fee_reminder', 'receipt'] as const
export type TemplateKind = typeof TEMPLATE_KINDS[number]

const SHARED = ['schoolName', 'parentName', 'studentName', 'className', 'term', 'date', 'senderTitle']
export const PLACEHOLDERS: Record<TemplateKind, string[]> = {
  fee_reminder: [...SHARED, 'totalPayable', 'paid', 'balance', 'bankDetails'],
  receipt: [...SHARED, 'receiptNo', 'amount', 'paidToDate', 'balance', 'method', 'reference', 'paidOn', 'verifyLink'],
}

export const DEFAULT_TEMPLATES: Record<TemplateKind, { subject: string, body: string }> = {
  fee_reminder: {
    subject: `{{schoolName}}: Kind reminder — {{studentName}}'s school fees ({{term}})`,
    body: `Dear {{parentName}},

We hope this message finds you and your family well, and we thank you for the trust you place in {{schoolName}}.

This is a gentle reminder about the school fees of {{studentName}} ({{className}}) for {{term}}:

Amount payable: {{totalPayable}}
Amount paid so far: {{paid}}
Outstanding balance: {{balance}}

We would be grateful if you could kindly make the payment at your earliest convenience, so that {{studentName}}'s learning continues without interruption.

{{bankDetails}}

If you have already made this payment, please accept our sincere thanks and kindly share the payment receipt with us so that we can update the record. If you would like to discuss a payment arrangement, or have any question about this balance, please do not hesitate to contact the school. We will be glad to help.

Thank you for your continued support.

Yours faithfully,
{{senderTitle}}
{{schoolName}}`,
  },
  receipt: {
    subject: `{{schoolName}}: Payment receipt {{receiptNo}} for {{studentName}}`,
    body: `Dear {{parentName}},

Thank you. We acknowledge with thanks your payment towards the school fees of {{studentName}} ({{className}}) for {{term}}.

Receipt number: {{receiptNo}}
Date of payment: {{paidOn}}
Amount received: {{amount}}
Payment method: {{method}}
Reference: {{reference}}
Total paid to date: {{paidToDate}}
Balance remaining: {{balance}}

Please keep this email as your record of payment. You can confirm this receipt at any time here:
{{verifyLink}}

If any detail above looks wrong, please let the school know so that we can correct it promptly.

Thank you for your continued support.

Yours faithfully,
{{senderTitle}}
{{schoolName}}`,
  },
}

const ready = new WeakSet<object>()
async function ensureTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_email_templates (tenant_id TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, updated_by TEXT, updated_at TEXT, PRIMARY KEY (tenant_id, kind))`).run()
  ready.add(db as object)
}

const kindOf = (value: unknown): TemplateKind => {
  if (!(TEMPLATE_KINDS as readonly string[]).includes(String(value))) throw new TemplateError('That email does not exist.', 404)
  return String(value) as TemplateKind
}

/** The school's own words for an email, or Ndovera's. */
export async function templateFor(db: D1Database, tenantId: string, kind: TemplateKind) {
  await ensureTable(db)
  const row = await db.prepare(`SELECT subject, body FROM school_email_templates WHERE tenant_id = ? AND kind = ?`).bind(tenantId, kind).first() as Record<string, any> | null
  return row ? { subject: String(row.subject), body: String(row.body), custom: true } : { ...DEFAULT_TEMPLATES[kind], custom: false }
}

export async function listTemplatesFor(db: D1Database, tenantId: string) {
  const out = []
  for (const kind of TEMPLATE_KINDS) out.push({ kind, ...(await templateFor(db, tenantId, kind)), placeholders: PLACEHOLDERS[kind], defaults: DEFAULT_TEMPLATES[kind] })
  return out
}

export async function saveTemplate(db: D1Database, tenantId: string, rawKind: unknown, input: { subject?: unknown, body?: unknown }, actor: string) {
  await ensureTable(db)
  const kind = kindOf(rawKind)
  const subject = String(input.subject || '').replace(/\s+/g, ' ').trim()
  const body = String(input.body || '').trim()
  if (subject.length < 3 || subject.length > 200) throw new TemplateError('Enter a subject of up to 200 characters.')
  if (body.length < 20 || body.length > 5000) throw new TemplateError('Enter a message of 20 to 5,000 characters.')
  const unknown = [...`${subject} ${body}`.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map(match => match[1]).filter(name => !PLACEHOLDERS[kind].includes(name))
  if (unknown.length) throw new TemplateError(`Ndovera cannot fill in: ${[...new Set(unknown)].map(name => `{{${name}}}`).join(', ')}.`)
  await db.prepare(`INSERT INTO school_email_templates (tenant_id, kind, subject, body, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, kind) DO UPDATE SET subject = excluded.subject, body = excluded.body, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, kind, subject, body, actor, new Date().toISOString()).run()
}

export async function resetTemplate(db: D1Database, tenantId: string, rawKind: unknown) {
  await ensureTable(db)
  await db.prepare(`DELETE FROM school_email_templates WHERE tenant_id = ? AND kind = ?`).bind(tenantId, kindOf(rawKind)).run()
}

/** Fill the placeholders. A line left with nothing to say (no reference, no bank details) is dropped. */
export function fillTemplate(text: string, facts: Record<string, string>) {
  const lines = text.split('\n').map(line => {
    const names = [...line.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map(match => match[1])
    const filled = line.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, name) => facts[name] ?? '')
    return names.length && names.every(name => !facts[name]) ? null : filled
  })
  return lines.filter((line): line is string => line !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

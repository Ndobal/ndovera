// Ndovera's own money: what schools paid (term bills and onboarding), what they still owe,
// what went out (growth partner payouts and recorded expenses), and the reminders sent.
// Ami runs it; shareholders read it. Amounts are kept in kobo and reported in naira.

export const PLATFORM_LEDGER_DDL = `CREATE TABLE IF NOT EXISTS platform_ledger (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, category TEXT, description TEXT, amount_cents INTEGER NOT NULL,
  occurred_on TEXT NOT NULL, recorded_by TEXT, created_at TEXT NOT NULL, voided_at TEXT, voided_by TEXT)`
export const PLATFORM_REMINDERS_DDL = `CREATE TABLE IF NOT EXISTS platform_fee_reminders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, sent_to TEXT, amount_cents INTEGER, bill_id TEXT,
  sent_by TEXT, sent_at TEXT NOT NULL)`

export const LEDGER_CATEGORIES = {
  expense: ['Hosting & infrastructure', 'Salaries & contractors', 'Marketing', 'Messaging (SMS / WhatsApp / email)', 'Payment fees', 'Office & admin', 'Taxes & levies', 'Other expense'],
  income: ['Training & setup services', 'Custom development', 'Grants & sponsorship', 'Other income'],
} as const

const ready = new WeakSet<object>()
export async function ensurePlatformFinanceTables(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(PLATFORM_LEDGER_DDL).run()
  await db.prepare(PLATFORM_REMINDERS_DDL).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_platform_reminders_tenant ON platform_fee_reminders (tenant_id, sent_at)`).run()
  ready.add(db as object)
}

const naira = (kobo: number) => Math.round(Number(kobo || 0)) / 100
const monthOf = (iso: string) => String(iso || '').slice(0, 7)

export type BillRow = {
  id: string, tenantId: string, session: string, term: string, amountCents: number, status: string, paidAt: string | null,
  paidReference: string | null, paidBy?: string | null, receiptNo: string | null, graceUntil: string | null, dueAt: string | null,
  sentAt: string | null, onboardingCents: number, createdAt: string | null,
}
export type OnboardingPayment = { id: string, tenantId: string, txRef: string, amountCents: number, status: string, paidAt: string | null, createdAt: string | null, initiatedBy?: string | null }
export type Payout = { id: string, partnerName: string, amount: number, status: string, reference: string, createdAt: string }
export type LedgerRow = { id: string, kind: string, category: string, description: string, amountCents: number, occurredOn: string, recordedBy: string, createdAt: string }
export type School = { id: string, schoolName: string, ownerName?: string, ownerEmail?: string, ownerPhone?: string, contactEmail?: string, status?: string, logoUrl?: string, currentTermFee?: Record<string, any> }

const PAID_ONBOARDING = new Set(['successful', 'paid', 'completed'])
const PAID_PAYOUT = new Set(['paid', 'completed', 'confirmed', 'received'])

/** How a recorded payment came in, from its reference. */
function methodOf(reference: string) {
  const text = String(reference || '').toLowerCase()
  if (text.startsWith('flutterwave') || text.startsWith('flw')) return 'Flutterwave'
  if (!text || text === 'ami-recorded') return 'Recorded by Ndovera'
  return 'Bank transfer / manual'
}

/**
 * The whole picture in one pass over rows already loaded: every payment received (newest
 * first), money owed per school, money out, and month-by-month totals for the last 12 months.
 */
export function buildFinanceReport(input: {
  now: Date, schools: School[], bills: BillRow[], onboarding: OnboardingPayment[], payouts: Payout[], ledger: LedgerRow[],
  reminders: Array<{ tenantId: string, channel: string, sentAt: string, sentBy: string }>,
}) {
  const nowIso = input.now.toISOString()
  const schoolById = new Map(input.schools.map(school => [school.id, school]))
  const nameOf = (tenantId: string) => schoolById.get(tenantId)?.schoolName || 'Unknown school'

  // ── Money in ──
  const payments: Array<{ id: string, at: string, tenantId: string, schoolName: string, amount: number, kind: string, period: string, method: string, reference: string, recordedBy: string, receiptNo: string }> = []
  for (const bill of input.bills) {
    if (bill.status !== 'paid' || !bill.paidAt) continue
    payments.push({
      id: bill.id, at: bill.paidAt, tenantId: bill.tenantId, schoolName: nameOf(bill.tenantId), amount: naira(bill.amountCents),
      kind: bill.onboardingCents ? 'Onboarding + term' : 'Term fee', period: [bill.term, bill.session].filter(Boolean).join(', '),
      method: methodOf(String(bill.paidReference || '')), reference: String(bill.paidReference || ''),
      recordedBy: String(bill.paidBy || (methodOf(String(bill.paidReference || '')) === 'Flutterwave' ? 'Flutterwave' : 'Ndovera')), receiptNo: String(bill.receiptNo || ''),
    })
  }
  for (const payment of input.onboarding) {
    if (!PAID_ONBOARDING.has(String(payment.status || '').toLowerCase())) continue
    const at = payment.paidAt || payment.createdAt || ''
    payments.push({
      id: payment.id, at, tenantId: payment.tenantId, schoolName: nameOf(payment.tenantId), amount: naira(payment.amountCents),
      kind: 'Onboarding', period: '', method: 'Flutterwave', reference: payment.txRef, recordedBy: payment.initiatedBy ? `Flutterwave (${payment.initiatedBy})` : 'Flutterwave', receiptNo: '',
    })
  }
  payments.sort((a, b) => String(b.at).localeCompare(String(a.at)))

  // ── Owed ──
  const open = input.bills.filter(bill => !['paid', 'draft', 'cancelled'].includes(bill.status))
  const schools = input.schools.map(school => {
    const own = input.bills.filter(bill => bill.tenantId === school.id && bill.status !== 'draft')
    const billed = own.reduce((sum, bill) => sum + bill.amountCents, 0)
    const paidCents = own.filter(bill => bill.status === 'paid').reduce((sum, bill) => sum + bill.amountCents, 0)
      + input.onboarding.filter(payment => payment.tenantId === school.id && PAID_ONBOARDING.has(String(payment.status || '').toLowerCase())).reduce((sum, payment) => sum + payment.amountCents, 0)
    const owedBills = open.filter(bill => bill.tenantId === school.id)
    const outstanding = owedBills.reduce((sum, bill) => sum + bill.amountCents, 0)
    const overdue = owedBills.filter(bill => bill.graceUntil && bill.graceUntil <= nowIso).reduce((sum, bill) => sum + bill.amountCents, 0)
    const last = payments.find(payment => payment.tenantId === school.id) || null
    const lastReminder = input.reminders.filter(reminder => reminder.tenantId === school.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] || null
    const oldestDue = owedBills.map(bill => bill.graceUntil || bill.dueAt || '').filter(Boolean).sort()[0] || null
    return {
      tenantId: school.id, schoolName: school.schoolName, ownerName: school.ownerName || '', ownerEmail: school.ownerEmail || '', ownerPhone: school.ownerPhone || '',
      contactEmail: school.contactEmail || school.ownerEmail || '', status: school.status || '', logoUrl: school.logoUrl || '',
      currentTermFee: school.currentTermFee || null,
      billed: naira(billed), paid: naira(paidCents), outstanding: naira(outstanding), overdue: naira(overdue), oldestDue,
      daysOverdue: oldestDue && oldestDue <= nowIso ? Math.floor((input.now.getTime() - new Date(oldestDue).getTime()) / 86400000) : 0,
      lastPayment: last ? { at: last.at, amount: last.amount, method: last.method, recordedBy: last.recordedBy, reference: last.reference } : null,
      lastReminder,
    }
  })

  // ── Money out ──
  const payoutsPaid = input.payouts.filter(payout => PAID_PAYOUT.has(String(payout.status || '').toLowerCase()))
  const expenses = input.ledger.filter(row => row.kind === 'expense')
  const otherIncome = input.ledger.filter(row => row.kind === 'income')

  // ── Month by month, last 12 months ──
  const months: string[] = []
  for (let back = 11; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth() - back, 1))
    months.push(date.toISOString().slice(0, 7))
  }
  const monthly = months.map(month => {
    const collected = payments.filter(payment => monthOf(payment.at) === month).reduce((sum, payment) => sum + payment.amount, 0)
    const other = otherIncome.filter(row => monthOf(row.occurredOn) === month).reduce((sum, row) => sum + naira(row.amountCents), 0)
    const spent = expenses.filter(row => monthOf(row.occurredOn) === month).reduce((sum, row) => sum + naira(row.amountCents), 0)
      + payoutsPaid.filter(payout => monthOf(payout.createdAt) === month).reduce((sum, payout) => sum + Number(payout.amount || 0), 0)
    const round = (value: number) => Math.round(value * 100) / 100
    return { month, collected: round(collected), otherIncome: round(other), expenses: round(spent), net: round(collected + other - spent) }
  })

  const thisMonth = monthOf(nowIso)
  const thisYear = nowIso.slice(0, 4)
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
  const collectedAllTime = sum(payments.map(payment => payment.amount))
  const otherIncomeAll = sum(otherIncome.map(row => naira(row.amountCents)))
  const expensesAll = sum(expenses.map(row => naira(row.amountCents)))
  const payoutsAll = sum(payoutsPaid.map(payout => Number(payout.amount || 0)))

  return {
    generatedAt: nowIso,
    kpis: {
      collectedAllTime,
      collectedThisMonth: sum(payments.filter(payment => monthOf(payment.at) === thisMonth).map(payment => payment.amount)),
      collectedThisYear: sum(payments.filter(payment => payment.at.startsWith(thisYear)).map(payment => payment.amount)),
      outstanding: sum(schools.map(school => school.outstanding)),
      overdue: sum(schools.map(school => school.overdue)),
      schoolsOwing: schools.filter(school => school.outstanding > 0).length,
      schoolsUnpaidThisTerm: schools.filter(school => school.status === 'active' && school.currentTermFee && !['paid', 'unknown'].includes(String(school.currentTermFee.status))).length,
      otherIncome: otherIncomeAll,
      expenses: expensesAll,
      partnerPayouts: payoutsAll,
      netAllTime: sum([collectedAllTime, otherIncomeAll, -expensesAll, -payoutsAll]),
      paymentsCount: payments.length,
    },
    monthly,
    schools: schools.sort((a, b) => b.outstanding - a.outstanding || a.schoolName.localeCompare(b.schoolName)),
    payments,
    payouts: payoutsPaid.map(payout => ({ ...payout })),
    ledger: input.ledger.map(row => ({ ...row, amount: naira(row.amountCents) })),
    reminders: [...input.reminders].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 100).map(reminder => ({ ...reminder, schoolName: nameOf(reminder.tenantId) })),
  }
}

/** A polite reminder from Ndovera to a school owner about its Ndovera bill. */
export function platformReminderText(facts: { ownerName: string, schoolName: string, amount: number, period: string, dueAt: string | null, payUrl: string, overdue: boolean }) {
  const money = `₦${facts.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const due = facts.dueAt ? new Date(facts.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  return [
    `Dear ${facts.ownerName || 'School Owner'},`,
    '',
    'We hope you and everyone at the school are well, and thank you for running your school on Ndovera.',
    '',
    `This is a friendly reminder that ${facts.schoolName}'s Ndovera subscription${facts.period ? ` for ${facts.period}` : ''} of ${money} is ${facts.overdue ? 'now overdue' : 'still outstanding'}${due ? ` (${facts.overdue ? 'it was due on' : 'due by'} ${due})` : ''}.`,
    facts.overdue ? 'To keep the Owner, Head of School and ICT dashboards open, please settle it as soon as you can. Teachers, students, parents and your school website are not affected.' : '',
    '',
    facts.payUrl ? `You can pay securely online here: ${facts.payUrl}` : 'Your invoice with the payment link will follow shortly.',
    '',
    'If you have already paid, please accept our thanks and ignore this message. If you have any questions or would like to discuss the bill, simply reply to this email.',
    '',
    'Warm regards,',
    'Ndovera Accounts',
  ].filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}

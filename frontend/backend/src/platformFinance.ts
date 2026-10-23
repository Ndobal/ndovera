// Ndovera's own money: what schools paid (term bills and onboarding), what they still owe,
// what went out (growth partner payouts and recorded expenses), and the reminders sent.
// Ami runs it; shareholders read it. Amounts are kept in kobo and reported in naira.

export const PLATFORM_LEDGER_DDL = `CREATE TABLE IF NOT EXISTS platform_ledger (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, category TEXT, description TEXT, amount_cents INTEGER NOT NULL,
  occurred_on TEXT NOT NULL, recorded_by TEXT, created_at TEXT NOT NULL, voided_at TEXT, voided_by TEXT)`
export const PLATFORM_REMINDERS_DDL = `CREATE TABLE IF NOT EXISTS platform_fee_reminders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, sent_to TEXT, amount_cents INTEGER, bill_id TEXT,
  sent_by TEXT, sent_at TEXT NOT NULL)`

// Monthly running costs (hosting, salaries, rent…): entered once, counted in every month from
// the start month until stopped, so the profit and loss carries them without re-typing.
export const PLATFORM_RECURRING_DDL = `CREATE TABLE IF NOT EXISTS platform_recurring_expenses (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, description TEXT, amount_cents INTEGER NOT NULL, start_month TEXT NOT NULL,
  end_month TEXT, recorded_by TEXT, created_at TEXT NOT NULL, stopped_by TEXT)`

export const LEDGER_CATEGORIES = {
  expense: ['Hosting & infrastructure', 'Salaries & contractors', 'Marketing', 'Messaging (SMS / WhatsApp / email)', 'Payment fees', 'Office & admin', 'Taxes & levies', 'Other expense'],
  income: ['Training & setup services', 'Custom development', 'Grants & sponsorship', 'Other income'],
} as const

const ready = new WeakSet<object>()
export async function ensurePlatformFinanceTables(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(PLATFORM_LEDGER_DDL).run()
  await db.prepare(PLATFORM_REMINDERS_DDL).run()
  await db.prepare(PLATFORM_RECURRING_DDL).run()
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
export type RecurringRow = { id: string, category: string, description: string, amountCents: number, startMonth: string, endMonth: string | null }
export type LedgerRow = { id: string, kind: string, category: string, description: string, amountCents: number, occurredOn: string, recordedBy: string, createdAt: string }
export type School = {
  id: string, schoolName: string, ownerName?: string, ownerEmail?: string, ownerPhone?: string, contactEmail?: string, status?: string, logoUrl?: string, currentTermFee?: Record<string, any>,
  // What this term's bill comes to when none has been raised: billable students × the school's rate.
  billableStudents?: number, rateCents?: number,
}

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
 * What a school owes for the current term, stated plainly. A sent bill is owed as billed; a
 * draft is owed but not yet sent; with no bill at all the figure is an estimate (billable
 * students × the school's rate) so the amount is never hidden behind a zero.
 * `counted` marks figures already inside `outstanding` (sent, unpaid bills).
 */
export function termOwedOf(school: School) {
  const fee = (school.currentTermFee || {}) as Record<string, any>
  const students = Math.max(0, Number(school.billableStudents || 0))
  const rate = naira(Number(school.rateCents || 0))
  const estimate = Math.round(students * rate * 100) / 100
  const period = [fee.term, fee.session].filter(Boolean).join(', ')
  const base = { period, students, rate, estimate }
  if (fee.status === 'paid') return { ...base, basis: 'paid', amount: Number(fee.amount || 0), owed: 0, counted: true, note: `Paid${fee.paidAt ? ` on ${String(fee.paidAt).slice(0, 10)}` : ''}` }
  if (fee.status === 'unpaid' || fee.status === 'overdue') return { ...base, basis: 'invoiced', amount: Number(fee.amount || 0), owed: Number(fee.amount || 0), counted: true, note: fee.status === 'overdue' ? 'Invoice sent · overdue' : 'Invoice sent · not paid' }
  if (fee.status === 'not_invoiced' && fee.billId) return { ...base, basis: 'draft', amount: Number(fee.amount || 0), owed: Number(fee.amount || 0), counted: false, note: 'Draft invoice · not sent to the school yet' }
  const note = !students ? 'No students on Ndovera yet' : !rate ? 'No rate set for this school' : `Estimate: ${students.toLocaleString('en-NG')} students × ₦${rate.toLocaleString('en-NG')} · no invoice raised`
  return { ...base, basis: 'estimate', amount: estimate, owed: estimate, counted: false, note: fee.status === 'unknown' || !fee.status ? `${note} · no term set in the school calendar` : note }
}

/**
 * The whole picture in one pass over rows already loaded: every payment received (newest
 * first), money owed per school, money out, and month-by-month totals for the last 12 months.
 */
export function buildFinanceReport(input: {
  now: Date, schools: School[], bills: BillRow[], onboarding: OnboardingPayment[], payouts: Payout[], ledger: LedgerRow[],
  reminders: Array<{ tenantId: string, channel: string, sentAt: string, sentBy: string }>,
  recurring?: RecurringRow[],
}) {
  const nowIso = input.now.toISOString()
  const recurring = input.recurring || []
  const runningCostOf = (month: string) => month > monthOf(nowIso) ? 0
    : recurring.filter(cost => cost.startMonth <= month && (!cost.endMonth || cost.endMonth >= month)).reduce((sum, cost) => sum + naira(cost.amountCents), 0)
  const schoolById = new Map(input.schools.map(school => [school.id, school]))
  const nameOf = (tenantId: string) => schoolById.get(tenantId)?.schoolName || 'Unknown school'

  // ── Money in ──
  const payments: Array<{ id: string, at: string, tenantId: string, schoolName: string, amount: number, onboarding: number, kind: string, period: string, method: string, reference: string, recordedBy: string, receiptNo: string }> = []
  for (const bill of input.bills) {
    if (bill.status !== 'paid' || !bill.paidAt) continue
    payments.push({
      id: bill.id, at: bill.paidAt, tenantId: bill.tenantId, schoolName: nameOf(bill.tenantId), amount: naira(bill.amountCents), onboarding: naira(Math.min(bill.onboardingCents || 0, bill.amountCents)),
      kind: bill.onboardingCents ? 'Onboarding + term' : 'Term fee', period: [bill.term, bill.session].filter(Boolean).join(', '),
      method: methodOf(String(bill.paidReference || '')), reference: String(bill.paidReference || ''),
      recordedBy: String(bill.paidBy || (methodOf(String(bill.paidReference || '')) === 'Flutterwave' ? 'Flutterwave' : 'Ndovera')), receiptNo: String(bill.receiptNo || ''),
    })
  }
  for (const payment of input.onboarding) {
    if (!PAID_ONBOARDING.has(String(payment.status || '').toLowerCase())) continue
    const at = payment.paidAt || payment.createdAt || ''
    payments.push({
      id: payment.id, at, tenantId: payment.tenantId, schoolName: nameOf(payment.tenantId), amount: naira(payment.amountCents), onboarding: naira(payment.amountCents),
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
    const thisTerm = termOwedOf(school)
    return {
      tenantId: school.id, schoolName: school.schoolName, ownerName: school.ownerName || '', ownerEmail: school.ownerEmail || '', ownerPhone: school.ownerPhone || '',
      contactEmail: school.contactEmail || school.ownerEmail || '', status: school.status || '', logoUrl: school.logoUrl || '',
      currentTermFee: school.currentTermFee || null,
      billed: naira(billed), paid: naira(paidCents), outstanding: naira(outstanding), overdue: naira(overdue), oldestDue,
      thisTerm,
      // Everything the school owes Ndovera: bills sent and unpaid, plus this term's draft or estimate.
      totalOwed: naira(outstanding) + (thisTerm.counted ? 0 : thisTerm.owed),
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
      + runningCostOf(month)
    const round = (value: number) => Math.round(value * 100) / 100
    return { month, collected: round(collected), otherIncome: round(other), expenses: round(spent), net: round(collected + other - spent) }
  })

  const thisMonth = monthOf(nowIso)
  const thisYear = nowIso.slice(0, 4)
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
  const collectedAllTime = sum(payments.map(payment => payment.amount))
  const otherIncomeAll = sum(otherIncome.map(row => naira(row.amountCents)))
  const firstRunningMonth = recurring.map(cost => cost.startMonth).sort()[0]
  const runningAll = firstRunningMonth ? sum(monthsBetween(firstRunningMonth, monthOf(nowIso)).map(runningCostOf)) : 0
  const expensesAll = sum([...expenses.map(row => naira(row.amountCents)), runningAll])
  const payoutsAll = sum(payoutsPaid.map(payout => Number(payout.amount || 0)))

  return {
    generatedAt: nowIso,
    kpis: {
      collectedAllTime,
      collectedThisMonth: sum(payments.filter(payment => monthOf(payment.at) === thisMonth).map(payment => payment.amount)),
      collectedThisYear: sum(payments.filter(payment => payment.at.startsWith(thisYear)).map(payment => payment.amount)),
      outstanding: sum(schools.map(school => school.outstanding)),
      owedDraft: sum(schools.filter(school => school.thisTerm.basis === 'draft').map(school => school.thisTerm.owed)),
      owedNotInvoiced: sum(schools.filter(school => school.thisTerm.basis === 'estimate').map(school => school.thisTerm.owed)),
      owedTotal: sum(schools.map(school => school.totalOwed)),
      schoolsPaid: schools.filter(school => school.paid > 0).length,
      collectedThisTerm: sum(schools.filter(school => school.thisTerm.basis === 'paid').map(school => school.thisTerm.amount)),
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
    schools: schools.sort((a, b) => b.totalOwed - a.totalOwed || a.schoolName.localeCompare(b.schoolName)),
    payments,
    payouts: payoutsPaid.map(payout => ({ ...payout })),
    ledger: input.ledger.map(row => ({ ...row, amount: naira(row.amountCents) })),
    recurring: recurring.map(cost => ({ ...cost, amount: naira(cost.amountCents), active: !cost.endMonth || cost.endMonth >= monthOf(nowIso) })),
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

// ─── Profit and loss ──────────────────────────────────────────────────────────

/** Every month from `from` to `to` inclusive (YYYY-MM). */
export function monthsBetween(from: string, to: string) {
  const months: string[] = []
  let [year, month] = from.split('-').map(Number)
  const [endYear, endMonth] = to.split('-').map(Number)
  if (!year || !month || !endYear || !endMonth) return months
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 600) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months
}

const round2 = (value: number) => Math.round(value * 100) / 100
const TERMS_PER_YEAR = 3

/**
 * Profit and loss over the given months. Revenue: term fees, onboarding fees and other income.
 * Expenses: one-off expenses by category, monthly running costs (counted only in months that
 * have started) and growth-partner payouts. Shareholder payouts are a share of the profit,
 * never an expense, so they are left out. Also the analysis: margin, average month, best and
 * worst month, where the money goes, and how many students a term pays for the running costs.
 */
export function buildProfitAndLoss(input: {
  months: string[], now: Date,
  payments: Array<{ at: string, amount: number, onboarding?: number }>,
  ledger: LedgerRow[], recurring: RecurringRow[], payouts: Payout[],
  averageRatePerStudent?: number,
}) {
  const current = input.now.toISOString().slice(0, 7)
  const payoutsPaid = input.payouts.filter(payout => PAID_PAYOUT.has(String(payout.status || '').toLowerCase()))
  const rows = input.months.map(month => {
    const future = month > current
    const paid = input.payments.filter(payment => monthOf(payment.at) === month)
    const onboarding = paid.reduce((sum, payment) => sum + Number(payment.onboarding || 0), 0)
    const termFees = paid.reduce((sum, payment) => sum + payment.amount, 0) - onboarding
    const otherIncome = input.ledger.filter(row => row.kind === 'income' && monthOf(row.occurredOn) === month).reduce((sum, row) => sum + naira(row.amountCents), 0)
    const byCategory: Record<string, number> = {}
    const add = (category: string, amount: number) => { if (amount) byCategory[category] = round2((byCategory[category] || 0) + amount) }
    for (const row of input.ledger) if (row.kind === 'expense' && monthOf(row.occurredOn) === month) add(row.category || 'Other expense', naira(row.amountCents))
    let running = 0
    if (!future) {
      for (const cost of input.recurring) {
        if (cost.startMonth <= month && (!cost.endMonth || cost.endMonth >= month)) { add(cost.category || 'Other expense', naira(cost.amountCents)); running += naira(cost.amountCents) }
      }
    }
    const payouts = payoutsPaid.filter(payout => monthOf(payout.createdAt) === month).reduce((sum, payout) => sum + Number(payout.amount || 0), 0)
    add('Growth partner payouts', payouts)
    const revenue = round2(termFees + onboarding + otherIncome)
    const expenses = round2(Object.values(byCategory).reduce((sum, value) => sum + value, 0))
    const net = round2(revenue - expenses)
    return {
      month, future, termFees: round2(termFees), onboarding: round2(onboarding), otherIncome: round2(otherIncome), revenue,
      byCategory, runningCosts: round2(running), expenses, net, margin: revenue ? Math.round((net / revenue) * 1000) / 10 : null,
    }
  })
  const elapsed = rows.filter(row => !row.future)
  const total = (key: 'termFees' | 'onboarding' | 'otherIncome' | 'revenue' | 'expenses' | 'net' | 'runningCosts') => round2(rows.reduce((sum, row) => sum + row[key], 0))
  const totals = { termFees: total('termFees'), onboarding: total('onboarding'), otherIncome: total('otherIncome'), revenue: total('revenue'), expenses: total('expenses'), net: total('net'), runningCosts: total('runningCosts') }
  const categoryTotals: Record<string, number> = {}
  for (const row of rows) for (const [category, amount] of Object.entries(row.byCategory)) categoryTotals[category] = round2((categoryTotals[category] || 0) + amount)
  const categories = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount, share: totals.expenses ? Math.round((amount / totals.expenses) * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount)
  const withActivity = elapsed.filter(row => row.revenue || row.expenses)
  const best = withActivity.length ? withActivity.reduce((a, b) => (b.net > a.net ? b : a)) : null
  const worst = withActivity.length ? withActivity.reduce((a, b) => (b.net < a.net ? b : a)) : null
  const count = Math.max(1, elapsed.length)
  const averageMonthlyExpense = round2(elapsed.reduce((sum, row) => sum + row.expenses, 0) / count)
  const averageMonthlyRevenue = round2(elapsed.reduce((sum, row) => sum + row.revenue, 0) / count)
  const currentRunningCost = round2(input.recurring.filter(cost => cost.startMonth <= current && (!cost.endMonth || cost.endMonth >= current)).reduce((sum, cost) => sum + naira(cost.amountCents), 0))
  const rate = Number(input.averageRatePerStudent || 0)
  return {
    months: rows,
    totals: { ...totals, margin: totals.revenue ? Math.round((totals.net / totals.revenue) * 1000) / 10 : null },
    categories,
    analysis: {
      monthsCounted: elapsed.length,
      profitableMonths: elapsed.filter(row => row.net > 0).length,
      lossMonths: elapsed.filter(row => row.net < 0).length,
      averageMonthlyRevenue, averageMonthlyExpense,
      averageMonthlyNet: round2(averageMonthlyRevenue - averageMonthlyExpense),
      expenseRatio: totals.revenue ? Math.round((totals.expenses / totals.revenue) * 1000) / 10 : null,
      bestMonth: best ? { month: best.month, net: best.net } : null,
      worstMonth: worst ? { month: worst.month, net: worst.net } : null,
      currentRunningCost,
      averageRatePerStudent: rate,
      // Students billed each term to cover a year of today's running costs (3 terms a year).
      breakEvenStudentsPerTerm: rate > 0 ? Math.ceil((currentRunningCost * 12) / TERMS_PER_YEAR / rate) : null,
    },
  }
}

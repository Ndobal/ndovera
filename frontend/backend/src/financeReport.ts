// Financial standings report: for a school's Owner and Head of School, what the term's fees
// should bring in, what has been received, what is still owed, every family still owing and how
// much, and the fee reminders sent to parents (email and WhatsApp). Each posted report is kept
// as it stood that day (the period's record); the latest one is posted to the Owner and HoS.
// Schools can switch on fortnightly email reminders, after which a report is posted too.

export const FORTNIGHT_DAYS = 14

export async function ensureFinanceReportTables(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS finance_reports (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, term_id TEXT, title TEXT NOT NULL, period_from TEXT, period_to TEXT,
    data_json TEXT NOT NULL, automatic INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_finance_reports_tenant ON finance_reports (tenant_id, created_at)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS fee_report_settings (
    tenant_id TEXT PRIMARY KEY, auto_reminders INTEGER NOT NULL DEFAULT 0, last_auto_run_at TEXT, updated_by TEXT, updated_at TEXT)`).run()
}

export type StandingsInput = {
  schoolName: string, termLabel: string, from: string, to: string, generatedAt: string,
  accounts: Array<{ studentId: string, studentName: string, className: string, totalPayable: number, paid: number, balance: number }>,
  families: { names: Map<string, string>, byStudent: Map<string, string[]> },
  reminders: Array<{ student_id: string, channel: string, sent_at: string }>,
  autoReminders: boolean, lastAutoRunAt: string,
}

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100

/** The report's figures, from the term's fee accounts (the same ledger the fee pages use). */
export function buildStandings(input: StandingsInput) {
  const expected = money(input.accounts.reduce((sum, account) => sum + Number(account.totalPayable || 0), 0))
  const received = money(input.accounts.reduce((sum, account) => sum + Number(account.paid || 0), 0))
  const owing = input.accounts.filter(account => Number(account.balance) > 0)
  const outstanding = money(owing.reduce((sum, account) => sum + Number(account.balance), 0))
  const credit = money(input.accounts.filter(account => Number(account.balance) < 0).reduce((sum, account) => sum - Number(account.balance), 0))

  // Families still owing: children grouped under their first linked parent; a child with no
  // parent linked stands alone.
  const families = new Map<string, { familyId: string, familyName: string, children: Array<{ studentName: string, className: string, balance: number }>, owes: number }>()
  for (const account of owing) {
    const parentId = input.families.byStudent.get(account.studentId)?.[0] || ''
    const key = parentId || `student:${account.studentId}`
    const entry = families.get(key) || { familyId: parentId, familyName: parentId ? (input.families.names.get(parentId) || 'Parent') : `${account.studentName} (no parent linked)`, children: [], owes: 0 }
    entry.children.push({ studentName: account.studentName, className: account.className, balance: money(account.balance) })
    entry.owes = money(entry.owes + Number(account.balance))
    families.set(key, entry)
  }
  const familiesOwing = [...families.values()].sort((a, b) => b.owes - a.owes || a.familyName.localeCompare(b.familyName))

  const inPeriod = input.reminders.filter(row => (!input.from || row.sent_at >= input.from) && (!input.to || row.sent_at.slice(0, 10) <= input.to))
  const channelCount = (channel: string) => inPeriod.filter(row => row.channel === channel).length
  const remindedStudents = new Set(inPeriod.map(row => row.student_id))
  const dates = [...new Set(inPeriod.map(row => row.sent_at.slice(0, 10)))].sort()

  return {
    schoolName: input.schoolName, termLabel: input.termLabel, from: input.from, to: input.to, generatedAt: input.generatedAt,
    totals: {
      expected, received, outstanding, credit,
      collectionRate: expected > 0 ? Math.round((received / expected) * 1000) / 10 : 0,
      students: input.accounts.length, studentsOwing: owing.length, studentsPaid: input.accounts.filter(account => Number(account.totalPayable) > 0 && Number(account.balance) <= 0).length,
      familiesOwing: familiesOwing.length,
    },
    familiesOwing,
    reminders: {
      email: channelCount('email'), whatsapp: channelCount('whatsapp'), studentsReminded: remindedStudents.size, dates,
      fortnightly: input.autoReminders, lastAutomatic: input.lastAutoRunAt || '',
      statement: reminderStatement(input.autoReminders, channelCount('email'), channelCount('whatsapp'), remindedStudents.size, dates),
    },
  }
}

export function reminderStatement(fortnightly: boolean, email: number, whatsapp: number, students: number, dates: string[]) {
  const sent = email + whatsapp
  const parts = [] as string[]
  if (fortnightly) parts.push('Fee reminders are sent to the parents of every student still owing every two weeks by email, in the school\'s name, with the balance and the school\'s bank details.')
  if (sent) parts.push(`In this period ${email} email reminder${email === 1 ? '' : 's'} and ${whatsapp} WhatsApp reminder${whatsapp === 1 ? '' : 's'} were sent for ${students} student${students === 1 ? '' : 's'}${dates.length ? `, on ${dates.length} day${dates.length === 1 ? '' : 's'} (${dates[0]}${dates.length > 1 ? ` to ${dates[dates.length - 1]}` : ''})` : ''}.`)
  else parts.push('No fee reminders were sent in this period.')
  return parts.join(' ')
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
const naira = (value: unknown) => `₦${(Number(value) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The report as an email (and printable) HTML document. */
export function standingsEmailHtml(report: ReturnType<typeof buildStandings>, link = '') {
  const t = report.totals
  const rows = report.familiesOwing.map((family, index) => `<tr><td style="padding:6px;border:1px solid #cbd5e1">${index + 1}</td><td style="padding:6px;border:1px solid #cbd5e1"><b>${esc(family.familyName)}</b><br><span style="color:#475569;font-size:12px">${family.children.map(child => `${esc(child.studentName)} (${esc(child.className)}): ${naira(child.balance)}`).join('<br>')}</span></td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right"><b>${naira(family.owes)}</b></td></tr>`).join('')
  return `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:720px">
  <h2 style="margin:0;color:#800000">${esc(report.schoolName)}</h2>
  <p style="margin:2px 0 12px;font-weight:bold">Financial Standings Report — ${esc(report.termLabel)}</p>
  <p style="color:#475569;font-size:12px">Period: ${esc(report.from || 'start of term')} to ${esc(report.to)} · Prepared ${esc(report.generatedAt.slice(0, 10))}</p>
  <table style="border-collapse:collapse;width:100%;margin:8px 0">
    <tr><td style="padding:6px;border:1px solid #cbd5e1">Expected income</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right"><b>${naira(t.expected)}</b></td></tr>
    <tr><td style="padding:6px;border:1px solid #cbd5e1">Income received</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right;color:#15803d"><b>${naira(t.received)}</b> (${t.collectionRate}%)</td></tr>
    <tr><td style="padding:6px;border:1px solid #cbd5e1">Income still to be paid</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right;color:#b91c1c"><b>${naira(t.outstanding)}</b></td></tr>
    <tr><td style="padding:6px;border:1px solid #cbd5e1">Families still owing</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right"><b>${t.familiesOwing}</b> (${t.studentsOwing} of ${t.students} students)</td></tr>
  </table>
  <p style="background:#eff6ff;padding:8px;border-radius:6px;font-size:13px">${esc(report.reminders.statement)}</p>
  ${rows ? `<h3 style="color:#800000">Families still owing</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr><th style="padding:6px;border:1px solid #cbd5e1">#</th><th style="padding:6px;border:1px solid #cbd5e1;text-align:left">Family</th><th style="padding:6px;border:1px solid #cbd5e1;text-align:right">Owes</th></tr>${rows}</table>` : '<p>Every family has paid in full.</p>'}
  ${link ? `<p style="margin-top:14px"><a href="${esc(link)}">Open the report on Ndovera</a> to print it or save it as Word or PDF.</p>` : ''}
</div>`
}

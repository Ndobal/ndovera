// Ndovera's shareholders: the share register (shares issued, transferred and redeemed, with the
// capital paid for them), the profit-sharing policy, profit distributions declared from the
// profit and loss, and what is due to each shareholder. Ami runs it; shareholders read it.
//
// Formula: for a declared period, distributable = net profit × (100 − retention %) / 100, and
// each shareholder receives distributable × their shares ÷ all shares on the day it is
// declared. A period that made a loss pays nothing. Amounts are kept in kobo.

export const SHARE_EVENTS_DDL = `CREATE TABLE IF NOT EXISTS platform_share_events (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, email TEXT NOT NULL, name TEXT, counterparty_email TEXT, counterparty_name TEXT,
  shares INTEGER NOT NULL, capital_cents INTEGER NOT NULL DEFAULT 0, note TEXT, occurred_on TEXT NOT NULL,
  recorded_by TEXT, created_at TEXT NOT NULL, voided_at TEXT, voided_by TEXT)`
export const SHARE_POLICY_DDL = `CREATE TABLE IF NOT EXISTS platform_share_policy (
  id TEXT PRIMARY KEY, retention_pct REAL NOT NULL, frequency TEXT, updated_at TEXT, updated_by TEXT)`
export const DIVIDENDS_DDL = `CREATE TABLE IF NOT EXISTS platform_dividends (
  id TEXT PRIMARY KEY, from_month TEXT NOT NULL, to_month TEXT NOT NULL, net_profit_cents INTEGER NOT NULL, retention_pct REAL NOT NULL,
  retained_cents INTEGER NOT NULL, distributable_cents INTEGER NOT NULL, total_shares INTEGER NOT NULL, note TEXT,
  declared_on TEXT NOT NULL, declared_by TEXT, voided_at TEXT, voided_by TEXT)`
export const DIVIDEND_LINES_DDL = `CREATE TABLE IF NOT EXISTS platform_dividend_lines (
  id TEXT PRIMARY KEY, dividend_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT, shares INTEGER NOT NULL, pct REAL NOT NULL,
  amount_cents INTEGER NOT NULL, paid_cents INTEGER NOT NULL DEFAULT 0, paid_at TEXT, paid_reference TEXT, paid_by TEXT)`

export const DEFAULT_RETENTION_PCT = 30
export const PAYOUT_FREQUENCIES = ['monthly', 'quarterly', 'half-yearly', 'yearly'] as const

const ready = new WeakSet<object>()
export async function ensureShareTables(db: D1Database) {
  if (ready.has(db as object)) return
  for (const ddl of [SHARE_EVENTS_DDL, SHARE_POLICY_DDL, DIVIDENDS_DDL, DIVIDEND_LINES_DDL]) await db.prepare(ddl).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_dividend_lines_dividend ON platform_dividend_lines (dividend_id)`).run()
  ready.add(db as object)
}

export type ShareEvent = {
  id: string, kind: 'issue' | 'transfer' | 'redeem', email: string, name: string, counterpartyEmail: string, counterpartyName: string,
  shares: number, capitalCents: number, note: string, occurredOn: string, recordedBy: string,
}

const naira = (kobo: number) => Math.round(Number(kobo || 0)) / 100

/**
 * The register from its events, oldest first. Issuing adds shares and the capital paid for
 * them; a transfer moves shares (and their share of paid-up capital) from one holder to
 * another; a redemption takes shares back (and their capital). An event that would take more
 * shares than a holder has is reported, not applied.
 */
export function buildShareRegister(events: ShareEvent[]) {
  const holders = new Map<string, { email: string, name: string, shares: number, capitalCents: number }>()
  const holder = (email: string, name: string) => {
    const key = email.toLowerCase()
    const current = holders.get(key) || { email: key, name: name || key, shares: 0, capitalCents: 0 }
    if (name) current.name = name
    holders.set(key, current)
    return current
  }
  const problems: string[] = []
  const ordered = [...events].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id))
  for (const event of ordered) {
    const shares = Math.max(0, Math.round(event.shares))
    if (event.kind === 'issue') {
      const to = holder(event.email, event.name)
      to.shares += shares
      to.capitalCents += Math.max(0, event.capitalCents)
      continue
    }
    const from = holder(event.email, event.name)
    if (shares > from.shares) { problems.push(`${event.occurredOn}: ${from.name} had ${from.shares} shares, not ${shares}`); continue }
    const capitalMoved = from.shares ? Math.round(from.capitalCents * shares / from.shares) : 0
    from.shares -= shares
    from.capitalCents -= capitalMoved
    if (event.kind === 'transfer') {
      const to = holder(event.counterpartyEmail, event.counterpartyName)
      to.shares += shares
      to.capitalCents += capitalMoved
    }
  }
  const totalShares = [...holders.values()].reduce((sum, row) => sum + row.shares, 0)
  const totalCapitalCents = [...holders.values()].reduce((sum, row) => sum + row.capitalCents, 0)
  const rows = [...holders.values()]
    .filter(row => row.shares > 0 || row.capitalCents > 0)
    .map(row => ({ ...row, capital: naira(row.capitalCents), pct: totalShares ? Math.round((row.shares / totalShares) * 100000) / 1000 : 0 }))
    .sort((a, b) => b.shares - a.shares || a.name.localeCompare(b.name))
  return { holders: rows, totalShares, totalCapitalCents, totalCapital: naira(totalCapitalCents), problems }
}

/**
 * Split a profit by the register. Kobo are shared by largest remainder so the lines add up
 * to exactly the distributable amount.
 */
export function planDistribution(input: { netProfitCents: number, retentionPct: number, holders: Array<{ email: string, name: string, shares: number }> }) {
  const retention = Math.min(100, Math.max(0, Number(input.retentionPct || 0)))
  const profit = Math.max(0, Math.round(input.netProfitCents))
  const distributableCents = Math.floor(profit * (100 - retention) / 100)
  const retainedCents = profit - distributableCents
  const holders = input.holders.filter(row => row.shares > 0)
  const totalShares = holders.reduce((sum, row) => sum + row.shares, 0)
  const exact = holders.map(row => ({ ...row, exact: totalShares ? distributableCents * row.shares / totalShares : 0 }))
  const lines = exact.map(row => ({ email: row.email, name: row.name, shares: row.shares, pct: totalShares ? Math.round((row.shares / totalShares) * 100000) / 1000 : 0, amountCents: Math.floor(row.exact), remainder: row.exact - Math.floor(row.exact) }))
  let left = distributableCents - lines.reduce((sum, line) => sum + line.amountCents, 0)
  for (const line of [...lines].sort((a, b) => b.remainder - a.remainder)) {
    if (left <= 0) break
    line.amountCents += 1
    left -= 1
  }
  return {
    netProfitCents: Math.round(input.netProfitCents), retentionPct: retention, retainedCents, distributableCents, totalShares,
    lines: lines.map(({ remainder, ...line }) => line),
  }
}

/**
 * What each holder is owed: declared distributions not yet paid, plus (as a projection, not
 * yet owed) their share of the profit made since the last declared period.
 */
export function shareholderDues(input: {
  holders: Array<{ email: string, name: string, shares: number }>,
  lines: Array<{ email: string, name: string, amountCents: number, paidCents: number }>,
  projection: { netProfitCents: number, retentionPct: number } | null,
}) {
  const projected = input.projection ? planDistribution({ ...input.projection, holders: input.holders }) : null
  const emails = new Set([...input.holders.map(row => row.email), ...input.lines.map(line => line.email)])
  return [...emails].map(email => {
    const own = input.lines.filter(line => line.email === email)
    const declaredCents = own.reduce((sum, line) => sum + line.amountCents, 0)
    const paidCents = own.reduce((sum, line) => sum + Math.min(line.paidCents, line.amountCents), 0)
    const projectedCents = projected?.lines.find(line => line.email === email)?.amountCents || 0
    const name = input.holders.find(row => row.email === email)?.name || own[0]?.name || email
    return {
      email, name, declared: naira(declaredCents), paid: naira(paidCents), due: naira(declaredCents - paidCents), projected: naira(projectedCents),
    }
  }).sort((a, b) => b.due - a.due || b.projected - a.projected || a.name.localeCompare(b.name))
}

// Daily staff punctuality log, period reports and the monthly punctuality award.
//
// Arrival comes from staff sign-ins (`staff_attendance_events`, action 'sign-in'),
// already judged late or on time against the school's configured cut-off. Working
// days are Monday to Friday, less the school's holidays and breaks. The award is
// the school's own: the most punctual staff member(s) of a month, published by
// the Owner or HOS with a badge.

export type SignIn = { staffId: string, date: string, createdAt: string, isLate: boolean, lateMinutes: number }

const LAGOS_OFFSET_MS = 60 * 60 * 1000

/** Mon–Fri dates in [from, to] that are not school holidays or breaks. */
export function workingDays(from: string, to: string, closed: Set<string>) {
  const days: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= end && days.length < 400; time += 86400000) {
    const date = new Date(time)
    const weekday = date.getUTCDay()
    const iso = date.toISOString().slice(0, 10)
    if (weekday !== 0 && weekday !== 6 && !closed.has(iso)) days.push(iso)
  }
  return days
}

/** Minutes after midnight, Lagos time, of a UTC timestamp. */
export function arrivalMinutes(createdAt: string) {
  const time = new Date(Date.parse(createdAt) + LAGOS_OFFSET_MS)
  return time.getUTCHours() * 60 + time.getUTCMinutes()
}

export function formatMinutes(minutes: number | null) {
  if (minutes == null) return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`
}

/**
 * Per-staff punctuality for a range. Only working days up to `today` count as
 * expected attendance, so a month in progress is judged on the days so far.
 */
export function summarisePunctuality(options: {
  staff: Array<{ id: string, email: string, name: string }>, signIns: SignIn[], days: string[], today: string,
}) {
  const expected = options.days.filter(day => day <= options.today)
  const expectedSet = new Set(expected)
  const firstByStaffDay = new Map<string, SignIn>()
  for (const signIn of options.signIns) {
    if (!expectedSet.has(signIn.date)) continue
    const key = `${signIn.staffId.toLowerCase()}|${signIn.date}`
    const current = firstByStaffDay.get(key)
    if (!current || signIn.createdAt < current.createdAt) firstByStaffDay.set(key, signIn)
  }
  const sameStaff = (person: { id: string, email: string }, staffId: string) => [person.id, person.email].some(value => value && value.toLowerCase() === staffId.toLowerCase())

  return options.staff.map(person => {
    const arrivals = [...firstByStaffDay.values()].filter(signIn => sameStaff(person, signIn.staffId))
    const onTime = arrivals.filter(signIn => !signIn.isLate).length
    const lateMinutes = arrivals.reduce((sum, signIn) => sum + (signIn.isLate ? Number(signIn.lateMinutes || 0) : 0), 0)
    const average = arrivals.length ? arrivals.reduce((sum, signIn) => sum + arrivalMinutes(signIn.createdAt), 0) / arrivals.length : null
    return {
      staffId: person.id,
      name: person.name,
      workingDays: expected.length,
      presentDays: arrivals.length,
      onTimeDays: onTime,
      lateDays: arrivals.length - onTime,
      absentDays: Math.max(0, expected.length - arrivals.length),
      lateMinutes,
      averageArrival: formatMinutes(average),
      averageArrivalMinutes: average,
      punctualityRate: expected.length ? Math.round((onTime / expected.length) * 1000) / 10 : 0,
      daily: expected.map(day => {
        const signIn = arrivals.find(item => item.date === day)
        return { date: day, status: signIn ? (signIn.isLate ? 'late' : 'on_time') : 'absent', arrival: signIn ? formatMinutes(arrivalMinutes(signIn.createdAt)) : '', lateMinutes: signIn?.isLate ? signIn.lateMinutes : 0 }
      }),
    }
  }).sort((a, b) => b.punctualityRate - a.punctualityRate || a.lateMinutes - b.lateMinutes || a.name.localeCompare(b.name))
}

/**
 * The month's most punctual staff: highest on-time rate, then fewest late
 * minutes, then earliest average arrival. Anyone present on fewer than 80% of
 * working days is not eligible. Ties share the award.
 */
export function pickPunctualityWinners(rows: ReturnType<typeof summarisePunctuality>) {
  const eligible = rows.filter(row => row.workingDays > 0 && row.presentDays >= Math.ceil(row.workingDays * 0.8) && row.onTimeDays > 0)
  if (!eligible.length) return []
  const rank = (row: typeof rows[number]) => [-row.punctualityRate, row.lateMinutes, Math.round(row.averageArrivalMinutes ?? 9999)]
  const sorted = [...eligible].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })
  const best = rank(sorted[0]).join('|')
  return sorted.filter(row => rank(row).join('|') === best)
}

export async function ensurePunctualityTables(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_punctuality_awards (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    month TEXT NOT NULL,
    winners_json TEXT NOT NULL,
    badge_label TEXT NOT NULL,
    badge_icon TEXT,
    message TEXT,
    published_by TEXT,
    published_at TEXT NOT NULL,
    UNIQUE(tenant_id, month)
  )`).run()
}

export async function loadSignIns(db: D1Database, tenantId: string, from: string, to: string): Promise<SignIn[]> {
  const rows = await db.prepare(`SELECT staff_id, date, created_at, is_late, late_minutes FROM staff_attendance_events
    WHERE tenant_id = ? AND action = 'sign-in' AND date >= ? AND date <= ?`).bind(tenantId, from, to).all().catch(() => ({ results: [] }))
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    staffId: String(row.staff_id || ''), date: String(row.date || ''), createdAt: String(row.created_at || ''),
    isLate: Boolean(Number(row.is_late || 0)), lateMinutes: Number(row.late_minutes || 0),
  }))
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function mapAward(row: Record<string, any> | null) {
  if (!row) return null
  let winners: Array<Record<string, any>> = []
  try { winners = JSON.parse(String(row.winners_json || '[]')) } catch {}
  return { id: row.id, month: row.month, winners, badgeLabel: row.badge_label, badgeIcon: row.badge_icon || '🏆', message: row.message || '', publishedBy: row.published_by || '', publishedAt: row.published_at }
}

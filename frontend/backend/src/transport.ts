// School transport: routes, the students on them, and the driver's daily runs.
//
// The Owner/HoS (or transport officer) sets up routes — the areas a bus plies, its driver and
// vehicle — and adds students with their pick-up point and times, the trip they ride on when the
// driver makes more than one school run, and whether they ride morning, afternoon or both.
// Each student on a route has a QR bus pass.
//
// The driver starts a run (morning or afternoon, trip 1–3) and marks each child on board by
// scanning their pass or tapping their name. Arriving at school in the morning marks the children
// on board present in their class and tells their parents and the school; leaving school in the
// afternoon tells the parents and the school the bus has just left. The notices are in-app.

export class TransportError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type Direction = 'morning' | 'afternoon'
export type Directions = 'both' | Direction

export const DIRECTIONS: Directions[] = ['both', 'morning', 'afternoon']

const ready = new WeakSet<object>()
export async function ensureTransportTables(db: D1Database) {
  if (ready.has(db as object)) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS transport_routes (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, areas TEXT, driver_id TEXT, vehicle TEXT,
      directions TEXT NOT NULL DEFAULT 'both', status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TEXT, updated_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transport_routes_tenant ON transport_routes(tenant_id, status)`,
    `CREATE TABLE IF NOT EXISTS transport_assignments (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, route_id TEXT NOT NULL, student_id TEXT NOT NULL, pickup_point TEXT,
      pickup_time TEXT, dropoff_time TEXT, trip_no INTEGER NOT NULL DEFAULT 1, directions TEXT NOT NULL DEFAULT 'both',
      pass_code TEXT NOT NULL, created_at TEXT, updated_at TEXT, UNIQUE(route_id, student_id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_transport_pass ON transport_assignments(pass_code)`,
    `CREATE INDEX IF NOT EXISTS idx_transport_assign_student ON transport_assignments(tenant_id, student_id)`,
    `CREATE TABLE IF NOT EXISTS transport_driver_settings (
      tenant_id TEXT NOT NULL, driver_id TEXT NOT NULL, trips INTEGER NOT NULL DEFAULT 1, updated_at TEXT, PRIMARY KEY (tenant_id, driver_id)
    )`,
    `CREATE TABLE IF NOT EXISTS transport_runs (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, driver_id TEXT NOT NULL, run_date TEXT NOT NULL, direction TEXT NOT NULL,
      trip_no INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'boarding', started_at TEXT, arrived_at TEXT, departed_at TEXT,
      UNIQUE(tenant_id, driver_id, run_date, direction, trip_no)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transport_runs_day ON transport_runs(tenant_id, run_date)`,
    `CREATE TABLE IF NOT EXISTS transport_boardings (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, run_id TEXT NOT NULL, student_id TEXT NOT NULL, route_id TEXT,
      boarded_at TEXT NOT NULL, method TEXT, UNIQUE(run_id, student_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transport_boardings_student ON transport_boardings(tenant_id, student_id)`,
  ]
  for (const sql of statements) await db.prepare(sql).run()
  ready.add(db as object)
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function normalizeDirections(value: unknown): Directions {
  const text = String(value || '').toLowerCase()
  return (DIRECTIONS as string[]).includes(text) ? text as Directions : 'both'
}

export function normalizeDirection(value: unknown): Direction {
  return String(value || '').toLowerCase() === 'afternoon' ? 'afternoon' : 'morning'
}

/** "7:05" / "07:05" / "7.05am" → "07:05"; anything else → ''. */
export function normalizeTime(value: unknown) {
  const text = String(value || '').trim().toLowerCase()
  const match = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(text)
  if (!match) return ''
  let hours = Number(match[1])
  const minutes = Number(match[2])
  if (match[3] === 'pm' && hours < 12) hours += 12
  if (match[3] === 'am' && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function clampTrips(value: unknown) {
  const n = Math.round(Number(value) || 1)
  return Math.min(3, Math.max(1, n))
}

/** Whether a student assigned for `directions` on `tripNo` rides this run. */
export function ridesRun(assignment: { directions: string, tripNo: number }, run: { direction: Direction, tripNo: number }, driverTrips: number) {
  const dirs = normalizeDirections(assignment.directions)
  if (dirs !== 'both' && dirs !== run.direction) return false
  return driverTrips <= 1 || Number(assignment.tripNo || 1) === Number(run.tripNo || 1)
}

/** The text in a bus pass QR code. */
export function passQrText(passCode: string) {
  return `NDOVERA-BUS:${passCode}`
}

/** The pass code from scanned text: the QR text, or the code typed in. */
export function passCodeFromScan(text: unknown) {
  const raw = String(text || '').trim()
  const match = /^NDOVERA-BUS:([A-Z0-9]{6,20})$/i.exec(raw)
  if (match) return match[1].toUpperCase()
  return /^[A-Z0-9]{6,20}$/i.test(raw) ? raw.toUpperCase() : ''
}

export function newPassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), byte => alphabet[byte % alphabet.length]).join('')
}

/** Today in Lagos, YYYY-MM-DD. */
export function lagosDate(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function lagosClock(iso?: string | null) {
  if (!iso) return ''
  const date = new Date(new Date(iso).getTime() + 60 * 60 * 1000)
  const hours = date.getUTCHours()
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

export function mapRoute(row: Record<string, any>) {
  return {
    id: String(row.id), name: String(row.name || ''), areas: String(row.areas || ''), driverId: String(row.driver_id || ''),
    vehicle: String(row.vehicle || ''), directions: normalizeDirections(row.directions), status: String(row.status || 'active'),
  }
}

export function mapAssignment(row: Record<string, any>) {
  return {
    id: String(row.id), routeId: String(row.route_id), studentId: String(row.student_id), pickupPoint: String(row.pickup_point || ''),
    pickupTime: String(row.pickup_time || ''), dropoffTime: String(row.dropoff_time || ''), tripNo: Number(row.trip_no || 1),
    directions: normalizeDirections(row.directions), passCode: String(row.pass_code || ''),
  }
}

export function mapRun(row: Record<string, any>) {
  return {
    id: String(row.id), driverId: String(row.driver_id), date: String(row.run_date), direction: normalizeDirection(row.direction),
    tripNo: Number(row.trip_no || 1), status: String(row.status || 'boarding'), startedAt: row.started_at || null,
    arrivedAt: row.arrived_at || null, departedAt: row.departed_at || null,
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listRoutes(db: D1Database, tenantId: string, filters: { driverId?: string } = {}) {
  await ensureTransportTables(db)
  const where = [`tenant_id = ?`, `status = 'active'`]
  const binds: unknown[] = [tenantId]
  if (filters.driverId) { where.push('driver_id = ?'); binds.push(filters.driverId) }
  const rows = await db.prepare(`SELECT * FROM transport_routes WHERE ${where.join(' AND ')} ORDER BY name`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapRoute)
}

export async function listAssignments(db: D1Database, tenantId: string, filters: { routeIds?: string[], studentIds?: string[] } = {}) {
  await ensureTransportTables(db)
  const where = ['a.tenant_id = ?', `r.status = 'active'`]
  const binds: unknown[] = [tenantId]
  if (filters.routeIds) {
    if (!filters.routeIds.length) return []
    where.push(`a.route_id IN (SELECT value FROM json_each(?))`); binds.push(JSON.stringify(filters.routeIds))
  }
  if (filters.studentIds) {
    if (!filters.studentIds.length) return []
    where.push(`a.student_id IN (SELECT value FROM json_each(?))`); binds.push(JSON.stringify(filters.studentIds))
  }
  const rows = await db.prepare(`SELECT a.* FROM transport_assignments a JOIN transport_routes r ON r.id = a.route_id WHERE ${where.join(' AND ')}
    ORDER BY a.trip_no, a.pickup_time, a.student_id`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapAssignment)
}

export async function driverTrips(db: D1Database, tenantId: string, driverId: string) {
  await ensureTransportTables(db)
  const row = await db.prepare(`SELECT trips FROM transport_driver_settings WHERE tenant_id = ? AND driver_id = ?`).bind(tenantId, driverId).first() as Record<string, any> | null
  return clampTrips(row?.trips || 1)
}

export async function runsOn(db: D1Database, tenantId: string, date: string, filters: { driverId?: string } = {}) {
  await ensureTransportTables(db)
  const where = ['tenant_id = ?', 'run_date = ?']
  const binds: unknown[] = [tenantId, date]
  if (filters.driverId) { where.push('driver_id = ?'); binds.push(filters.driverId) }
  const rows = await db.prepare(`SELECT * FROM transport_runs WHERE ${where.join(' AND ')} ORDER BY direction, trip_no`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapRun)
}

export async function boardingsFor(db: D1Database, tenantId: string, runIds: string[]) {
  await ensureTransportTables(db)
  if (!runIds.length) return [] as Array<{ runId: string, studentId: string, boardedAt: string, method: string }>
  const rows = await db.prepare(`SELECT run_id, student_id, boarded_at, method FROM transport_boardings WHERE tenant_id = ? AND run_id IN (SELECT value FROM json_each(?))`)
    .bind(tenantId, JSON.stringify(runIds)).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ runId: String(row.run_id), studentId: String(row.student_id), boardedAt: String(row.boarded_at), method: String(row.method || '') }))
}

// ─── Writes: routes and assignments ──────────────────────────────────────────

export async function saveRoute(db: D1Database, tenantId: string, input: Record<string, any>, actorId: string, routeId = '') {
  await ensureTransportTables(db)
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  if (!name) throw new TransportError('Give the route a name.')
  const now = new Date().toISOString()
  const values = [name, String(input.areas || '').trim().slice(0, 500), String(input.driverId || '').trim() || null, String(input.vehicle || '').trim().slice(0, 120), normalizeDirections(input.directions)]
  if (routeId) {
    const result = await db.prepare(`UPDATE transport_routes SET name = ?, areas = ?, driver_id = ?, vehicle = ?, directions = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND status = 'active'`)
      .bind(...values, now, routeId, tenantId).run()
    if (!Number(result?.meta?.changes || 0)) throw new TransportError('Route not found.', 404)
    return routeId
  }
  const id = `troute_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  await db.prepare(`INSERT INTO transport_routes (id, tenant_id, name, areas, driver_id, vehicle, directions, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`)
    .bind(id, tenantId, ...values, actorId, now, now).run()
  return id
}

export async function archiveRoute(db: D1Database, tenantId: string, routeId: string) {
  await ensureTransportTables(db)
  await db.prepare(`UPDATE transport_routes SET status = 'archived', updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(new Date().toISOString(), routeId, tenantId).run()
}

/** Add students to a route (or update their details there). Returns how many were saved. */
export async function assignStudents(db: D1Database, tenantId: string, routeId: string, studentIds: string[], details: Record<string, any>) {
  await ensureTransportTables(db)
  const route = await db.prepare(`SELECT id FROM transport_routes WHERE id = ? AND tenant_id = ? AND status = 'active'`).bind(routeId, tenantId).first()
  if (!route) throw new TransportError('Route not found.', 404)
  const ids = [...new Set(studentIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 200)
  if (!ids.length) throw new TransportError('Choose at least one student.')
  const now = new Date().toISOString()
  const pickupTime = normalizeTime(details.pickupTime)
  const dropoffTime = normalizeTime(details.dropoffTime)
  const tripNo = clampTrips(details.tripNo)
  const directions = normalizeDirections(details.directions)
  const pickupPoint = String(details.pickupPoint || '').trim().slice(0, 200)
  for (const studentId of ids) {
    // eslint-disable-next-line no-await-in-loop
    await db.prepare(`INSERT INTO transport_assignments (id, tenant_id, route_id, student_id, pickup_point, pickup_time, dropoff_time, trip_no, directions, pass_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(route_id, student_id) DO UPDATE SET pickup_point = excluded.pickup_point, pickup_time = excluded.pickup_time, dropoff_time = excluded.dropoff_time,
        trip_no = excluded.trip_no, directions = excluded.directions, updated_at = excluded.updated_at`)
      .bind(`tassign_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, tenantId, routeId, studentId, pickupPoint, pickupTime, dropoffTime, tripNo, directions, newPassCode(), now, now).run()
  }
  return ids.length
}

export async function unassignStudent(db: D1Database, tenantId: string, routeId: string, studentId: string) {
  await ensureTransportTables(db)
  await db.prepare(`DELETE FROM transport_assignments WHERE tenant_id = ? AND route_id = ? AND student_id = ?`).bind(tenantId, routeId, studentId).run()
}

export async function setDriverTrips(db: D1Database, tenantId: string, driverId: string, trips: unknown) {
  await ensureTransportTables(db)
  const value = clampTrips(trips)
  await db.prepare(`INSERT INTO transport_driver_settings (tenant_id, driver_id, trips, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id, driver_id) DO UPDATE SET trips = excluded.trips, updated_at = excluded.updated_at`).bind(tenantId, driverId, value, new Date().toISOString()).run()
  return value
}

// ─── Writes: the driver's runs ───────────────────────────────────────────────

/** Today's run for this driver, direction and trip — created when first opened. */
export async function openRun(db: D1Database, tenantId: string, driverId: string, direction: Direction, tripNo: number, date = lagosDate()) {
  await ensureTransportTables(db)
  const trip = clampTrips(tripNo)
  await db.prepare(`INSERT OR IGNORE INTO transport_runs (id, tenant_id, driver_id, run_date, direction, trip_no, status, started_at) VALUES (?, ?, ?, ?, ?, ?, 'boarding', ?)`)
    .bind(`trun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, tenantId, driverId, date, direction, trip, new Date().toISOString()).run()
  const row = await db.prepare(`SELECT * FROM transport_runs WHERE tenant_id = ? AND driver_id = ? AND run_date = ? AND direction = ? AND trip_no = ?`)
    .bind(tenantId, driverId, date, direction, trip).first() as Record<string, any>
  return mapRun(row)
}

export async function getRun(db: D1Database, tenantId: string, runId: string) {
  await ensureTransportTables(db)
  const row = await db.prepare(`SELECT * FROM transport_runs WHERE id = ? AND tenant_id = ?`).bind(runId, tenantId).first() as Record<string, any> | null
  return row ? mapRun(row) : null
}

/** The students who ride this run: on the driver's routes, this direction, this trip. */
export async function expectedForRun(db: D1Database, tenantId: string, run: ReturnType<typeof mapRun>) {
  const routes = await listRoutes(db, tenantId, { driverId: run.driverId })
  const trips = await driverTrips(db, tenantId, run.driverId)
  const assignments = await listAssignments(db, tenantId, { routeIds: routes.map(route => route.id) })
  const routeById = new Map(routes.map(route => [route.id, route]))
  return assignments.filter(assignment => {
    const route = routeById.get(assignment.routeId)
    if (!route || (route.directions !== 'both' && route.directions !== run.direction)) return false
    return ridesRun(assignment, run, trips)
  })
}

/** Mark a child on board (by pass code or id). Only children who ride this run can board it. */
export async function board(db: D1Database, tenantId: string, run: ReturnType<typeof mapRun>, input: { code?: unknown, studentId?: unknown, onBoard?: boolean }) {
  const expected = await expectedForRun(db, tenantId, run)
  const code = passCodeFromScan(input.code)
  const match = code
    ? expected.find(assignment => assignment.passCode === code)
    : expected.find(assignment => assignment.studentId === String(input.studentId || ''))
  if (!match) {
    if (code) {
      const elsewhere = await db.prepare(`SELECT student_id FROM transport_assignments WHERE pass_code = ? AND tenant_id = ?`).bind(code, tenantId).first()
      throw new TransportError(elsewhere ? 'This child is not on this trip.' : 'This bus pass is not recognised.', 404)
    }
    throw new TransportError('This child is not on this trip.', 404)
  }
  if (input.onBoard === false) {
    await db.prepare(`DELETE FROM transport_boardings WHERE run_id = ? AND student_id = ?`).bind(run.id, match.studentId).run()
    return { studentId: match.studentId, onBoard: false }
  }
  await db.prepare(`INSERT OR IGNORE INTO transport_boardings (id, tenant_id, run_id, student_id, route_id, boarded_at, method) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(`tboard_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, tenantId, run.id, match.studentId, match.routeId, new Date().toISOString(), code ? 'qr' : 'tap').run()
  return { studentId: match.studentId, onBoard: true }
}

/** Morning: the bus is at school. Afternoon: the bus has left school. Recorded once. */
export async function markRun(db: D1Database, tenantId: string, run: ReturnType<typeof mapRun>, event: 'arrived' | 'departed') {
  if (event === 'arrived' && run.direction !== 'morning') throw new TransportError('Arrival is recorded on the morning run.')
  if (event === 'departed' && run.direction !== 'afternoon') throw new TransportError('Leaving school is recorded on the afternoon run.')
  const now = new Date().toISOString()
  const column = event === 'arrived' ? 'arrived_at' : 'departed_at'
  await db.prepare(`UPDATE transport_runs SET status = ?, ${column} = COALESCE(${column}, ?) WHERE id = ? AND tenant_id = ?`).bind(event, now, run.id, tenantId).run()
  return (await getRun(db, tenantId, run.id))!
}

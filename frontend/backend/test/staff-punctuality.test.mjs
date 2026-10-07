import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { punctuality } from './build/materialSessionTest.mjs'

const staff = [{ id: 'ada', email: 'ada@a', name: 'Ada' }, { id: 'bola', email: 'bola@a', name: 'Bola' }, { id: 'chi', email: 'chi@a', name: 'Chi' }]
// 07:30 and 08:20 Lagos time, as stored (UTC).
const at = (date, hhmm) => `${date}T${String(Number(hhmm.slice(0, 2)) - 1).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`
const signIn = (staffId, date, hhmm, lateMinutes = 0) => ({ staffId, date, createdAt: at(date, hhmm), isLate: lateMinutes > 0, lateMinutes })

test('working days skip weekends and the school holidays', () => {
  // 5–11 Oct 2026: Mon 5 … Sun 11; 7 Oct is a school holiday.
  assert.deepEqual(punctuality.workingDays('2026-10-05', '2026-10-11', new Set(['2026-10-07'])), ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'])
})

test('the summary counts first arrivals, lateness and absence; the winner is decided by the rules', () => {
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
  const rows = punctuality.summarisePunctuality({
    staff, days, today: '2026-10-09',
    signIns: [
      ...days.map(day => signIn('ada', day, '07:30')),
      ...days.map(day => signIn('bola', day, '07:20')),
      signIn('bola', '2026-10-05', '09:00', 60), // a later second sign-in the same day is ignored
      ...days.slice(0, 3).map(day => signIn('chi', day, '08:20', 20)),
    ],
  })
  const ada = rows.find(row => row.staffId === 'ada')
  const chi = rows.find(row => row.staffId === 'chi')
  assert.deepEqual([ada.presentDays, ada.onTimeDays, ada.punctualityRate, ada.averageArrival], [5, 5, 100, '07:30'])
  assert.deepEqual([chi.presentDays, chi.lateDays, chi.absentDays, chi.lateMinutes], [3, 3, 2, 60])
  assert.equal(chi.daily[4].status, 'absent')
  // Both Ada and Bola are 100% on time with no late minutes; Bola arrives earlier on average.
  assert.deepEqual(punctuality.pickPunctualityWinners(rows).map(row => row.staffId), ['bola'])
})

test('ties share the award and poor attendance is not eligible', () => {
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
  const rows = punctuality.summarisePunctuality({
    staff, days, today: '2026-10-09',
    signIns: [...days.map(day => signIn('ada', day, '07:30')), ...days.map(day => signIn('bola', day, '07:30')), signIn('chi', days[0], '06:00')],
  })
  assert.deepEqual(punctuality.pickPunctualityWinners(rows).map(row => row.staffId).sort(), ['ada', 'bola'])
})

const SECRET = 'punctuality-test-secret'
let generation = 0

test('leadership publishes the month award and every staff member sees it; students do not', async () => {
  const worker = (await import(`./build/worker.mjs?punct=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const people = { owner: ['own', 'owner@a', 'owner'], ada: ['ada', 'ada@a', 'teacher'], bola: ['bola', 'bola@a', 'teacher'], pupil: ['pupil', 'pupil@a', 'student'] }
  for (const [id, email, role] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role, tenantId: 'school-a', status: 'active' })).run()
  }
  db.db.exec(`CREATE TABLE staff_attendance_events (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, date TEXT, action TEXT, method TEXT, qr_code TEXT, face_image_url TEXT, shared_phone INTEGER, is_late INTEGER, late_minutes INTEGER, late_charge REAL, permission_request_id TEXT, permission_status TEXT, notes TEXT, recorded_by TEXT, created_at TEXT, updated_at TEXT)`)
  const september = punctuality.workingDays('2026-09-01', '2026-09-30', new Set())
  let n = 0
  for (const day of september) {
    await db.prepare(`INSERT INTO staff_attendance_events (id, tenant_id, staff_id, date, action, is_late, late_minutes, created_at) VALUES (?, 'school-a', 'ada', ?, 'sign-in', 0, 0, ?)`).bind(`e${n++}`, day, at(day, '07:15')).run()
    await db.prepare(`INSERT INTO staff_attendance_events (id, tenant_id, staff_id, date, action, is_late, late_minutes, created_at) VALUES (?, 'school-a', 'bola', ?, 'sign-in', 1, 10, ?)`).bind(`e${n++}`, day, at(day, '08:10')).run()
  }
  const call = async (person, method, path, body) => {
    const [id, , role] = people[person]
    const token = await sign({ id, role, roles: [role], tenantId: 'school-a', name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
      { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }

  const report = await call('owner', 'GET', '/api/school/staff-punctuality?period=month&date=2026-09-15')
  assert.equal(report.status, 200)
  assert.deepEqual([report.body.staff[0].staffId, report.body.staff[0].punctualityRate], ['ada', 100])
  const bola = report.body.staff.find(row => row.staffId === 'bola')
  assert.deepEqual([bola.punctualityRate, bola.lateDays, bola.lateMinutes], [0, september.length, 10 * september.length])
  assert.equal((await call('ada', 'GET', '/api/school/staff-punctuality?period=month&date=2026-09-15')).status, 403)

  const winner = await call('owner', 'GET', '/api/school/staff-punctuality/winner?month=2026-09')
  assert.deepEqual(winner.body.winners.map(row => row.staffId), ['ada'])
  assert.equal((await call('ada', 'POST', '/api/school/staff-punctuality/awards', { month: '2026-09' })).status, 403)
  const published = await call('owner', 'POST', '/api/school/staff-punctuality/awards', { month: '2026-09', badgeLabel: 'Early Bird', badgeIcon: '⏰', message: 'Thank you!' })
  assert.deepEqual([published.status, published.body.award.winners[0].name], [200, 'ADA'])

  assert.equal((await call('bola', 'GET', '/api/school/staff-punctuality/award')).body.award.badgeLabel, 'Early Bird')
  assert.equal((await call('pupil', 'GET', '/api/school/staff-punctuality/award')).body.award, null)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Terms Calendar: per session; conflicts found before approval; drafted, submitted and approved
// by another head; every version kept; publishing updates only this session's own entries in
// the live calendar and on the website; reminders in the app, once each.

const SECRET = 'terms-calendar-secret'

async function setup() {
  const worker = (await import(`./build/worker.mjs?cal=${Math.random()}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  db.db.exec(`CREATE TABLE academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, start_date TEXT, end_date TEXT, status TEXT)`)
  db.db.exec(`CREATE TABLE academic_terms (id TEXT PRIMARY KEY, tenant_id TEXT, session_id TEXT, name TEXT, sequence INTEGER, start_date TEXT, end_date TEXT, resumption_date TEXT, status TEXT)`)
  db.db.exec(`INSERT INTO academic_sessions VALUES ('s26', 'school-a', '2026/2027', '2026-09-07', '2027-07-23', 'active'), ('s25', 'school-a', '2025/2026', '2025-09-08', '2026-07-24', 'completed')`)
  db.db.exec(`INSERT INTO academic_terms VALUES ('t1', 'school-a', 's26', 'First Term', 1, '2026-09-07', '2026-12-11', NULL, 'active'), ('t2', 'school-a', 's26', 'Second Term', 2, '2027-01-11', '2027-04-02', '2027-01-11', 'upcoming')`)
  const people = { owner: ['own', 'own@a.ng', 'owner'], hos: ['hos', 'hos@a.ng', 'hos'], teacher: ['tea', 'tea@a.ng', 'teacher'], parent: ['par', 'par@a.ng', 'parent'] }
  for (const [id, email, role] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ id, email, role, roles: [role], tenantId: 'school-a' })).run()
  }
  const call = async (person, method, path, body) => {
    const [id, email, role] = people[person]
    const token = await sign({ id, email, role, roles: [role], name: id.toUpperCase(), tenantId: 'school-a', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': role }, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

const ENTRIES = [
  { id: 'midterm-1', type: 'break', title: 'First Term mid-term break', startDate: '2026-10-26', endDate: '2026-10-30', audience: 'everyone' },
  { id: 'exam-1', type: 'exam', title: 'First Term examinations', startDate: '2026-11-30', endDate: '2026-12-04', audience: 'everyone', reminderDays: 7 },
  { id: 'results-1', type: 'results', title: 'First Term results', startDate: '2026-12-11', endDate: '2026-12-11', audience: 'parents' },
  { id: 'open-1', type: 'open_day', title: 'Open day', startDate: '2026-11-14', endDate: '2026-11-14', audience: 'everyone', showOnWebsite: true, note: 'Visit the school' },
]

test('conflicts are found before approval: exams in a break or on a public holiday, results before exams end, outside the session', async () => {
  const { call } = await setup()
  const bad = [
    ...ENTRIES,
    { id: 'test-bad', type: 'test', title: 'C.A. test in the break', startDate: '2026-10-28', endDate: '2026-10-28' },
    { id: 'exam-holiday', type: 'exam', title: 'Mock on Independence Day', startDate: '2026-10-01', endDate: '2026-10-01' },
    { id: 'results-early', type: 'results', title: 'Too early', startDate: '2026-12-01', endDate: '2026-12-01' },
    { id: 'far', type: 'event', title: 'Next year', startDate: '2027-09-01', endDate: '2027-09-01' },
  ]
  const saved = await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: bad })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  const messages = saved.body.conflicts.filter(item => item.severity === 'error').map(item => item.message).join(' | ')
  assert.match(messages, /C\.A\. test in the break" falls during First Term mid-term break/)
  assert.match(messages, /Mock on Independence Day" falls on Independence Day/)
  assert.match(messages, /Too early" is before the examinations end \(2026-12-04\)/)
  assert.match(messages, /Next year" falls outside 2026\/2027/)
  // Errors stop the calendar being submitted.
  const submit = await call('hos', 'POST', '/api/school/terms-calendar/s26/submit')
  assert.equal(submit.status, 409)
  assert.equal((await call('teacher', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })).status, 403)
})

test('draft → submit → approved by another head → published to the live calendar and website; history kept; earlier session untouched', async () => {
  const { call, db } = await setup()
  await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })
  assert.equal((await call('hos', 'POST', '/api/school/terms-calendar/s26/submit')).status, 200)
  // Locked while waiting; the drafter cannot approve their own calendar while another head exists.
  assert.equal((await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })).status, 409)
  assert.equal((await call('hos', 'POST', '/api/school/terms-calendar/s26/approve')).status, 403)
  // Returned with a note, fixed, resubmitted, approved by the Owner.
  assert.equal((await call('owner', 'POST', '/api/school/terms-calendar/s26/return', { note: '' })).status, 400)
  assert.equal((await call('owner', 'POST', '/api/school/terms-calendar/s26/return', { note: 'Add the PTA meeting' })).status, 200)
  const withPta = [...ENTRIES, { id: 'pta-1', type: 'event', title: 'PTA meeting', startDate: '2026-11-21', endDate: '2026-11-21', audience: 'parents' }]
  await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: withPta })
  await call('hos', 'POST', '/api/school/terms-calendar/s26/submit')
  const published = await call('owner', 'POST', '/api/school/terms-calendar/s26/approve', { note: 'Approved at the board meeting' })
  assert.deepEqual([published.status, published.body.version, published.body.published], [200, 1, 5])

  const live = db.db.prepare(`SELECT id, type, title, status, reminder_minutes FROM school_calendar_events WHERE source = 'terms_calendar' ORDER BY start_date`).all()
  assert.deepEqual(live.map(row => [row.type, row.title]), [['break', 'First Term mid-term break'], ['event', 'Open day'], ['event', 'PTA meeting'], ['event', 'First Term examinations'], ['event', 'First Term results']])
  assert.equal(live.find(row => row.title === 'First Term examinations').reminder_minutes, 7 * 1440)
  assert.deepEqual(db.db.prepare(`SELECT title FROM school_events`).all().map(row => row.title), ['Open day'])

  // Version 2 drops the PTA meeting: cancelled on the calendar (kept on file), version 1 superseded.
  await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })
  await call('hos', 'POST', '/api/school/terms-calendar/s26/submit')
  const second = await call('owner', 'POST', '/api/school/terms-calendar/s26/approve')
  assert.deepEqual([second.body.version, second.body.removed], [2, 1])
  assert.equal(db.db.prepare(`SELECT status FROM school_calendar_events WHERE title = 'PTA meeting'`).get().status, 'cancelled')
  const view = (await call('owner', 'GET', '/api/school/terms-calendar?sessionId=s26')).body.calendar
  assert.deepEqual(view.history.map(item => [item.version, item.status]), [[2, 'published'], [1, 'superseded']])
  assert.equal(view.history[1].decidedBy, 'OWN')
  assert.ok(view.reference.some(item => item.kind === 'public_holiday' && item.title === 'Independence Day'))
  assert.equal((await call('owner', 'GET', '/api/school/terms-calendar/s26/versions/1')).body.version.entries.length, 5)

  // A finished session's calendar cannot be changed.
  assert.equal((await call('hos', 'PUT', '/api/school/terms-calendar/s25/draft', { entries: [] })).status, 409)
})

test('a school with only an Owner approves its own calendar', async () => {
  const { call, db } = await setup()
  db.db.exec(`UPDATE users SET status = 'inactive' WHERE id = 'hos'`)
  await call('owner', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })
  await call('owner', 'POST', '/api/school/terms-calendar/s26/submit')
  assert.equal((await call('owner', 'POST', '/api/school/terms-calendar/s26/approve')).status, 200)
})

test('reminders: in the app, to the audience chosen, once each, only for published entries', async () => {
  const { call, db } = await setup()
  const { sendDueReminders } = await import(`./build/termsCalendar.mjs?r=${Math.random()}`)
  await call('hos', 'PUT', '/api/school/terms-calendar/s26/draft', { entries: ENTRIES })
  const sent = []
  const deliver = async (userIds, tenantId, title) => { sent.push({ userIds, title }); return userIds.length }
  // Not published yet: nothing goes.
  assert.equal((await sendDueReminders(db, deliver, new Date('2026-11-23T06:00:00Z'))).sent, 0)
  await call('hos', 'POST', '/api/school/terms-calendar/s26/submit')
  await call('owner', 'POST', '/api/school/terms-calendar/s26/approve')
  // Exams start 30 Nov with a 7-day reminder: due on 23 Nov, to everyone except students.
  assert.equal((await sendDueReminders(db, deliver, new Date('2026-11-22T06:00:00Z'))).sent, 0)
  const due = await sendDueReminders(db, deliver, new Date('2026-11-23T06:00:00Z'))
  assert.equal(due.sent, 4)
  assert.equal(sent[0].title, 'Coming up: First Term examinations')
  assert.deepEqual(sent[0].userIds.sort(), ['hos', 'own', 'par', 'tea'])
  // Never twice.
  assert.equal((await sendDueReminders(db, deliver, new Date('2026-11-23T08:00:00Z'))).sent, 0)
})

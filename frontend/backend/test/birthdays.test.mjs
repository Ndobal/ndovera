import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as bday from './build/birthdays.mjs'

// Birthday celebrations (ndovera_birthdays/README.md): the backend acceptance tests that
// do not need real photos — isolation, consent, wishes, moderation, settings, designs.

const SECRET = 'birthday-test-secret'
let worker
let generation = 0
const lagosToday = bday.localClock(new Date(), 'Africa/Lagos').date
const dob = year => `${year}-${lagosToday.slice(5)}`

const PEOPLE = {
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner', '1980-01-01'],
  teacher: ['t-1', 'teacher@a.test', 'teacher', 'school-a', 'Ada Teacher', dob(1990)],
  colleague: ['t-2', 'colleague@a.test', 'teacher', 'school-a', 'Bola Colleague', '1985-06-15'],
  student: ['s-1', 'student@a.test', 'student', 'school-a', 'Chidi Student', dob(2012)],
  classmate: ['s-2', 'classmate@a.test', 'student', 'school-a', 'Dayo Classmate', '2012-03-03'],
  parent: ['p-1', 'parent@a.test', 'parent', 'school-a', 'Chidi Parent', ''],
  ownerB: ['o-b', 'owner@b.test', 'owner', 'school-b', 'Other Owner', ''],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?bday=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, owner_email TEXT, status TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis <College>', 'owner@a.test', 'active'), ('school-b', 'Other', 'owner@b.test', 'active');
    CREATE TABLE parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'p-1', 's-1', 'school-a', '2026-01-01');
  `)
  for (const [id, email, role, tenant, name, dateOfBirth] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, dateOfBirth, avatar: id === 't-1' ? 'https://ndovera.com/files/avatars/school-b/t-1/x.png' : '' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId, name] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  const text = await response.text()
  let parsed = {}
  try { parsed = JSON.parse(text) } catch { parsed = { text } }
  return { status: response.status, body: parsed, school: response.headers.get('X-School-Id'), cache: response.headers.get('Cache-Control'), type: response.headers.get('Content-Type') }
}

async function enable(db, patch = {}) {
  const current = (await call(db, 'owner', 'GET', '/api/birthdays/settings')).body
  const saved = await call(db, 'owner', 'PUT', '/api/birthdays/settings', { ...current, enabled: true, announcementTime: '00:00', ...patch })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  return saved.body
}

const deps = db => ({ db, schoolName: async () => 'Genesis <College>', runAi: null })

test('a school that turns birthdays on celebrates today’s staff once; others see it; another school never does', async () => {
  const db = await setup()
  assert.equal((await call(db, 'teacher', 'GET', '/api/birthdays/settings')).status, 403)
  assert.deepEqual((await call(db, 'colleague', 'GET', '/api/birthdays/today')).body.items, [], 'off by default')
  await enable(db)
  assert.equal(await bday.runSchoolBirthdays(deps(db), 'school-a'), 1, 'the teacher; students are off by default')
  assert.equal(await bday.runSchoolBirthdays(deps(db), 'school-a'), 0, 'once a day')

  const feed = await call(db, 'colleague', 'GET', '/api/birthdays/today')
  assert.equal(feed.school, 'school-a')
  assert.equal(feed.cache, 'private, no-store')
  assert.deepEqual(feed.body.items.map(item => item.name), ['Ada Teacher'])
  const id = feed.body.items[0].id
  const detail = (await call(db, 'colleague', 'GET', `/api/birthdays/${id}`)).body
  assert.equal(detail.canSendWish, true)
  assert.equal(detail.canReadWishes, false)
  assert.ok(detail.allowedStyles.includes('cheerful'))
  assert.ok(!detail.allowedStyles.includes('faith'), 'faith styles only where the school approves')
  assert.ok(!JSON.stringify(detail).includes('1990'), 'no year of birth or age anywhere')

  const card = await call(db, 'colleague', 'GET', `/api/birthdays/${id}/card`)
  assert.equal(card.status, 200)
  assert.match(card.type, /image\/svg\+xml/)
  assert.equal(card.school, 'school-a')
  assert.match(card.body.text, /Happy Birthday/)
  assert.match(card.body.text, /Genesis &lt;College&gt;/, 'text is escaped')
  assert.ok(!card.body.text.includes('<image'), 'an avatar outside the person’s own folder is never used: initials instead')

  // School B: not found, whatever it guesses.
  for (const path of [`/api/birthdays/${id}`, `/api/birthdays/${id}/card`, `/api/birthdays/${id}/wishes`]) assert.equal((await call(db, 'ownerB', 'GET', path)).status, 404, path)
  assert.equal((await call(db, 'ownerB', 'POST', `/api/birthdays/${id}/wishes`, { message: 'hi', requestId: 'r' })).status, 404)
  assert.deepEqual((await call(db, 'ownerB', 'GET', '/api/birthdays/today')).body.items, [])
})

test('wishes: students wait for approval, only the birthday person reads them, replays are safe, reports hide a wish', async () => {
  const db = await setup()
  await enable(db)
  await bday.runSchoolBirthdays(deps(db), 'school-a')
  const id = (await call(db, 'colleague', 'GET', '/api/birthdays/today')).body.items[0].id

  assert.deepEqual((await call(db, 'colleague', 'POST', `/api/birthdays/${id}/wishes`, { message: 'Happy birthday, Ada! 🎉', requestId: 'r1' })).body, { status: 'approved' })
  assert.deepEqual((await call(db, 'colleague', 'POST', `/api/birthdays/${id}/wishes`, { message: 'Happy birthday, Ada! 🎉', requestId: 'r1' })).body, { status: 'approved' }, 'a replay returns the original')
  assert.equal((await call(db, 'colleague', 'POST', `/api/birthdays/${id}/wishes`, { message: 'Different words', requestId: 'r1' })).status, 409)
  assert.deepEqual((await call(db, 'classmate', 'POST', `/api/birthdays/${id}/wishes`, { message: 'Happy birthday ma', requestId: 'r2' })).body, { status: 'pending' })
  assert.equal((await call(db, 'teacher', 'POST', `/api/birthdays/${id}/wishes`, { message: 'Me', requestId: 'r3' })).status, 403, 'not to yourself')
  assert.equal((await call(db, 'colleague', 'POST', `/api/birthdays/${id}/wishes`, { message: 'x'.repeat(1001), requestId: 'r4' })).status, 400)

  assert.equal((await call(db, 'colleague', 'GET', `/api/birthdays/${id}/wishes`)).status, 403, 'others cannot read them')
  const mine = (await call(db, 'teacher', 'GET', `/api/birthdays/${id}/wishes`)).body.items
  assert.deepEqual(mine.map(item => item.message), ['Happy birthday, Ada! 🎉'], 'pending ones are not shown to the recipient')
  assert.equal((await call(db, 'teacher', 'GET', `/api/birthdays/${id}`)).body.wishCount, 1)
  assert.equal((await call(db, 'colleague', 'GET', `/api/birthdays/${id}`)).body.wishCount, 1, 'a sender counts only their own')

  // The Head approves the student's; the recipient reports one, which hides it.
  const queue = (await call(db, 'owner', 'GET', '/api/birthdays/moderation')).body.items
  assert.equal(queue.length, 1)
  assert.equal((await call(db, 'colleague', 'GET', '/api/birthdays/moderation')).status, 403)
  assert.equal((await call(db, 'owner', 'POST', `/api/birthdays/wishes/${queue[0].id}/decision`, { decision: 'approve' })).body.status, 'approved')
  const both = (await call(db, 'teacher', 'GET', `/api/birthdays/${id}/wishes`)).body.items
  assert.equal(both.length, 2)
  assert.equal((await call(db, 'teacher', 'POST', `/api/birthdays/${id}/wishes/${both[0].id}/report`, { reason: 'Not kind' })).body.status, 'received')
  assert.equal((await call(db, 'teacher', 'GET', `/api/birthdays/${id}/wishes`)).body.items.length, 1)
  assert.equal((await call(db, 'owner', 'GET', '/api/birthdays/moderation')).body.items[0].reportReason, 'Not kind')

  // Memories: the person's own, by session only.
  assert.equal((await call(db, 'teacher', 'GET', '/api/birthdays/memories')).body.items.length, 1)
  assert.equal((await call(db, 'colleague', 'GET', '/api/birthdays/memories')).body.items.length, 0)
})

test('students need consent (theirs or a parent’s); withdrawing hides the celebration at once', async () => {
  const db = await setup()
  await enable(db, { students: true })
  // No consent yet: the student is not celebrated.
  assert.equal((await call(db, 'student', 'GET', '/api/birthdays/my-consent')).body.celebrate, false)
  const parentView = (await call(db, 'parent', 'GET', '/api/birthdays/my-consent')).body
  assert.deepEqual(parentView.children.map(child => child.name), ['Chidi Student'])
  assert.equal((await call(db, 'classmate', 'PUT', '/api/birthdays/consent/s-1', { celebrate: true })).status, 403, 'not another student')
  assert.equal((await call(db, 'parent', 'PUT', '/api/birthdays/consent/s-1', { celebrate: true })).status, 200)
  assert.equal(await bday.runSchoolBirthdays(deps(db), 'school-a'), 2, 'the teacher and, with consent, the student')
  const items = (await call(db, 'classmate', 'GET', '/api/birthdays/today')).body.items
  assert.deepEqual(items.map(item => item.name).sort(), ['Ada Teacher', 'Chidi Student'])
  const studentId = items.find(item => item.name === 'Chidi Student').id

  // The parent withdraws: gone from the dashboard and the card at once.
  await call(db, 'parent', 'PUT', '/api/birthdays/consent/s-1', { celebrate: false })
  assert.deepEqual((await call(db, 'classmate', 'GET', '/api/birthdays/today')).body.items.map(item => item.name), ['Ada Teacher'])
  assert.equal((await call(db, 'classmate', 'GET', `/api/birthdays/${studentId}/card`)).status, 404)
  // Staff opt out themselves.
  await call(db, 'teacher', 'PUT', '/api/birthdays/my-consent', { celebrate: false })
  assert.deepEqual((await call(db, 'classmate', 'GET', '/api/birthdays/today')).body.items, [])
})

test('stale settings are refused; designs never repeat a family over 13 years; 29 February follows the school; only a person’s own photo', async () => {
  const db = await setup()
  const first = await enable(db)
  assert.equal((await call(db, 'owner', 'PUT', '/api/birthdays/settings', { ...first, version: first.version - 1 })).status, 409)
  assert.equal((await call(db, 'owner', 'PUT', '/api/birthdays/settings', { ...first, timezone: 'Mars/Base' })).status, 400)

  const used = []
  for (let year = 0; year < 13; year += 1) {
    const design = bday.chooseDesign(used.slice(-12), 1000 + year)
    assert.ok(!used.slice(-12).includes(design.family), `year ${year}`)
    used.push(design.family)
  }
  assert.equal(new Set(used).size, 13, '13 consecutive cards, 13 families')
  assert.ok(bday.FAMILIES.length >= 13)

  assert.equal(bday.birthdayMatches('2008-02-29', '2027-02-28', 'feb28'), true)
  assert.equal(bday.birthdayMatches('2008-02-29', '2027-03-01', 'feb28'), false)
  assert.equal(bday.birthdayMatches('2008-02-29', '2027-03-01', 'mar01'), true)
  assert.equal(bday.birthdayMatches('2008-02-29', '2028-02-29', 'mar01'), true)

  assert.equal(bday.ownAvatarKey('https://ndovera.com/files/avatars/school-a/t-1/a.png', 'school-a', 't-1'), 'avatars/school-a/t-1/a.png')
  assert.equal(bday.ownAvatarKey('https://ndovera.com/files/avatars/school-a/t-9/a.png', 'school-a', 't-1'), '', 'never another person’s photo')
  assert.equal(bday.ownAvatarKey('https://ndovera.com/files/avatars/school-a/t-1/../t-9/a.png', 'school-a', 't-1'), '')

  const svg = bday.renderCard({ design: bday.chooseDesign([], 7), name: '<script>alert(1)</script>', displayDate: '10 October', message: 'Hi & welcome', schoolName: 'S' })
  assert.ok(!svg.includes('<script>'))
  assert.match(svg, /&lt;script&gt;/)
  // No cards for birthdays before the service started.
  assert.ok(bday.START_DATE === '2026-10-10')
})

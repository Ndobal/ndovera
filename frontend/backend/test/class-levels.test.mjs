import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { importContext, normalizeClassLevel, withImportDefaults } from './build/curriculumLibrary.mjs'
import { levelOf } from './build/practiceLevels.mjs'

// Schools name classes their own way. A school says which standard level each class is
// ("GRADE 1" is Primary 2), and a long scheme of work keeps its class and subject from
// one piece of the document to the next.

const SECRET = 'class-levels-secret'
let worker
let generation = 0

test('early-years and secondary names are read as their standard levels', () => {
  const label = name => normalizeClassLevel(name).label
  assert.deepEqual(['EARLY EXPLORERS', 'Pre-Nursery', 'RECEPTION', 'PRE-SCHOOL 1', 'PRE-SCHOOL 2', 'Nursery 3', 'Junior High School 1', 'PRY2', 'PRENUR'].map(label),
    ['Pre-Nursery', 'Pre-Nursery', 'Nursery 1', 'Nursery 2', 'Nursery 3', 'Nursery 3', 'JSS 1', 'Primary 2', 'Pre-Nursery'])
  assert.deepEqual(['EARLY EXPLORERS', 'RECEPTION', 'PRE-SCHOOL 1', 'Junior High School 2', 'Senior High School 3'].map(name => levelOf(name)?.rank), [-2, -1, 0, 8, 12])
})

test('a piece of a long scheme of work keeps the class, subject and term of the heading before it', () => {
  const text = [
    'TABLE OF CONTENT', 'HEALTH HABITS SCHEME OF WORK (PRIMARY 6) ........ 900', '',
    '10 | 985|BACK TO TABLE OF CONTENTPRE-NURSERYHEALTH HABITS SCHEME OF WORK', 'FIRST TERM', 'Week Topic Teacher\'s Activities Pupil\'s Activities', '1 Introduction to Our Body',
    'SECOND TERM', '1 Hand washing',
    '101 | 985|BACK TO TABLE OF CONTENTNURSERY 1', 'HANDWRITING SCHEME OF WORK', 'FIRST TERM', '1 Holding the pencil',
    'NUMERACY SCHEME OF WORK (NURSERY 3)', 'THIRD TERM', '4 Counting 1 to 20',
  ].join('\n')
  const at = phrase => text.indexOf(phrase)
  assert.deepEqual(importContext(text, at('1 Hand washing')), { classLabel: 'Pre-Nursery', subject: 'Health Habits', term: 'Second Term' })
  assert.deepEqual(importContext(text, at('1 Holding the pencil')), { classLabel: 'Nursery 1', subject: 'Handwriting', term: 'First Term' })
  assert.deepEqual(importContext(text, at('4 Counting')), { classLabel: 'Nursery 3', subject: 'Numeracy', term: 'Third Term' })
  assert.deepEqual(withImportDefaults([{ topic: 'Hand washing' }, { topic: 'x', class: 'Nursery 2', term: 'First Term' }], { classLabel: 'Pre-Nursery', subject: 'Health Habits', term: 'Second Term' }),
    [{ topic: 'Hand washing', class: 'Pre-Nursery', subject: 'Health Habits', term: 'Second Term' }, { topic: 'x', class: 'Nursery 2', subject: 'Health Habits', term: 'First Term' }])
})

async function setup() {
  worker = (await import(`./build/worker.mjs?class-levels=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm) VALUES ('g1', 'school-a', 'GRADE 1', 'PRIMARY'), ('rec', 'school-a', 'RECEPTION', 'PRE-SCHOOL'), ('other', 'school-b', 'GRADE 1', '')`)
  for (const [id, email, role, extra] of [['o-1', 'owner@a.test', 'owner', {}], ['t-1', 'teacher@a.test', 'teacher', {}], ['s-1', 'pupil@a.test', 'student', { classId: 'g1' }]]) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, roles: [role], tenantId: 'school-a', status: 'active', ...extra })).run()
  }
  return db
}

async function call(db, [id, role], method, path, body) {
  const token = await sign({ id, role, roles: [role], tenantId: 'school-a', name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('the school sets each class\'s standard level; practice and the curriculum follow it', async () => {
  const db = await setup()
  const owner = ['o-1', 'owner']
  const listed = await call(db, owner, 'GET', '/api/school/class-levels')
  assert.equal(listed.status, 200, JSON.stringify(listed.body))
  assert.deepEqual(listed.body.classes.map(item => [item.name, item.guess, item.level]), [['GRADE 1', 'PRY1', ''], ['RECEPTION', 'NUR1', '']])
  assert.equal(listed.body.levels[0].label, 'Pre-Nursery')
  assert.equal((await call(db, ['t-1', 'teacher'], 'PUT', '/api/school/class-levels', { levels: { g1: 'PRY2' } })).status, 403)
  assert.equal((await call(db, owner, 'PUT', '/api/school/class-levels', { levels: { g1: 'NOPE' } })).status, 400)
  assert.equal((await call(db, owner, 'PUT', '/api/school/class-levels', { levels: { g1: 'PRY2', other: 'SS3' } })).status, 200)
  assert.equal(db.db.prepare(`SELECT standard_level FROM classes WHERE id = 'g1'`).get().standard_level, 'Primary 2')
  assert.equal(db.db.prepare(`SELECT standard_level FROM classes WHERE id = 'other'`).get().standard_level, null, 'another school\'s class is untouched')
  // The pupil in GRADE 1 practises at Primary 2.
  const home = await call(db, ['s-1', 'student'], 'GET', '/api/practice-arena/home')
  assert.equal(home.status, 200, JSON.stringify(home.body))
  assert.equal(home.body.student.level, 'Primary 2')
  // Cleared, the name is read again.
  await call(db, owner, 'PUT', '/api/school/class-levels', { levels: { g1: '' } })
  assert.equal((await call(db, ['s-1', 'student'], 'GET', '/api/practice-arena/home')).body.student.level, 'Primary 1')
})

// End-to-end checks on class stream posting, through the Worker's own routes:
// who may post or comment, as whom, and never across schools.
import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'stream-test-secret'

// The Worker caches "table ready" flags per isolate. Each test gets a fresh
// database, so it also gets a fresh copy of the module.
let worker
let generation = 0

const PEOPLE = [
  // id, email, role, tenant, extra settings
  ['t-class', 'teacher@a.test', 'teacher', 'school-a', {}],
  ['t-subject', 'subject@a.test', 'teacher', 'school-a', {}],
  ['t-other', 'other@a.test', 'teacher', 'school-a', {}],
  ['s-in', 'pupil@a.test', 'student', 'school-a', { classId: 'jss2a' }],
  ['s-out', 'elsewhere@a.test', 'student', 'school-a', { classId: 'jss1a' }],
  ['p-1', 'parent@a.test', 'parent', 'school-a', {}],
  ['o-a', 'owner@a.test', 'owner', 'school-a', {}],
  ['h-a', 'hos@a.test', 'hos', 'school-a', {}],
  ['o-b', 'owner@b.test', 'owner', 'school-b', {}],
]

async function setup() {
  worker = (await import(`./build/worker.mjs?fresh=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec('CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)')
  for (const [id, tenant, teacher] of [['jss2a', 'school-a', 't-class'], ['jss1a', 'school-a', null], ['b-class', 'school-b', null]]) {
    await db.prepare('INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES (?, ?, ?, ?, ?)').bind(id, tenant, id.toUpperCase(), '', teacher).run()
  }
  await db.prepare("INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('math', 'school-a', 'Mathematics', 'jss2a', 't-subject')").run()
  for (const [id, email, role, tenant, extra] of PEOPLE) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, `${role} ${id}`, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: `${role} ${id}`, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

async function call(db, userId, method, path, body) {
  const [id, , role, tenantId] = PEOPLE.find(person => person[0] === userId)
  const token = await sign({ id, role, roles: [role], tenantId, name: `${role} ${id}`, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const post = (db, user, classId, body) => call(db, user, 'POST', `/api/classrooms/${classId}/stream`, body)

test('the class teacher, a subject teacher and an enrolled student can post, always as themselves', async () => {
  const db = await setup()
  const teacher = await post(db, 't-class', 'jss2a', { content: 'Bring your rulers.', authorId: 'o-a' })
  assert.equal(teacher.status, 201)
  assert.equal(teacher.body.post.authorId, 't-class')
  assert.equal(teacher.body.post.postedByLabel, null)

  assert.equal((await post(db, 't-subject', 'jss2a', { content: 'Maths test Friday.' })).status, 201)

  const student = await post(db, 's-in', 'jss2a', { text: 'Thank you!', authorId: 't-class' })
  assert.equal(student.status, 201)
  assert.equal(student.body.post.authorId, 's-in')
  assert.equal(student.body.post.authorRole, 'student')
})

test('nobody outside the class, or the school, can post to it', async () => {
  const db = await setup()
  assert.equal((await post(db, 't-other', 'jss2a', { content: 'Not my class' })).status, 403)
  assert.equal((await post(db, 's-out', 'jss2a', { content: 'Wrong class' })).status, 403)
  assert.equal((await post(db, 'p-1', 'jss2a', { content: 'Parent post' })).status, 403)
  assert.equal((await post(db, 'o-b', 'jss2a', { content: 'Other school owner' })).status, 404)
  assert.equal((await post(db, 'o-a', 'b-class', { content: 'Other school class' })).status, 404)
  assert.equal((await call(db, 't-other', 'POST', '/api/classrooms/jss2a/posts', { content: 'Alias route' })).status, 403)
  // Every attempt was refused before anything was written — the posts table may not even exist.
  const table = await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'posts'").first()
  const count = table ? (await db.prepare('SELECT COUNT(*) AS n FROM posts').first()).n : 0
  assert.equal(count, 0)
})

test('owner and HOS posts are labelled, and a view-only HOS cannot post', async () => {
  const db = await setup()
  const owner = await post(db, 'o-a', 'jss2a', { content: 'Assembly at 8.' })
  assert.equal(owner.status, 201)
  assert.equal(owner.body.post.postedByLabel, 'School Owner')
  assert.equal(owner.body.post.authorRole, 'owner')
  const hos = await post(db, 'h-a', 'jss2a', { content: 'Inspection next week.' })
  assert.equal(hos.body.post.postedByLabel, 'Head of School')

  const stream = await call(db, 's-in', 'GET', '/api/classrooms/jss2a/stream')
  assert.deepEqual(stream.body.posts.map(item => item.postedByLabel).sort(), ['Head of School', 'School Owner'])

  assert.equal((await call(db, 'o-a', 'PUT', '/api/supervision/policy', { hosMode: 'view' })).status, 200)
  assert.equal((await post(db, 'h-a', 'jss2a', { content: 'Blocked' })).status, 403)
  assert.equal((await call(db, 'h-a', 'PUT', `/api/classrooms/jss2a/stream/${hos.body.post.id}`, { content: 'Edited' })).status, 403)
  assert.equal((await call(db, 'h-a', 'POST', '/api/supervision/policy', {})).status, 404)
})

test('comments follow the same rules and must belong to a post in that class', async () => {
  const db = await setup()
  const first = await post(db, 't-class', 'jss2a', { content: 'Homework is on page 4.' })
  const postId = first.body.post.id
  const comment = await call(db, 's-in', 'POST', `/api/classrooms/jss2a/posts/${postId}/comments`, { text: 'Done!', authorId: 't-class' })
  assert.equal(comment.status, 201)
  assert.equal(comment.body.comment.authorId, 's-in')
  assert.equal((await call(db, 's-out', 'POST', `/api/classrooms/jss2a/posts/${postId}/comments`, { text: 'Hi' })).status, 403)
  assert.equal((await call(db, 'p-1', 'POST', `/api/classrooms/jss2a/posts/${postId}/comments`, { text: 'Hi' })).status, 403)
  // Authorised for JSS 1A does not reach a JSS 2A post through JSS 1A's URL.
  assert.equal((await call(db, 's-out', 'POST', `/api/classrooms/jss1a/posts/${postId}/comments`, { text: 'Sneaky' })).status, 404)
  const stored = await db.prepare('SELECT comments FROM posts WHERE id = ?').bind(postId).first()
  assert.equal(JSON.parse(stored.comments).length, 1)
})

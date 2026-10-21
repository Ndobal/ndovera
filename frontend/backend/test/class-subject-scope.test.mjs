import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// In a class, a subject teacher sees their own subjects' materials and assignments (and what
// they posted); the class teacher sees everything.

const SECRET = 'class-scope-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?class-scope=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, school_name TEXT, owner_email TEXT, status TEXT, requested_subdomain TEXT, website_domain TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, school_name, owner_email, status) VALUES ('school-a', 'School A', 'owner@a.test', 'active')`)
  const people = { math: ['t-math', 'math@a.test', 'teacher'], eng: ['t-eng', 'eng@a.test', 'teacher'], ct: ['t-ct', 'ct@a.test', 'teacher'] }
  for (const [id, email, role] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, 'school-a', 'active').run()
    for (const key of [email, id]) await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(key, JSON.stringify({ name: id, email, role, roles: [role], tenantId: 'school-a', status: 'active' })).run()
  }
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1a', 'school-a', 'JSS 1', 'A', 't-ct'), ('jss1b', 'school-a', 'JSS 1', 'B', '')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`)
  db.db.exec(`INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('math-a', 'school-a', 'Mathematics', 'jss1a', 't-math'), ('eng-a', 'school-a', 'English', 'jss1a', 't-eng'), ('math-b', 'school-a', 'Mathematics', 'jss1b', 't-math')`)
  const call = async (person, method, path, body) => {
    const [id, email, role] = people[person]
    const token = await sign({ id, email, role, roles: [role], tenantId: 'school-a', name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

test('subject teachers see their own subjects; the class teacher sees all', async () => {
  const { call } = await setup()
  for (const [who, subjectId, title] of [['math', 'math-a', 'Fractions note'], ['eng', 'eng-a', 'Nouns note']]) {
    const posted = await call(who, 'POST', '/api/classrooms/jss1a/materials', { title, subjectId, description: 'Read this.' })
    assert.equal(posted.status, 201, JSON.stringify(posted.body))
    const set = await call(who, 'POST', '/api/classrooms/jss1a/assignments', { title: `${title} quiz`, subjectId, questions: [{ id: 'q1', type: 'essay', prompt: 'Explain.' }] })
    assert.equal(set.status, 201, JSON.stringify(set.body))
  }
  const titles = async (who, kind) => ((await call(who, 'GET', `/api/classrooms/jss1a/${kind}`)).body[kind] || []).map(item => item.title).sort()
  assert.deepEqual(await titles('math', 'materials'), ['Fractions note'])
  assert.deepEqual(await titles('eng', 'materials'), ['Nouns note'])
  assert.deepEqual(await titles('math', 'assignments'), ['Fractions note quiz'])
  assert.deepEqual(await titles('ct', 'materials'), ['Fractions note', 'Nouns note'])
  assert.deepEqual(await titles('ct', 'assignments'), ['Fractions note quiz', 'Nouns note quiz'])
})

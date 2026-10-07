import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'rename-test-secret'
let worker
let generation = 0

async function setup() {
  worker = (await import(`./build/worker.mjs?rename=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'A'), ('school-b', 'B');
    INSERT INTO classes (id, tenantId, name) VALUES ('jss1a', 'school-a', 'JSS 1');
    INSERT INTO subjects VALUES ('bst', 'school-a', 'Basic Science & Technology', 'jss1a', 't1', 'x'),
                                ('math', 'school-a', 'Mathematics', 'jss1a', 't2', 'x');
    CREATE TABLE result_ca_entries (id TEXT PRIMARY KEY, batch_id TEXT, tenant_id TEXT, class_id TEXT, session_name TEXT, term_name TEXT,
      student_id TEXT, subject_id TEXT, subject_name TEXT, teacher_id TEXT, ca_components_json TEXT, ca_score REAL, exam_score REAL, updated_by TEXT, updated_at TEXT);
    INSERT INTO result_ca_entries VALUES ('r1', 'b1', 'school-a', 'jss1a', '2025/2026', 'Third Term', 's1', 'bst', 'Basic Science & Technology', 't1', '[]', 30, 50, 't1', 'x');
    CREATE TABLE assignments (id TEXT PRIMARY KEY, classId TEXT, title TEXT, subjectId TEXT, subjectName TEXT);
    INSERT INTO assignments VALUES ('a1', 'jss1a', 'Homework', 'bst', 'Basic Science & Technology');
    CREATE TABLE materials (id TEXT PRIMARY KEY, classId TEXT, title TEXT, url TEXT, metadata TEXT, uploadedAt TEXT, uploadedBy TEXT);
    INSERT INTO materials VALUES ('m1', 'jss1a', 'Cells', NULL, '{"subjectId":"bst","subjectName":"Basic Science & Technology"}', '2026-09-10', 't1');
    CREATE TABLE material_audit (id TEXT PRIMARY KEY, tenant_id TEXT, material_id TEXT, action TEXT, subject_id TEXT, subject_name TEXT, created_at TEXT);
    INSERT INTO material_audit VALUES ('au1', 'school-a', 'm1', 'published', 'bst', 'Basic Science & Technology', 'x');
  `)
  for (const [id, email, role, tenant] of [['own', 'own@a.test', 'owner', 'school-a'], ['own-b', 'own@b.test', 'owner', 'school-b']]) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, status: 'active' })).run()
  }
  return db
}

async function rename(db, userId, tenantId, subjectId, name) {
  const token = await sign({ id: userId, role: 'owner', roles: ['owner'], tenantId, name: userId, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com/api/school/subjects/${subjectId}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json() }
}

const one = (db, sql) => db.prepare(sql).first()

test('renaming keeps the subject and its records, and updates the name everywhere it is shown', async () => {
  const db = await setup()
  const result = await rename(db, 'own', 'school-a', 'bst', '  Basic   Science ')
  assert.equal(result.status, 200)
  assert.equal(result.body.renamed, true)

  assert.equal((await one(db, "SELECT COUNT(*) AS n FROM subjects WHERE tenantId = 'school-a'")).n, 2)
  assert.equal((await one(db, "SELECT name FROM subjects WHERE id = 'bst'")).name, 'Basic Science')
  // Results, assignments and materials still point at the same id, now showing the new name.
  const entry = await one(db, "SELECT subject_id, subject_name, ca_score FROM result_ca_entries WHERE id = 'r1'")
  assert.deepEqual([entry.subject_id, entry.subject_name, entry.ca_score], ['bst', 'Basic Science', 30])
  assert.equal((await one(db, "SELECT subjectName FROM assignments WHERE id = 'a1'")).subjectName, 'Basic Science')
  assert.equal(JSON.parse((await one(db, "SELECT metadata FROM materials WHERE id = 'm1'")).metadata).subjectName, 'Basic Science')
  // The audit trail is history and keeps the name it recorded.
  assert.equal((await one(db, "SELECT subject_name FROM material_audit WHERE id = 'au1'")).subject_name, 'Basic Science & Technology')

  const log = await one(db, "SELECT old_name, new_name, actor_id FROM subject_rename_audit WHERE subject_id = 'bst'")
  assert.deepEqual([log.old_name, log.new_name, log.actor_id], ['Basic Science & Technology', 'Basic Science', 'own'])
})

test('a rename cannot clash with another subject in the class or reach another school', async () => {
  const db = await setup()
  assert.equal((await rename(db, 'own', 'school-a', 'bst', 'mathematics')).status, 409)
  assert.equal((await rename(db, 'own', 'school-a', 'bst', '   ')).status, 400)
  assert.equal((await rename(db, 'own-b', 'school-b', 'bst', 'Hijacked')).status, 404)
  assert.equal((await one(db, "SELECT name FROM subjects WHERE id = 'bst'")).name, 'Basic Science & Technology')
  // Every attempt was refused before anything was written, so not even the log exists.
  assert.equal(await one(db, "SELECT 1 FROM sqlite_master WHERE name = 'subject_rename_audit'"), null)
})

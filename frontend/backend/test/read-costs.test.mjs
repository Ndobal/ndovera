import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { D1Shim } from './d1-shim.mjs'

// The Workers Free plan stops all database queries at 5M rows read a day. These are the heaviest
// everyday reads found on production (Nov 2026): each must use its index, not walk a table.

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
const indexed = name => {
  const found = new RegExp('`(CREATE INDEX IF NOT EXISTS ' + name + ' [^`]+)`').exec(source)
  assert.ok(found, `${name} is in READ_INDEXES`)
  return found[1]
}

function database() {
  const db = new D1Shim()
  db.db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, tenantId TEXT, status TEXT, createdAt TEXT);
    CREATE TABLE settings (studentId TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT);
    CREATE INDEX idx_subjects_tenant_class_name ON subjects(tenantId, classId, name);
    CREATE INDEX idx_subjects_tenant_teacher_class ON subjects(tenantId, teacherId, classId);
    CREATE TABLE student_attendance_school (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, class_id TEXT, date TEXT, status TEXT);
    CREATE TABLE curriculum_topics (id TEXT PRIMARY KEY, curriculum_id TEXT, topic TEXT, subject TEXT, subject_key TEXT, class_label TEXT, updated_at TEXT);
    CREATE TABLE curricula (id TEXT PRIMARY KEY, name TEXT, status TEXT);
  `)
  for (const name of ['idx_subjects_tenant_class_teacher', 'idx_attendance_school_class_date', 'idx_settings_class', 'idx_curriculum_topics_stamp']) db.db.exec(indexed(name))
  return db
}

const plan = (db, sql) => db.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(row => row.detail).join('\n')

test('a class\'s students start from that class, not from every student in the school', () => {
  const db = database()
  const at = source.indexOf('async function listStudentsForClass')
  assert.match(source.slice(at, at + 500), /FROM settings s\s+CROSS JOIN users u ON \(u\.email = s\.studentId OR u\.id = s\.studentId\)/)
  const steps = plan(db, `SELECT u.id FROM settings s CROSS JOIN users u ON (u.email = s.studentId OR u.id = s.studentId) WHERE u.tenantId = 'a' AND lower(u.role) = 'student' AND json_extract(s.payload, '$.classId') = 'c'`)
  assert.match(steps, /SEARCH s USING INDEX idx_settings_class/)
  assert.match(steps, /MULTI-INDEX OR/)
  assert.doesNotMatch(steps, /SCAN/)
})

test('the same students are found whichever key their settings use, and other classes and schools are left out', () => {
  const db = database()
  db.db.exec(`
    INSERT INTO users (id, email, name, role, tenantId, status) VALUES
      ('u1', 'one@a.test', 'One', 'student', 'a', 'active'), ('u2', 'two@a.test', 'Two', 'Student', 'a', 'active'),
      ('u3', 'three@a.test', 'Other class', 'student', 'a', 'active'), ('u4', 'four@b.test', 'Other school', 'student', 'b', 'active'), ('u5', 'five@a.test', 'A teacher', 'teacher', 'a', 'active');
    INSERT INTO settings (studentId, payload) VALUES
      ('one@a.test', '{"classId":"c"}'), ('u2', '{"classId":"c"}'), ('three@a.test', '{"classId":"d"}'), ('four@b.test', '{"classId":"c"}'), ('five@a.test', '{"classId":"c"}');
  `)
  const rows = db.db.prepare(`SELECT u.id FROM settings s CROSS JOIN users u ON (u.email = s.studentId OR u.id = s.studentId) WHERE u.tenantId = 'a' AND lower(u.role) = 'student' AND json_extract(s.payload, '$.classId') = 'c' ORDER BY u.id`).all()
  assert.deepEqual(rows.map(row => row.id), ['u1', 'u2'])
})

test('a class\'s subject teachers are read from that class alone', () => {
  const steps = plan(database(), `SELECT teacherId FROM subjects WHERE tenantId = 'a' AND classId = 'c'`)
  assert.match(steps, /idx_subjects_tenant_class_teacher \(tenantId=\? AND classId=\?\)/)
})

test('a class\'s attendance comes from an index, already in date order', () => {
  const steps = plan(database(), `SELECT * FROM student_attendance_school WHERE tenant_id = 'a' AND class_id = 'c' ORDER BY date DESC`)
  assert.match(steps, /idx_attendance_school_class_date \(tenant_id=\? AND class_id=\?\)/)
  assert.doesNotMatch(steps, /TEMP B-TREE/)
})

test('the night builder pages through curriculum topics without sorting them all', () => {
  const steps = plan(database(), `SELECT ct.id FROM curriculum_topics ct JOIN curricula c ON c.id = ct.curriculum_id WHERE c.status = 'published' AND (ct.updated_at > '' OR (ct.updated_at = '' AND ct.id > '')) ORDER BY ct.updated_at, ct.id LIMIT 100`)
  assert.doesNotMatch(steps, /TEMP B-TREE/)
})

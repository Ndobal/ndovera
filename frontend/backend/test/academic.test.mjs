// Workflow tests for the academic session, promotion and term fee cycle.
//
// These run the real module against SQLite through the D1 shim, so the
// invariants under test are the ones the database actually enforces.
//
//   node --test test/     (after `npm run test:build`)

import test from 'node:test'
import assert from 'node:assert/strict'

import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'

const TENANT = 'tenant_test'

const SESSION_2026 = {
  name: '2026/2027',
  startDate: '2026-09-07',
  endDate: '2027-07-24',
  resumptionDate: '2026-09-07',
  terms: [
    { sequence: 1, name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-18', resumptionDate: '2027-01-11' },
    { sequence: 2, name: 'Second Term', startDate: '2027-01-11', endDate: '2027-04-02', resumptionDate: '2027-04-20' },
    { sequence: 3, name: 'Third Term', startDate: '2027-04-20', endDate: '2027-07-24', resumptionDate: '2027-09-06' },
  ],
}

const SESSION_2027 = {
  name: '2027/2028',
  startDate: '2027-09-06',
  endDate: '2028-07-22',
  terms: [
    { sequence: 1, name: 'First Term', startDate: '2027-09-06', endDate: '2027-12-17' },
    { sequence: 2, name: 'Second Term', startDate: '2028-01-10', endDate: '2028-04-01' },
    { sequence: 3, name: 'Third Term', startDate: '2028-04-18', endDate: '2028-07-22' },
  ],
}

async function freshDb() {
  const db = new D1Shim()
  createLegacySchema(db)
  // The schema guard is isolate-scoped in production; each test gets a new
  // database, so clear it or the tables are never created here.
  academic.resetAcademicTablesCache()
  await academic.ensureAcademicTables(db)
  return db
}

/** Two classes and three students, wired the way the app stores them. */
async function seedSchool(db) {
  const now = new Date().toISOString()
  const classes = [
    { id: 'class_p3', name: 'Primary 3', arm: 'A' },
    { id: 'class_p4', name: 'Primary 4', arm: 'A' },
    { id: 'class_p5', name: 'Primary 5', arm: '' },
  ]
  for (const klass of classes) {
    await db.prepare('INSERT INTO classes (id, tenantId, name, arm, createdAt) VALUES (?, ?, ?, ?, ?)')
      .bind(klass.id, TENANT, klass.name, klass.arm, now).run()
  }

  const students = [
    { id: 'stu_john', name: 'John Doe', email: 'john@school.test', classId: 'class_p3' },
    { id: 'stu_mary', name: 'Mary Bello', email: 'mary@school.test', classId: 'class_p3' },
    { id: 'stu_david', name: 'David Okon', email: 'david@school.test', classId: 'class_p3' },
  ]
  for (const student of students) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, className, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(student.id, student.email, student.name, 'student', TENANT, 'Primary 3 A', 'active', now).run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)')
      .bind(student.email, JSON.stringify({ classId: student.classId, className: 'Primary 3', role: 'student', tenantId: TENANT })).run()
  }
  return { classes, students }
}

async function seedFeeTemplate(db, { session, term, classId, amount, studentOverrides = {} }) {
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO fees_config (id, tenant_id, fee_type, class_id, student_id, amount, session, term, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(`fc_${classId}_${term}_tuition`, TENANT, 'Tuition', classId, null, amount, session, term, 0, now, now).run()

  for (const [studentId, override] of Object.entries(studentOverrides)) {
    await db.prepare('INSERT INTO fees_config (id, tenant_id, fee_type, class_id, student_id, amount, session, term, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(`fc_${studentId}_${term}_tuition`, TENANT, 'Tuition', classId, studentId, override, session, term, 0, now, now).run()
  }
}

/** The class-to-class flow the owner saves on the promotion page. */
async function seedProgressionMap(db, map) {
  await db.prepare('INSERT OR REPLACE INTO settings (studentId, payload) VALUES (?, ?)')
    .bind(`promotion_map_${TENANT}`, JSON.stringify({ map, criteria: '' })).run()
}

async function enrolAll(db, sessionId, students, classId = 'class_p3') {
  for (const student of students) {
    await academic.upsertEnrollment(db, {
      tenantId: TENANT,
      sessionId,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      classId,
      actorId: 'owner_1',
      actorName: 'Owner',
    })
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

test('creates a session with its three terms', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })

  assert.equal(detail.session.name, '2026/2027')
  assert.equal(detail.session.status, 'upcoming')
  assert.equal(detail.terms.length, 3)
  assert.deepEqual(detail.terms.map(t => t.name), ['First Term', 'Second Term', 'Third Term'])
  assert.equal(detail.terms[0].startDate, '2026-09-07')
  db.close()
})

test('holds multiple sessions and rejects a duplicate name', async () => {
  const db = await freshDb()
  await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  assert.equal((await academic.listSessions(db, TENANT)).length, 2)

  await assert.rejects(
    () => academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 }),
    /already exists/,
  )
  db.close()
})

test('rejects overlapping sessions and back-to-front dates', async () => {
  const db = await freshDb()
  await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })

  await assert.rejects(
    () => academic.createSession(db, {
      tenantId: TENANT, name: '2026/2027 Extra', startDate: '2027-01-01', endDate: '2027-10-01',
    }),
    /overlap/,
  )
  await assert.rejects(
    () => academic.createSession(db, {
      tenantId: TENANT, name: 'Backwards', startDate: '2029-09-01', endDate: '2029-08-01',
    }),
    /must fall after/,
  )
  db.close()
})

test('rejects a term that falls outside its session', async () => {
  const db = await freshDb()
  await assert.rejects(
    () => academic.createSession(db, {
      tenantId: TENANT,
      name: '2030/2031',
      startDate: '2030-09-01',
      endDate: '2031-07-01',
      terms: [{ sequence: 1, name: 'First Term', startDate: '2030-08-01', endDate: '2030-12-01' }],
    }),
    /falls outside the session \(2030-09-01 to 2031-07-01\)/,
  )
  db.close()
})

test('rejects overlapping terms inside one session', async () => {
  const db = await freshDb()
  await assert.rejects(
    () => academic.createSession(db, {
      tenantId: TENANT,
      name: '2031/2032',
      startDate: '2031-09-01',
      endDate: '2032-07-01',
      terms: [
        { sequence: 1, name: 'First Term', startDate: '2031-09-01', endDate: '2031-12-20' },
        { sequence: 2, name: 'Second Term', startDate: '2031-12-01', endDate: '2032-03-20' },
      ],
    }),
    /overlap/,
  )
  db.close()
})

test('activating a session stands the previous one down', async () => {
  const db = await freshDb()
  const first = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const second = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  await academic.activateSession(db, { tenantId: TENANT, sessionId: first.session.id })
  assert.equal((await academic.getActiveSession(db, TENANT)).name, '2026/2027')

  const result = await academic.activateSession(db, { tenantId: TENANT, sessionId: second.session.id })
  assert.equal(result.deactivated.name, '2026/2027')

  const active = await academic.listSessions(db, TENANT)
  assert.deepEqual(
    active.filter(s => s.status === 'active').map(s => s.name),
    ['2027/2028'],
  )
  db.close()
})

test('the database itself refuses a second active session', async () => {
  const db = await freshDb()
  const first = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const second = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: first.session.id })

  // Bypass the module and write straight to the table.
  await assert.rejects(
    () => db.prepare("UPDATE academic_sessions SET status = 'active' WHERE id = ?")
      .bind(second.session.id).run(),
    /UNIQUE|constraint/i,
  )
  db.close()
})

test('the database itself refuses a second active term', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })

  const terms = await academic.listTerms(db, TENANT, detail.session.id)
  assert.equal(terms.filter(t => t.status === 'active').length, 1)

  await assert.rejects(
    () => db.prepare("UPDATE academic_terms SET status = 'active' WHERE id = ?").bind(terms[2].id).run(),
    /UNIQUE|constraint/i,
  )
  db.close()
})

test('terms hand over one at a time', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  const terms = await academic.listTerms(db, TENANT, detail.session.id)

  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[1].id })
  let after = await academic.listTerms(db, TENANT, detail.session.id)
  assert.equal(after[0].status, 'completed')
  assert.equal(after[1].status, 'active')

  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[2].id })
  after = await academic.listTerms(db, TENANT, detail.session.id)
  assert.deepEqual(after.map(t => t.status), ['completed', 'completed', 'active'])
  db.close()
})

test('records breaks and reports the school as on holiday', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })

  await academic.saveBreak(db, {
    tenantId: TENANT,
    sessionId: detail.session.id,
    name: 'Christmas Holiday',
    breakType: 'christmas',
    startDate: '2026-12-19',
    endDate: '2027-01-10',
    resumptionDate: '2027-01-11',
  })

  const breaks = await academic.listBreaks(db, TENANT, detail.session.id)
  assert.equal(breaks.length, 1)
  assert.equal(breaks[0].breakType, 'christmas')

  const position = await academic.getCalendarPosition(db, TENANT, '2026-12-28')
  assert.equal(position.state, 'on-break')
  assert.equal(position.currentBreak.name, 'Christmas Holiday')

  const inTerm = await academic.getCalendarPosition(db, TENANT, '2026-10-01')
  assert.equal(inTerm.state, 'in-term')
  db.close()
})

test('a break must resume after it ends', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await assert.rejects(
    () => academic.saveBreak(db, {
      tenantId: TENANT, sessionId: detail.session.id, name: 'Bad Break',
      startDate: '2026-12-19', endDate: '2027-01-10', resumptionDate: '2026-12-25',
    }),
    /resume after/,
  )
  db.close()
})

// ─── Promotion ───────────────────────────────────────────────────────────────

test('proposes next classes and leaves every one pending', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })

  assert.equal(batch.batch.status, 'draft')
  assert.equal(batch.decisions.length, 3)
  assert.ok(batch.decisions.every(d => d.status === 'pending'))
  assert.ok(batch.decisions.every(d => d.action === 'promote'))
  assert.ok(batch.decisions.every(d => d.toClassName === 'Primary 4 A'))
  db.close()
})

test('a manual override replaces the proposal', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })

  const updated = await academic.updatePromotionDecisions(db, {
    tenantId: TENANT,
    batchId: batch.batch.id,
    updates: [{ studentId: 'stu_david', action: 'repeat', toClassId: 'class_p3' }],
    actorName: 'Head of School',
  })

  const david = updated.decisions.find(d => d.studentId === 'stu_david')
  assert.equal(david.action, 'repeat')
  assert.equal(david.toClassName, 'Primary 3 A')
  assert.equal(david.source, 'manual')
  assert.equal(updated.decisions.find(d => d.studentId === 'stu_john').action, 'promote')
  db.close()
})

test('committing promotion creates new enrollments and preserves the old ones', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })
  await academic.updatePromotionDecisions(db, {
    tenantId: TENANT,
    batchId: batch.batch.id,
    updates: [{ studentId: 'stu_david', action: 'repeat', toClassId: 'class_p3' }],
  })

  const result = await academic.commitPromotionBatch(db, {
    tenantId: TENANT,
    batchId: batch.batch.id,
    actorName: 'Owner',
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  })
  assert.equal(result.enrolled, 3)

  // Last session's record is untouched apart from its outcome.
  const previous = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: from.session.id })
  assert.equal(previous.length, 3)
  assert.ok(previous.every(e => e.className === 'Primary 3'))
  assert.equal(previous.find(e => e.studentId === 'stu_john').status, 'promoted')
  assert.equal(previous.find(e => e.studentId === 'stu_david').status, 'repeated')

  const next = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id })
  assert.equal(next.length, 3)
  assert.equal(next.find(e => e.studentId === 'stu_john').className, 'Primary 4')
  assert.equal(next.find(e => e.studentId === 'stu_david').className, 'Primary 3')

  // One student, two placements — not two students.
  const history = await academic.listStudentEnrollmentHistory(db, TENANT, 'stu_john')
  assert.equal(history.length, 2)
  assert.deepEqual(history.map(h => h.sessionName), ['2027/2028', '2026/2027'])
  db.close()
})

test('promotion writes an audit trail', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })
  await academic.commitPromotionBatch(db, {
    tenantId: TENANT, batchId: batch.batch.id, actorId: 'owner_1', actorName: 'Owner',
  })

  const audit = await academic.listPromotionAudit(db, { tenantId: TENANT, studentId: 'stu_john' })
  assert.equal(audit.length, 1)
  assert.equal(audit[0].fromSessionName, '2026/2027')
  assert.equal(audit[0].fromClassName, 'Primary 3 A')
  assert.equal(audit[0].toSessionName, '2027/2028')
  assert.equal(audit[0].toClassName, 'Primary 4 A')
  assert.equal(audit[0].action, 'promote')
  assert.equal(audit[0].mode, 'automatic')
  assert.equal(audit[0].performedByName, 'Owner')
  db.close()
})

test('a student cannot be enrolled into the same session twice', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)
  await enrolAll(db, to.session.id, [students[0]], 'class_p4')

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })

  await assert.rejects(
    () => academic.commitPromotionBatch(db, { tenantId: TENANT, batchId: batch.batch.id }),
    /already enrolled/,
  )
  db.close()
})

test('promoting into the live session moves the current-class mirror', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })
  await academic.commitPromotionBatch(db, { tenantId: TENANT, batchId: batch.batch.id })

  // The incoming session is not live yet, so today's view must not change.
  let payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('john@school.test').first()).payload)
  assert.equal(payload.classId, 'class_p3')

  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id })
  await academic.syncMirrorToSession(db, {
    tenantId: TENANT,
    sessionId: to.session.id,
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  })

  payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('john@school.test').first()).payload)
  assert.equal(payload.classId, 'class_p4')
  assert.equal(payload.className, 'Primary 4')

  const userRow = await db.prepare('SELECT className FROM users WHERE id = ?').bind('stu_john').first()
  assert.equal(userRow.className, 'Primary 4 A')
  db.close()
})

// ─── The automatic register ──────────────────────────────────────────────────

test('a new session opens with the whole school already on its register', async () => {
  const db = await freshDb()
  await seedSchool(db)

  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })

  assert.equal(detail.enrolment.enrolled, 3)
  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: detail.session.id })
  assert.equal(register.length, 3)
  assert.ok(register.every(row => row.classId === 'class_p3'))
  assert.ok(register.every(row => row.status === 'active'))
  db.close()
})

test('drafting the next session moves every returning student up a class', async () => {
  const db = await freshDb()
  await seedSchool(db)
  await seedProgressionMap(db, { class_p3: 'class_p4', class_p4: 'class_p5' })
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })

  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  assert.equal(to.enrolment.promoted, 3)
  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id })
  assert.ok(register.every(row => row.className === 'Primary 4'))
  assert.ok(register.every(row => row.source === 'auto-promotion'))

  // Nothing has happened yet: this year's register still reads as running, and
  // the live view has not moved a single child.
  const current = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: from.session.id })
  assert.ok(current.every(row => row.status === 'active'))
  const userRow = await db.prepare('SELECT className FROM users WHERE id = ?').bind('stu_john').first()
  assert.equal(userRow.className, 'Primary 3 A')
  db.close()
})

test('opening the new session hands the old register over and moves the school', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await seedProgressionMap(db, { class_p3: 'class_p4' })
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id })
  await academic.syncMirrorToSession(db, {
    tenantId: TENANT,
    sessionId: to.session.id,
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  })

  const previous = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: from.session.id })
  assert.ok(previous.every(row => row.status === 'promoted'))
  assert.ok(previous.every(row => row.classId === 'class_p3'))

  const userRow = await db.prepare('SELECT className FROM users WHERE id = ?').bind('stu_john').first()
  assert.equal(userRow.className, 'Primary 4 A')

  // The class register the teacher opens follows the same move.
  const membership = await db.prepare(
    'SELECT class_id FROM class_memberships WHERE user_id = ? AND membership_role = ?'
  ).bind('stu_john', 'student').first()
  assert.equal(membership.class_id, 'class_p4')
  db.close()
})

test('a class with no progression rule holds its students where they are', async () => {
  const db = await freshDb()
  await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })

  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  assert.equal(to.enrolment.promoted, 0)
  assert.equal(to.enrolment.heldBack, 3)
  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id })
  assert.ok(register.every(row => row.classId === 'class_p3'))
  db.close()
})

test('a final class mapped to alumni graduates out of the new session', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await seedProgressionMap(db, { class_p3: 'alumni' })
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })

  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  assert.equal(to.enrolment.graduated, 3)

  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id })
  await academic.syncMirrorToSession(db, {
    tenantId: TENANT,
    sessionId: to.session.id,
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  })

  const userRow = await db.prepare('SELECT status FROM users WHERE id = ?').bind('stu_john').first()
  assert.equal(userRow.status, 'alumni')
  const leavers = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: from.session.id })
  assert.ok(leavers.every(row => row.status === 'graduated'))
  db.close()
})

test('a promotion round overrules the automatic placement', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await seedProgressionMap(db, { class_p3: 'class_p4' })
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p5' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })
  const result = await academic.commitPromotionBatch(db, {
    tenantId: TENANT, batchId: batch.batch.id, actorId: 'owner_1', actorName: 'Owner',
  })

  assert.equal(result.enrolled, 3)
  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id })
  assert.equal(register.length, 3)
  assert.ok(register.every(row => row.classId === 'class_p5'))
  assert.ok(register.every(row => row.source === 'promotion'))

  // One decision per student in the history: the one the school actually made.
  const audit = await academic.listPromotionAudit(db, { tenantId: TENANT, studentId: 'stu_john' })
  assert.equal(audit.length, 1)
  assert.equal(audit[0].toClassName, 'Primary 5')
  db.close()
})

test('a student admitted after the session opened joins its register', async () => {
  const db = await freshDb()
  await seedSchool(db)
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })

  const now = new Date().toISOString()
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, className, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('stu_new', 'zara@school.test', 'Zara Ali', 'student', TENANT, 'Primary 4 A', 'active', now).run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)')
    .bind('zara@school.test', JSON.stringify({ classId: 'class_p4', className: 'Primary 4' })).run()

  await seedFeeTemplate(db, { session: '2026/2027', term: 'First Term', classId: 'class_p4', amount: 250000 })
  await seedFeeTemplate(db, { session: '2026/2027', term: 'First Term', classId: 'class_p3', amount: 250000 })

  const seeded = await academic.autoEnrolSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  assert.equal(seeded.enrolled, 1)

  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: detail.session.id })
  assert.equal(register.length, 4)
  assert.equal(register.find(row => row.studentId === 'stu_new').classId, 'class_p4')
  db.close()
})

test('fees can be raised for a session nobody enrolled by hand', async () => {
  const db = await freshDb()
  await seedSchool(db)
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  await seedFeeTemplate(db, { session: '2026/2027', term: 'First Term', classId: 'class_p3', amount: 250000 })

  // A session that predates the automatic register: its own is empty.
  await db.prepare('DELETE FROM session_enrollments WHERE session_id = ?').bind(detail.session.id).run()

  const terms = await academic.listTerms(db, TENANT, detail.session.id)
  const result = await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })

  assert.equal(result.created, 3)
  const dashboard = await academic.getFeeDashboard(db, { tenantId: TENANT, termId: terms[0].id })
  assert.equal(dashboard.currentTerm.assessed, 750000)
  db.close()
})

test('a student whose settings are keyed by id still changes class', async () => {
  const db = await freshDb();
  const { students } = await seedSchool(db);
  // Half the school stores settings under the user id rather than the email, and
  // every class list in the app reads both. A mirror that only knew about the
  // email left these children in last session's class.
  await db.prepare('DELETE FROM settings WHERE studentId = ?').bind('john@school.test').run();
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)')
    .bind('stu_john', JSON.stringify({ classId: 'class_p3', className: 'Primary 3', role: 'student', tenantId: TENANT })).run();

  await seedProgressionMap(db, { class_p3: 'class_p4' });
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 });
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id });
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 });

  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id });
  await academic.syncMirrorToSession(db, {
    tenantId: TENANT,
    sessionId: to.session.id,
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  });

  const payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('stu_john').first()).payload);
  assert.equal(payload.classId, 'class_p4');
  db.close();
});

test('a student with no settings row at all is given one', async () => {
  const db = await freshDb();
  const { students } = await seedSchool(db);
  await db.prepare('DELETE FROM settings WHERE studentId = ?').bind('mary@school.test').run();

  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 });
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id });
  await enrolAll(db, detail.session.id, students);

  const payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('mary@school.test').first()).payload);
  assert.equal(payload.classId, 'class_p3');
  assert.equal(payload.role, 'student');
  db.close();
});

test('a year group promoted into one class is split by hand afterwards', async () => {
  const db = await freshDb();
  const { students } = await seedSchool(db);
  // Every JSS 3 lands in one class by the flow; the school then splits it.
  await seedProgressionMap(db, { class_p3: 'class_p4' });
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 });
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id });
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 });
  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id });

  const result = await academic.moveEnrollments(db, {
    tenantId: TENANT,
    sessionId: to.session.id,
    studentIds: ['stu_mary', 'stu_david'],
    classId: 'class_p5',
    actorName: 'Owner',
    studentEmailById: new Map(students.map(s => [s.id, s.email])),
  });

  assert.equal(result.moved, 2);
  assert.equal(result.liveViewMoved, true);

  const register = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id });
  assert.equal(register.find(row => row.studentId === 'stu_john').classId, 'class_p4');
  assert.equal(register.find(row => row.studentId === 'stu_mary').classId, 'class_p5');
  assert.equal(register.find(row => row.studentId === 'stu_mary').source, 'manual');

  // The move reaches the class lists the teachers read, not just the register.
  const payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('mary@school.test').first()).payload);
  assert.equal(payload.classId, 'class_p5');
  const membership = await db.prepare(
    'SELECT class_id FROM class_memberships WHERE user_id = ? AND membership_role = ?'
  ).bind('stu_mary', 'student').first();
  assert.equal(membership.class_id, 'class_p5');
  db.close();
});

test('a hand-placed student survives a later promotion round', async () => {
  const db = await freshDb();
  const { students } = await seedSchool(db);
  await seedProgressionMap(db, { class_p3: 'class_p4' });
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 });
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id });
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 });

  await academic.moveEnrollments(db, {
    tenantId: TENANT, sessionId: to.session.id, studentIds: ['stu_mary'], classId: 'class_p5',
  });

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  });

  await assert.rejects(
    () => academic.commitPromotionBatch(db, { tenantId: TENANT, batchId: batch.batch.id }),
    /already enrolled/,
  );
  db.close();
});

test('moving to a class that no longer exists is refused', async () => {
  const db = await freshDb();
  await seedSchool(db);
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 });

  await assert.rejects(
    () => academic.moveEnrollments(db, {
      tenantId: TENANT, sessionId: detail.session.id, studentIds: ['stu_john'], classId: 'class_gone',
    }),
    /no longer exists/,
  );
  db.close();
});

// ─── Fees ────────────────────────────────────────────────────────────────────

async function openFirstTermWithFees(db, students) {
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  await enrolAll(db, detail.session.id, students)
  await seedFeeTemplate(db, { session: '2026/2027', term: 'First Term', classId: 'class_p3', amount: 250000 })

  const terms = await academic.listTerms(db, TENANT, detail.session.id)
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })
  return { detail, terms }
}

test('generates one assessment per enrolled student', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { terms } = await openFirstTermWithFees(db, students)

  const dashboard = await academic.getFeeDashboard(db, { tenantId: TENANT, termId: terms[0].id })
  assert.equal(dashboard.assessments.length, 3)
  assert.equal(dashboard.currentTerm.assessed, 750000)
  assert.equal(dashboard.currentTerm.collected, 0)
  assert.equal(dashboard.currentTerm.outstanding, 750000)
  db.close()
})

test('a per-student fee override is recorded as a discount', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  await enrolAll(db, detail.session.id, students)
  await seedFeeTemplate(db, {
    session: '2026/2027', term: 'First Term', classId: 'class_p3', amount: 250000,
    studentOverrides: { stu_mary: 150000 },
  })

  const terms = await academic.listTerms(db, TENANT, detail.session.id)
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_mary')
  const assessment = history.assessments[0]
  assert.equal(assessment.grossAmount, 250000)
  assert.equal(assessment.netAmount, 150000)
  assert.equal(assessment.discountAmount, 100000)
  db.close()
})

test('records a full payment and clears the balance', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await openFirstTermWithFees(db, students)

  const result = await academic.recordFeePayment(db, {
    tenantId: TENANT, studentId: 'stu_john', amount: 250000, recordedByName: 'Bursar',
  })
  assert.equal(result.allocations.length, 1)
  assert.equal(result.allocations[0].amount, 250000)

  const outstanding = await academic.listStudentOutstanding(db, TENANT, 'stu_john')
  assert.equal(outstanding.length, 0)

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments[0].status, 'paid')
  assert.equal(history.summary.totalDue, 0)
  db.close()
})

test('records a partial payment and keeps the remainder owed', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 200000 })

  let history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments[0].status, 'partial')
  assert.equal(history.assessments[0].amountPaid, 200000)
  assert.equal(history.assessments[0].outstanding, 50000)

  // A second instalment settles it, and both transactions survive.
  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 50000 })
  history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments[0].outstanding, 0)
  assert.equal(history.payments.length, 2)
  assert.deepEqual(history.payments.map(p => p.amount).sort((a, b) => a - b), [50000, 200000])
  db.close()
})

test('refuses a payment larger than what is owed', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await openFirstTermWithFees(db, students)

  await assert.rejects(
    () => academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 400000 }),
    /owes 250000/,
  )
  db.close()
})

test('rejects a duplicate submission of the same payment', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await openFirstTermWithFees(db, students)

  const first = await academic.recordFeePayment(db, {
    tenantId: TENANT, studentId: 'stu_john', amount: 100000, idempotencyKey: 'form-submit-1',
  })
  const second = await academic.recordFeePayment(db, {
    tenantId: TENANT, studentId: 'stu_john', amount: 100000, idempotencyKey: 'form-submit-1',
  })

  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.payments.length, 1)
  assert.equal(history.assessments[0].amountPaid, 100000)
  db.close()
})

test('the next term bills separately and last term stays owed', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { detail, terms } = await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 200000 })

  // Second term opens with its own template.
  await seedFeeTemplate(db, { session: '2026/2027', term: 'Second Term', classId: 'class_p3', amount: 250000 })
  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[1].id })
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[1].id })

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')

  // Two separate assessments; the first term debt was not rolled into the second.
  assert.equal(history.assessments.length, 2)
  const firstTerm = history.assessments.find(a => a.termName === 'First Term')
  const secondTerm = history.assessments.find(a => a.termName === 'Second Term')
  assert.equal(firstTerm.outstanding, 50000)
  assert.equal(secondTerm.netAmount, 250000)
  assert.equal(secondTerm.outstanding, 250000)

  assert.equal(history.summary.previousOutstanding, 50000)
  assert.equal(history.summary.currentCharges, 250000)
  assert.equal(history.summary.totalDue, 300000)
  db.close()
})

test('a payment settles the oldest debt first', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { terms } = await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 200000 })
  await seedFeeTemplate(db, { session: '2026/2027', term: 'Second Term', classId: 'class_p3', amount: 250000 })
  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[1].id })
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[1].id })

  // Pays 100,000 against a 50,000 arrear plus this term's 250,000.
  const result = await academic.recordFeePayment(db, {
    tenantId: TENANT, studentId: 'stu_john', amount: 100000,
  })

  assert.equal(result.allocations.length, 2)
  assert.deepEqual(
    result.allocations.map(a => [a.termName, a.amount]),
    [['First Term', 50000], ['Second Term', 50000]],
  )

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments.find(a => a.termName === 'First Term').outstanding, 0)
  assert.equal(history.assessments.find(a => a.termName === 'Second Term').outstanding, 200000)
  db.close()
})

test('a named allocation settles the exact charge chosen', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { terms } = await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 200000 })
  await seedFeeTemplate(db, { session: '2026/2027', term: 'Second Term', classId: 'class_p3', amount: 250000 })
  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[1].id })
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[1].id })

  const outstanding = await academic.listStudentOutstanding(db, TENANT, 'stu_john')
  const firstTerm = outstanding.find(a => a.termName === 'First Term')

  const result = await academic.recordFeePayment(db, {
    tenantId: TENANT,
    studentId: 'stu_john',
    amount: 50000,
    allocations: [{ assessmentId: firstTerm.id, amount: 50000 }],
  })

  assert.equal(result.allocations[0].termName, 'First Term')
  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments.find(a => a.termName === 'First Term').status, 'paid')
  assert.equal(history.assessments.find(a => a.termName === 'Second Term').outstanding, 250000)
  db.close()
})

test('allocations that do not add up to the payment are refused', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  await openFirstTermWithFees(db, students)
  const outstanding = await academic.listStudentOutstanding(db, TENANT, 'stu_john')

  await assert.rejects(
    () => academic.recordFeePayment(db, {
      tenantId: TENANT, studentId: 'stu_john', amount: 100000,
      allocations: [{ assessmentId: outstanding[0].id, amount: 60000 }],
    }),
    /does not match/,
  )
  await assert.rejects(
    () => academic.recordFeePayment(db, {
      tenantId: TENANT, studentId: 'stu_john', amount: 300000,
      allocations: [{ assessmentId: outstanding[0].id, amount: 300000 }],
    }),
    /only has 250000 outstanding/,
  )
  db.close()
})

test('a promoted student is billed for the class they moved into', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })
  await academic.updatePromotionDecisions(db, {
    tenantId: TENANT, batchId: batch.batch.id,
    updates: [{ studentId: 'stu_david', action: 'repeat', toClassId: 'class_p3' }],
  })
  await academic.commitPromotionBatch(db, { tenantId: TENANT, batchId: batch.batch.id })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id })

  // Primary 3 costs 200,000; Primary 4 costs 220,000.
  await seedFeeTemplate(db, { session: '2027/2028', term: 'First Term', classId: 'class_p3', amount: 200000 })
  await seedFeeTemplate(db, { session: '2027/2028', term: 'First Term', classId: 'class_p4', amount: 220000 })

  const terms = await academic.listTerms(db, TENANT, to.session.id)
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })

  const john = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  const david = await academic.getStudentFinancialHistory(db, TENANT, 'stu_david')

  assert.equal(john.assessments.at(-1).netAmount, 220000)
  assert.equal(john.assessments.at(-1).className, 'Primary 4')
  assert.equal(david.assessments.at(-1).netAmount, 200000)
  assert.equal(david.assessments.at(-1).className, 'Primary 3')
  db.close()
})

test('regenerating a term keeps what has already been collected', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { detail, terms } = await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 100000 })

  // The school raises the fee and regenerates.
  await db.prepare('UPDATE fees_config SET amount = 300000 WHERE tenant_id = ? AND class_id = ?')
    .bind(TENANT, 'class_p3').run()
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })

  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments[0].netAmount, 300000)
  assert.equal(history.assessments[0].amountPaid, 100000)
  assert.equal(history.assessments[0].outstanding, 200000)
  db.close()
})

test('carries pre-existing arrears forward as an opening balance', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const detail = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  await enrolAll(db, detail.session.id, students)

  // The old running ledger: John owes 50,000, Mary is square.
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO fees_ledger (id, tenant_id, student_id, student_name, fee_amount, amount_paid, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('fl_1', TENANT, 'stu_john', 'John Doe', 250000, 200000, 'partial', now).run()
  await db.prepare('INSERT INTO fees_ledger (id, tenant_id, student_id, student_name, fee_amount, amount_paid, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('fl_2', TENANT, 'stu_mary', 'Mary Bello', 250000, 250000, 'paid', now).run()

  const terms = await academic.listTerms(db, TENANT, detail.session.id)

  const preview = await academic.backfillOpeningBalances(db, { tenantId: TENANT, termId: terms[0].id, dryRun: true })
  assert.equal(preview.carriedCount, 1)
  assert.equal(preview.carriedTotal, 50000)

  const applied = await academic.backfillOpeningBalances(db, { tenantId: TENANT, termId: terms[0].id })
  assert.equal(applied.carriedCount, 1)

  const john = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(john.assessments.length, 1)
  assert.equal(john.assessments[0].assessmentKind, 'opening_balance')
  assert.equal(john.assessments[0].outstanding, 50000)

  // The old ledger is left exactly as it was.
  const ledger = await db.prepare('SELECT * FROM fees_ledger WHERE student_id = ?').bind('stu_john').first()
  assert.equal(ledger.amount_paid, 200000)

  // Running it twice does not double the debt.
  const again = await academic.backfillOpeningBalances(db, { tenantId: TENANT, termId: terms[0].id })
  assert.equal(again.carriedCount, 0)
  const after = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(after.assessments.length, 1)
  db.close()
})

test('the fee dashboard separates this term from what came before', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const { terms } = await openFirstTermWithFees(db, students)

  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 200000 })
  await seedFeeTemplate(db, { session: '2026/2027', term: 'Second Term', classId: 'class_p3', amount: 250000 })
  await academic.activateTerm(db, { tenantId: TENANT, termId: terms[1].id })
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[1].id })
  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 50000 })

  const dashboard = await academic.getFeeDashboard(db, { tenantId: TENANT })
  assert.equal(dashboard.term.name, 'Second Term')
  assert.equal(dashboard.currentTerm.assessed, 750000)
  assert.equal(dashboard.previousOutstanding.carriedForward, 750000)
  assert.equal(dashboard.previousOutstanding.recovered, 250000)
  assert.equal(dashboard.previousOutstanding.remaining, 500000)
  db.close()
})

// ─── Scheduled transitions ───────────────────────────────────────────────────

test('a term that has ended hands over on its configured date', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const detail = await academic.createSession(db, {
    tenantId: TENANT,
    ...SESSION_2026,
    terms: SESSION_2026.terms.map(term => ({ ...term, autoActivate: true })),
  })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: detail.session.id })
  await enrolAll(db, detail.session.id, students)

  // Mid-holiday: first term is over but second has not started.
  let run = await academic.runScheduledAcademicTransitions(db, { today: '2026-12-28' })
  assert.ok(run.transitions.some(t => t.kind === 'term-closed'))
  assert.equal(await academic.getActiveTerm(db, TENANT), null)

  // Resumption day.
  await academic.activateTerm(db, { tenantId: TENANT, termId: (await academic.listTerms(db, TENANT, detail.session.id))[0].id })
  run = await academic.runScheduledAcademicTransitions(db, { today: '2027-01-11' })
  assert.ok(run.transitions.some(t => t.kind === 'term-activated' && t.to === 'Second Term'))
  assert.equal((await academic.getActiveTerm(db, TENANT)).name, 'Second Term')
  db.close()
})

test('a scheduled session takes over on its resumption date', async () => {
  const db = await freshDb()
  await seedSchool(db)
  await seedProgressionMap(db, { class_p3: 'class_p4' })
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, {
    tenantId: TENANT, ...SESSION_2027, autoActivate: true, resumptionDate: '2027-09-06',
  })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })

  // The incoming session filled its own register when it was drafted, so
  // resumption day opens it instead of finding an empty school.
  const run = await academic.runScheduledAcademicTransitions(db, { today: '2027-09-06' })
  assert.ok(run.transitions.some(t => t.kind === 'session-activated'))
  assert.equal((await academic.getActiveSession(db, TENANT)).name, '2027/2028')

  // Placements followed the activation through to the live view.
  const payload = JSON.parse((await db.prepare('SELECT payload FROM settings WHERE studentId = ?')
    .bind('john@school.test').first()).payload)
  assert.equal(payload.classId, 'class_p4')
  db.close()
})

test('a session with nobody to enrol still refuses to open', async () => {
  const db = await freshDb()
  const detail = await academic.createSession(db, {
    tenantId: TENANT, ...SESSION_2026, autoActivate: true, resumptionDate: '2026-09-07',
  })

  const run = await academic.runScheduledAcademicTransitions(db, { today: '2026-09-07' })
  assert.ok(run.transitions.some(t => t.kind === 'session-activation-skipped'))
  assert.equal(await academic.getActiveSession(db, TENANT), null)
  assert.equal(detail.enrolment.enrolled, 0)
  db.close()
})

test('term dates are read in Africa/Lagos, not UTC', () => {
  // 23:30 UTC on the 6th is already the 7th in Lagos.
  assert.equal(academic.lagosToday(new Date('2026-09-06T23:30:00Z')), '2026-09-07')
  assert.equal(academic.lagosToday(new Date('2026-09-06T22:30:00Z')), '2026-09-06')
})

// ─── Historical data ─────────────────────────────────────────────────────────

test('creating and activating sessions never destroys existing records', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)
  await seedFeeTemplate(db, { session: '2026/2027', term: 'First Term', classId: 'class_p3', amount: 250000 })

  const terms = await academic.listTerms(db, TENANT, from.session.id)
  await academic.generateTermAssessments(db, { tenantId: TENANT, termId: terms[0].id })
  await academic.recordFeePayment(db, { tenantId: TENANT, studentId: 'stu_john', amount: 250000 })

  const before = {
    students: (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n,
    payments: (await db.prepare('SELECT COUNT(*) AS n FROM fee_payments').first()).n,
    allocations: (await db.prepare('SELECT COUNT(*) AS n FROM fee_payment_allocations').first()).n,
    assessments: (await db.prepare('SELECT COUNT(*) AS n FROM fee_assessments').first()).n,
  }

  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await enrolAll(db, to.session.id, students, 'class_p4')
  await academic.activateSession(db, { tenantId: TENANT, sessionId: to.session.id })

  const after = {
    students: (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n,
    payments: (await db.prepare('SELECT COUNT(*) AS n FROM fee_payments').first()).n,
    allocations: (await db.prepare('SELECT COUNT(*) AS n FROM fee_payment_allocations').first()).n,
    assessments: (await db.prepare('SELECT COUNT(*) AS n FROM fee_assessments').first()).n,
  }

  assert.deepEqual(after, before)

  // Last session's assessment and its payment are still readable.
  const history = await academic.getStudentFinancialHistory(db, TENANT, 'stu_john')
  assert.equal(history.assessments[0].sessionName, '2026/2027')
  assert.equal(history.assessments[0].amountPaid, 250000)
  db.close()
})

test('a failed bulk promotion leaves nothing half-written', async () => {
  const db = await freshDb()
  const { students } = await seedSchool(db)
  const from = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2026 })
  const to = await academic.createSession(db, { tenantId: TENANT, ...SESSION_2027 })
  await academic.activateSession(db, { tenantId: TENANT, sessionId: from.session.id })
  await enrolAll(db, from.session.id, students)

  const batch = await academic.buildPromotionProposals(db, {
    tenantId: TENANT,
    fromSessionId: from.session.id,
    toSessionId: to.session.id,
    progressionMap: { class_p3: 'class_p4' },
    students: students.map(s => ({ ...s, classId: 'class_p3' })),
  })

  // Force the enrollment insert to fail part-way: student names are unique
  // today, so re-inserting the same cohort for the next session violates this.
  // The incoming register is cleared first so the round has real work to do.
  await db.prepare('DELETE FROM session_enrollments WHERE session_id = ?').bind(to.session.id).run()
  await db.prepare('CREATE UNIQUE INDEX idx_force_fail ON session_enrollments(student_name)').run()

  await assert.rejects(() => academic.commitPromotionBatch(db, { tenantId: TENANT, batchId: batch.batch.id }))

  const enrolled = await academic.listSessionEnrollments(db, { tenantId: TENANT, sessionId: to.session.id })
  assert.equal(enrolled.length, 0)
  const audit = await academic.listPromotionAudit(db, { tenantId: TENANT, batchId: batch.batch.id })
  assert.equal(audit.length, 0)
  db.close()
})

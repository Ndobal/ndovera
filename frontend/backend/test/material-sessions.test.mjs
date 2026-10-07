import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { academic, materials, sessions, lifecycle, teaching, supervision } from './build/materialSessionTest.mjs'

async function setup() {
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec('CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)')
  academic.resetAcademicTablesCache()
  sessions.resetMaterialBackfillCache()
  lifecycle.resetMaterialLifecycleCache()
  teaching.resetTeachingAssignmentsCache()
  await academic.ensureAcademicTables(db)
  await materials.ensureMaterialsTable(db)
  for (const [id, tenant] of [['old-class', 'school'], ['new-class', 'school'], ['other-class', 'other']]) {
    await db.prepare('INSERT INTO classes (id, tenantId, name) VALUES (?, ?, ?)').bind(id, tenant, id).run()
  }
  for (const [id, tenant, start, end, status] of [
    ['past', 'school', '2025-09-01', '2026-07-31', 'completed'],
    ['current', 'school', '2026-09-01', '2027-07-31', 'active'],
    ['other-session', 'other', '2025-09-01', '2026-07-31', 'active'],
  ]) {
    await db.prepare(`INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '2025-01-01', '2025-01-01')`).bind(id, tenant, id, start, end, status).run()
  }
  return db
}

async function legacy(db, id, classId, date, metadata = '{}') {
  await db.prepare('INSERT INTO materials (id, classId, title, uploadedAt, metadata) VALUES (?, ?, ?, ?, ?)')
    .bind(id, classId, id, date, metadata).run()
}

async function addTerms(db, rows) {
  for (const [id, name, sequence, start, end, status] of rows) {
    await db.prepare(`INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status, created_at, updated_at)
      VALUES (?, 'school', 'current', ?, ?, ?, ?, ?, 'x', 'x')`).bind(id, name, sequence, start, end, status).run()
  }
}

test('existing school materials are classified once, tenant isolated, and current lists start fresh', async () => {
  const db = await setup()
  await legacy(db, 'old', 'new-class', '2025-10-10', '{"description":"Keep this note"}')
  await legacy(db, 'new', 'new-class', '2026-09-10')
  await legacy(db, 'unknown', 'old-class', '', 'invalid json')
  await legacy(db, 'foreign', 'other-class', '2025-10-10')
  assert.deepEqual((await materials.getMaterialsForClass(db, 'new-class')).map(x => x.id), ['new'])
  assert.equal((await materials.getMaterialById(db, 'old')).metadata.academicSessionId, 'past')
  assert.equal((await materials.getMaterialById(db, 'old')).description, 'Keep this note')
  assert.equal((await materials.getMaterialById(db, 'unknown')).metadata.academicSessionId, 'legacy')
  assert.equal((await materials.getMaterialById(db, 'foreign')).metadata.academicSessionId, undefined)
  await db.prepare("UPDATE academic_sessions SET start_date = '2025-01-01' WHERE id = 'current'").run()
  await sessions.backfillMaterialSessions(db, 'school', { force: true })
  assert.equal((await materials.getMaterialById(db, 'old')).metadata.academicSessionId, 'past')
  const counts = await materials.getCurrentMaterialCounts(db, 'school')
  assert.deepEqual(counts.results.map(x => [x.classId, x.count]), [['new-class', 1]])
})

test('publishing and reuse stamp the active session on the server and preserve the original', async () => {
  const db = await setup()
  await legacy(db, 'original', 'old-class', '2025-10-10', '{"subjectId":"math","releaseAt":"2025-11-01"}')
  await sessions.backfillMaterialSessions(db, 'school')
  const original = await materials.getMaterialById(db, 'original')
  const copy = await materials.addMaterial(db, { ...original, id: undefined, classId: 'new-class', metadata: { ...original.metadata, academicSessionId: 'past', reusedFromId: original.id } })
  assert.notEqual(copy.id, original.id)
  assert.equal(copy.metadata.academicSessionId, 'current')
  assert.equal(copy.metadata.reusedFromId, original.id)
  assert.equal((await materials.getMaterialById(db, original.id)).metadata.academicSessionId, 'past')
  await db.prepare("UPDATE academic_sessions SET status = 'completed' WHERE id = 'current'").run()
  assert.deepEqual(await materials.getMaterialsForClass(db, 'new-class'), [])
})

test('archive access follows historical enrollment after promotion, including repeated classes', async () => {
  const db = await setup()
  await academic.upsertEnrollment(db, { tenantId: 'school', sessionId: 'past', studentId: 'student', studentName: 'Student', classId: 'old-class', className: 'Old class' })
  const placements = await sessions.materialArchivePlacements(db, 'school', 'student')
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'old-class', metadata: { academicSessionId: 'past' } }, placements), true)
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'new-class', metadata: { academicSessionId: 'past' } }, placements), false)
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'old-class', metadata: { academicSessionId: 'current' } }, placements), false)
  assert.deepEqual(await sessions.materialArchivePlacements(db, 'other', 'student'), [])
  // With no register at all, pre-register history falls back to the student's own class.
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'old-class', metadata: { academicSessionId: 'legacy' } }, []), false)
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'old-class', metadata: { academicSessionId: 'legacy' } }, [], { classId: 'old-class', sessionId: 'current' }), true)
  assert.equal(sessions.studentCanAccessArchivedMaterial({ classId: 'old-class', metadata: { academicSessionId: 'legacy' } }, placements, { classId: 'new-class', sessionId: 'current' }), true)
})

test('schools without a calendar still archive everything published before September', async () => {
  const db = await setup()
  await db.prepare("DELETE FROM academic_sessions WHERE tenant_id = 'school'").run()
  const today = academic.lagosToday()
  await legacy(db, 'before-cutoff', 'old-class', '2026-08-31')
  await legacy(db, 'this-year', 'old-class', today)
  assert.deepEqual((await materials.getMaterialsForClass(db, 'old-class')).map(x => x.id), ['this-year'])
  assert.equal((await materials.getMaterialById(db, 'before-cutoff')).metadata.academicSessionId, 'legacy')
  const published = await materials.addMaterial(db, { classId: 'old-class', title: 'Note' })
  assert.equal(published.metadata.academicSessionId, sessions.provisionalSessionId(today))
  assert.equal(sessions.provisionalSessionId('2026-08-31'), 'period-2025-2026')
  assert.equal(sessions.provisionalSessionId('2026-09-01'), 'period-2026-2027')
})

test('provisional stamps move to the real session once the school records one, terms included', async () => {
  const db = await setup()
  await db.prepare("DELETE FROM academic_sessions WHERE tenant_id = 'school'").run()
  await legacy(db, 'early', 'old-class', '2026-09-10')
  await sessions.backfillMaterialSessions(db, 'school', { force: true })
  assert.equal((await materials.getMaterialById(db, 'early')).metadata.academicSessionId, 'period-2026-2027')
  await db.prepare(`INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
    VALUES ('current', 'school', '2026/2027', '2026-09-01', '2027-07-31', 'active', 'x', 'x')`).run()
  await addTerms(db, [['t1', 'First Term', 1, '2026-09-01', '2026-12-15', 'active']])
  await sessions.backfillMaterialSessions(db, 'school', { force: true })
  const early = await materials.getMaterialById(db, 'early')
  assert.equal(early.metadata.academicSessionId, 'current')
  assert.equal(early.metadata.academicTermId, 't1')
})

test('only the running term is current; earlier terms move to history without being touched', async () => {
  const db = await setup()
  await addTerms(db, [
    ['first', 'First Term', 1, '2026-09-01', '2026-12-15', 'completed'],
    ['second', 'Second Term', 2, '2027-01-05', '2027-04-01', 'active'],
    ['third', 'Third Term', 3, '2027-04-20', '2027-07-31', 'upcoming'],
  ])
  await legacy(db, 'first-term', 'new-class', '2026-10-01')
  await legacy(db, 'christmas-break', 'new-class', '2026-12-20')
  await legacy(db, 'second-term', 'new-class', '2027-01-10')
  await sessions.backfillMaterialSessions(db, 'school', { force: true })
  assert.equal((await materials.getMaterialById(db, 'christmas-break')).metadata.academicTermId, 'first')
  assert.deepEqual((await materials.getMaterialsForClass(db, 'new-class')).map(x => x.id), ['second-term'])
  assert.equal((await materials.getMaterialsForClass(db, 'new-class', { includeArchive: true })).length, 3)
  const added = await materials.addMaterial(db, { classId: 'new-class', title: 'Now' })
  assert.equal(added.metadata.academicTermId, 'second')
  // Earlier terms of the running session stay open to the class the student is in now.
  const material = await materials.getMaterialById(db, 'first-term')
  assert.equal(sessions.studentCanAccessArchivedMaterial(material, [], { classId: 'new-class', sessionId: 'current' }), true)
  assert.equal(sessions.studentCanAccessArchivedMaterial(material, [], { classId: 'old-class', sessionId: 'current' }), false)
})

test('between terms, the term that just ended stays current until the next one opens', async () => {
  const db = await setup()
  await addTerms(db, [
    ['first', 'First Term', 1, '2026-09-01', '2026-12-15', 'completed'],
    ['second', 'Second Term', 2, '2027-01-05', '2027-04-01', 'upcoming'],
  ])
  assert.deepEqual(await sessions.currentMaterialContext(db, 'school', '2026-12-20'), { sessionId: 'current', termId: 'first' })
  assert.deepEqual(await sessions.currentMaterialContext(db, 'school', '2026-08-25'), { sessionId: 'current', termId: 'first' })
})

test('a session that started in August still archives what was published before September', async () => {
  const db = await setup()
  await db.prepare("UPDATE academic_sessions SET start_date = '2026-08-01' WHERE id = 'current'").run()
  await legacy(db, 'august', 'new-class', '2026-08-20')
  await legacy(db, 'september', 'new-class', '2026-09-02')
  assert.deepEqual((await materials.getMaterialsForClass(db, 'new-class')).map(x => x.id), ['september'])
  assert.equal((await materials.getMaterialById(db, 'august')).metadata.academicSessionId, 'current')
})

test('drafts, hiding and deletion follow the lifecycle and deletion keeps an audit record', async () => {
  const db = await setup()
  const draft = await materials.addMaterial(db, { classId: 'new-class', title: 'Fractions', metadata: { status: 'draft', uploadedById: 'teacher-a', subjectId: 'math' } })
  assert.equal(draft.status, 'draft')
  assert.equal(draft.metadata.publishedAt, '')
  const forged = await materials.addMaterial(db, { classId: 'new-class', title: 'Forged', metadata: { status: 'deleted', academicSessionId: 'past' } })
  assert.equal(forged.status, 'published')
  assert.equal(forged.metadata.academicSessionId, 'current')

  assert.equal(lifecycle.canTransitionMaterial('draft', 'published'), true)
  assert.equal(lifecycle.canTransitionMaterial('published', 'hidden'), true)
  assert.equal(lifecycle.canTransitionMaterial('hidden', 'published'), true)
  assert.equal(lifecycle.canTransitionMaterial('deleted', 'published'), false)
  assert.equal(lifecycle.materialAudience('teacher'), 'teacher_only')
  assert.equal(lifecycle.materialAudience('student_parent'), 'student_published')

  await lifecycle.recordMaterialVersion(db, 'school', draft, { id: 'teacher-a', name: 'Mrs A' })
  await lifecycle.recordMaterialVersion(db, 'school', { ...draft, title: 'Fractions (fixed)' }, { id: 'teacher-a', name: 'Mrs A' })
  await lifecycle.recordMaterialAudit(db, { tenantId: 'school', material: draft, action: 'deleted', actor: { id: 'teacher-a', name: 'Mrs A' }, statusBefore: 'draft', statusAfter: 'deleted' })
  await materials.deleteMaterial(db, draft.id, { id: 'teacher-a', name: 'Mrs A' })

  assert.deepEqual((await materials.getMaterialsForClass(db, 'new-class')).map(x => x.id), [forged.id])
  const kept = await materials.getMaterialById(db, draft.id)
  assert.equal(kept.status, 'deleted')
  assert.equal(kept.metadata.statusBeforeDelete, 'draft')
  const history = await lifecycle.listMaterialHistory(db, 'school', draft.id)
  assert.deepEqual(history.versions.map(v => v.version), [2, 1])
  const audit = await lifecycle.listMaterialAudit(db, 'school', { action: 'deleted' })
  assert.equal(audit.length, 1)
  assert.equal(audit[0].class_id, 'new-class')
  assert.equal(audit[0].session_id, 'current')
  assert.equal(audit[0].subject_id, 'math')
  assert.equal(audit[0].owner_id, 'teacher-a')
  assert.deepEqual(await lifecycle.listMaterialAudit(db, 'other'), [])
  const counts = await materials.getCurrentMaterialCounts(db, 'school', { studentVisible: true })
  assert.deepEqual(counts.results.map(x => [x.classId, x.count]), [['new-class', 1]])
})

test("structured blocks keep the teacher's words and drop anything malformed", () => {
  const blocks = lifecycle.sanitizeMaterialBlocks([
    { type: 'topic', text: 'Photosynthesis' },
    { type: 'definition', text: 'photosynthesis is the process...' },
    { type: 'list', text: 'Factors affecting photosynthesis', items: ['sunlight', 'water'], ordered: true },
    { type: 'script', text: '<b>' },
    { type: 'paragraph', text: '   ' },
  ])
  assert.deepEqual(blocks.map(block => block.type), ['topic', 'definition', 'list'])
  assert.equal(blocks[1].text, 'photosynthesis is the process...')
  assert.equal(lifecycle.blocksToPlainText(blocks), 'Photosynthesis\n\nphotosynthesis is the process...\n\nFactors affecting photosynthesis\n1. sunlight\n2. water')
})

test('a new session records who taught what, then leaves teacher assignment to the school', async () => {
  const db = await setup()
  await db.prepare("UPDATE academic_sessions SET status = 'upcoming' WHERE id = 'current'").run()
  await db.prepare("UPDATE academic_sessions SET status = 'active' WHERE id = 'past'").run()
  await db.prepare("UPDATE classes SET name = 'JSS 1', arm = 'A', classTeacherId = 'mrs-a' WHERE id = 'old-class'").run()
  await db.prepare(`INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES
    ('math', 'school', 'Mathematics', 'old-class', 'mrs-a'), ('eng', 'school', 'English', 'old-class', 'mr-b'),
    ('foreign', 'other', 'Mathematics', 'other-class', 'mrs-a')`).run()
  await db.prepare(`INSERT INTO class_memberships (id, tenant_id, class_id, user_id, membership_role, created_at, updated_at) VALUES
    ('m1', 'school', 'old-class', 'mrs-a', 'teacher', 'x', 'x'), ('m2', 'school', 'old-class', 'mr-c', 'teacher', 'x', 'x')`).run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('mrs-a', JSON.stringify({ role: 'teacher', tenantId: 'school', classId: 'old-class' })).run()

  const result = await academic.activateSession(db, { tenantId: 'school', sessionId: 'current' })
  assert.equal(result.teacherAssignmentsReleased, 4)

  const history = await teaching.listSessionAssignments(db, 'school', 'past')
  assert.deepEqual(history.map(row => [row.role, row.subject_name, row.teacher_id]).sort(), [
    ['class_teacher', '', 'mrs-a'], ['co_teacher', '', 'mr-c'], ['subject', 'English', 'mr-b'], ['subject', 'Mathematics', 'mrs-a'],
  ])
  assert.equal(history[0].class_name, 'JSS 1 A')
  assert.equal((await db.prepare("SELECT teacherId FROM subjects WHERE id = 'math'").first()).teacherId, null)
  assert.equal((await db.prepare("SELECT teacherId FROM subjects WHERE id = 'foreign'").first()).teacherId, 'mrs-a')
  assert.equal((await db.prepare("SELECT classTeacherId FROM classes WHERE id = 'old-class'").first()).classTeacherId, null)
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM class_memberships WHERE tenant_id = 'school' AND membership_role = 'teacher'").first()).n, 0)
  assert.equal(JSON.parse((await db.prepare("SELECT payload FROM settings WHERE studentId = 'mrs-a'").first()).payload).classId, undefined)
  assert.equal((await teaching.listTeachingHistory(db, 'other', ['mrs-a'])).length, 0)

  // The administrator picks a teacher for English first; confirming last
  // session's English row then leaves that choice alone.
  await db.prepare("UPDATE subjects SET teacherId = 'mrs-d' WHERE id = 'eng'").run()
  const ids = history.filter(row => row.role !== 'co_teacher').map(row => row.id)
  const carried = await teaching.carryForwardAssignments(db, { tenantId: 'school', fromSessionId: 'past', assignmentIds: ids })
  assert.equal(carried.applied, 2)
  assert.deepEqual(carried.classTeacherClassIds, ['old-class'])
  assert.equal((await db.prepare("SELECT teacherId FROM subjects WHERE id = 'math'").first()).teacherId, 'mrs-a')
  assert.equal((await db.prepare("SELECT teacherId FROM subjects WHERE id = 'eng'").first()).teacherId, 'mrs-d')
  await teaching.recordLiveAssignments(db, { tenantId: 'school', sessionId: 'current' })
  assert.equal((await teaching.listTeachingHistory(db, 'school', ['MRS-A'])).length, 4)
})

test("a school's first session keeps the assignments it was set up with", async () => {
  const db = await setup()
  await db.prepare("UPDATE academic_sessions SET status = 'upcoming' WHERE tenant_id = 'school'").run()
  await db.prepare("INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('math', 'school', 'Mathematics', 'old-class', 'mrs-a')").run()
  const result = await academic.activateSession(db, { tenantId: 'school', sessionId: 'current' })
  assert.equal(result.teacherAssignmentsReleased, 0)
  assert.equal((await db.prepare("SELECT teacherId FROM subjects WHERE id = 'math'").first()).teacherId, 'mrs-a')
})

test('live schools without registers retain the outgoing class when a new session opens', async () => {
  const db = await setup()
  await db.prepare("INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('student', 'student@test', 'Student', 'student', 'school', 'active')").run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('student@test', JSON.stringify({ role: 'student', tenantId: 'school', classId: 'old-class' })).run()
  await db.prepare("UPDATE academic_sessions SET status = 'upcoming' WHERE id = 'current'").run()
  await db.prepare("UPDATE academic_sessions SET status = 'active' WHERE id = 'past'").run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('promotion_map_school', JSON.stringify({ map: { 'old-class': 'new-class' } })).run()
  await academic.activateSession(db, { tenantId: 'school', sessionId: 'current' })
  const placements = await sessions.materialArchivePlacements(db, 'school', 'student')
  assert.equal(placements[0].class_id, 'old-class')
  assert.equal(placements[0].session_id, 'past')
  assert.equal((await academic.getEnrollment(db, 'school', 'current', 'student')).classId, 'new-class')
  // Students' own placement is never cleared with the teacher assignments.
  assert.equal(JSON.parse((await db.prepare("SELECT payload FROM settings WHERE studentId = 'student@test'").first()).payload).role, 'student')
})

test('owners and HOS supervise classes without ever becoming their teacher', async () => {
  const db = await setup()
  supervision.resetClassSupervisionCache()
  await db.prepare("INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('math', 'school', 'Mathematics', 'old-class', 'mrs-a')").run()
  const before = await teaching.loadLiveAssignments(db, 'school')

  assert.equal(await supervision.joinClass(db, { tenantId: 'school', userId: 'Owner@School', role: 'owner', classId: 'old-class' }), true)
  assert.equal(await supervision.joinClass(db, { tenantId: 'school', userId: 'owner@school', role: 'owner', classId: 'old-class' }), false)
  await supervision.joinClass(db, { tenantId: 'school', userId: 'owner@school', role: 'owner', classId: 'new-class' })
  assert.deepEqual((await supervision.listSupervisedClassIds(db, 'school', 'owner@school')).sort(), ['new-class', 'old-class'])
  assert.deepEqual(await supervision.listSupervisedClassIds(db, 'other', 'owner@school'), [])

  // Joining touches no teacher assignment; exiting removes the class from the workspace only.
  assert.deepEqual(await teaching.loadLiveAssignments(db, 'school'), before)
  assert.equal(await supervision.exitClass(db, { tenantId: 'school', userId: 'owner@school', classId: 'old-class' }), true)
  assert.deepEqual(await supervision.listSupervisedClassIds(db, 'school', 'owner@school'), ['new-class'])
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM class_supervision WHERE class_id = 'old-class'").first()).n, 1)
  assert.deepEqual(await teaching.loadLiveAssignments(db, 'school'), before)

  // HOS intervention follows school policy; the owner always may.
  assert.equal(await supervision.supervisorMayIntervene(db, 'school', 'hos'), true)
  await supervision.setHosMode(db, 'school', 'view', 'owner@school')
  assert.equal(await supervision.supervisorMayIntervene(db, 'school', 'hos'), false)
  assert.equal(await supervision.supervisorMayIntervene(db, 'school', 'owner'), true)
  assert.equal(await supervision.supervisorMayIntervene(db, 'other', 'hos'), true)
})

test('supervisory interventions are marked in the material audit trail', async () => {
  const db = await setup()
  const material = await materials.addMaterial(db, { classId: 'new-class', title: 'Fractions', metadata: { subjectId: 'math', subjectName: 'Mathematics', className: 'JSS 2A' } })
  await lifecycle.recordMaterialAudit(db, { tenantId: 'school', material, action: 'edited', actor: { id: 'owner@school', name: 'Owner', role: 'owner', supervisory: true } })
  await lifecycle.recordMaterialAudit(db, { tenantId: 'school', material, action: 'edited', actor: { id: 'mrs-a', name: 'Mrs A', role: 'teacher' } })
  const supervisory = await lifecycle.listMaterialAudit(db, 'school', { supervisoryOnly: true })
  assert.equal(supervisory.length, 1)
  assert.deepEqual([supervisory[0].actor_role, supervisory[0].class_name, supervisory[0].subject_name, supervisory[0].material_id],
    ['owner', 'JSS 2A', 'Mathematics', material.id])
})

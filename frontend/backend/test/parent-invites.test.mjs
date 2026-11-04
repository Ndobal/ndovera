import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Student addresses from the school's ending, safe corrections, and parents joining by a private link.

const SECRET = 'parent-invites-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?invites=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    DROP TABLE IF EXISTS tenants;
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, school_slug TEXT, requested_subdomain TEXT, country TEXT, status TEXT, owner_email TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College', 'genesis', 'genesis', 'Nigeria', 'active', 'owner@a.test'), ('school-b', 'Other School', 'other', 'other', 'Nigeria', 'active', 'o@b.test');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('c1', 'school-a', 'JSS 1', 'A');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS sample_records (id TEXT PRIMARY KEY, student_id TEXT, note TEXT);
  `)
  const person = async (id, email, name, role, tenant = 'school-a', extra = {}) => {
    await db.prepare('INSERT INTO users (id, email, name, role, primary_role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, email, name, role, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, primaryRole: role, roles: [role], tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  await person('o-1', 'owner@a.test', 'Owner', 'owner')
  await person('h-1', 'hos@a.test', 'Head', 'hos')
  await person('t-1', 'tea@a.test', 'Teacher', 'teacher')
  await person('k-1', 'ada@old.test', 'Ada Obi', 'student', 'school-a', { displayId: 'GEN-0001', className: 'JSS 1', classId: 'c1' })
  await person('k-2', 'bayo@old.test', 'Bayo Obi', 'student', 'school-a', { displayId: 'GEN-0002' })
  await person('x-1', 'far@b.test', 'Elsewhere', 'parent', 'school-b')
  const sent = []
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    if (target.includes('oauth')) return Response.json({ access_token: 'tok', expires_in: 3600 })
    if (target.includes('/messages')) { sent.push(JSON.parse(init.body)); return Response.json({ status: { code: 200 }, data: {} }) }
    throw new Error(`unexpected fetch ${target}`)
  }
  const env = { APP_DB: db, JWT_SECRET: SECRET, ZOHO_MAIL_ACCOUNT_ID: 'acc', ZOHO_MAIL_FROM_ADDRESS: 'from@n.test', ZOHO_MAIL_CLIENT_ID: 'a', ZOHO_MAIL_CLIENT_SECRET: 'b', ZOHO_MAIL_REFRESH_TOKEN: 'c', FLUTTERWAVE_REDIRECT_BASE_URL: 'https://ndovera.com' }
  const raw = async (path, init = {}) => {
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { headers: { 'Content-Type': 'application/json' }, ...init }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const call = async (as, method, path, body) => {
    const roles = { owner: ['o-1', 'owner@a.test'], hos: ['h-1', 'hos@a.test'], teacher: ['t-1', 'tea@a.test'] }
    const [id, email] = roles[as]
    const token = await sign({ id, email, role: as, roles: [as], tenantId: 'school-a', name: as, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    return raw(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  }
  const post = (path, body) => raw(path, { method: 'POST', body: JSON.stringify(body) })
  const login = id => raw('/api/auth/login', { method: 'POST', body: JSON.stringify({ id, password: FORM.password }) })
  return { db, call, raw, post, login, sent }
}
const FORM = { name: 'Mrs Obi', email: 'mum@real.test', phone: '08031112222', dateOfBirth: '1985-02-03', occupation: 'Nurse', password: 'strong-pass-1' }
const tokenOf = url => url.split('/invite/')[1]
const payload = (db, key) => JSON.parse(db.db.prepare('SELECT payload FROM settings WHERE studentId = ?').get(key)?.payload || 'null')

test('a new student gets first.surname at the school ending, and the school can set that ending', async () => {
  const ctx = await setup()
  const add = (name, parentData) => ctx.call('owner', 'POST', '/api/people', { name, role: 'student', classId: 'c1', parentData })
  assert.equal((await add('Chidi Emeka')).body.user.email, 'chidi.emeka@genesis.ndovera.com', 'before the school sets one')
  assert.equal((await ctx.call('teacher', 'PUT', '/api/school/student-email-domain', { domain: '@xyz.com' })).status, 403)
  assert.equal((await ctx.call('owner', 'PUT', '/api/school/student-email-domain', { domain: 'not a domain' })).status, 400)
  assert.equal((await ctx.call('hos', 'PUT', '/api/school/student-email-domain', { domain: '@XYZ.com' })).body.domain, 'xyz.com')
  assert.equal((await add('Dami Ade')).body.user.email, 'dami.ade@xyz.com')
  assert.equal((await add('Dami Ade')).body.user.email, 'dami.ade2@xyz.com', 'a namesake gets their own')
})

test('a parent phone on the add-student form is enough, signs them in, and a brother or sister finds the same parent', async () => {
  const ctx = await setup()
  const add = name => ctx.call('owner', 'POST', '/api/people', { name, role: 'student', classId: 'c1', parentData: { phone: '08035550000' } })
  const first = await add('Efe Bello')
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const second = await add('Femi Bello')
  const parents = ctx.db.db.prepare('SELECT parent_id, student_id FROM parent_student_links').all()
  assert.equal(parents.length, 2)
  assert.equal(parents[0].parent_id, parents[1].parent_id, 'one account for both')
  assert.ok(second.status === 201)
  const row = ctx.db.db.prepare('SELECT phone FROM login_phones').get()
  assert.equal(row.phone, '2348035550000')
})

test('hos or owner corrects an address: sign-in, records and links all follow', async () => {
  const ctx = await setup()
  ctx.db.db.exec(`INSERT INTO sample_records VALUES ('r1', 'ada@old.test', 'kept under the old address');
    INSERT INTO parent_student_links VALUES ('l1', 'x', 'ada@old.test', 'school-a', 'x');`)
  const path = '/api/people/k-1/email'
  assert.equal((await ctx.call('teacher', 'PUT', path, { email: 'a@b.test' })).status, 403)
  assert.equal((await ctx.call('owner', 'PUT', path, { email: 'nonsense' })).status, 400)
  assert.equal((await ctx.call('owner', 'PUT', path, { email: 'bayo@old.test' })).status, 409, 'already taken')
  assert.equal((await ctx.call('hos', 'PUT', '/api/people/t-1/email', { email: 'new@b.test' })).status, 403, 'staff addresses are not changed here')

  assert.equal((await ctx.call('hos', 'PUT', path, { email: 'Ada.Right@old.test' })).body.email, 'ada.right@old.test')
  assert.equal(ctx.db.db.prepare('SELECT email FROM users WHERE id = ?').get('k-1').email, 'ada.right@old.test')
  assert.equal(payload(ctx.db, 'ada.right@old.test').displayId, 'GEN-0001')
  assert.equal(payload(ctx.db, 'ada@old.test'), null)
  assert.equal(ctx.db.db.prepare('SELECT student_id FROM sample_records').get().student_id, 'ada.right@old.test', 'records move too')
  assert.equal(ctx.db.db.prepare(`SELECT student_id FROM parent_student_links WHERE id = 'l1'`).get().student_id, 'k-1')
})

test('"use school email" follows the current school and the current name', async () => {
  const ctx = await setup()
  await ctx.call('owner', 'PUT', '/api/school/student-email-domain', { domain: '@xyz.com' })
  assert.equal((await ctx.call('owner', 'GET', '/api/people/k-1/school-email')).body.email, 'ada.obi@xyz.com')
  assert.equal((await ctx.call('owner', 'PUT', '/api/people/k-1/email', { useSchoolEmail: true })).body.email, 'ada.obi@xyz.com')
  assert.equal((await ctx.call('owner', 'PUT', '/api/people/k-1/email', { useSchoolEmail: true })).body.unchanged, true, 'pressing again changes nothing')
  ctx.db.db.exec(`UPDATE users SET name = 'Ada Nwosu' WHERE id = 'k-1'`)
  assert.equal((await ctx.call('owner', 'GET', '/api/people/k-1/school-email')).body.email, 'ada.nwosu@xyz.com', 'a changed name suggests a changed address')
})

test('students never receive email, whatever their address looks like', async () => {
  const ctx = await setup()
  await ctx.call('owner', 'PUT', '/api/people/k-1/email', { email: 'ada@real-looking.test' })
  const made = await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ['k-1'], sendTo: 'ada@real-looking.test' })
  assert.equal(made.status, 201)
  assert.equal(made.body.emailedTo, '')
  assert.equal(ctx.sent.length, 0)
})

test('a parent opens the link, fills it in, and signs in by email or phone', async () => {
  const ctx = await setup()
  assert.equal((await ctx.call('teacher', 'POST', '/api/school/parent-invites', { studentIds: ['k-1'] })).status, 403)
  assert.equal((await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ['nobody'] })).status, 404)
  const made = await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ['k-1', 'k-2'] })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  assert.match(made.body.message, /GEN-0001[\s\S]*GEN-0002/)
  const token = tokenOf(made.body.url)
  assert.ok(!ctx.db.db.prepare('SELECT token_hash FROM parent_invites').get().token_hash.includes(token), 'only a hash is stored')

  const shown = await ctx.raw(`/api/public/parent-invites/${token}`)
  assert.equal(shown.body.schoolName, 'Genesis College')
  assert.deepEqual(shown.body.children.map(child => child.code).sort(), ['GEN-0001', 'GEN-0002'])
  assert.ok(!JSON.stringify(shown.body).includes('ada@old.test'), 'no addresses on the public page')
  assert.equal((await ctx.raw('/api/public/parent-invites/wrong')).status, 404)

  for (const missing of ['name', 'email', 'phone', 'dateOfBirth', 'occupation', 'password']) {
    assert.equal((await ctx.post(`/api/public/parent-invites/${token}`, { ...FORM, [missing]: '' })).status, 400, missing)
  }
  const done = await ctx.post(`/api/public/parent-invites/${token}`, FORM)
  assert.equal(done.status, 200, JSON.stringify(done.body))
  const saved = payload(ctx.db, 'mum@real.test')
  assert.equal(saved.occupation, 'Nurse')
  assert.equal(saved.dateOfBirth, '1985-02-03')
  assert.equal(saved.mustChangePassword, false)
  assert.equal(saved.initialPassword, undefined)
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM parent_student_links`).get().n, 2)
  assert.equal((await ctx.login('mum@real.test')).status, 200)
  assert.equal((await ctx.login('08031112222')).status, 200)

  assert.equal((await ctx.post(`/api/public/parent-invites/${token}`, { ...FORM, email: 'other@real.test', phone: '08039998888' })).status, 410, 'a link works once')
})

test('a link cannot take over someone else\'s account', async () => {
  const ctx = await setup()
  const invite = async ids => tokenOf((await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ids })).body.url)
  const first = await invite(['k-1'])
  await ctx.post(`/api/public/parent-invites/${first}`, FORM)

  const second = await invite(['k-2'])
  const path = `/api/public/parent-invites/${second}`
  const wrong = await ctx.post(path, { ...FORM, password: 'not-the-password' })
  assert.equal(wrong.status, 409)
  assert.equal(wrong.body.existing, true)
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM parent_student_links WHERE student_id = 'k-2'`).get().n, 0)
  assert.equal((await ctx.post(path, { ...FORM, email: 'someone@real.test' })).status, 409, 'a phone already in use')
  assert.equal((await ctx.post(path, { ...FORM, email: 'far@b.test', phone: '08037770000' })).status, 409, 'another school\'s account')
  assert.equal((await ctx.post(path, { ...FORM, email: 'ada@old.test', phone: '08037770000' })).status, 409, 'a student\'s address')
  assert.equal((await ctx.post(path, FORM)).status, 200, 'the right password adds the second child')
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM parent_student_links WHERE student_id = 'k-2'`).get().n, 1)
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email = 'mum@real.test'`).get().n, 1)
})

test('a phone-only parent the school created for this child takes their account over with the link', async () => {
  const ctx = await setup()
  const added = await ctx.call('owner', 'POST', '/api/people', { name: 'Gozie Obi', role: 'student', classId: 'c1', parentData: { phone: FORM.phone } })
  const placeholderParent = ctx.db.db.prepare(`SELECT id, email FROM users WHERE email LIKE '%@ndovera.local'`).get()
  assert.ok(placeholderParent, JSON.stringify(added.body))
  const token = tokenOf((await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: [added.body.user.id] })).body.url)
  assert.equal((await ctx.post(`/api/public/parent-invites/${token}`, FORM)).status, 200)
  assert.equal(ctx.db.db.prepare('SELECT email FROM users WHERE id = ?').get(placeholderParent.id).email, 'mum@real.test')
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@ndovera.local'`).get().n, 0)
  assert.equal((await ctx.login('mum@real.test')).status, 200)
})

test('changing a parent number moves their sign-in: the old one stops, a taken one is refused', async () => {
  const ctx = await setup()
  const token = tokenOf((await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ['k-1'] })).body.url)
  await ctx.post('/api/public/parent-invites/' + token, FORM)
  const parentId = ctx.db.db.prepare("SELECT id FROM users WHERE email = 'mum@real.test'").get().id
  const change = phone => ctx.call('owner', 'PUT', '/api/people/' + parentId, { phone })
  assert.equal((await change('12')).status, 400)
  const moved = await change('08036667777')
  assert.equal(moved.status, 200, JSON.stringify(moved.body))
  assert.equal((await ctx.login('08036667777')).status, 200, 'the new number signs in')
  assert.notEqual((await ctx.login('08031112222')).status, 200, 'the old one no longer does')
  assert.equal((await ctx.login('mum@real.test')).status, 200, 'the email and password still do')

  const added = await ctx.call('owner', 'POST', '/api/people', { name: 'Hope Ade', role: 'student', classId: 'c1', parentData: { phone: '08034445555' } })
  assert.equal(added.status, 201)
  assert.equal((await change('08034445555')).status, 409, 'a number another parent holds')
  const phoneOnly = ctx.db.db.prepare("SELECT id FROM users WHERE email LIKE '%@ndovera.local'").get().id
  assert.equal((await ctx.call('owner', 'PUT', '/api/people/' + phoneOnly, { phone: '' })).status, 400, 'a phone-only parent cannot lose their only sign-in')
})

test('too many wrong passwords stop the link', async () => {
  const ctx = await setup()
  const invite = async ids => tokenOf((await ctx.call('owner', 'POST', '/api/school/parent-invites', { studentIds: ids })).body.url)
  await ctx.post(`/api/public/parent-invites/${await invite(['k-1'])}`, FORM)
  const token = await invite(['k-2'])
  for (let i = 0; i < 10; i += 1) await ctx.post(`/api/public/parent-invites/${token}`, { ...FORM, password: `wrong-password-${i}` })
  assert.equal((await ctx.post(`/api/public/parent-invites/${token}`, FORM)).status, 429)
})

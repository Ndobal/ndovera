import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { contactLinks, crawlSource, ensureProspectTables, extractEmails, gatherTick, normalizeSettings, robotsAllows, sendTick, stopProspect, unsubscribeToken, weekKey } from './build/prospects.mjs'

// School outreach: addresses gathered once a week from public school pages, never twice;
// emails on day 1, day 15, then every two months, stopping on opt-out, reply or joining.

const SCHOOL_HOME = `<html><head><title>Kings Academy | Lagos</title></head><body>
  <p>Write to info@kingsacademy.edu.ng or admissions [at] kingsacademy [dot] edu.ng</p>
  <img src="logo@2x.png"> <a href="mailto:noreply@kingsacademy.edu.ng">x</a> <a href="/contact-us">Contact us</a>
  <a href="https://facebook.com/kings">Facebook</a></body></html>`
const SCHOOL_CONTACT = `<p>Bursary: bursar@kingsacademy.edu.ng, also info@kingsacademy.edu.ng</p>`

function fakeWeb(pages) {
  const visited = []
  const fetcher = async url => {
    visited.push(String(url))
    const body = pages[String(url)]
    if (body === undefined) return new Response('not found', { status: 404 })
    return new Response(body, { status: 200, headers: { 'content-type': url.endsWith('robots.txt') ? 'text/plain' : 'text/html' } })
  }
  return { fetcher, visited }
}

test('addresses on a page: mailto, plain and "[at] [dot]"; junk and no-reply left out; contact pages followed', () => {
  assert.deepEqual(extractEmails(SCHOOL_HOME).sort(), ['admissions@kingsacademy.edu.ng', 'info@kingsacademy.edu.ng'])
  assert.deepEqual(contactLinks(SCHOOL_HOME, 'https://kingsacademy.edu.ng/'), ['https://kingsacademy.edu.ng/contact-us'])
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private', '/contact'), true)
  assert.equal(robotsAllows('User-agent: *\nDisallow: /', '/contact'), false)
  assert.equal(robotsAllows('User-agent: Googlebot\nDisallow: /', '/contact'), true)
})

test('the weekly gathering stores each address once, ever, and visits each source once a week', async () => {
  const db = new D1Shim()
  await ensureProspectTables(db)
  db.db.exec(`INSERT INTO prospect_sources (id, url, country, added_at) VALUES ('s1', 'https://kingsacademy.edu.ng/', 'NG', '2026-10-01'), ('s2', 'https://blocked.example.ng/', 'GH', '2026-10-01')`)
  const { fetcher } = fakeWeb({
    'https://kingsacademy.edu.ng/robots.txt': 'User-agent: *\nDisallow: /admin',
    'https://kingsacademy.edu.ng/': SCHOOL_HOME,
    'https://kingsacademy.edu.ng/contact-us': SCHOOL_CONTACT,
    'https://blocked.example.ng/robots.txt': 'User-agent: *\nDisallow: /',
    'https://blocked.example.ng/': '<p>head@blocked.example.ng</p>',
  })
  const sunday = new Date('2026-11-01T02:00:00Z')
  const first = await gatherTick(db, fetcher, { at: sunday })
  assert.deepEqual([first.crawled, first.added], [2, 3])
  const rows = db.db.prepare(`SELECT email, country, school_name, source_url FROM prospect_schools ORDER BY email`).all()
  assert.deepEqual(rows.map(row => row.email), ['admissions@kingsacademy.edu.ng', 'bursar@kingsacademy.edu.ng', 'info@kingsacademy.edu.ng'])
  assert.equal(rows[0].school_name, 'Kings Academy')
  assert.equal(rows.find(row => row.email.startsWith('bursar')).source_url, 'https://kingsacademy.edu.ng/contact-us')
  // robots.txt said no: nothing taken, and the reason is kept on the source.
  assert.match(db.db.prepare(`SELECT last_error FROM prospect_sources WHERE id = 's2'`).get().last_error, /robots/)

  // Same week: nothing left to visit, the week is closed.
  assert.equal((await gatherTick(db, fetcher, { at: new Date('2026-11-01T02:05:00Z') })).done, true)
  // Next week: visited again, but no address is stored twice.
  const next = await gatherTick(db, fetcher, { at: new Date('2026-11-08T02:00:00Z') })
  assert.deepEqual([next.crawled, next.added], [2, 0])
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM prospect_schools`).get().n, 3)
  assert.equal(weekKey(new Date('2026-11-01T02:00:00Z')), '2026-10-26')
})

test('emails go on day 1, day 15, then every two months; never past the cap, the opt-out, or once the school joins', async () => {
  const db = new D1Shim()
  createLegacySchema(db)
  await ensureProspectTables(db)
  const at = '2026-11-02T08:00:00.000Z'
  const add = (id, email, country) => db.db.prepare(`INSERT INTO prospect_schools (id, email, domain, school_name, country, source_url, found_at, status, step, next_due_at, updated_at) VALUES (?, ?, ?, ?, ?, 'https://x', ?, 'new', 0, ?, ?)`).run(id, email, email.split('@')[1], 'Kings Academy', country, at, at, at)
  add('p1', 'info@kingsacademy.edu.ng', 'NG')
  add('p2', 'info@capeschool.co.za', 'ZA')
  add('p3', 'head@joined.edu.ng', 'NG')
  add('p4', 'info@another.edu.gh', 'GH')
  // p3's school already uses Ndovera.
  db.db.prepare(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('o1', 'owner@joined.edu.ng', 'Owner', 'owner', 't1', 'active')`).run()
  const mail = []
  const deps = when => ({ db, send: async (to, subject, html) => { mail.push({ to, subject, html }); return true }, secret: 's3cret', baseUrl: 'https://ndovera.com', at: new Date(when) })
  let settings = normalizeSettings({ sending: true, dailyCap: 1 })
  assert.deepEqual(settings.noAutoSend, ['ZA'])

  // Sending switched off: nothing goes.
  assert.equal((await sendTick(deps(at), normalizeSettings({ sending: false }))).sent, 0)
  // Cap of 1 a day.
  assert.equal((await sendTick(deps(at), settings)).sent, 1)
  assert.equal((await sendTick(deps('2026-11-02T08:30:00Z'), settings)).reason, 'daily cap reached')
  settings = normalizeSettings({ sending: true, dailyCap: 50 })
  await sendTick(deps('2026-11-02T09:00:00Z'), settings)
  const statuses = Object.fromEntries(db.db.prepare(`SELECT id, status, step FROM prospect_schools`).all().map(row => [row.id, `${row.status}/${row.step}`]))
  assert.deepEqual(statuses, { p1: 'active/1', p2: 'new/0', p3: 'converted/0', p4: 'active/1' })
  assert.ok(!mail.some(item => item.to.endsWith('.co.za')), 'South Africa is not emailed automatically')
  const first = mail.find(item => item.to === 'info@kingsacademy.edu.ng')
  assert.match(first.subject, /Kings Academy/)
  const token = await unsubscribeToken('s3cret', 'info@kingsacademy.edu.ng')
  assert.ok(first.html.includes(`unsubscribe?e=info%40kingsacademy.edu.ng&amp;t=${token}`))

  // Day 15: the second email; then nothing until two months later.
  mail.length = 0
  await sendTick(deps('2026-11-10T08:00:00Z'), settings)
  assert.equal(mail.length, 0)
  await sendTick(deps('2026-11-16T09:30:00Z'), settings)
  assert.deepEqual(mail.map(item => item.to).sort(), ['info@another.edu.gh', 'info@kingsacademy.edu.ng'])
  mail.length = 0
  await sendTick(deps('2026-12-20T08:00:00Z'), settings)
  assert.equal(mail.length, 0)
  await sendTick(deps('2027-01-16T08:00:00Z'), settings)
  assert.equal(mail.length, 2)

  // Opted out: never again, even if the address is found again.
  await stopProspect(db, 'info@kingsacademy.edu.ng', 'opted_out', 'unsubscribe link')
  mail.length = 0
  await sendTick(deps('2027-04-20T08:00:00Z'), settings)
  assert.deepEqual(mail.map(item => item.to), ['info@another.edu.gh'])
  await crawlSource(db, async url => new Response(url.endsWith('robots.txt') ? '' : '<p>info@kingsacademy.edu.ng</p>', { headers: { 'content-type': 'text/html' } }), { id: 'sx', url: 'https://kingsacademy.edu.ng/', country: 'NG' })
  assert.equal(db.db.prepare(`SELECT status FROM prospect_schools WHERE email = 'info@kingsacademy.edu.ng'`).get().status, 'opted_out')
})

test('Ami manages outreach; the unsubscribe link works only with its own token', async () => {
  const worker = (await import('./build/worker.mjs?outreach=1')).default
  const db = new D1Shim()
  createLegacySchema(db)
  const SECRET = 'outreach-secret'
  const call = async (role, method, path, body, form) => {
    const token = await sign({ id: role, email: `${role}@ndovera.com`, role, roles: [role], tenantId: role === 'ami' ? null : 't1', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 Chrome/130' } : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': role, 'User-Agent': 'Mozilla/5.0 Chrome/130' }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, text: await response.text() }
  }
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('ami', 'ami@ndovera.com', 'Ami', 'ami', null, 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('ami@ndovera.com', JSON.stringify({ email: 'ami@ndovera.com', role: 'ami', roles: ['ami'] })).run()
  assert.equal((await call('owner', 'GET', '/api/ami/outreach')).status, 403)
  const added = await call('ami', 'POST', '/api/ami/outreach/sources', { country: 'NG', urls: 'kingsacademy.edu.ng\nhttps://greenfield.sch.ng/contact\nnot a url' })
  assert.equal(added.status, 200, added.text)
  assert.equal(JSON.parse(added.text).added, 2)
  const overview = JSON.parse((await call('ami', 'GET', '/api/ami/outreach')).text)
  assert.deepEqual(overview.sources.map(source => source.url).sort(), ['https://greenfield.sch.ng/contact', 'https://kingsacademy.edu.ng/'])
  assert.equal(overview.settings.sending, false)
  const saved = JSON.parse((await call('ami', 'PUT', '/api/ami/outreach/settings', { sending: true, dailyCap: 900 })).text)
  assert.deepEqual([saved.settings.sending, saved.settings.dailyCap], [true, 300])

  const email = 'info@kingsacademy.edu.ng'
  const token = await unsubscribeToken(SECRET, email)
  assert.equal((await call('ami', 'GET', `/api/outreach/unsubscribe?e=${encodeURIComponent(email)}&t=bad`)).status, 400)
  const page = await call('ami', 'GET', `/api/outreach/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`)
  assert.match(page.text, /Stop these emails/)
  assert.equal((await call(null, 'POST', '/api/outreach/unsubscribe', null, `e=${encodeURIComponent(email)}&t=${token}`)).status, 200)
  assert.equal(db.db.prepare(`SELECT status FROM prospect_schools WHERE email = ?`).get(email).status, 'opted_out')
})

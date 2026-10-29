import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Ami resets every student's practice XP (all schools or one). Each student's XP is backed
// up first, so the reset can be undone; XP earned after the reset is kept on undo.

const SECRET = 'xp-reset-secret'

async function setup() {
  const worker = (await import('./build/worker.mjs?xpreset=1')).default
  const db = new D1Shim()
  createLegacySchema(db)
  const call = async (role, method, path, body) => {
    const token = await sign({ id: role, role, roles: [role], tenantId: role === 'ami' ? '' : 'school-a', name: role, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
      { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

test('Ami resets every student\'s XP with a backup, and can undo it', async () => {
  const { db, call } = await setup()
  assert.equal((await call('ami', 'GET', '/api/ami/practice/xp-resets')).status, 200)
  // The practice tables exist once anything practice-related has run; create the profiles.
  await call('ami', 'POST', '/api/ami/practice/reset-xp', { confirm: 'RESET XP' })
  const stamp = new Date().toISOString()
  for (const [id, tenant, xp] of [['s1', 'school-a', 1200], ['s2', 'school-a', 300], ['s3', 'school-b', 50]]) {
    db.db.prepare(`INSERT INTO practice_profiles (student_id, tenant_id, xp, today_xp, streak, updated_at) VALUES (?, ?, ?, 20, 4, ?)`).run(id, tenant, xp, stamp)
  }
  const xpOf = () => Object.fromEntries(db.db.prepare(`SELECT student_id, xp FROM practice_profiles ORDER BY student_id`).all().map(row => [row.student_id, row.xp]))

  assert.equal((await call('owner', 'POST', '/api/ami/practice/reset-xp', { confirm: 'RESET XP' })).status, 403)
  assert.equal((await call('ami', 'POST', '/api/ami/practice/reset-xp', {})).status, 400, 'must be typed to confirm')

  // One school only.
  const one = await call('ami', 'POST', '/api/ami/practice/reset-xp', { confirm: 'RESET XP', tenantId: 'school-b' })
  assert.deepEqual([one.status, one.body.students], [200, 1])
  assert.deepEqual(xpOf(), { s1: 1200, s2: 300, s3: 0 })

  // Everyone.
  const all = await call('ami', 'POST', '/api/ami/practice/reset-xp', { confirm: 'RESET XP' })
  assert.equal(all.body.students, 3)
  assert.deepEqual(xpOf(), { s1: 0, s2: 0, s3: 0 })
  assert.equal(db.db.prepare(`SELECT streak FROM practice_profiles WHERE student_id = 's1'`).get().streak, 4, 'streaks are kept')

  // Undo: the XP comes back, plus what was earned since.
  db.db.prepare(`UPDATE practice_profiles SET xp = 40 WHERE student_id = 's1'`).run()
  const undone = await call('ami', 'POST', `/api/ami/practice/xp-resets/${all.body.id}/restore`)
  assert.equal(undone.status, 200, JSON.stringify(undone.body))
  assert.deepEqual(xpOf(), { s1: 1240, s2: 300, s3: 0 })
  assert.equal((await call('ami', 'POST', `/api/ami/practice/xp-resets/${all.body.id}/restore`)).status, 409, 'undone once only')
  const list = (await call('ami', 'GET', '/api/ami/practice/xp-resets')).body.resets
  assert.equal(list.find(item => item.id === all.body.id).restoredAt !== null, true)
})

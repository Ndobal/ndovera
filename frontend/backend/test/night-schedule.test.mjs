import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Night AI within the free allowance: new questions twice a week, a check every night, a cap
// that a saved setting cannot exceed, examinations taking turns, and all of it in the last hour
// before Cloudflare's daily allowance resets (00:00 UTC, 01:00 in Lagos).

const SECRET = 'night-schedule-secret'
let generation = 0

// Lagos is UTC+1, so 00:30 in Lagos is 23:30 UTC the evening before.
const SUNDAY = '2026-11-07T23:30:00.000Z'
const MONDAY = '2026-11-08T23:30:00.000Z'
const WEDNESDAY = '2026-11-10T23:30:00.000Z'

function model(calls, { fail = false } = {}) {
  return {
    run: async (_model, input) => {
      if (fail) throw new Error('daily AI allowance spent')
      const system = String(input.messages?.[0]?.content || '')
      const user = String(input.messages?.[input.messages.length - 1]?.content || '')
      if (/chief examiner/i.test(system)) {
        calls.review += 1
        return { response: JSON.stringify([...user.matchAll(/^ID: (\S+)/gm)].map(match => ({ id: match[1], verdict: 'ok' }))) }
      }
      const slots = [...user.matchAll(/^\d+\. type "(\w+)", topic "([^"]+)", (\d+) mark/gm)]
      if (slots.length) {
        calls.generate += 1
        calls.writes.push(/UTME/.test(user) ? 'jamb' : /NECO/.test(user) ? 'neco' : /WASSCE/.test(user) ? 'waec' : 'class')
        return { response: JSON.stringify(slots.map(([, type, topic], index) => ({ type, prompt: `Q${calls.generate}-${index}: about ${topic}?`, options: ['A1', 'B1', 'C1', 'D1', 'E1'].map(option => `${option}-${calls.generate}-${index}`), answerIndex: 0, workingSteps: ['Because.'] }))) }
      }
      calls.other += 1
      return { response: '[]' }
    },
  }
}

async function setup() {
  const worker = (await import(`./build/worker.mjs?night=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, status TEXT);`)
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('ami-1', 'ami@ndovera.test', 'Ami', 'ami', '', 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('ami@ndovera.test', JSON.stringify({ name: 'Ami', email: 'ami@ndovera.test', role: 'ami', status: 'active' })).run()
  const calls = { generate: 0, review: 0, other: 0, writes: [] }
  const env = { APP_DB: db, JWT_SECRET: SECRET, AI: model(calls) }
  const ami = async (method, path, body) => {
    const token = await sign({ id: 'ami-1', role: 'ami', roles: ['ami'], tenantId: '', name: 'Ami', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  await ami('GET', '/api/ami/practice/builder')
  const stamp = new Date().toISOString()
  db.db.exec(`
    INSERT INTO exam_specs (id, exam_key, name, subject_key, subject, status, created_at, updated_at) VALUES ('j', 'JAMB', 'JAMB Physics', 'physics', 'Physics', 'published', '${stamp}', '${stamp}'), ('w', 'WASSCE', 'WAEC Physics', 'physics', 'Physics', 'published', '${stamp}', '${stamp}'), ('n', 'NECO', 'NECO Physics', 'physics', 'Physics', 'published', '${stamp}', '${stamp}');
    INSERT INTO exam_spec_topics (id, spec_id, topic, position, created_at, updated_at) VALUES ('wt1', 'w', 'Waves', 1, '${stamp}', '${stamp}'), ('wt2', 'w', 'Heat', 2, '${stamp}', '${stamp}'), ('jt', 'j', 'Motion', 1, '${stamp}', '${stamp}'), ('nt', 'n', 'Light', 1, '${stamp}', '${stamp}');
  `)
  // The cron at a moment in time, with the clock set for the scheduled job's own "now".
  const tick = async (iso, count = 1, runEnv = env) => {
    const RealDate = Date
    const fixed = new RealDate(iso).getTime()
    globalThis.Date = class extends RealDate {
      constructor(...args) { if (args.length) super(...args); else super(fixed) }
      static now() { return fixed }
    }
    try {
      for (let index = 0; index < count; index += 1) {
        const waits = []
        await worker.scheduled({ cron: '* * * * *', scheduledTime: fixed }, runEnv, { waitUntil: promise => waits.push(promise), passThroughOnException() {} })
        await Promise.allSettled(waits)
      }
    } finally { globalThis.Date = RealDate }
  }
  return { db, ami, calls, tick, env }
}

test('questions are written on Sunday and Wednesday only; other nights just check', async () => {
  const { calls, tick } = await setup()
  await tick(MONDAY, 3)
  assert.equal(calls.generate, 0, 'no writing on Monday')
  await tick(SUNDAY, 2)
  assert.ok(calls.generate >= 1, 'writing on Sunday')
  const sunday = calls.generate
  await tick(MONDAY, 2)
  assert.equal(calls.generate, sunday, 'Monday still writes nothing')
  assert.ok(calls.review >= 1, 'Monday checks what Sunday wrote')
  await tick(WEDNESDAY, 2)
  assert.ok(calls.generate > sunday, 'writing on Wednesday')
})

test('outside the last hour before the reset, night work does not run', async () => {
  const { calls, tick } = await setup()
  await tick('2026-11-08T00:30:00.000Z', 2) // 01:30 in Lagos: the new day's allowance belongs to schools
  await tick('2026-11-08T10:00:00.000Z', 2)
  assert.deepEqual([calls.generate, calls.review], [0, 0])
})

test('a saved budget of 100 cannot spend more than the cap, and the cap can be changed', async () => {
  const { db, ami, calls, tick, env } = await setup()
  assert.equal((await ami('PUT', '/api/ami/practice/builder', { batchesPerNight: 100 })).body.settings.batchesPerNight, 100)
  await tick(SUNDAY, 20)
  const nights = () => db.db.prepare(`SELECT steps FROM practice_build_nights WHERE day = '2026-11-08'`).get().steps
  assert.equal(nights(), 12)
  const spent = calls.generate + calls.review
  await tick(SUNDAY, 3, { ...env, AI_NIGHT_STEP_LIMIT: '14' })
  assert.equal(nights(), 14)
  assert.ok(calls.generate + calls.review > spent)
})

test('the examinations take turns, so one long queue keeps nobody waiting', async () => {
  const { calls, tick } = await setup()
  await tick(SUNDAY, 5) // every third step is a check
  assert.ok(calls.writes.length >= 3, JSON.stringify(calls.writes))
  assert.deepEqual([...new Set(calls.writes.slice(0, 3))].sort(), ['jamb', 'neco', 'waec'])
})

test('when the AI allowance runs out the night stops, and no topic is marked as stuck', async () => {
  const { db, calls, tick, env } = await setup()
  const failing = { ...env, AI: model(calls, { fail: true }) }
  await tick(SUNDAY, 4, failing)
  const nights = db.db.prepare(`SELECT steps, failures FROM practice_build_nights WHERE day = '2026-11-08'`).get()
  assert.deepEqual([nights.steps, nights.failures], [1, 1], 'one failure, then it waits for tomorrow')
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM practice_build_queue WHERE attempts > 0 OR status = 'stuck'`).get().n, 0)
  await tick(WEDNESDAY, 1)
  assert.ok(calls.generate >= 1, 'the next night carries on')
})

// Growth partners stay up to date: updates Ami publishes, an unread count, and Toolkit messages Ami can change.
import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim } from './d1-shim.mjs'
import { DEFAULT_TOOLKIT_MESSAGES, deletePartnerUpdate, listAllPartnerUpdates, partnerUpdatesFor, partnerUpdatesUnread, savePartnerUpdate, saveToolkitMessages, setPartnerUpdatePublished, toolkitMessages } from './build/requestedExams.mjs'

const UPDATE = { title: 'Bank transfer', body: 'Schools can now pay by bank transfer.', explain: 'Say it needs no card.' }

test('a draft stays hidden, and publishing shows it as new to each partner once', async () => {
  const db = new D1Shim()
  const id = await savePartnerUpdate(db, UPDATE, 'ami')
  assert.equal(await partnerUpdatesUnread(db, 'p1'), 0)
  assert.deepEqual(await partnerUpdatesFor(db, 'p1'), [])

  await setPartnerUpdatePublished(db, id, true)
  assert.equal(await partnerUpdatesUnread(db, 'p1'), 1)
  assert.equal(await partnerUpdatesUnread(db, 'p2'), 1)
  const [first] = await partnerUpdatesFor(db, 'p1')
  assert.equal(first.isNew, true)
  assert.equal(first.explain, 'Say it needs no card.')

  assert.equal(await partnerUpdatesUnread(db, 'p1'), 0, 'opening the page counts as seen')
  assert.equal((await partnerUpdatesFor(db, 'p1'))[0].isNew, false)
  assert.equal(await partnerUpdatesUnread(db, 'p2'), 1, 'other partners still have it as new')
})

test('taking an update down hides it, publishing again does not count it as new again, and it can be deleted', async () => {
  const db = new D1Shim()
  const id = await savePartnerUpdate(db, UPDATE, 'ami')
  await setPartnerUpdatePublished(db, id, true)
  await partnerUpdatesFor(db, 'p1')
  await setPartnerUpdatePublished(db, id, false)
  assert.deepEqual(await partnerUpdatesFor(db, 'p1'), [])
  await setPartnerUpdatePublished(db, id, true)
  assert.equal(await partnerUpdatesUnread(db, 'p1'), 0)
  await savePartnerUpdate(db, { ...UPDATE, title: 'Bank transfers' }, 'ami', id)
  assert.equal((await listAllPartnerUpdates(db))[0].title, 'Bank transfers')
  await deletePartnerUpdate(db, id)
  assert.deepEqual(await listAllPartnerUpdates(db), [])
  await assert.rejects(setPartnerUpdatePublished(db, id, true), /not found/)
})

test('an update needs a title and what changed', async () => {
  const db = new D1Shim()
  await assert.rejects(savePartnerUpdate(db, { title: '', body: 'Something changed here.' }, 'ami'), /title/)
  await assert.rejects(savePartnerUpdate(db, { title: 'A title', body: '' }, 'ami'), /what changed/)
})

test('the unread count reads from the index, and is capped', async () => {
  const db = new D1Shim()
  await partnerUpdatesUnread(db, 'p1')
  const plan = db.db.prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) AS n FROM (SELECT 1 FROM partner_updates WHERE status = 'published' AND published_at > 'x' LIMIT 50)`).all().map(row => row.detail).join(' ')
  assert.match(plan, /idx_partner_updates_published/, plan)
  for (let index = 0; index < 55; index += 1) await setPartnerUpdatePublished(db, await savePartnerUpdate(db, UPDATE, 'ami'), true)
  assert.equal(await partnerUpdatesUnread(db, 'p1'), 50)
})

test('Toolkit messages start with the safe set, and every saved message needs the partner\'s link', async () => {
  const db = new D1Shim()
  assert.deepEqual(await toolkitMessages(db), DEFAULT_TOOLKIT_MESSAGES)
  for (const item of DEFAULT_TOOLKIT_MESSAGES) {
    assert.ok(item.body.includes('{link}'), item.title)
    assert.doesNotMatch(item.body, /old(er)? phones?|bLiteb|WhatsApp notice|SMS|cedi|shilling/i, `${item.title} promises what is not proven yet`)
  }
  await assert.rejects(saveToolkitMessages(db, [{ title: 'No link', body: 'Hello' }], 'ami'), /\{link\}/)
  await assert.rejects(saveToolkitMessages(db, [], 'ami'), /at least one/)
  await assert.rejects(saveToolkitMessages(db, Array.from({ length: 13 }, () => ({ title: 'T', body: '{link}' })), 'ami'), /12/)
  await saveToolkitMessages(db, [{ title: 'Mine', body: 'Join here: {link}' }], 'ami')
  assert.equal((await toolkitMessages(db))[0].title, 'Mine')
})

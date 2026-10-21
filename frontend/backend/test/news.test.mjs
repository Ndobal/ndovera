import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim } from './d1-shim.mjs'
import { buildNewsEdition, readNews, parseFeed, lagosDate } from './build/news.mjs'

const rss = (site, titles) => `<?xml version="1.0"?><rss><channel><title>Feed</title>${titles.map((title, i) => `<item><title><![CDATA[${title}]]></title><link>${site}/story-${i}/</link><pubDate>Tue, 20 Oct 2026 0${i}:00:00 +0100</pubDate><description>Full text that must not be stored</description></item>`).join('')}</channel></rss>`

test('feeds are read as headline + link on the outlet\'s own site only', () => {
  const items = parseFeed(`<rss><channel>
    <item><title>Senate passes &amp; signs &#8216;bill&#8217;</title><link>https://punchng.com/a/</link></item>
    <item><title>Elsewhere</title><link>https://evil.example/a</link></item>
    <item><title>Script</title><link>javascript:alert(1)</link></item>
  </channel></rss>`, 'https://punchng.com')
  assert.deepEqual(items.map(item => [item.title, item.link]), [['Senate passes & signs ‘bill’', 'https://punchng.com/a/']])
})

test('one edition a day, kept as history; an outlet that fails does not stop the rest', async () => {
  const db = new D1Shim()
  const fetcher = async url => {
    if (url.includes('punchng')) return rss('https://punchng.com', ['Fuel price drops', 'WAEC releases results'])
    if (url.includes('vanguardngr')) return rss('https://www.vanguardngr.com', ['Super Eagles win'])
    throw new Error('HTTP 503')
  }
  const first = await buildNewsEdition(db, { edition: '2026-10-20', fetcher, now: new Date('2026-10-19T23:00:00Z') })
  assert.equal(first.saved, 3)
  assert.equal(first.outlets.tvc, 'HTTP 503')
  await buildNewsEdition(db, { edition: '2026-10-21', fetcher: async url => (url.includes('punchng') ? rss('https://punchng.com', ['New day headline']) : ''), now: new Date('2026-10-20T23:00:00Z') })
  // Running again for the same day adds nothing twice.
  await buildNewsEdition(db, { edition: '2026-10-21', fetcher: async url => (url.includes('punchng') ? rss('https://punchng.com', ['New day headline']) : ''), now: new Date('2026-10-20T23:20:00Z') })

  const latest = await readNews(db)
  assert.equal(latest.edition, '2026-10-21')
  assert.deepEqual(latest.editions.map(item => item.edition), ['2026-10-21', '2026-10-20'])
  assert.deepEqual(latest.outlets.map(item => [item.name, item.headlines.length]), [['Punch', 1]])
  const older = await readNews(db, '2026-10-20')
  assert.deepEqual(older.outlets.map(item => item.name), ['Punch', 'Vanguard'])
  assert.equal(older.outlets[0].headlines[0].title, 'Fuel price drops')
  assert.ok(!JSON.stringify(older).includes('must not be stored'))
})

test('the edition is the Lagos date', () => {
  assert.equal(lagosDate(new Date('2026-10-20T23:00:00Z')), '2026-10-21')
  assert.equal(lagosDate(new Date('2026-10-20T22:59:00Z')), '2026-10-20')
})

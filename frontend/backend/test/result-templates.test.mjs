import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim } from './d1-shim.mjs'
import { PROGRESS_TEMPLATES, defaultTemplateFor, loadEarlierTermTotals, normalizePage2, normalizeProfileExtra, page2For, termSlotOf, templateForTerm } from './build/resultTemplates.mjs'

test('term names are read however schools write them', () => {
  assert.deepEqual(['First Term', '1st term', 'Term 2', 'SECOND TERM', '3RD TERM', 'third term', 'Holiday'].map(termSlotOf), ['first', 'first', 'second', 'second', 'third', 'third', ''])
})

test('every section defaults to its report card per term; a school or Ndovera choice wins', () => {
  assert.equal(templateForTerm({ section: 'nursery', templateKey: 'premium-ledger' }, 'First Term'), 'nursery-progress-term')
  assert.equal(templateForTerm({ section: 'nursery' }, 'Third Term'), 'nursery-progress-session')
  assert.equal(templateForTerm({ section: 'primary' }, '2nd Term'), 'primary-result-term')
  assert.equal(templateForTerm({ section: 'secondary' }, '3rd Term'), 'secondary-report-session')
  assert.equal(templateForTerm({ section: 'primary', metadata: { termTemplates: { third: 'glass-crest' } } }, 'Third Term'), 'glass-crest')
  // School-wide settings (no section) keep their own template.
  assert.equal(templateForTerm({ section: '', templateKey: 'montessori-grid' }, 'First Term'), 'montessori-grid')
  assert.equal(defaultTemplateFor('secondary'), 'secondary-report-term')
  assert.deepEqual(PROGRESS_TEMPLATES.filter(item => item.layout.cumulative).map(item => item.terms), [['third'], ['third'], ['third']])
})

test('page 2 is the school\'s own when set, else the template\'s; limits and keys are safe', () => {
  assert.equal(page2For({}, 'nursery-progress-term').mode, 'checklist')
  assert.equal(page2For({}, 'primary-result-session').mode, 'rating')
  assert.equal(page2For({}, 'secondary-report-term'), null)
  const own = normalizePage2({ title: 'Our Skills', mode: 'rating', sections: [{ title: 'Reading', items: ['Reads aloud', { label: 'Spells' }, ''] }, { title: 'Empty', items: [] }] })
  assert.deepEqual([own.title, own.sections.length, own.sections[0].items.map(item => item.label)], ['Our Skills', 1, ['Reads aloud', 'Spells']])
  assert.equal(page2For({ metadata: { page2: own } }, 'nursery-progress-term').title, 'Our Skills')
  assert.equal(page2For({ metadata: { page2: { ...own, enabled: false } } }, 'nursery-progress-term'), null)
  const extra = normalizeProfileExtra({ heightStart: '117', weightEnd: 26, daysAbsent: '', page2: { a: 'yes', b: 'x'.repeat(50), evil: 'yes' } }, new Set(['a', 'b']))
  assert.deepEqual(extra, { heightStart: '117', weightEnd: '26', page2: { a: 'yes', b: 'x'.repeat(20) } })
})

test('the 3rd-term layouts read the 1st and 2nd term totals from the C.A. score sheet of the same session', async () => {
  const db = new D1Shim()
  db.db.exec(`
    CREATE TABLE result_batches (id TEXT PRIMARY KEY, tenant_id TEXT, session_name TEXT, term_name TEXT);
    CREATE TABLE result_ca_entries (id TEXT PRIMARY KEY, batch_id TEXT, student_id TEXT, subject_name TEXT, ca_score REAL, exam_score REAL);
    INSERT INTO result_batches VALUES ('b1', 't', '2025/2026', 'First Term'), ('b2', 't', '2025/2026', 'Second Term'), ('b3', 't', '2025/2026', 'Third Term'), ('old', 't', '2024/2025', 'First Term'), ('x', 'other', '2025/2026', 'First Term');
    INSERT INTO result_ca_entries VALUES ('e1', 'b1', 's1', 'Numeracy', 58, 40), ('e2', 'b2', 's1', 'numeracy ', 42, 40), ('e3', 'b3', 's1', 'Numeracy', 60, 38),
      ('e4', 'old', 's1', 'Numeracy', 10, 10), ('e5', 'x', 's1', 'Numeracy', 1, 1);
  `)
  const totals = await loadEarlierTermTotals(db, 't', '2025/2026', 'Third Term', ['s1'])
  assert.deepEqual(totals.get('s1').get('numeracy'), { first: 98, second: 82 })
})

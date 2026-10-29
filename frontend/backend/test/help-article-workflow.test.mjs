import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertArticleEditor, assertArticleTransition, validateArticleContent,
} from './build/helpArticleWorkflow.mjs';

const author = { userId: 'teacher-admin-1', tenantId: 'school-1', role: 'hos' };
const reviewer = { userId: 'school-owner-2', tenantId: 'school-1', role: 'owner' };
const sample = {
  title: 'Check a receipt', category: 'Finance', keywords: 'payment',
  roles: ['parent', 'owner'], steps: ['Select the correct school term.'],
};

test('valid article content preserves role audience and instructions', () => {
  assert.deepEqual(validateArticleContent(sample).roles, ['parent', 'owner']);
  assert.equal(validateArticleContent(sample).steps.length, 1);
});

test('rejects invalid roles, duplicate roles and excessive instructions', () => {
  assert.throws(() => validateArticleContent({ ...sample, roles: ['parent', 'parent'] }));
  assert.throws(() => validateArticleContent({ ...sample, roles: ['ami'] }));
  assert.throws(() => validateArticleContent({ ...sample, steps: [] }));
  assert.throws(() => validateArticleContent({ ...sample, steps: ['x'.repeat(1501)] }));
});

test('only owner and HOS can edit tenant articles', () => {
  assert.equal(assertArticleEditor(author).tenantId, 'school-1');
  assert.throws(() => assertArticleEditor({ ...author, role: 'student' }));
  assert.throws(() => assertArticleEditor({ ...author, tenantId: '' }));
});

test('author cannot approve own article, independent reviewer can', () => {
  assert.throws(() => assertArticleTransition('in_review', 'approved', author.userId, author));
  assert.doesNotThrow(() => assertArticleTransition('in_review', 'approved', author.userId, reviewer));
});

test('only supported publishing transitions are accepted', () => {
  assert.doesNotThrow(() => assertArticleTransition('draft', 'in_review', author.userId, author));
  assert.doesNotThrow(() => assertArticleTransition('approved', 'published', author.userId, reviewer));
  assert.throws(() => assertArticleTransition('draft', 'published', author.userId, reviewer));
  assert.throws(() => assertArticleTransition('published', 'approved', author.userId, reviewer));
  assert.throws(() => assertArticleTransition('archived', 'published', author.userId, reviewer));
});

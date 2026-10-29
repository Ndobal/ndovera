import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateHelpRequestInput,
  validateHelpActor,
  assertHelpStaffRole,
} from './build/helpRequests.mjs';

test('support request rejects empty, oversized and malformed fields', () => {
  assert.throws(() => validateHelpRequestInput({ subject: '', description: 'Details' }));
  assert.throws(() => validateHelpRequestInput({ subject: 'A', description: 'x'.repeat(4001) }));
  assert.throws(() => validateHelpRequestInput({ subject: 'A', description: 'B', page: 'https://example.org' }));
  assert.deepEqual(validateHelpRequestInput({
    subject: '  Missing result  ',
    description: ' Please check ',
    page: '/roles/parent/results',
  }), {
    subject: 'Missing result',
    description: 'Please check',
    category: '',
    page: '/roles/parent/results',
  });
});

test('actor requires actual server-derived strings', () => {
  assert.throws(() => validateHelpActor({ userId: 5, tenantId: 'school', role: 'owner' }));
  assert.throws(() => validateHelpActor({ userId: 'u', tenantId: '', role: 'owner' }));
  assert.equal(validateHelpActor({ userId: 'u', tenantId: 'school', role: 'student' }).userId, 'u');
});

test('tenant support permissions reject students and platform-wide AMI', () => {
  assert.throws(() => assertHelpStaffRole({ userId: 'u', tenantId: 't', role: 'student' }));
  assert.throws(() => assertHelpStaffRole({ userId: 'u', tenantId: 't', role: 'ami' }));
  assert.equal(assertHelpStaffRole({ userId: 'u', tenantId: 't', role: 'owner' }).role, 'owner');
});

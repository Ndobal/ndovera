import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePremisesSecurityRoute } from './build/premisesSecurity.mjs';

const actor = { userId: 'officer1', tenantId: 'schoolA', role: 'securityofficer' };
const request = (path, method = 'GET', data) => new Request('https://school.test' + path, {
  method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
});
const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
test('unrelated API route is ignored', async () => {
  assert.equal(await handlePremisesSecurityRoute(request('/api/finance'), db, actor), null);
});
test('unauthenticated user cannot view security records', async () => {
  const result = await handlePremisesSecurityRoute(request('/api/premises-security/overview'), db, null);
  assert.equal(result.status, 401);
});
test('students cannot view premises security records', async () => {
  const result = await handlePremisesSecurityRoute(request('/api/premises-security/overview'), db, { ...actor, role: 'student' });
  assert.equal(result.status, 403);
});
test('officers cannot resolve incidents', async () => {
  const result = await handlePremisesSecurityRoute(request('/api/premises-security/records/00000000-0000-0000-0000-000000000001/status', 'PATCH', { status: 'resolved' }), db, actor);
  assert.equal(result.status, 403);
});
test('invalid incident payload is rejected', async () => {
  const result = await handlePremisesSecurityRoute(request('/api/premises-security/records', 'POST', { kind: 'incident', title: '' }), db, actor);
  assert.equal(result.status, 400);
});

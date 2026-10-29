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

test('checkout requires authenticated school security role', async () => {
  const path = '/api/premises-security/records/00000000-0000-0000-0000-000000000001/checkout';
  assert.equal((await handlePremisesSecurityRoute(request(path, 'PATCH'), db, null)).status, 401);
  assert.equal((await handlePremisesSecurityRoute(request(path, 'PATCH'), db, { ...actor, role: 'parent' })).status, 403);
});
test('audit history requires authenticated school security role', async () => {
  const path = '/api/premises-security/records/00000000-0000-0000-0000-000000000001/events';
  assert.equal((await handlePremisesSecurityRoute(request(path), db, null)).status, 401);
  assert.equal((await handlePremisesSecurityRoute(request(path), db, { ...actor, role: 'student' })).status, 403);
});

test('only supervisors can acknowledge escalated incidents', async () => {
  const path = '/api/premises-security/records/00000000-0000-0000-0000-000000000001/acknowledge';
  const response = await handlePremisesSecurityRoute(request(path, 'PATCH'), db, actor);
  assert.equal(response.status, 403);
});
test('unauthenticated users cannot escalate incidents', async () => {
  const path = '/api/premises-security/records/00000000-0000-0000-0000-000000000001/escalate';
  const response = await handlePremisesSecurityRoute(request(path, 'PATCH'), db, null);
  assert.equal(response.status, 401);
});

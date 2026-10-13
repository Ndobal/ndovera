import { buildSelectedRoleHeader, getStoredAuth } from './authApi';

// A teacher who is also Head of School works as HOS. The server re-issues the
// sign-in cookie on every request, so the cookie is routinely newer than the
// stored token; that must not drop them back to "teacher" (every HOS page then
// answered "forbidden" until a reload).

const encode = value => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = payload => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload })}.sig`;
const hos = { id: 'tola@school', role: 'teacher', roles: ['teacher', 'hos'], switchableRoles: ['teacher', 'hos'], tenantId: 'school-a', name: 'Tola' };

function setCookie(value) {
  document.cookie = `ndovera_token=${encodeURIComponent(value)}; path=/`;
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = 'ndovera_token=; path=/; max-age=0';
});

test('a refreshed cookie for the same person keeps the role they chose', () => {
  window.localStorage.setItem('token', token({ ...hos, iat: 1 }));
  window.localStorage.setItem('authUser', JSON.stringify(hos));
  window.localStorage.setItem('selectedRole', 'hos');
  setCookie(token({ ...hos, role: 'hos', iat: 2 }));

  getStoredAuth();
  expect(window.localStorage.getItem('selectedRole')).toBe('hos');
  expect(buildSelectedRoleHeader()).toEqual({ 'X-Selected-Role': 'hos' });
});

test('a cookie for a different person forgets the previous role', () => {
  window.localStorage.setItem('token', token(hos));
  window.localStorage.setItem('authUser', JSON.stringify(hos));
  window.localStorage.setItem('selectedRole', 'hos');
  setCookie(token({ id: 'kemi@school', role: 'teacher', roles: ['teacher'], switchableRoles: ['teacher'], tenantId: 'school-a', name: 'Kemi' }));

  getStoredAuth();
  expect(window.localStorage.getItem('selectedRole')).toBeNull();
});

import { readFileSync } from 'fs';
import path from 'path';

// A page that needs no account must be on the public list. If it is not, the app wraps it in the signed-in frame and a
// visitor is sent to the home page. This broke /features, and the links parents and helpers are sent: /invite and /pay.
const source = readFileSync(path.resolve(__dirname, '../App.js'), 'utf8');
const listStart = source.indexOf('const PUBLIC_ROUTE_PATHS');
const exact = [...source.slice(listStart, source.indexOf(']);', listStart)).matchAll(/'(\/[^']*)'/g)].map(match => match[1]);
const prefixLine = /const PUBLIC_ROUTE_PREFIXES = \[([^\]]*)\]/.exec(source)[1];
const prefixes = [...prefixLine.matchAll(/'(\/[^']*)'/g)].map(match => match[1]);
const isPublic = route => exact.includes(route) || prefixes.some(prefix => route.startsWith(prefix));

test('every page open to visitors is on the public list', () => {
  const open = [...source.matchAll(/<Route path="([^"]+)" element=\{(.{0,70})/g)]
    .filter(match => !/RequireAuth|RoleGuard/.test(match[2]) && !match[1].startsWith('/roles/'))
    .map(match => match[1]);
  expect(open.length).toBeGreaterThan(10);
  expect(open.filter(route => !isPublic(route))).toEqual([]);
});

test('the links people are sent work without an account', () => {
  ['/features', '/invite/abc', '/pay/abc', '/bank-pay/abc', '/c/abc', '/invoice/abc'].forEach(route => expect(isPublic(route)).toBe(true));
});

test('a signed-in page stays signed in', () => {
  ['/roles/student', '/roles/owner/people', '/exams', '/settings'].forEach(route => expect(isPublic(route)).toBe(false));
});

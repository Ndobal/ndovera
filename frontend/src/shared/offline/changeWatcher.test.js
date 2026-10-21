import { checkNow, getConnectionStatus, resetChangeWatcher, subscribeChanges, subscribeConnection } from './changeWatcher';

jest.mock('../../features/auth/services/authApi', () => ({
  getStoredAuth: () => ({ token: 'token-1' }),
  buildSelectedRoleHeader: () => ({}),
}));

const reply = (status, body = {}, headers = {}) => Promise.resolve({
  status, ok: status >= 200 && status < 300,
  headers: { get: name => headers[name] || null },
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  resetChangeWatcher();
  global.fetch = jest.fn();
});

test('panels hear about a change only when a stamp moved', async () => {
  const heard = [];
  subscribeChanges(kinds => heard.push(kinds));
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 3, user: 1 }));
  await checkNow();
  expect(heard).toEqual([]); // the first answer is the baseline
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 3, user: 1 }));
  await checkNow();
  expect(heard).toEqual([]);
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 4, user: 1 }));
  await checkNow();
  expect(heard).toEqual([['tenant']]);
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 4, user: 2 }));
  await checkNow();
  expect(heard).toEqual([['tenant'], ['user']]);
  expect(global.fetch.mock.calls[0][1].headers['X-No-Offline-Cache']).toBe('1');
});

test('a busy or unreachable server is treated like being offline, and recovery is noticed', async () => {
  const statuses = [];
  subscribeConnection(status => statuses.push(status));
  global.fetch.mockReturnValueOnce(reply(503, { success: false }));
  await checkNow();
  // One failure on a patchy connection says nothing yet; a second in a row shows the notice.
  expect(getConnectionStatus()).toBe('ok');
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  await checkNow();
  expect(getConnectionStatus()).toBe('unavailable');
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 1, user: 0 }));
  await checkNow();
  expect(statuses).toEqual(['unavailable', 'ok']);
});

test('one slow or failed check does not show the busy notice; a good answer clears the count', async () => {
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  await checkNow();
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 1, user: 0 }));
  await checkNow();
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  await checkNow();
  expect(getConnectionStatus()).toBe('ok');
});

test('an expired session is not mistaken for an outage', async () => {
  global.fetch.mockReturnValueOnce(reply(401, { error: 'invalid token' }));
  await checkNow();
  expect(getConnectionStatus()).toBe('ok');
});

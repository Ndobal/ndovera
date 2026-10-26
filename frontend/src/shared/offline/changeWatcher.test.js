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

test('only Ndovera answering 502/503/504 is "Ndovera is busy", and recovery is noticed', async () => {
  const statuses = [];
  subscribeConnection(status => statuses.push(status));
  global.fetch.mockReturnValueOnce(reply(503, { success: false }));
  await checkNow();
  // One failure on a patchy connection says nothing yet; a second in a row shows the notice.
  expect(getConnectionStatus()).toBe('ok');
  global.fetch.mockReturnValueOnce(reply(503, { success: false }));
  await checkNow();
  expect(getConnectionStatus()).toBe('unavailable');
  global.fetch.mockReturnValueOnce(reply(200, { tenant: 1, user: 0 }));
  await checkNow();
  expect(statuses).toEqual(['unavailable', 'ok']);
});

test("no answer at all is the person's own network, not Ndovera", async () => {
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  await checkNow();
  global.fetch.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  await checkNow();
  expect(getConnectionStatus()).toBe('poor');
});

test("the app's saved copies say why they were used: a slow network is the person's, a refusal is Ndovera's", async () => {
  global.fetch.mockReturnValue(reply(200, { tenant: 1 }, { 'X-Ndovera-Offline': 'slow' }));
  await checkNow();
  await checkNow();
  expect(getConnectionStatus()).toBe('poor');
  resetChangeWatcher();
  global.fetch.mockReturnValue(reply(503, { success: false, offline: true }, { 'X-Ndovera-Offline': 'network' }));
  await checkNow();
  await checkNow();
  expect(getConnectionStatus()).toBe('poor');
  resetChangeWatcher();
  global.fetch.mockReturnValue(reply(200, { tenant: 1 }, { 'X-Ndovera-Offline': 'server' }));
  await checkNow();
  await checkNow();
  expect(getConnectionStatus()).toBe('unavailable');
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

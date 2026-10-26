import { OFFLINE_MESSAGE, POOR_NETWORK_MESSAGE, installFriendlyNetworkErrors, statusForFailure } from './networkErrors';

const setOnline = online => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });

afterEach(() => setOnline(true));

test('a request with no answer reads as the person\'s network, in words they can act on', async () => {
  window.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
  installFriendlyNetworkErrors();
  await expect(window.fetch('/api/x')).rejects.toThrow(POOR_NETWORK_MESSAGE);
  setOnline(false);
  await expect(window.fetch('/api/x')).rejects.toThrow(OFFLINE_MESSAGE);
});

test('only a 502/503/504 from Ndovera is blamed on Ndovera', () => {
  expect(statusForFailure({ status: 503 })).toBe('unavailable');
  expect(statusForFailure(new TypeError('Failed to fetch'))).toBe('poor');
  setOnline(false);
  expect(statusForFailure(new TypeError('Failed to fetch'))).toBe('offline');
});

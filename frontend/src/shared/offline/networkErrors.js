// Saying whose connection failed. Almost every failed request is the person's own network
// (no signal, data bundle finished, slow mobile data, Wi-Fi without internet), not Ndovera:
// when Ndovera itself is down or overloaded it still answers, with 502/503/504. So a request
// that gets no answer at all is described as the person's connection, in words they can act on.

export const OFFLINE_MESSAGE = 'You are offline: this phone or computer is not connected to the internet. Turn on mobile data or Wi-Fi and try again.';
export const POOR_NETWORK_MESSAGE = 'Your network (mobile data or Wi-Fi) is too weak or slow to reach Ndovera right now. Check your signal or data bundle, or move to a spot with better reception, and try again.';
export const SERVER_BUSY_MESSAGE = 'Ndovera is very busy right now. Please try again in a few minutes.';

export function deviceOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** The message for a request that got no answer at all. */
export function networkFailureMessage() {
  return deviceOffline() ? OFFLINE_MESSAGE : POOR_NETWORK_MESSAGE;
}

/**
 * The connection status a failed request points to: 'unavailable' only when Ndovera answered
 * that it is down or busy (502/503/504); otherwise 'offline' or 'poor' (the person's network).
 */
export function statusForFailure(error) {
  if ([502, 503, 504].includes(Number(error?.status))) return 'unavailable';
  return deviceOffline() ? 'offline' : 'poor';
}

/**
 * Browsers report a request that never got an answer as "Failed to fetch", "Load failed" or
 * "NetworkError when attempting to fetch resource" — words that read like Ndovera is broken.
 * Every page shows error.message, so the message is replaced once, here, for the whole app.
 */
export function installFriendlyNetworkErrors() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch.ndoveraFriendly) return;
  const nativeFetch = window.fetch.bind(window);
  const friendlyFetch = (...args) => nativeFetch(...args).catch(error => {
    if (error?.name !== 'TypeError') throw error;
    const friendly = new TypeError(networkFailureMessage());
    friendly.cause = error;
    friendly.network = true;
    throw friendly;
  });
  friendlyFetch.ndoveraFriendly = true;
  window.fetch = friendlyFetch;
}

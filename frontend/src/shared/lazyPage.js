import { lazy } from 'react';

const RELOAD_KEY = 'ndv-stale-reload';

/**
 * A page that downloads only when someone opens it, so the first screen does not wait for every page of the app.
 * If its file cannot load, usually because a new version went live, the page reloads once to pick up the current build.
 * A second failure goes to the error screen, so this can never loop.
 */
export default function lazyPage(load) {
  return lazy(() => load().catch(error => {
    if (window.navigator.onLine === false) throw error;
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 30000) throw error;
      window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch (stopped) {
      throw error;
    }
    window.location.reload();
    return new Promise(() => {});
  }));
}

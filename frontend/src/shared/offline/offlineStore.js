// A small key-value store on IndexedDB for what must survive without a connection:
// practice packs, quiz attempts waiting to sync, Ndovera notes, queued sign-ins.
// IndexedDB holds far more than localStorage (a face capture alone can fill
// localStorage), and survives the app being closed. Where IndexedDB is missing
// (old browsers, private mode, tests) the same calls work in memory.

const DB_NAME = 'ndovera-offline';
const DB_VERSION = 1;
const STORES = ['kv', 'outbox'];

let dbPromise = null;
const memory = { kv: new Map(), outbox: new Map() };

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) { resolve(null); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(store, mode, action) {
  return openDb().then(db => {
    if (!db) return action(null);
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getItem(key, store = 'kv') {
  try {
    const value = await run(store, 'readonly', objectStore => (objectStore ? objectStore.get(key) : null));
    return value === undefined || value === null ? (memory[store].get(key) ?? null) : value;
  } catch {
    return memory[store].get(key) ?? null;
  }
}

export async function setItem(key, value, store = 'kv') {
  memory[store].set(key, value);
  try {
    await run(store, 'readwrite', objectStore => (objectStore ? objectStore.put(value, key) : null));
  } catch {}
  return value;
}

export async function removeItem(key, store = 'kv') {
  memory[store].delete(key);
  try {
    await run(store, 'readwrite', objectStore => (objectStore ? objectStore.delete(key) : null));
  } catch {}
}

/** Every [key, value] in a store whose key starts with `prefix`. */
export async function entries(prefix = '', store = 'kv') {
  const found = new Map();
  for (const [key, value] of memory[store]) if (String(key).startsWith(prefix)) found.set(key, value);
  try {
    const db = await openDb();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const request = tx.objectStore(store).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (String(cursor.key).startsWith(prefix)) found.set(cursor.key, cursor.value);
          cursor.continue();
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {}
  return Array.from(found.entries());
}

/** Whose data this is: offline data never crosses from one signed-in person to another. */
export function currentUserKey() {
  try {
    const raw = window.localStorage.getItem('authUser') || window.localStorage.getItem('ndovera_auth') || '';
    const parsed = raw ? JSON.parse(raw) : null;
    const user = parsed?.user || parsed || {};
    return String(user.id || user.email || 'guest').trim().toLowerCase() || 'guest';
  } catch {
    return 'guest';
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Ask the browser to keep our offline data when space runs low. */
export function requestPersistentStorage() {
  try {
    if (navigator?.storage?.persist) navigator.storage.persist().catch(() => null);
  } catch {}
}

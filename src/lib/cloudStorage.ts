// A synchronous, localStorage-shaped cache backed by Cloudflare D1
// (via /api/data) instead of the browser. This is what lets every
// existing hook/page that used to call `localStorage.getItem/setItem`
// keep exactly the same code shape — only the storage backend changed,
// from "this device" to "this account, on any device".
//
// How it works:
//  1. On sign-in, `init()` fetches the whole per-user JSON blob once and
//     fills an in-memory cache.
//  2. `getItem`/`setItem`/`removeItem` read/write that in-memory cache
//     synchronously (so existing `useState(() => loadFromStorage(...))`
//     initializers keep working unchanged).
//  3. Every write schedules a debounced save back to the server; a save
//     is also flushed immediately when the tab is hidden/closed.
//
// Nothing here ever touches window.localStorage/sessionStorage.

type Cache = Record<string, string>;

let cache: Cache = {};
let ready = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const readyListeners: Array<() => void> = [];

const DATA_URL = '/api/data';
const SAVE_DEBOUNCE_MS = 700;

async function loadFromCloud(): Promise<void> {
  ready = false;
  cache = {};
  try {
    const res = await fetch(DATA_URL, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      if (json && typeof json.data === 'object' && json.data) cache = json.data as Cache;
    }
  } catch {
    // Offline or network error on first load — app still works with an
    // empty cache; nothing is lost since nothing has been written yet.
  } finally {
    ready = true;
    readyListeners.forEach(fn => fn());
    readyListeners.length = 0;
  }
}

async function flush(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  try {
    await fetch(DATA_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cache }),
    });
  } catch {
    dirty = true; // retry on the next change or the next flush
  }
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
}

function flushBeacon() {
  if (!dirty) return;
  try {
    const blob = new Blob([JSON.stringify({ data: cache })], { type: 'application/json' });
    const sent = navigator.sendBeacon(DATA_URL, blob);
    if (sent) dirty = false;
  } catch {
    // ignore — best effort only
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeacon();
  });
  window.addEventListener('pagehide', flushBeacon);
}

export const cloudStorage = {
  /** Call once right after a user is confirmed signed in. */
  init(): Promise<void> {
    return loadFromCloud();
  },
  /** True once the initial fetch (success or failure) has completed. */
  isReady(): boolean {
    return ready;
  },
  onReady(cb: () => void) {
    if (ready) cb();
    else readyListeners.push(cb);
  },
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
  },
  setItem(key: string, value: string) {
    cache[key] = value;
    scheduleSave();
  },
  removeItem(key: string) {
    delete cache[key];
    scheduleSave();
  },
  /** Reset the in-memory cache only (used on logout, before the next sign-in). */
  resetLocal() {
    cache = {};
    ready = false;
    dirty = false;
    if (saveTimer) clearTimeout(saveTimer);
  },
  /** Force an immediate save, bypassing the debounce (e.g. before navigation). */
  flushNow(): Promise<void> {
    return flush();
  },
};

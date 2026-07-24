// The AI provider keys set in Admin → AI Keys are global (shared by every
// learner's account), not per-user, so they live in their own tiny cache
// backed by /api/config instead of the per-user blob in cloudStorage.ts.

export interface AdminAiConfig {
  google: string;
  elevenlabs: string;
  elevenVoice: string;
}

const DEFAULT_CONFIG: AdminAiConfig = { google: '', elevenlabs: '', elevenVoice: 'JBFqnCBsd6RMkjVDRZzb' };

let cache: AdminAiConfig = { ...DEFAULT_CONFIG };
let ready = false;
const readyListeners: Array<() => void> = [];

const CONFIG_URL = '/api/config';

export const adminConfig = {
  async init(): Promise<void> {
    ready = false;
    try {
      const res = await fetch(CONFIG_URL, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        cache = {
          google: json.google || '',
          elevenlabs: json.elevenlabs || '',
          elevenVoice: json.elevenVoice || DEFAULT_CONFIG.elevenVoice,
        };
      }
    } catch {
      // Offline — keep whatever was last cached in memory this session.
    } finally {
      ready = true;
      readyListeners.forEach(fn => fn());
      readyListeners.length = 0;
    }
  },
  isReady(): boolean {
    return ready;
  },
  onReady(cb: () => void) {
    if (ready) cb();
    else readyListeners.push(cb);
  },
  get(): AdminAiConfig {
    return cache;
  },
  /** Admin-only: persists new keys to D1 for every learner's account. */
  async save(next: AdminAiConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(CONFIG_URL, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || `Save failed (${res.status})` };
      }
      cache = { ...next };
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Network error' };
    }
  },
};

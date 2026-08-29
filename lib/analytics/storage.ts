/**
 * Lazy, never-throwing AsyncStorage for the analytics module.
 *
 * Extracted from `AnalyticsService` when the second and third analytics stores
 * (experiment assignments, feature adoption) needed exactly the same three
 * properties, and copying twenty lines twice would have meant three places to
 * get the TurboModule guard wrong.
 *
 * The three properties, all load-bearing:
 *  - **Lazy.** `@react-native-async-storage/async-storage` is a native module;
 *    requiring it at module load is how this repo's iOS 26 TurboModule crash
 *    reached boot (CLAUDE.md §4.6). It is required inside a function, inside a
 *    try/catch, on first use.
 *  - **Cooled-down retry.** A failed require is retried at most every couple of
 *    seconds, so a genuinely absent module costs one attempt per window rather
 *    than one per event.
 *  - **Never throws.** A read that fails returns `null` and a write that fails
 *    is dropped. Telemetry that cannot persist is telemetry that loses a
 *    session of accuracy; telemetry that throws is a crash in the player's game.
 */

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
};

let realStorage: AsyncStorageLike | null = null;
let lastLoadAttempt = 0;
const LOAD_RETRY_COOLDOWN_MS = 2000;

function getLazyAsyncStorage(): AsyncStorageLike | null {
  if (realStorage) return realStorage;
  const now = Date.now();
  if (lastLoadAttempt > 0 && now - lastLoadAttempt < LOAD_RETRY_COOLDOWN_MS) return null;
  lastLoadAttempt = now;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    realStorage = require('@react-native-async-storage/async-storage').default as AsyncStorageLike;
    return realStorage;
  } catch {
    return null;
  }
}

export const analyticsStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const store = getLazyAsyncStorage();
      return store ? await store.getItem(key) : null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const store = getLazyAsyncStorage();
      if (store) await store.setItem(key, value);
    } catch {
      /* best-effort */
    }
  },
};

/**
 * Read and JSON-parse a record, returning null on absence, malformed JSON, or
 * anything that is not a plain object.
 *
 * Parsing lives here rather than at each call site because every analytics
 * store wants the same answer to "the cache is corrupt": start fresh. A caller
 * that gets `null` creates a new record; a caller handed a half-parsed object
 * would carry the corruption forward into the data.
 */
export async function readJsonRecord(key: string): Promise<Record<string, unknown> | null> {
  const raw = await analyticsStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

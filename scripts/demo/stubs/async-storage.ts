/**
 * In-memory `@react-native-async-storage/async-storage` stand-in for the
 * demo-save generator (see `stubs/react-native.ts` for why these exist).
 *
 * `utils/saveValidation` lazily `require()`s AsyncStorage for the
 * double-buffer read/write helpers. The generator never calls those — it emits
 * the envelope and lets Playwright write it into the browser's localStorage —
 * but the module has to resolve.
 */

const store = new Map<string, string>();

export const AsyncStorageStub = {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
  getAllKeys: async (): Promise<string[]> => [...store.keys()],
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    keys.map((k) => [k, store.get(k) ?? null]),
  multiSet: async (pairs: [string, string][]): Promise<void> => {
    for (const [k, v] of pairs) store.set(k, v);
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    for (const k of keys) store.delete(k);
  },
};

export default AsyncStorageStub;

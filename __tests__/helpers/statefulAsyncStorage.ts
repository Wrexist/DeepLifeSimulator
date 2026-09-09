/** Read-after-write storage for simulations that exercise real save I/O. */
export function createStatefulAsyncStorageMock() {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    clear: jest.fn(async () => { values.clear(); }),
    getAllKeys: jest.fn(async () => [...values.keys()]),
    multiGet: jest.fn(async (keys: string[]) => keys.map(key => [key, values.get(key) ?? null])),
    multiSet: jest.fn(async (pairs: [string, string][]) => {
      for (const [key, value] of pairs) values.set(key, value);
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      for (const key of keys) values.delete(key);
    }),
  };
  return { __esModule: true, default: storage, ...storage };
}

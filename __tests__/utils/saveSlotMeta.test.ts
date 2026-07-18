/**
 * Unit tests for the per-slot save metadata cache (utils/saveSlotMeta.ts).
 *
 * Covers: defensive clamping in extractSaveSlotMeta, write/read round-trip,
 * malformed-read → null, delete, the raw existence probe, and the one-time
 * legacy backfill in ensureSaveSlotMeta (seeded with a REAL signed envelope via
 * the same helpers the app uses — mirrors __tests__/save/currentSlotSync.test.ts).
 */

// Stateful in-memory AsyncStorage: the shared jest.setup mock is a no-op that
// can't round-trip. This lets writeSaveSlotMeta/readSaveSlotMeta persist AND the
// real double-buffer save/load path (used by ensureSaveSlotMeta's backfill) work.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const mock = {
    getItem: jest.fn((k: string) => Promise.resolve(store.has(k) ? store.get(k)! : null)),
    setItem: jest.fn((k: string, v: string) => {
      store.set(k, String(v));
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      store.delete(k);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve([...store.keys()])),
    multiGet: jest.fn((ks: string[]) =>
      Promise.resolve(ks.map((k) => [k, store.has(k) ? store.get(k)! : null]))
    ),
    multiSet: jest.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => store.set(k, String(v)));
      return Promise.resolve();
    }),
    multiRemove: jest.fn((ks: string[]) => {
      ks.forEach((k) => store.delete(k));
      return Promise.resolve();
    }),
  };
  return { __esModule: true, default: mock, ...mock };
});

import {
  extractSaveSlotMeta,
  saveSlotMetaKey,
  writeSaveSlotMeta,
  readSaveSlotMeta,
  deleteSaveSlotMeta,
  ensureSaveSlotMeta,
  probeSaveSlotBlob,
  type SaveSlotMeta,
} from '@/utils/saveSlotMeta';
import { createSaveEnvelope, doubleBufferSave } from '@/utils/saveValidation';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;

const meaningfulState = {
  userProfile: { firstName: 'Ada', lastName: 'Lovelace' },
  date: { age: 27 },
  stats: { money: 5000 },
  weeksLived: 140,
  updatedAt: 1_700_000_000_000,
  version: 19,
};

/** Persist a real signed envelope into a slot via the production double-buffer path. */
async function seedSlot(slot: number, state: object): Promise<void> {
  const envelope = createSaveEnvelope(JSON.stringify(state));
  const result = await doubleBufferSave(`save_slot_${slot}`, envelope);
  if (!result.success) throw new Error(`Failed to seed slot ${slot}: ${result.error}`);
}

beforeEach(async () => {
  if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();
});

describe('saveSlotMetaKey', () => {
  it('produces a stable, slot-scoped key', () => {
    expect(saveSlotMetaKey(1)).toBe('save_slot_meta_1');
    expect(saveSlotMetaKey(3)).toBe('save_slot_meta_3');
  });
});

describe('extractSaveSlotMeta', () => {
  it('extracts a compact summary from a meaningful save', () => {
    expect(extractSaveSlotMeta(meaningfulState)).toEqual<SaveSlotMeta>({
      name: 'Ada Lovelace',
      age: 27,
      money: 5000,
      weeksLived: 140,
      updatedAt: 1_700_000_000_000,
    });
  });

  it('clamps NaN / Infinity / negative age, money and weeks to 0', () => {
    const meta = extractSaveSlotMeta({
      userProfile: { firstName: 'X' },
      date: { age: Number.NaN },
      stats: { money: -50 },
      weeksLived: Number.POSITIVE_INFINITY,
    });
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe('X');
    expect(meta!.age).toBe(0);
    expect(meta!.money).toBe(0);
    expect(meta!.weeksLived).toBe(0);
    // No updatedAt on the source → falls back to a real timestamp.
    expect(typeof meta!.updatedAt).toBe('number');
    expect(meta!.updatedAt).toBeGreaterThan(0);
  });

  it('floors fractional age and weeks but leaves money as-is', () => {
    const meta = extractSaveSlotMeta({
      userProfile: { firstName: 'Frac' },
      date: { age: 30.9 },
      stats: { money: 1234.56 },
      weeksLived: 12.7,
    });
    expect(meta).toMatchObject({ age: 30, money: 1234.56, weeksLived: 12 });
  });

  it('returns null when the profile / save shape is missing', () => {
    expect(extractSaveSlotMeta({ stats: { money: 1 }, date: { age: 1 } })).toBeNull();
    expect(extractSaveSlotMeta(null)).toBeNull();
    expect(extractSaveSlotMeta(undefined)).toBeNull();
    expect(extractSaveSlotMeta('nope')).toBeNull();
    expect(extractSaveSlotMeta(42)).toBeNull();
  });

  it('returns null for a valid shape with no meaningful gameplay', () => {
    expect(extractSaveSlotMeta({ userProfile: {}, stats: {}, date: {} })).toBeNull();
  });
});

describe('write / read / delete round-trip', () => {
  const sample: SaveSlotMeta = { name: 'Grace', age: 40, money: 999, weeksLived: 200, updatedAt: 123 };

  it('writes then reads back the identical summary', async () => {
    await writeSaveSlotMeta(1, sample);
    expect(await AsyncStorageMock.getItem(saveSlotMetaKey(1))).toBe(JSON.stringify(sample));
    expect(await readSaveSlotMeta(1)).toEqual(sample);
  });

  it('reads absent slot as null', async () => {
    expect(await readSaveSlotMeta(2)).toBeNull();
  });

  it('reads malformed JSON as null', async () => {
    await AsyncStorageMock.setItem(saveSlotMetaKey(2), '{ not valid json');
    expect(await readSaveSlotMeta(2)).toBeNull();
  });

  it('write(null) clears any stale entry', async () => {
    await writeSaveSlotMeta(1, sample);
    await writeSaveSlotMeta(1, null);
    expect(await readSaveSlotMeta(1)).toBeNull();
  });

  it('delete removes the cached summary', async () => {
    await writeSaveSlotMeta(3, sample);
    expect(await readSaveSlotMeta(3)).toEqual(sample);
    await deleteSaveSlotMeta(3);
    expect(await readSaveSlotMeta(3)).toBeNull();
  });
});

describe('probeSaveSlotBlob', () => {
  it("reports 'empty' for a confirmed-absent blob and 'exists' when present", async () => {
    expect(await probeSaveSlotBlob(2)).toBe('empty');
    await seedSlot(2, meaningfulState);
    expect(await probeSaveSlotBlob(2)).toBe('exists');
  });

  it("reports 'unknown' — never 'empty' — when the storage read throws", async () => {
    const original = AsyncStorageMock.getItem.getMockImplementation();
    AsyncStorageMock.getItem.mockImplementation(() => Promise.reject(new Error('storage down')));
    try {
      // A transient read failure must not look like an overwritable empty slot.
      expect(await probeSaveSlotBlob(2)).toBe('unknown');
    } finally {
      AsyncStorageMock.getItem.mockImplementation(original!);
    }
  });
});

describe('ensureSaveSlotMeta (one-time backfill)', () => {
  it('backfills the summary from a legacy blob and caches it', async () => {
    await seedSlot(3, meaningfulState);
    // Nothing cached yet — the backfill must do the decode+parse.
    expect(await readSaveSlotMeta(3)).toBeNull();

    const meta = await ensureSaveSlotMeta(3);
    expect(meta).toEqual<SaveSlotMeta>({
      name: 'Ada Lovelace',
      age: 27,
      money: 5000,
      weeksLived: 140,
      updatedAt: 1_700_000_000_000,
    });

    // And it must now be cached (subsequent reads are free).
    expect(await readSaveSlotMeta(3)).toEqual(meta);
  });

  it('returns null when no blob exists for the slot', async () => {
    expect(await ensureSaveSlotMeta(2)).toBeNull();
  });

  it('short-circuits to the cached summary without touching the blob', async () => {
    const cached: SaveSlotMeta = { name: 'Cached', age: 1, money: 2, weeksLived: 3, updatedAt: 4 };
    await writeSaveSlotMeta(1, cached);
    // No blob seeded for slot 1 — a cache hit must still return the cached value.
    expect(await ensureSaveSlotMeta(1)).toEqual(cached);
  });

  it('concurrent cold-path callers share ONE backfill (single-flight)', async () => {
    await seedSlot(3, meaningfulState);
    const [a, b] = await Promise.all([ensureSaveSlotMeta(3), ensureSaveSlotMeta(3)]);
    // One shared in-flight task resolves both callers with the SAME object;
    // two independent backfills would each build their own meta instance.
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('a deletion DURING the backfill wins — no resurrected metadata', async () => {
    await seedSlot(1, meaningfulState);

    // Gate the blob reads so the backfill parks between "read blob" and
    // "write meta" while we delete the slot's metadata. `reachedGate` tells us
    // the backfill has passed its generation capture and is inside the blob
    // read — deleting any earlier would (correctly) let it re-cache from the
    // still-existing blob.
    const original = AsyncStorageMock.getItem.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let signalReached!: () => void;
    const reachedGate = new Promise<void>((resolve) => {
      signalReached = resolve;
    });
    AsyncStorageMock.getItem.mockImplementation(async (key: string) => {
      if (key.startsWith('save_slot_1') && key !== saveSlotMetaKey(1)) {
        signalReached();
        await gate;
      }
      return original(key);
    });

    try {
      const backfill = ensureSaveSlotMeta(1);
      await reachedGate; // backfill is now mid-blob-read, generation captured
      await deleteSaveSlotMeta(1); // bumps the slot's deletion generation
      release();
      expect(await backfill).toBeNull(); // late result discarded...
      expect(await readSaveSlotMeta(1)).toBeNull(); // ...and nothing was written
    } finally {
      AsyncStorageMock.getItem.mockImplementation(original);
    }
  });
});

/**
 * Backups must actually be written in a PRODUCTION-signed build.
 *
 * The 2026-07-28 audit (PERF-1) found that no shipped build had ever created a
 * save backup: `createBackupFromState` stringified a RAW GameState and handed it
 * to `createBackup`, whose first step decodes the argument as a persisted save
 * envelope. A raw state has no `v: 2`, so with unsigned legacy saves refused —
 * true in every shipped build — the decode returned "Unsigned legacy save format
 * is not accepted", the throw was swallowed into `return null`, and because the
 * function never rejected, the caller's `.catch()` never fired and the save path
 * reported success.
 *
 * The reason it survived every prior audit and the whole suite is the test
 * environment itself: jest sets `__DEV__ = false` but leaves `NODE_ENV` at
 * 'test', and `resolveSaveSigningRuntimeConfig` treats anything that is not
 * 'production' as dev — so `allowUnsignedLegacySaves` is true and the legacy
 * branch (which works) is the one every other test takes. This suite therefore
 * re-imports the save modules with `NODE_ENV=production` so the signed path is
 * the one under test. Nothing else in the suite does that, which is the point.
 */

// jest.setup.js stubs AsyncStorage with no-ops (getItem always null, getAllKeys
// always []), which cannot show whether a backup was actually written. Override
// it here with a real in-memory store so "was it persisted?" is a real question.
const memoryStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = memoryStore;
  const api = {
    setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    removeItem: jest.fn(async (k: string) => { store.delete(k); }),
    clear: jest.fn(async () => { store.clear(); }),
    getAllKeys: jest.fn(async () => [...store.keys()]),
    multiGet: jest.fn(async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null])),
    multiSet: jest.fn(async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => store.set(k, v)); }),
    multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((k) => store.delete(k)); }),
  };
  return { __esModule: true, default: api, ...api };
});

const REAL_NODE_ENV = process.env.NODE_ENV;
const REAL_ALLOW_LEGACY = process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES;

/**
 * Re-import the save modules as a production build would resolve them. The
 * signing config is read ONCE at module scope, so the env has to be set before
 * the require and the module registry reset around it.
 */
function loadAsProductionBuild() {
  jest.resetModules();
  process.env.NODE_ENV = 'production';
  // Production hard-refuses unsigned legacy saves; preflightSaveSigning.js
  // errors the build out if this flag is ever true for a signed release.
  delete process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES;
  process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES = 'true';
  process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-save-hmac-key-0123456789abcdef';

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const validation = require('@/utils/saveValidation');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const backup = require('@/utils/saveBackup');
  return { validation, backup };
}

function sampleState(overrides: Record<string, unknown> = {}) {
  return {
    version: 25,
    weeksLived: 412,
    userProfile: { firstName: 'Ada', lastName: 'Lovelace' },
    date: { age: 26, year: 2033, week: 2, month: 1 },
    stats: { money: 125_000, health: 70, happiness: 60, energy: 55, fitness: 40, reputation: 50, gems: 12 },
    ...overrides,
  };
}

beforeEach(() => {
  memoryStore.clear();
});

afterEach(() => {
  if (REAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = REAL_NODE_ENV;
  if (REAL_ALLOW_LEGACY === undefined) delete process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES;
  else process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES = REAL_ALLOW_LEGACY;
  jest.resetModules();
});

describe('createBackupFromState on a production-signed build', () => {
  it('confirms the environment under test really is the signed one', () => {
    const { validation } = loadAsProductionBuild();
    // If this ever flips to true the rest of this suite silently stops testing
    // the production path — the exact blind spot that hid PERF-1.
    expect(validation.shouldAllowUnsignedLegacySaves()).toBe(false);
  });

  it('writes a backup that can be listed and loaded back (the PERF-1 regression)', async () => {
    const { backup } = loadAsProductionBuild();
    const slot = 3;

    const id = await backup.createBackupFromState(slot, sampleState(), 'auto_save');
    expect(id).not.toBeNull();

    const listed = await backup.listBackups(slot);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(id);
    // Metadata is extracted from the live state, so it must survive the wrap.
    expect(listed[0].gameInfo).toEqual({
      characterName: 'Ada Lovelace',
      age: 26,
      money: 125_000,
      weeksLived: 412,
    });

    // loadBackup applies the strict envelope verification the primary loader
    // uses, so a non-null return already proves the payload is a valid signed
    // envelope — not merely that some bytes were stored.
    const restored = await backup.loadBackup(id as string);
    expect(restored).not.toBeNull();

    const { validation } = { validation: require('@/utils/saveValidation') };
    const decoded = validation.decodePersistedSaveEnvelope(restored!.data, { allowLegacy: false });
    expect(decoded.valid).toBe(true);
    const state = JSON.parse(decoded.data as string);
    expect(state.weeksLived).toBe(412);
    expect(state.stats.money).toBe(125_000);
  });

  it('produces a signed v2 envelope, not a raw state, as the stored payload', async () => {
    const { backup, validation } = loadAsProductionBuild();
    const id = await backup.createBackupFromState(1, sampleState(), 'manual');
    expect(id).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { safeGetItem } = require('@/utils/safeStorage');
    const stored = JSON.parse((await safeGetItem(id as string)) as string);
    const envelope = JSON.parse(stored.data);
    expect(envelope.v).toBe(2);
    expect(typeof envelope.hmac).toBe('string');

    // And the envelope must verify under the same rules a real load applies.
    const decoded = validation.decodePersistedSaveEnvelope(stored.data, { allowLegacy: false });
    expect(decoded.valid).toBe(true);
  });

  it('keeps every backup of a slot up to the rotation limit', async () => {
    const { backup } = loadAsProductionBuild();
    const slot = 5;
    for (let i = 0; i < 3; i += 1) {
      const id = await backup.createBackupFromState(slot, sampleState({ weeksLived: 100 + i }), 'auto_save');
      expect(id).not.toBeNull();
    }
    const listed = await backup.listBackups(slot);
    expect(listed.length).toBe(3);
  });
});

/**
 * H8 + L10 — every path that writes a save owes the same protected-state work.
 *
 * The anti-exploit layer has two halves, and both used to live only in
 * `performSave` (the queued/autosave path):
 *
 *   1. EMBED. `_embeddedProtectedState` is written INSIDE the save blob so that
 *      deleting the standalone AsyncStorage `protected_state_*` keys does not
 *      erase the death/jail/wanted high-water marks — `loadGame` restores from
 *      the embed when the standalone keys are gone.
 *   2. ADVANCE. `updateProtectedState` ratchets those marks after a successful
 *      write.
 *
 * `forceSave` did NEITHER (H8), and it is the path that runs on app
 * background/kill, IAP grants, redeem codes, the death popup and onboarding —
 * so the NEWEST blob on disk routinely carried no embed at all, leaving the
 * restore with nothing to restore from. The quota-cleanup retry branches
 * returned success while skipping the advance (L10), same class, narrower
 * trigger.
 *
 * Both halves are now single private helpers shared by `performSave`,
 * `forceSave` and both cleanup-retry branches. These tests pin the parity, and
 * the "must not fail the save" test pins that the protection stays best-effort.
 */
import { saveQueue, queueSave, forceSave } from '@/utils/saveQueue';

const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    multiRemove: jest.fn(async (ks: string[]) => ks.forEach((k) => store.delete(k))),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

const PROTECTED = { totalDeaths: 3, jailTime: 12, wantedLevel: 2 };

let getProtectedState = jest.fn(async (_slot: number): Promise<unknown> => PROTECTED);
const updateProtectedState = jest.fn(async (_slot: number, _data: unknown) => undefined);

jest.mock('@/utils/saveBackup', () => ({
  getProtectedState: (...a: [number]) => getProtectedState(...a),
  updateProtectedState: (...a: [number, unknown]) => updateProtectedState(...a),
}));

/**
 * `createSaveEnvelope` is the identity here, so the string handed to
 * `doubleBufferSave` IS the serialized payload and the test can parse it back.
 */
const writes: { key: string; payload: string }[] = [];
let failNextWriteWithQuota = false;
const doubleBufferSave = jest.fn(async (key: string, payload: string) => {
  if (failNextWriteWithQuota) {
    failNextWriteWithQuota = false;
    const err = new Error('quota exceeded');
    err.name = 'QuotaExceededError';
    throw err;
  }
  writes.push({ key, payload });
  return { success: true as const };
});

jest.mock('@/utils/saveValidation', () => ({
  createSaveEnvelope: (s: string) => s,
  decodePersistedSaveEnvelope: (s: string) => ({ valid: true, data: s, format: 'v2' }),
  doubleBufferSave: (...args: unknown[]) =>
    (doubleBufferSave as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  isSaveSigningConfigError: () => false,
  isPristineUnstartedState: () => false,
  SAVE_SIGNING_CONFIG_ERROR_CODE: 'SAVE_SIGNING_CONFIG_ERROR',
}));

const state = { stats: { money: 4200, gems: 5 }, weeksLived: 365, version: 43 };

/** The payload of the most recent slot write, parsed. */
const lastPayload = (): Record<string, unknown> => {
  const w = writes.filter((x) => x.key.startsWith('save_slot_')).pop();
  if (!w) throw new Error('no slot write recorded');
  return JSON.parse(w.payload) as Record<string, unknown>;
};

beforeEach(() => {
  store.clear();
  writes.length = 0;
  failNextWriteWithQuota = false;
  getProtectedState = jest.fn(async (_slot: number): Promise<unknown> => PROTECTED);
  updateProtectedState.mockClear();
  doubleBufferSave.mockClear();
});

describe('forceSave / performSave protected-state parity (H8, L10)', () => {
  it('H8: forceSave writes a payload carrying _embeddedProtectedState', async () => {
    await forceSave(1, state);
    expect(lastPayload()._embeddedProtectedState).toEqual(PROTECTED);
  });

  it('H8: forceSave advances the protected-state marks after a successful write', async () => {
    await forceSave(1, state);
    expect(updateProtectedState).toHaveBeenCalledTimes(1);
    expect(updateProtectedState).toHaveBeenCalledWith(1, state);
  });

  it('the queued path still does both — the behaviour forceSave was missing', async () => {
    await queueSave(2, state);
    expect(lastPayload()._embeddedProtectedState).toEqual(PROTECTED);
    expect(updateProtectedState).toHaveBeenCalledWith(2, state);
  });

  it('no protected state on disk yet → no embed key, and the save still succeeds', async () => {
    getProtectedState = jest.fn(async (_slot: number): Promise<unknown> => null);
    await forceSave(1, state);
    expect(Object.keys(lastPayload())).not.toContain('_embeddedProtectedState');
    // The advance is what BOOTSTRAPS the keys, so it must still run.
    expect(updateProtectedState).toHaveBeenCalledWith(1, state);
  });

  it('the embed is best-effort: a throwing getProtectedState must not fail the save', async () => {
    getProtectedState = jest.fn(async (_slot: number): Promise<unknown> => {
      throw new Error('protected-state read exploded');
    });
    await expect(forceSave(1, state)).resolves.toBeUndefined();
    expect(lastPayload().weeksLived).toBe(365);
  });

  it('the advance is best-effort: a throwing updateProtectedState must not fail the save', async () => {
    updateProtectedState.mockRejectedValueOnce(new Error('write exploded'));
    await expect(forceSave(1, state)).resolves.toBeUndefined();
    expect(lastPayload()._embeddedProtectedState).toEqual(PROTECTED);
  });

  it('L10: the forceSave quota-cleanup retry advances the marks before reporting success', async () => {
    // Give performQuotaCleanup something to actually clean, so `cleaned > 0`
    // and the retry branch is reached.
    store.set('leaderboard_cache_v1', '{}');
    store.set('achievements_cache', '{}');
    failNextWriteWithQuota = true;

    await forceSave(1, state);

    expect(doubleBufferSave).toHaveBeenCalledTimes(2); // original + retry
    expect(lastPayload()._embeddedProtectedState).toEqual(PROTECTED);
    expect(updateProtectedState).toHaveBeenCalledWith(1, state);
  });

  it('L10: the queued quota-cleanup retry advances the marks before reporting success', async () => {
    store.set('leaderboard_cache_v1', '{}');
    store.set('achievements_cache', '{}');
    failNextWriteWithQuota = true;

    await queueSave(3, state);

    expect(doubleBufferSave).toHaveBeenCalledTimes(2);
    expect(updateProtectedState).toHaveBeenCalledWith(3, state);
  });

  afterAll(() => {
    saveQueue.setToastCallback(null as unknown as (m: string, t: string) => void);
  });
});

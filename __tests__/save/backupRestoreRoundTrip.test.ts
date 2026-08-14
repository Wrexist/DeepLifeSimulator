/**
 * A restore has to actually restore.
 *
 * `restoreFromBackup` wrote the recovered bytes with `atomicSave`, which touches
 * only the legacy single key `save_slot_N`. Every real save has gone through
 * `doubleBufferSave` — `_A`/`_B` plus an `_active` pointer — since the double
 * buffer landed, and `doubleBufferLoad` consults that pointer FIRST, reaching
 * the legacy key only when the pointer is missing AND both buffers fail AND the
 * build allows unsigned legacy saves (false on every signed production build).
 *
 * So on any device that had saved even once, a restore returned
 * `{ success: true }`, invalidated the slot summary, updated protected state —
 * and the next load served the pre-restore buffer. The player was told their
 * save came back and got the broken one instead. 2026-07-29 audit BRC-1b.
 *
 * This test drives the real storage layer (an in-memory AsyncStorage) rather
 * than mocks, because the bug lived entirely in WHICH KEY was written.
 */
import {
  doubleBufferSave,
  doubleBufferLoad,
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
  shouldAllowUnsignedLegacySaves,
} from '@/utils/saveValidation';
import { createBackup, restoreFromBackup, listBackups } from '@/utils/saveBackup';

process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-backup-round-trip';

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
    multiRemove: jest.fn(async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

const SLOT = 2;
const SLOT_KEY = `save_slot_${SLOT}`;

const stateOf = (name: string, weeksLived: number) => ({
  userProfile: { firstName: name, lastName: 'Okonkwo' },
  stats: { money: weeksLived * 100 },
  date: { age: 18 + Math.floor(weeksLived / 52), month: 'March' },
  weeksLived,
  version: 25,
});

/** Read the slot exactly the way the production loader does. */
async function loadSlot() {
  const { data } = await doubleBufferLoad(SLOT_KEY, undefined, {
    allowLegacy: shouldAllowUnsignedLegacySaves(),
  });
  if (!data) return null;
  const decoded = decodePersistedSaveEnvelope(data, {
    allowLegacy: shouldAllowUnsignedLegacySaves(),
  });
  return decoded.valid && typeof decoded.data === 'string' ? JSON.parse(decoded.data) : null;
}

beforeEach(() => {
  store.clear();
});

describe('restoring a backup is visible to the loader', () => {
  it('brings the backed-up character back — the whole point of a backup', async () => {
    const good = stateOf('Mara', 2231);
    const goodEnvelope = createSaveEnvelope(JSON.stringify(good));

    // A backup of the good save, then the slot moves on to a different state.
    const backup = await createBackup(SLOT, goodEnvelope, 'before_overwrite');
    expect(typeof backup).toBe('string');

    const ruined = stateOf('Nobody', 0);
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(ruined)));
    expect((await loadSlot()).userProfile.firstName).toBe('Nobody');

    const result = await restoreFromBackup(SLOT, backup!);
    expect(result.success).toBe(true);

    // The assertion the old implementation failed: read it back through the
    // production loader, not through the key the restore happened to write.
    const reloaded = await loadSlot();
    expect(reloaded.userProfile.firstName).toBe('Mara');
    expect(reloaded.weeksLived).toBe(2231);
  });

  it('writes through the double buffer, so the active pointer names the restore', async () => {
    const original = stateOf('Mara', 900);
    const backup = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(original)), 'manual');

    // Two saves so the active pointer has flipped at least once — the exact
    // shape that made the legacy-key write invisible.
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('A', 1))));
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('B', 2))));

    await restoreFromBackup(SLOT, backup!);

    const active = store.get(`${SLOT_KEY}_active`);
    expect(active === 'A' || active === 'B').toBe(true);

    const buffered = store.get(`${SLOT_KEY}_${active}`);
    expect(buffered).toBeDefined();
    const decoded = decodePersistedSaveEnvelope(buffered!, { allowLegacy: false });
    expect(JSON.parse(decoded.data as string).userProfile.firstName).toBe('Mara');
  });

  it('leaves no stale legacy blob able to outrank the restore', async () => {
    const backup = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(stateOf('Mara', 500))), 'manual');
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('Other', 5))));
    // Seed the legacy key, the way a pre-double-buffer build left it behind.
    store.set(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('Ancient', 9))));

    await restoreFromBackup(SLOT, backup!);

    expect(store.has(SLOT_KEY)).toBe(false);
    expect((await loadSlot()).userProfile.firstName).toBe('Mara');
  });

  it('reports failure for a backup that does not exist, and leaves the slot alone', async () => {
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('Untouched', 40))));

    const result = await restoreFromBackup(SLOT, 'backup_that_never_existed');

    expect(result.success).toBe(false);
    expect((await loadSlot()).userProfile.firstName).toBe('Untouched');
  });

  it('keeps the backup listed after restoring, so a mistaken restore is not a one-way door', async () => {
    const backup = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(stateOf('Mara', 700))), 'manual');
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(stateOf('Other', 3))));

    await restoreFromBackup(SLOT, backup!);

    expect((await listBackups(SLOT)).some((b) => b.id === backup!)).toBe(true);
  });
});

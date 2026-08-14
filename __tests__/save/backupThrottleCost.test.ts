/**
 * A backup that is about to be thrown away should not be built first.
 *
 * `createBackupFromState` ran `JSON.stringify(state)`, then `createSaveEnvelope`
 * — a CRC32 over the whole string plus a pure-JS HMAC-SHA256 over it again —
 * and only THEN called `createBackup`, whose first statement was the 60-second
 * auto-save throttle. `saveGame` has 155 production call sites, including after
 * every `nextWeek` and every Pulse like, so any save inside that window paid the
 * full serialize + two crypto passes and discarded the result.
 *
 * The throttle itself was not cheap either: it read the newest timestamp via
 * `listBackups`, which `safeGetItem`s and `JSON.parse`s EVERY backup blob for
 * the slot — up to five, each holding a complete save envelope — to look at one
 * number. 2026-07-30 audit PERF-1.
 */
import { createBackup, createBackupFromState, listBackups } from '@/utils/saveBackup';
import { createSaveEnvelope } from '@/utils/saveValidation';

process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-backup-throttle';

const store = new Map<string, string>();
let getItemCalls: string[] = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => {
      getItemCalls.push(k);
      return store.has(k) ? store.get(k)! : null;
    }),
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

const SLOT = 3;

const life = (over: Record<string, unknown> = {}) => ({
  userProfile: { firstName: 'Ada', lastName: 'Okonkwo' },
  stats: { money: 1_000 },
  date: { age: 30 },
  weeksLived: 600,
  generationNumber: 1,
  version: 27,
  ...over,
});

beforeEach(() => {
  store.clear();
  getItemCalls = [];
});

describe('the auto-save throttle', () => {
  it('refuses a second auto backup inside the window', async () => {
    const first = await createBackupFromState(SLOT, life(), 'auto_save');
    expect(first).not.toBeNull();

    const second = await createBackupFromState(SLOT, life({ weeksLived: 601 }), 'auto_save');
    expect(second).toBeNull();

    expect(await listBackups(SLOT)).toHaveLength(1);
  });

  it('reads ONE key to decide, not every backup blob', async () => {
    // Fill the ring so a listBackups-based throttle would have several blobs to
    // parse. These are deliberate reasons, which are never throttled.
    for (let i = 0; i < 3; i += 1) {
      await createBackup(
        SLOT,
        createSaveEnvelope(JSON.stringify(life({ weeksLived: 600 + i }))),
        'before_prestige',
      );
    }

    getItemCalls = [];
    const throttled = await createBackupFromState(SLOT, life(), 'auto_save');
    expect(throttled).toBeNull();

    // The whole point: deciding "no" must not touch the backup blobs.
    const blobReads = getItemCalls.filter((k) => k.startsWith('save_backup_'));
    expect(blobReads).toHaveLength(0);
    expect(getItemCalls.length).toBeLessThanOrEqual(2);
  });

  it('still allows a DELIBERATE backup inside the window', async () => {
    await createBackupFromState(SLOT, life(), 'auto_save');

    // Only `auto_save` is rate-limited; a pre-prestige or pre-overwrite
    // snapshot is exactly the copy the recovery tier exists to keep.
    const deliberate = await createBackupFromState(SLOT, life(), 'before_prestige');
    expect(deliberate).not.toBeNull();
  });

  it('allows the FIRST auto backup for a slot that has none', async () => {
    expect(await createBackupFromState(SLOT, life(), 'auto_save')).not.toBeNull();
  });
});

describe('the throttle stamp is maintained by the backup path itself', () => {
  it('is written by createBackup, so the cheap path works without a manual backup', async () => {
    await createBackup(SLOT, createSaveEnvelope(JSON.stringify(life())), 'corruption_recovery');

    // `recordBackupTime` used to be called only from createManualBackup, so the
    // cheap key was absent for players who had never made one — and the
    // throttle fell back to parsing blobs every single time.
    expect(store.has(`last_backup_time_${SLOT}`)).toBe(true);
  });

  it('falls back to the blob scan when the stamp is missing (older saves)', async () => {
    await createBackup(SLOT, createSaveEnvelope(JSON.stringify(life())), 'corruption_recovery');
    store.delete(`last_backup_time_${SLOT}`);

    // Still correct, just not as cheap — an old save must not get a free
    // unthrottled backup on every tick.
    expect(await createBackupFromState(SLOT, life(), 'auto_save')).toBeNull();
  });
});

/**
 * Recovery has to work for the player who needs it most.
 *
 * The anti-exploit gate on `canRestoreBackup` was written for an in-run rewind
 * and then applied to every restore. Two of its checks refuse precisely the
 * recoveries that matter (2026-07-29 audit BRC-6):
 *
 *  - `continueAsChild` bumps `generationNumber`, so the generation check made
 *    every backup from the run that just ended permanently unrestorable —
 *    including one taken seconds earlier.
 *  - The autosave keeps running while the death screen is up, so the ring fills
 *    with dead-state backups; the death check then refused every ALIVE backup,
 *    leaving the dead ones as the only legal restores.
 *
 * And its catch block failed CLOSED "for security" — trading a single-player
 * progression exploit against permanent data loss for someone whose save is
 * already broken.
 *
 * A restore was also itself irreversible: it read the outgoing save only to
 * feed the exploit check, then overwrote it without keeping a copy (BRC-14).
 */
process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-restore-recovery';

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

import { createSaveEnvelope, doubleBufferSave } from '@/utils/saveValidation';
import { canRestoreBackup, createBackup, restoreFromBackup, listBackups } from '@/utils/saveBackup';
import { describeRestorePoint, relativeTime } from '@/components/onboarding/RestoreBackupSheet';

const SLOT = 1;
const SLOT_KEY = `save_slot_${SLOT}`;

const alive = (over: Record<string, unknown> = {}) => ({
  userProfile: { firstName: 'Mara', lastName: 'Okonkwo' },
  stats: { money: 500_000 },
  date: { age: 54 },
  weeksLived: 1900,
  generationNumber: 2,
  streetJobsCompleted: 40,
  version: 25,
  ...over,
});

beforeEach(() => {
  store.clear();
});

describe('a recovery restore is not treated as an exploit', () => {
  it('lets a player restore an ALIVE backup after their character died', async () => {
    const dead = alive({ showDeathPopup: true, deathReason: 'old age' });

    expect((await canRestoreBackup(SLOT, alive(), dead, 'recovery')).allowed).toBe(true);
    // The in-run rewind still refuses it — that is what the check is for.
    expect((await canRestoreBackup(SLOT, alive(), dead, 'rewind')).allowed).toBe(false);
  });

  it('lets a player restore the life they just finished after continuing as an heir', async () => {
    const heir = alive({ generationNumber: 5 });
    const previousLife = alive({ generationNumber: 4 });

    expect((await canRestoreBackup(SLOT, previousLife, heir, 'recovery')).allowed).toBe(true);
    // Even a rewind keeps the IMMEDIATELY preceding generation restorable: the
    // old rule made the run you just played unrecoverable the moment you
    // continued your legacy.
    expect((await canRestoreBackup(SLOT, previousLife, heir, 'rewind')).allowed).toBe(true);
    // Two generations back is still refused for a rewind.
    expect(
      (await canRestoreBackup(SLOT, alive({ generationNumber: 2 }), heir, 'rewind')).allowed,
    ).toBe(false);
  });

  it('does not let a recovery be used to erase a criminal record on a rewind', async () => {
    const heavy = alive({ streetJobsCompleted: 80 });
    const clean = alive({ streetJobsCompleted: 0 });

    expect((await canRestoreBackup(SLOT, clean, heavy, 'rewind')).allowed).toBe(false);
    expect((await canRestoreBackup(SLOT, clean, heavy, 'recovery')).allowed).toBe(true);
  });

  it('still refuses an age regression, in either mode — that check is not about the exploit', async () => {
    const older = alive({ date: { age: 70 } });
    const younger = alive({ date: { age: 30 } });

    expect((await canRestoreBackup(SLOT, younger, older, 'rewind')).allowed).toBe(false);
    expect((await canRestoreBackup(SLOT, younger, older, 'recovery')).allowed).toBe(false);
  });

  it('fails OPEN when the check itself throws', async () => {
    // A crash in the permission check must not convert a recoverable loss into
    // a permanent one. `backupState` being null makes the property reads throw.
    const result = await canRestoreBackup(SLOT, null, alive(), 'recovery');
    expect(result.allowed).toBe(true);
  });

  it('defaults to the strict rewind rules when no intent is given', async () => {
    const dead = alive({ showDeathPopup: true });
    expect((await canRestoreBackup(SLOT, alive(), dead)).allowed).toBe(false);
  });
});

describe('a restore keeps a way back', () => {
  it('snapshots the save it replaces, so the wrong choice is not final', async () => {
    const wanted = alive({ userProfile: { firstName: 'Mara', lastName: 'O' }, weeksLived: 1900 });
    const backupId = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(wanted)), 'manual');

    const current = alive({ userProfile: { firstName: 'Replaced', lastName: 'Me' }, weeksLived: 1901 });
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(current)));

    expect((await restoreFromBackup(SLOT, backupId!, 'recovery')).success).toBe(true);

    const after = await listBackups(SLOT);
    const undo = after.find((b) => b.reason === 'before_restore');
    expect(undo).toBeDefined();
    // `gameInfo` is optional on a backup entry, so assert it survived the
    // round-trip before reading through it — otherwise an undo point written
    // WITHOUT its metadata would fail here as a TypeError rather than as the
    // missing-metadata assertion it actually is.
    expect(undo!.gameInfo).toBeDefined();
    expect(undo!.gameInfo!.characterName).toContain('Replaced');
  });

  it('makes that undo point itself restorable', async () => {
    const older = alive({ userProfile: { firstName: 'Older', lastName: 'Save' } });
    const backupId = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(older)), 'manual');

    const current = alive({ userProfile: { firstName: 'Current', lastName: 'Save' } });
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(current)));

    await restoreFromBackup(SLOT, backupId!, 'recovery');
    const undo = (await listBackups(SLOT)).find((b) => b.reason === 'before_restore');

    const back = await restoreFromBackup(SLOT, undo!.id, 'recovery');
    expect(back.success).toBe(true);
    expect(back.state?.userProfile?.firstName).toBe('Current');
  });
});

describe('the pre-prestige snapshot exists at all', () => {
  it('is a reason rotation will never evict', async () => {
    // Prestige rebuilds the entire state — the single most destructive thing a
    // player can do on purpose — and it was the one destructive path with no
    // backup call whatsoever, so a mis-tapped prestige was unrecoverable.
    // `before_prestige` was declared, protected and shown in the restore UI,
    // and nothing ever wrote one. 2026-07-29 audit BRC-4.
    // FREEZE the clock so EVERY backup here shares a millisecond. The id was
    // `save_backup_${slot}_${Date.now()}`, so same-millisecond writes collided
    // and the second silently overwrote the first — including its
    // rotation-exempt `reason`. In CI this surfaced as a flaky assertion; the
    // flake was the bug. Freezing makes it deterministic instead of a race.
    //
    // Restored in a `finally`: a bare reassignment after the assertions leaves
    // every later test in this file — and every file sharing the worker — with
    // a stubbed clock if anything above it throws.
    const realNow = Date.now;
    Date.now = () => 1_800_000_000_000;
    try {
      const precious = await createBackup(
        SLOT,
        createSaveEnvelope(JSON.stringify(alive({ weeksLived: 2231 }))),
        'before_prestige',
      );
      expect(precious).not.toBeNull();

      const ids = new Set<string>([precious!]);
      for (let i = 0; i < 12; i += 1) {
        const id = await createBackup(
          SLOT,
          createSaveEnvelope(JSON.stringify(alive({ weeksLived: i }))),
          'corruption_recovery',
        );
        ids.add(id!);
      }

      // Every backup must have its own key; a collision silently overwrites an
      // earlier one AND its rotation-exempt reason.
      expect(ids.size).toBe(13);
      expect((await listBackups(SLOT)).some((b) => b.id === precious)).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('gives the QUOTA-RETRY path its own id too', async () => {
    // The retry after a QuotaExceededError built its id from slot+timestamp
    // directly, bypassing the sequence entirely — and it is the likeliest
    // collision of all, because it runs in the same millisecond as the write
    // that just failed. The uniqueness test above passes without covering it,
    // which is exactly how the first collision survived review.
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
    const realNow = Date.now;
    const realSetItem = AsyncStorage.setItem;
    Date.now = () => 1_900_000_000_000;

    try {
      // A survivor the retry must not overwrite, written before quota bites.
      const survivor = await createBackup(
        SLOT,
        createSaveEnvelope(JSON.stringify(alive({ weeksLived: 1111 }))),
        'before_prestige',
      );
      expect(survivor).not.toBeNull();

      // TWO failures per createBackup, not one. `safeSetItem` catches a quota
      // error and retries once itself after clearing caches, so a single
      // failure is absorbed there and `createBackup`'s own retry branch is
      // never reached — which is how this path stayed untested. Failing both
      // makes safeSetItem return false, which createBackup turns into the
      // quota error its cleanup + retry block is written for. The third write
      // (the retry's own) is allowed to land.
      let failsLeft = 0;
      AsyncStorage.setItem = jest.fn(async (k: string, v: string) => {
        if (failsLeft > 0) {
          failsLeft -= 1;
          const err: Error & { name: string } = new Error('quota exceeded');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return realSetItem(k, v);
      });

      const retryIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        failsLeft = 2;
        const id = await createBackup(
          SLOT,
          createSaveEnvelope(JSON.stringify(alive({ weeksLived: 2000 + i }))),
          'corruption_recovery',
        );
        expect(id).not.toBeNull();
        retryIds.push(id!);
      }
      // Same millisecond, three retries: three distinct keys, and none of them
      // is the survivor's key.
      expect(new Set(retryIds).size).toBe(3);
      expect(retryIds).not.toContain(survivor);
    } finally {
      // Both mocks in the finally: an assertion throwing above would otherwise
      // leak a setItem that fails twice per call into every later test here.
      AsyncStorage.setItem = realSetItem;
      Date.now = realNow;
    }
  });

  it('does not claim a backup that storage refused — or evict one to make room for it', async () => {
    // `safeSetItem` does NOT throw when the device is full: it catches the
    // quota error, tries its own cleanup, and returns `false`. `createBackup`
    // ignored that boolean, so on a full device it logged "Created backup",
    // ROTATED — evicting a real recovery point — and returned an id for a key
    // that was never written. The recovery tier destroyed recovery points and
    // reported success. Found while covering the quota-retry id path.
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;

    const keeper = await createBackup(
      SLOT,
      createSaveEnvelope(JSON.stringify(alive({ weeksLived: 1500 }))),
      'before_prestige',
    );
    expect(keeper).not.toBeNull();
    const before = await listBackups(SLOT);

    // A device with no room at all: every write fails, including the retry.
    const realSetItem = AsyncStorage.setItem;
    AsyncStorage.setItem = jest.fn(async () => {
      const err: Error & { name: string } = new Error('quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    try {
      const doomed = await createBackup(
        SLOT,
        createSaveEnvelope(JSON.stringify(alive({ weeksLived: 1600 }))),
        'corruption_recovery',
      );
      // No id for a backup that does not exist.
      expect(doomed).toBeNull();
    } finally {
      AsyncStorage.setItem = realSetItem;
    }

    // And the existing recovery point is still there.
    const after = await listBackups(SLOT);
    expect(after.some((b) => b.id === keeper)).toBe(true);
    expect(after.length).toBe(before.length);
  });

  it('restores the pre-prestige life as a recovery', async () => {
    const beforePrestige = alive({ userProfile: { firstName: 'Mara', lastName: 'O' }, generationNumber: 2 });
    const id = await createBackup(SLOT, createSaveEnvelope(JSON.stringify(beforePrestige)), 'before_prestige');

    // The post-prestige state has moved on.
    await doubleBufferSave(SLOT_KEY, createSaveEnvelope(JSON.stringify(alive({ generationNumber: 3, weeksLived: 0 }))));

    const result = await restoreFromBackup(SLOT, id!, 'recovery');
    expect(result.success).toBe(true);
    expect(result.state.generationNumber).toBe(2);
  });
});

describe('the restore list reads like a set of moments, not files', () => {
  it('leads with who the character was and how far they got', () => {
    expect(
      describeRestorePoint({
        id: 'b',
        slot: 1,
        timestamp: 0,
        size: 0,
        reason: 'manual',
        gameInfo: { characterName: 'Mara Okonkwo', age: 54, money: 500000, weeksLived: 1900 },
      }),
    ).toContain('Mara Okonkwo');
  });

  it('stays readable when the summary is missing or garbage', () => {
    const bare = describeRestorePoint({
      id: 'b',
      slot: 1,
      timestamp: 0,
      size: 0,
      reason: 'auto_save',
      gameInfo: { characterName: '', age: NaN, money: NaN, weeksLived: NaN },
    });
    expect(bare).toBe('Unnamed Character');
  });

  it('describes when, in the terms someone picking a moment thinks in', () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now - 5_000, now)).toBe('moments ago');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(relativeTime(now - 60 * 60_000, now)).toBe('1 hour ago');
    expect(relativeTime(now - 3 * 24 * 3600_000, now)).toBe('3 days ago');
    expect(relativeTime(now - 21 * 24 * 3600_000, now)).toBe('3 weeks ago');
    // A clock that moved backwards must not produce "-4 minutes ago".
    expect(relativeTime(now + 60_000, now)).toBe('moments ago');
  });
});

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
    expect(undo!.gameInfo.characterName).toContain('Replaced');
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
    expect(back.state.userProfile.firstName).toBe('Current');
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

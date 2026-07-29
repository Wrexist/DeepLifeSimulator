/**
 * A write with no known destination must not be written, and a write from a
 * previous session must earn its replay.
 *
 * Two separate ways a save landed somewhere it did not belong:
 *
 * SAVE-OW-6 — four guards in the write path turned "I don't know which slot
 * this is" into "write it to slot 1". A NaN or out-of-range slot is exactly the
 * state you are in when something upstream has already gone wrong, and the
 * response was to commit that write over whatever the player had in slot 1.
 *
 * SAVE-OW-7 — the persisted queue holds WHOLE GameState snapshots and is
 * replayed on the next launch. The only thing checked was the slot number, so
 * an operation queued before the app died was committed later regardless of its
 * age or of what had happened to the slot since — and any guard living in
 * `saveGame` is bypassed entirely, because the replay never goes through it.
 * That is the mechanism that carried a pristine boot state across an app kill,
 * and it stayed open for any device updating while carrying a persisted queue.
 */
process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-queue-replay';

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

import { isWritableSlot } from '@/utils/slotNumber';
import { queueSave, forceSave, saveQueue } from '@/utils/saveQueue';
import { initialGameState } from '@/contexts/game/initialState';

const played = (weeksLived: number) => ({
  ...initialGameState,
  weeksLived,
  userProfile: { ...initialGameState.userProfile, firstName: 'Mara', lastName: 'Okonkwo' },
});

function persistQueueOf(ops: unknown[]) {
  store.set('save_queue_persisted', JSON.stringify(ops));
}

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe('an unknown slot is not slot 1', () => {
  it('accepts only 1-3', () => {
    expect([1, 2, 3].every(isWritableSlot)).toBe(true);
    for (const bad of [0, 4, -1, 2.5, NaN, Infinity, '2', null, undefined, {}]) {
      expect(isWritableSlot(bad)).toBe(false);
    }
  });

  it('refuses to queue a save for an invalid slot instead of redirecting it', async () => {
    await expect(queueSave(NaN, played(10))).rejects.toThrow(/invalid save slot/i);
    await expect(queueSave(0, played(10))).rejects.toThrow(/invalid save slot/i);
    await expect(queueSave(7, played(10))).rejects.toThrow(/invalid save slot/i);
  });

  it('refuses to force-save to an invalid slot, and releases the lock it took', async () => {
    const { saveLoadMutex } = await import('@/utils/saveLoadMutex');

    await expect(forceSave(undefined as never, played(10))).rejects.toThrow(/invalid save slot/i);

    // The refusal happens after the mutex is acquired, so the finally must
    // still have run — otherwise every later save deadlocks for 30s.
    expect(saveLoadMutex.isHeld()).toBe(false);
  });

  it('still accepts a valid slot', async () => {
    await expect(queueSave(2, played(10))).resolves.not.toThrow();
  });
});

describe('replaying a queue from a previous session', () => {
  it('drops an operation that is too old to trust', async () => {
    persistQueueOf([
      { id: 'a', slot: 1, data: played(50), timestamp: Date.now() - 48 * 60 * 60 * 1000, retryCount: 0 },
    ]);

    await saveQueue.restoreOnStartup();

    expect(saveQueue.getStatus().queueLength).toBe(0);
  });

  it('drops a pristine unstarted state, whoever queued it', async () => {
    // The guard `saveGame` applies, moved to the replay boundary where it
    // cannot be bypassed by an operation persisted by an older build.
    persistQueueOf([
      { id: 'a', slot: 1, data: { ...initialGameState }, timestamp: Date.now(), retryCount: 0 },
    ]);

    await saveQueue.restoreOnStartup();

    expect(saveQueue.getStatus().queueLength).toBe(0);
  });

  it('drops an operation that would move the slot BACKWARDS', async () => {
    // The slot summary says the player has lived 900 weeks; the queued write
    // is from week 100. Replaying it is a rollback nobody asked for.
    const { writeSaveSlotMeta, extractSaveSlotMeta } = await import('@/utils/saveSlotMeta');
    await writeSaveSlotMeta(1, extractSaveSlotMeta(played(900))!);

    persistQueueOf([{ id: 'a', slot: 1, data: played(100), timestamp: Date.now(), retryCount: 0 }]);

    await saveQueue.restoreOnStartup();

    expect(saveQueue.getStatus().queueLength).toBe(0);
  });

  it('drops an operation whose slot is not writable', async () => {
    persistQueueOf([{ id: 'a', slot: 9, data: played(100), timestamp: Date.now(), retryCount: 0 }]);

    await saveQueue.restoreOnStartup();

    expect(saveQueue.getStatus().queueLength).toBe(0);
  });

  it('still replays a recent, real, forward-moving save — the case the queue exists for', async () => {
    persistQueueOf([
      { id: 'a', slot: 2, data: played(900), timestamp: Date.now() - 30_000, retryCount: 0 },
    ]);

    await saveQueue.restoreOnStartup();

    // It either drained already or is queued; what must NOT happen is a silent
    // drop, so wait for the write to actually reach storage.
    for (let i = 0; i < 50; i += 1) {
      if (store.has('save_slot_2_A') || store.has('save_slot_2_B')) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(store.has('save_slot_2_A') || store.has('save_slot_2_B')).toBe(true);

    // Let the queue's own post-save bookkeeping finish before the environment
    // is torn down, so the drain doesn't dangle past the suite.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});

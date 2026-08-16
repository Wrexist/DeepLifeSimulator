/**
 * F-9 — `queueSave` must not resolve until the write has landed.
 *
 * `saveGame` acquires the save/load mutex, awaits `queueSave(...)`, and releases
 * the lock in a `finally`. `addToQueue` resolved as soon as the operation was
 * PUSHED, so the mutex came off while `doubleBufferSave` was still writing the
 * slot — and a `loadGame` acquiring next read the slot mid-write. The lock was
 * protecting the enqueue, which needs no protection.
 *
 * The fix keeps the mutex where it is and makes the enqueuer's await span the
 * actual write. `performSave` deliberately does NOT take the mutex itself: the
 * enqueuer is still holding it and the mutex is not reentrant, so the drain
 * would block on a lock only the blocked enqueuer can release.
 */
import { saveQueue, queueSave } from '@/utils/saveQueue';

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

/** Lets the test hold `doubleBufferSave` open and observe who is waiting. */
let releaseWrite: (() => void) | null = null;
let writeStarted = 0;
const doubleBufferSave = jest.fn(async () => {
  writeStarted += 1;
  await new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
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

const state = { stats: { money: 10, gems: 0 }, weeksLived: 120, version: 43 };

/**
 * Read through a function so TypeScript does not narrow `releaseWrite` to the
 * `null` we just assigned — the mock reassigns it from inside the drain.
 */
const takeRelease = (): (() => void) | null => releaseWrite;

/** Let every already-scheduled microtask/macrotask run. */
const settleEventLoop = async () => {
  for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  store.clear();
  releaseWrite = null;
  writeStarted = 0;
  doubleBufferSave.mockClear();
  saveQueue.clearQueue();
});

describe('queueSave resolves on completion, not on enqueue', () => {
  it('stays pending while the slot write is still in flight', async () => {
    let resolved = false;
    const pending = queueSave(1, state).then(() => {
      resolved = true;
    });

    await settleEventLoop();

    // The write is open and the caller — which is holding the mutex — is still
    // waiting on it. Before the fix this flag was already true.
    expect(writeStarted).toBe(1);
    expect(resolved).toBe(false);

    releaseWrite?.();
    await pending;
    expect(resolved).toBe(true);
  });

  it('resolves once the write completes', async () => {
    const pending = queueSave(2, state);
    await settleEventLoop();
    releaseWrite?.();

    await expect(pending).resolves.toBeUndefined();
    expect(doubleBufferSave).toHaveBeenCalledTimes(1);
  });

  it('does not strand an operation enqueued as a drain is finishing', async () => {
    // The window: `processQueue` exits on an empty queue, but clears
    // `processingPromise` one microtask later. An operation pushed in between
    // used to see a non-null promise, start no drain, and sit in the queue
    // forever — which, now that the enqueuer awaits completion, would hang the
    // caller (and the mutex) instead of just landing late.
    const first = queueSave(1, state);
    await settleEventLoop();
    const finishFirst = takeRelease();
    releaseWrite = null;
    finishFirst?.();

    // Enqueue immediately behind the finishing drain, without letting the
    // event loop settle first.
    const second = queueSave(1, state);

    await settleEventLoop();
    takeRelease()?.();

    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(doubleBufferSave).toHaveBeenCalledTimes(2);
    expect(saveQueue.getStatus().queueLength).toBe(0);
  });

  it('does not resolve via the dying drain while its own write is in flight (F-9b)', async () => {
    // The stale-drain race: `processQueue` returns on an empty queue one
    // microtask before `processingPromise` clears, so an operation enqueued in
    // that window gets the OLD drain promise back from `kickProcessing()`.
    // Racing that stale promise resolved `queueSave` while this operation's
    // write had not even started — the mutex came off, and the mid-write
    // window F-9 exists to close was open again. The await must loop until
    // THIS operation settles, whatever drain promise it happened to see.
    const first = queueSave(1, state);
    await settleEventLoop();
    const finishFirst = takeRelease();
    releaseWrite = null;
    finishFirst?.();

    // Enqueue behind the finishing drain, without letting the loop settle.
    let secondResolved = false;
    const second = queueSave(1, state).then(() => {
      secondResolved = true;
    });

    await settleEventLoop();

    // The second write is open; its caller must still be waiting on it. With
    // the raced-stale-drain code this flag could already be true here.
    expect(writeStarted).toBe(2);
    expect(secondResolved).toBe(false);

    takeRelease()?.();
    await Promise.all([first, second]);
    expect(secondResolved).toBe(true);
  });

  it('keeps a running drain observed after clearQueue (F-12)', async () => {
    // `clearQueue` used to null `processingPromise` outright. Nothing cancels an
    // in-flight `performSave`, so the drain kept writing — it was merely no
    // longer OBSERVED. The next enqueue then saw a null promise and started a
    // SECOND concurrent drain, and `forceSave`'s "wait for queue processing to
    // complete" guard awaited only that new one, so it could overwrite the slot
    // while the original `doubleBufferSave` was still writing it.
    const first = queueSave(1, state);
    await settleEventLoop();
    expect(writeStarted).toBe(1);
    const finishFirst = takeRelease();

    saveQueue.clearQueue();

    // The drain is still running, so the queue must still say so.
    expect(saveQueue.getStatus().isProcessing).toBe(true);

    releaseWrite = null;
    const second = queueSave(1, state);
    await settleEventLoop();

    // The new operation joins the LIVE drain instead of opening a second
    // concurrent write onto the same slot. Before the fix this was 2.
    expect(writeStarted).toBe(1);
    expect(takeRelease()).toBeNull();

    finishFirst?.();
    await settleEventLoop();

    // Only once the first write finished does the drain pick the next one up.
    expect(writeStarted).toBe(2);
    takeRelease()?.();

    await Promise.all([first, second]);
    expect(saveQueue.getStatus().queueLength).toBe(0);
  });
});

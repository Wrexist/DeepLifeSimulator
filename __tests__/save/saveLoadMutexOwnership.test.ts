/**
 * A holder may only release its own lock.
 *
 * `release()` checked one thing: `if (!this.isLocked) return;`. It never asked
 * whether the caller was the holder. So after the 30-second watchdog
 * force-released a slow holder A and handed the lock to B, A's own
 * `finally { release() }` saw `isLocked === true` — B's lock — cleared B's
 * watchdog, unlocked, and shifted C off the queue. B and C then both believed
 * they held the mutex, and both wrote the same slot.
 *
 * The workaround at saveQueue.ts (`manageMutex=false`) names this failure mode
 * verbatim: "self-deadlocks until the 30s watchdog and then double-releases,
 * corrupting concurrent slot writes." It was patched at the one known call site
 * instead of in the mutex. 2026-07-29 audit PIPE-3.
 */
import { saveLoadMutex } from '@/utils/saveLoadMutex';

jest.useFakeTimers();

afterEach(() => {
  // Drain whatever the test left holding, so suites stay independent.
  for (let i = 0; i < 8 && saveLoadMutex.isHeld(); i += 1) saveLoadMutex.release();
  jest.clearAllTimers();
});

describe('mutex ownership', () => {
  it('hands out a token that releases the lock', async () => {
    const token = await saveLoadMutex.acquire('save');

    expect(saveLoadMutex.isHeld()).toBe(true);
    saveLoadMutex.release(token);
    expect(saveLoadMutex.isHeld()).toBe(false);
  });

  it('issues a DIFFERENT token to each holder', async () => {
    const first = await saveLoadMutex.acquire('save');
    saveLoadMutex.release(first);
    const second = await saveLoadMutex.acquire('load');

    expect(second).not.toBe(first);
    saveLoadMutex.release(second);
  });

  it('ignores a release from a holder whose lock was force-released', async () => {
    const staleToken = await saveLoadMutex.acquire('save', 30_000);

    // The watchdog fires: A is force-released and B takes the lock.
    jest.advanceTimersByTime(30_000);
    expect(saveLoadMutex.isHeld()).toBe(false);

    const bToken = await saveLoadMutex.acquire('save');
    expect(saveLoadMutex.isHeld()).toBe(true);

    // A finally finishes and releases. Under the old code this unlocked B.
    saveLoadMutex.release(staleToken);

    expect(saveLoadMutex.isHeld()).toBe(true);
    // And B's own release still works.
    saveLoadMutex.release(bToken);
    expect(saveLoadMutex.isHeld()).toBe(false);
  });

  it('does not let a stale release hand the lock to a THIRD waiter', async () => {
    const staleToken = await saveLoadMutex.acquire('save', 30_000);
    jest.advanceTimersByTime(30_000);

    const bToken = await saveLoadMutex.acquire('save');

    let cAcquired = false;
    const cPromise = saveLoadMutex.acquire('load').then((t) => {
      cAcquired = true;
      return t;
    });

    // The stale release must NOT pop C off the queue while B is still working.
    saveLoadMutex.release(staleToken);
    await Promise.resolve();
    jest.advanceTimersByTime(1);
    await Promise.resolve();

    // Assert on the LOCK, not on cAcquired: under the old code C's queue entry
    // ran (currentOperation flipped to 'load') a microtask before its `.then`
    // did, so the flag alone does not discriminate.
    expect(saveLoadMutex.isHeld()).toBe(true);
    expect(saveLoadMutex.getCurrentOperation()).toBe('save');
    expect(cAcquired).toBe(false);

    // B finishes properly; only then does C get it.
    saveLoadMutex.release(bToken);
    jest.advanceTimersByTime(1);
    const cToken = await cPromise;
    expect(cAcquired).toBe(true);
    saveLoadMutex.release(cToken);
  });

  it('still supports a token-less release, so an un-migrated site is not broken', async () => {
    await saveLoadMutex.acquire('save');
    saveLoadMutex.release();
    expect(saveLoadMutex.isHeld()).toBe(false);
  });

  it('reports which operation holds the lock', async () => {
    const token = await saveLoadMutex.acquire('load');
    expect(saveLoadMutex.getCurrentOperation()).toBe('load');
    saveLoadMutex.release(token);
    expect(saveLoadMutex.getCurrentOperation()).toBeNull();
  });
});

/**
 * C-1 (Round 8) regression: forceSave must NOT re-acquire the (non-reentrant)
 * save/load mutex when called from saveGame, which already holds it.
 *
 * The bug: saveGame() acquired saveLoadMutex, then (when force=true) awaited
 * forceSave(), which acquired the SAME singleton mutex again. Because the mutex
 * is a plain boolean lock, the nested acquire blocked for the full 30s watchdog
 * timeout and then the forced-release handed the lock to the queued waiter while
 * saveGame's finally double-released it — corrupting concurrent slot writes on
 * every in-app purchase (the only caller of saveGame(true)).
 *
 * The fix: forceSave takes a `manageMutex` flag (default true for standalone
 * callers). saveGame passes false because it already owns the lock.
 */

import { saveQueue, forceSave } from '@/utils/saveQueue';

const acquire = jest.fn().mockResolvedValue(undefined);
const release = jest.fn();

jest.mock('@/utils/saveLoadMutex', () => ({
  saveLoadMutex: {
    acquire: (...args: unknown[]) => acquire(...args),
    release: (...args: unknown[]) => release(...args),
    isHeld: () => false,
    getCurrentOperation: () => null,
  },
}));

// Mock the heavy persistence internals so the test is fast and deterministic.
// saveQueue statically imports isSaveSigningConfigError / SAVE_SIGNING_CONFIG_ERROR_CODE
// and dynamically imports createSaveEnvelope / doubleBufferSave — all must be present.
jest.mock('@/utils/saveValidation', () => ({
  createSaveEnvelope: (s: string) => s,
  doubleBufferSave: jest.fn().mockResolvedValue({ success: true }),
  isSaveSigningConfigError: () => false,
  SAVE_SIGNING_CONFIG_ERROR_CODE: 'SAVE_SIGNING_CONFIG_ERROR',
}));

const sampleData = { stats: { money: 0, gems: 0 }, version: 19 };

describe('forceSave mutex management (C-1)', () => {
  beforeEach(() => {
    acquire.mockClear();
    release.mockClear();
  });

  it('does NOT touch the mutex when manageMutex=false (saveGame already holds it)', async () => {
    await saveQueue.forceSave(1, sampleData, false);
    expect(acquire).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('acquires AND releases the mutex when called standalone (default)', async () => {
    await saveQueue.forceSave(1, sampleData);
    expect(acquire).toHaveBeenCalledWith('save');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('exported forceSave() helper forwards manageMutex through to the queue', async () => {
    await forceSave(1, sampleData, false);
    expect(acquire).not.toHaveBeenCalled();

    await forceSave(1, sampleData);
    expect(acquire).toHaveBeenCalledWith('save');
  });

  it('resolves promptly (no 30s deadlock) when the lock is conceptually held elsewhere', async () => {
    // With manageMutex=false the call must not await acquire at all, so it
    // resolves on the normal microtask timeline rather than the watchdog timeout.
    const start = Date.now();
    await saveQueue.forceSave(2, sampleData, false);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

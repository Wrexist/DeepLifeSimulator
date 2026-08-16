/**
 * `services/CloudSyncService.ts` must be INERT ON IMPORT.
 *
 * The service used to arm a network listener and a 30-second `setInterval` in
 * its constructor, and the module ran `getInstance()` at the bottom — so merely
 * importing the file started background work. It is imported for real: the
 * AppState listener in `contexts/game/GameActionsContext.tsx` requires it on
 * every background/foreground transition to call `pauseSync`/`resumeSync`.
 * Meanwhile everything in that file that moves a SAVE (`queueSync`, `sync`,
 * `downloadState`, `checkConflict`) has zero callers, so the timer was polling
 * on behalf of a feature that cannot do anything. 2026-08-16 architecture audit M6.
 *
 * The service is `require`d lazily inside each test, AFTER the spies exist — a
 * top-level `import` would run the module before anything could observe it,
 * which is precisely the failure mode under test.
 */

// The network side effect, as a module mock rather than a spy on the singleton:
// `jest.resetModules()` hands the service a FRESH copy of every module it
// imports, so a spy installed on one instance of `offlineManager` would not be
// the object the service reaches. A `jest.mock` factory survives the reset.
// (Name prefixed `mock` so the hoisted factory may close over it.)
const mockAddNetworkListener = jest.fn(() => () => {});
jest.mock('@/utils/offlineManager', () => ({
  offlineManager: {
    isConnected: () => true,
    addNetworkListener: mockAddNetworkListener,
  },
}));

describe('CloudSyncService import-time side effects', () => {
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockAddNetworkListener.mockClear();
    setIntervalSpy = jest.spyOn(global, 'setInterval');
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
  });

  it('importing the module starts no timer and registers no network listener', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/services/CloudSyncService');
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(mockAddNetworkListener).not.toHaveBeenCalled();
  });

  it('getting the singleton still starts nothing — construction is inert', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudSyncService } = require('@/services/CloudSyncService');
      const service = getCloudSyncService();
      expect(service).toBeDefined();
      expect(service.isStarted()).toBe(false);
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(mockAddNetworkListener).not.toHaveBeenCalled();
  });

  it('resumeSync on a service that was never started is a no-op', () => {
    // The live call site: the AppState listener calls `resumeSync()` on every
    // foreground. Without the `started` gate that would become a second,
    // accidental `start()` — the import-time side effect back through a side door.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudSyncService } = require('@/services/CloudSyncService');
      getCloudSyncService().resumeSync();
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('start() is what arms the listener and the timer, and is idempotent', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudSyncService } = require('@/services/CloudSyncService');
      const service = getCloudSyncService();

      // `finally`, not a trailing call: a failed assertion must still clear the
      // interval, or the leaked timer hangs the whole Jest worker.
      try {
        service.start();
        expect(service.isStarted()).toBe(true);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(mockAddNetworkListener).toHaveBeenCalledTimes(1);

        service.start();
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(mockAddNetworkListener).toHaveBeenCalledTimes(1);
      } finally {
        service.dispose();
      }

      expect(service.isStarted()).toBe(false);
    });
  });
});

/**
 * `resolveConflict('merge')` unions `achievements` and `relationships` by id but
 * takes every other field — `family.children` included — from whichever side won
 * on TIMESTAMP. A child in the loser's `relationships` therefore arrived with no
 * `family.children` entry: the exact family↔relationships split `loadGame`
 * reconciles on every load, and which the relationship validator reports as
 * corruption. The merge now finishes through the shared hydration, which owns
 * that reconciliation.
 */
describe('CloudSyncService.resolveConflict("merge")', () => {
  it('returns a state whose family and relationships agree', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');

    const local = createTestGameState({ weeksLived: 500, updatedAt: 2_000 });
    const remote = createTestGameState({ weeksLived: 500, updatedAt: 1_000 });
    // The child lives only on the side that LOSES the timestamp comparison, and
    // only in `relationships` — so nothing but the reconciliation can save it.
    remote.relationships = [
      { id: 'kid-m', name: 'Kid M', type: 'child', relationshipScore: 55 },
    ] as typeof remote.relationships;

    const merged = await getCloudSyncService().resolveConflict(local, remote, 'merge');

    expect(merged.relationships.map((r: { id: string }) => r.id)).toContain('kid-m');
    expect(merged.family.children.map((c: { id: string }) => c.id)).toContain('kid-m');
  });
});

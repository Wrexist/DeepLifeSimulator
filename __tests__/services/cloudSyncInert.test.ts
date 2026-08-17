/**
 * `services/CloudSyncService.ts` must be INERT ON IMPORT.
 *
 * The service used to arm a network listener and a 30-second `setInterval` in
 * its constructor, and the module ran `getInstance()` at the bottom — so merely
 * importing the file started background work. It is imported for real: the
 * AppState listener in `contexts/game/GameActionsContext.tsx` requires it on
 * every background/foreground transition to call `pauseSync`/`resumeSync`.
 * 2026-08-16 architecture audit M6.
 *
 * The save-moving half is wired now (device backup, `services/cloudBackup.ts`),
 * but ONLY behind the `cloudSave` flag: the sole caller of `start()` is the
 * flag-gated boot task in `app/_layout.tsx`. So the inertia rule is unchanged
 * and matters more, not less — in a build with the flag off, importing this
 * module still has to cost nothing.
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

// The transport and the storage layer, mocked for the identity/upload cases
// below. The inert cases above never reach either.
/** What `performUpload` hands the transport — every field is always sent. */
interface UploadCallPayload {
  state: unknown;
  updatedAt: number;
  userId: string;
  slotId: string;
  revision: number;
  hash: string;
  signature: string;
}
const mockUploadGameState = jest.fn(async (_save: UploadCallPayload) => ({ success: true }));
// The transport's self-reported health. `uploadGameState` returns
// `{success:true}` for writes it never made (disabled after repeated failures,
// or its `withErrorRecovery` fallback swallowing one), so this is the only
// evidence the service has that a write really happened.
let mockTransportStatus = { disabled: false, failureCount: 0, notificationShown: false };
const mockGetCloudSyncStatus = jest.fn(() => mockTransportStatus);
jest.mock('@/lib/progress/cloud', () => ({
  uploadGameState: mockUploadGameState,
  downloadGameState: jest.fn(async () => null),
  getCloudSyncStatus: mockGetCloudSyncStatus,
}));
const mockStorage = new Map<string, string>();
/** Keys whose write fails the way `safeSetItem` reports it: `false`, no throw. */
const mockUnwritableKeys = new Set<string>();
jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  safeSetItem: jest.fn(async (key: string, value: string) => {
    if (mockUnwritableKeys.has(key)) return false;
    mockStorage.set(key, value);
    return true;
  }),
}));

/** A fresh service (and fresh per-slot bookkeeping) for each upload case. */
function resetUploadHarness(): void {
  jest.resetModules();
  mockStorage.clear();
  mockUnwritableKeys.clear();
  mockUploadGameState.mockClear();
  mockTransportStatus = { disabled: false, failureCount: 0, notificationShown: false };
  // `mockReset` (not `mockClear`) so a queued `mockReturnValueOnce` from a
  // previous test cannot leak into this one.
  mockGetCloudSyncStatus.mockReset().mockImplementation(() => mockTransportStatus);
}

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
 * The identity a device backup uploads under.
 *
 * `resolveUserId` used to prefer `userProfile.username`, and `initialGameState`
 * ships `username: 'player'` — which passes the validity check. Every install
 * would therefore have uploaded to the single cloud key `player` and restored
 * whichever device wrote last. The identity is now the anonymous per-device id
 * in `cloud_user_id`, independent of game state, which also makes it stable in
 * the pre-game menus where no life is loaded.
 */
describe('CloudSyncService identity', () => {
  it('uploads under the stored device id, never the player-editable profile name', async () => {
    mockUploadGameState.mockClear();
    mockStorage.set('cloud_user_id', 'device_abc123');
    mockStorage.set('currentSlot', '2');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');

    const state = createTestGameState({ weeksLived: 700 });
    state.userProfile.username = 'player'; // the initialState default — see above
    const result = await getCloudSyncService().backupNow(state);

    expect(result.success).toBe(true);
    expect(mockUploadGameState).toHaveBeenCalledTimes(1);
    expect(mockUploadGameState.mock.calls[0][0]).toMatchObject({
      userId: 'device_abc123',
      slotId: 'slot_2',
    });
    // The revision is deliberately NOT `weeksLived` any more (see
    // `nextRevision`); it only has to be a positive int4. What this case pins
    // is the IDENTITY the upload goes out under.
    expect(Number.isInteger(mockUploadGameState.mock.calls[0][0].revision)).toBe(true);
    expect(mockUploadGameState.mock.calls[0][0].revision).toBeGreaterThanOrEqual(1);
  });

  /**
   * `resolveUserId` mints an id and persists it. The write result used to be
   * discarded, so a storage failure returned an id the device can never
   * recover: the next launch mints a DIFFERENT one and everything uploaded
   * under the first is orphaned in the cloud.
   */
  it('does not upload when a freshly minted device id cannot be persisted', async () => {
    resetUploadHarness();
    mockUnwritableKeys.add('cloud_user_id'); // no id stored, and the write fails

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');

    const result = await getCloudSyncService().backupNow(
      createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_000 })
    );

    expect(result.success).toBe(false);
    expect(mockUploadGameState).not.toHaveBeenCalled();
    expect(mockStorage.has('cloud_user_id')).toBe(false);
  });
});

/**
 * The upload revision — the number the backend orders backups by
 * (`revision integer CHECK (revision >= 1)`, and it answers `409 Stale
 * revision` to anything at or below what it already holds).
 *
 * It used to be `state.weeksLived`, which moves once per PLAYED GAME WEEK, so
 * every later save inside the same week produced the same number, the
 * already-synced guard skipped the upload, and both the automatic queue and
 * "Back up now" reported success while the cloud copy stayed behind.
 */
describe('CloudSyncService upload revision', () => {
  beforeEach(() => {
    resetUploadHarness();
    mockStorage.set('cloud_user_id', 'device_abc123');
    mockStorage.set('currentSlot', '1');
  });

  it('uploads BOTH of two saves made inside the same game week', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');
    const service = getCloudSyncService();

    // Identical `weeksLived`; only `updatedAt` moves — exactly what
    // `wrappedSetGameState` stamps on every committed mutation. The two are
    // 400 ms apart, i.e. inside the SAME wall-clock second, so this also pins
    // the sub-second case that a plain epoch-seconds revision would collapse.
    const first = createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_000 });
    const second = createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_400 });

    expect(await service.backupNow(first)).toEqual({ success: true, skipped: false });
    expect(await service.backupNow(second)).toEqual({ success: true, skipped: false });
    expect(mockUploadGameState).toHaveBeenCalledTimes(2);

    const revisions = mockUploadGameState.mock.calls.map(call => call[0].revision);
    expect(revisions[1]).toBeGreaterThan(revisions[0]);
    revisions.forEach(revision => {
      expect(Number.isInteger(revision)).toBe(true);
      expect(revision).toBeGreaterThanOrEqual(1);
      // int4: a raw `Date.now()` (epoch ms) would blow straight through this.
      expect(revision).toBeLessThanOrEqual(2147483647);
    });
  });

  it('still skips an upload when nothing changed since the last one', async () => {
    // The other half of the contract: "Back up now" pressed twice with no play
    // in between must not re-send an identical body (the Settings row says
    // "already up to date"). The guard is the STATE's `updatedAt`, not the
    // revision number.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');
    const service = getCloudSyncService();

    const state = createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_000 });

    expect(await service.backupNow(state)).toEqual({ success: true, skipped: false });
    expect(await service.backupNow(state)).toEqual({ success: true, skipped: true });
    expect(mockUploadGameState).toHaveBeenCalledTimes(1);
  });
});

/**
 * `uploadGameState` returns `{success:true}` for writes it never made — once
 * cloud sync has disabled itself after repeated failures, and whenever its
 * `withErrorRecovery` fallback swallows a failed write. Recording either as a
 * real backup advanced the synced revision (so later saves were skipped as
 * stale) and stamped a "last backed up" time for a backup that never happened.
 */
describe('CloudSyncService disabled-transport no-op', () => {
  beforeEach(() => {
    resetUploadHarness();
    mockStorage.set('cloud_user_id', 'device_abc123');
    mockStorage.set('currentSlot', '1');
  });

  it('records nothing when the transport is disabled, and still uploads once it recovers', async () => {
    mockTransportStatus = { disabled: true, failureCount: 3, notificationShown: false };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');
    const service = getCloudSyncService();
    const state = createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_000 });

    const result = await service.backupNow(state);

    expect(result.success).toBe(false);
    // No "last backup" time — neither in memory nor on disk.
    expect(await service.getLastBackupAt()).toBeNull();
    expect(mockStorage.has('cloud_backup_last_at')).toBe(false);

    // And nothing was recorded as synced, so the SAME state still uploads for
    // real once the transport recovers rather than being skipped as stale.
    mockTransportStatus = { disabled: false, failureCount: 0, notificationShown: false };
    expect(await service.backupNow(state)).toEqual({ success: true, skipped: false });
    expect(await service.getLastBackupAt()).toBeGreaterThan(0);
  });

  it('records nothing when the transport quietly fell back to local storage', async () => {
    // The `withErrorRecovery` fallback path: the write failed, the error was
    // swallowed, `uploadGameState` still answered `{success:true}`. The only
    // in-band trace is the raised failure count.
    mockGetCloudSyncStatus
      .mockReturnValueOnce({ disabled: false, failureCount: 0, notificationShown: false })
      .mockReturnValueOnce({ disabled: false, failureCount: 1, notificationShown: false });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudSyncService } = require('@/services/CloudSyncService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestGameState } = require('../helpers/createTestGameState');
    const service = getCloudSyncService();

    const result = await service.backupNow(
      createTestGameState({ weeksLived: 700, updatedAt: 1_800_000_000_000 })
    );

    expect(result.success).toBe(false);
    expect(await service.getLastBackupAt()).toBeNull();
    expect(mockStorage.has('cloud_backup_last_at')).toBe(false);
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

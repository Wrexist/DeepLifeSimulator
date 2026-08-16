/**
 * The cloud DEVICE BACKUP seam (`services/cloudBackup.ts`).
 *
 * Three things are worth pinning here, and only one of them is about the
 * network:
 *
 *   1. The FLAG is a real off switch. With `cloudSave` off, a successful save
 *      must reach nothing — no timer, no upload — because that is every build
 *      except `preview` today.
 *   2. The DEBOUNCE coalesces. `saveGame` fires on every week tick, every
 *      2-minute autosave and every background transition; two of those inside
 *      the window must produce ONE upload, carrying the LATEST state.
 *   3. The RESTORE verdict refuses a regression. `hydrateRemoteState` owns
 *      that rule (§4.2: `weeksLived` only grows), and this asserts the seam
 *      actually routes through it instead of applying whatever it downloaded.
 *
 * The service is mocked: this file is about the decision layer, not the
 * transport. `cloudSyncInert.test.ts` covers the service itself.
 */
import { createTestGameState } from '../helpers/createTestGameState';

const mockQueueSync = jest.fn(async (_state: unknown) => {});
const mockBackupNow = jest.fn(async () => ({ success: true }));
const mockDownloadState = jest.fn(async () => null as unknown);
const mockGetLastBackupAt = jest.fn(async () => 0);

// A module mock, not a spy: each case loads a FRESH copy of `cloudBackup`
// through `jest.isolateModules`, which hands it fresh copies of its imports
// too — so a spy on this module's live singleton would not be the object the
// module under test reaches. A `jest.mock` factory survives the reset.
// (Prefixed `mock` so the hoisted factory may close over it.)
let mockAutosaveSuspended = false;
jest.mock('@/utils/autosaveSuspension', () => ({
  isLifeAutosaveSuspended: () => mockAutosaveSuspended,
  lifeAutosaveSuspendReason: () => 'test',
  resumeLifeAutosave: jest.fn(),
  suspendLifeAutosave: jest.fn(),
}));

jest.mock('@/services/CloudSyncService', () => ({
  getCloudSyncService: () => ({
    queueSync: mockQueueSync,
    backupNow: mockBackupNow,
    downloadState: mockDownloadState,
    getLastBackupAt: mockGetLastBackupAt,
  }),
}));

type CloudBackupModule = typeof import('@/services/cloudBackup');

const CLOUD_ENV = {
  EXPO_PUBLIC_ENABLE_CLOUD_SAVE: 'true',
  EXPO_PUBLIC_CLOUD_SAVE_URL: 'https://example.test/functions/v1',
};

/**
 * Load a FRESH copy of the module with a given env.
 *
 * `FEATURE_FLAGS` is evaluated at module init, and the debounce state is
 * module-level, so both have to be re-created per case — a spy on a shared
 * instance would leak the previous test's armed timer into this one.
 */
function loadCloudBackup(env: Record<string, string>): CloudBackupModule {
  let mod!: CloudBackupModule;
  const previous = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('@/services/cloudBackup');
    });
  } finally {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
  return mod;
}

describe('cloud backup flag gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is OFF when neither env var is set — a save uploads nothing', () => {
    const mod = loadCloudBackup({});
    expect(mod.isCloudBackupEnabled()).toBe(false);

    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 200 }));
    expect(mod.hasPendingCloudBackup()).toBe(false);
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).not.toHaveBeenCalled();
  });

  it('is OFF when the flag is set but the URL is missing — the UI would be a dead end', () => {
    const mod = loadCloudBackup({ EXPO_PUBLIC_ENABLE_CLOUD_SAVE: 'true' });
    expect(mod.isCloudBackupEnabled()).toBe(false);
  });

  it('is ON with both, even under Boring Build — it is not a native SDK', () => {
    const mod = loadCloudBackup({ ...CLOUD_ENV, EXPO_PUBLIC_BORING_BUILD: 'true' });
    expect(mod.isCloudBackupEnabled()).toBe(true);
  });
});

describe('cloud backup debounce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces two saves inside the window into ONE upload, carrying the newest state', () => {
    const mod = loadCloudBackup(CLOUD_ENV);

    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 300 }));
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 301 }));
    expect(mockQueueSync).not.toHaveBeenCalled(); // nothing uploads inline

    jest.runOnlyPendingTimers();

    expect(mockQueueSync).toHaveBeenCalledTimes(1);
    expect(mockQueueSync.mock.calls[0][0]).toMatchObject({ weeksLived: 301 });
  });

  it('holds the next upload for the full interval after one has run', () => {
    const mod = loadCloudBackup(CLOUD_ENV);

    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 400 }));
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).toHaveBeenCalledTimes(1);

    // Two more saves a minute apart — still inside the window, so still one upload.
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 401 }));
    jest.advanceTimersByTime(60_000);
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 402 }));
    jest.advanceTimersByTime(60_000);
    expect(mockQueueSync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(mod.MIN_CLOUD_BACKUP_INTERVAL_MS);
    expect(mockQueueSync).toHaveBeenCalledTimes(2);
    expect(mockQueueSync.mock.calls[1][0]).toMatchObject({ weeksLived: 402 });
  });

  it('re-checks the suspension at FIRE time — the window is minutes long', () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 600 }));
    // The player walked out to the slot picker after the save, before the timer.
    mockAutosaveSuspended = true;
    try {
      jest.runOnlyPendingTimers();
      expect(mockQueueSync).not.toHaveBeenCalled();
    } finally {
      mockAutosaveSuspended = false;
    }
  });

  it('does not upload a life the player has walked out of (autosave suspended)', () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockAutosaveSuspended = true;
    try {
      mod.scheduleCloudBackup(createTestGameState({ weeksLived: 500 }));
      jest.runOnlyPendingTimers();
      expect(mockQueueSync).not.toHaveBeenCalled();
    } finally {
      mockAutosaveSuspended = false;
    }
  });
});

describe('cloud restore verdict', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a cloud copy that is BEHIND the live game, and says so', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 300 }));

    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 420 });

    expect(outcome.status).toBe('older');
    expect(outcome.message).toBe(mod.CLOUD_RESTORE_OLDER_MESSAGE);
    if (outcome.status === 'older') {
      expect(outcome.remoteWeeks).toBe(300);
      expect(outcome.localWeeks).toBe(420);
    }
  });

  it('applies a cloud copy that is ahead, hydrated rather than raw', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 500 }));

    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 420 });

    expect(outcome.status).toBe('applied');
    if (outcome.status === 'applied') {
      expect(outcome.state.weeksLived).toBe(500);
      // Hydration guarantees the shape the app runs, not just what was on the wire.
      expect(outcome.state.stats).toBeDefined();
      expect(Array.isArray(outcome.state.relationships)).toBe(true);
    }
  });

  it('reports an empty cloud slot instead of pretending something was restored', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(null);

    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 2, localWeeksLived: 100 });
    expect(outcome.status).toBe('empty');
  });

  it('refuses everything when the flag is off — no download is even attempted', async () => {
    const mod = loadCloudBackup({});
    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 0 });
    expect(outcome.status).toBe('disabled');
    expect(mockDownloadState).not.toHaveBeenCalled();
  });
});

describe('formatLastBackupLabel', () => {
  it('reads as a status line, and never claims a backup that never happened', () => {
    const now = 1_000_000_000_000;
    expect(mod0().formatLastBackupLabel(null, now)).toBe('Not backed up yet');
    expect(mod0().formatLastBackupLabel(0, now)).toBe('Not backed up yet');
    expect(mod0().formatLastBackupLabel(now - 30_000, now)).toBe('Last backup: just now');
    expect(mod0().formatLastBackupLabel(now - 12 * 60_000, now)).toBe('Last backup: 12 min ago');
    expect(mod0().formatLastBackupLabel(now - 3 * 3_600_000, now)).toBe('Last backup: 3h ago');
    expect(mod0().formatLastBackupLabel(now - 2 * 86_400_000, now)).toBe('Last backup: 2d ago');
  });
});

// The label is pure and flag-independent; one module copy is enough for it.
let cached: CloudBackupModule | null = null;
function mod0(): CloudBackupModule {
  if (!cached) cached = loadCloudBackup(CLOUD_ENV);
  return cached;
}

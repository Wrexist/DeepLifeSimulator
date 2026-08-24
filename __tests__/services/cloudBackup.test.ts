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
import { readFileSync } from 'fs';
import { join } from 'path';
import { CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { createTestGameState } from '../helpers/createTestGameState';

const mockQueueSync = jest.fn(async (_state: unknown) => {});
const mockBackupNow = jest.fn(
  async (): Promise<{ success: boolean; skipped?: boolean; error?: string }> => ({ success: true })
);
const mockDownloadState = jest.fn(async () => null as unknown);
const mockGetLastBackupAt = jest.fn(async () => 0);
// The slot-write path (`restoreCloudSaveToSlot`) reaches these through dynamic
// `import()`, so they are mocked rather than run: the real `forceSave` HMACs a
// ~100KB payload through the double-buffer writer, which has nothing to do with
// the verdict this file is about.
const mockForceSave = jest.fn(async (_slot: number, _data: unknown) => {});
const mockDeleteSaveSlotMeta = jest.fn(async (_slot: number) => {});

jest.mock('@/utils/saveQueue', () => ({
  forceSave: (slot: number, data: unknown) => mockForceSave(slot, data),
  queueSave: jest.fn(async () => {}),
}));

jest.mock('@/utils/saveSlotMeta', () => ({
  deleteSaveSlotMeta: (slot: number) => mockDeleteSaveSlotMeta(slot),
}));

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
  // All three are required: without the token the transport refuses every
  // read and write in a release build, so a two-var profile would be half-on.
  EXPO_PUBLIC_CLOUD_AUTH_TOKEN: 'test-token',
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

  it('is OFF when neither env var is set - a save uploads nothing', () => {
    const mod = loadCloudBackup({});
    expect(mod.isCloudBackupEnabled()).toBe(false);

    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 200 }));
    expect(mod.hasPendingCloudBackup()).toBe(false);
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).not.toHaveBeenCalled();
  });

  it('is OFF when the flag is set but the URL is missing - the UI would be a dead end', () => {
    const mod = loadCloudBackup({ EXPO_PUBLIC_ENABLE_CLOUD_SAVE: 'true' });
    expect(mod.isCloudBackupEnabled()).toBe(false);
  });

  it('is OFF when the auth token is missing - every write would be refused', () => {
    // The token is supplied by the EAS env store, not eas.json, so a profile
    // that declares the flag and URL alone resolves to off rather than
    // rendering Back up / Restore buttons whose every tap fails.
    const { EXPO_PUBLIC_CLOUD_AUTH_TOKEN: _omitted, ...withoutToken } = CLOUD_ENV;
    expect(loadCloudBackup(withoutToken).isCloudBackupEnabled()).toBe(false);
  });

  it('is ON with both, even under Boring Build - it is not a native SDK', () => {
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

  it('re-checks the suspension at FIRE time - the window is minutes long', () => {
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

  it('releases the window when the queue REJECTS - nothing was uploaded, so nothing was spent', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockQueueSync.mockRejectedValueOnce(new Error('queue refused the state'));

    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 700 }));
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).toHaveBeenCalledTimes(1);
    // Let the rejection's `catch` run — fake timers do not fake microtasks.
    await Promise.resolve();
    await Promise.resolve();

    // The very next save must be able to try again. Contrast with the case
    // above, where a SUCCESSFUL upload holds the next one for the full window.
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 701 }));
    jest.advanceTimersByTime(0);

    expect(mockQueueSync).toHaveBeenCalledTimes(2);
    expect(mockQueueSync.mock.calls[1][0]).toMatchObject({ weeksLived: 701 });
  });

  it('resetCloudBackupSchedule drops an armed upload outright', () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 250 }));
    expect(mod.hasPendingCloudBackup()).toBe(true);

    mod.resetCloudBackupSchedule();

    expect(mod.hasPendingCloudBackup()).toBe(false);
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).not.toHaveBeenCalled();
  });
});

describe('manual "Back up now"', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports success, and says so distinctly when the cloud is already current', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    const state = createTestGameState({ weeksLived: 120 });

    mockBackupNow.mockResolvedValueOnce({ success: true });
    await expect(mod.backUpNow(state)).resolves.toMatchObject({ success: true });

    mockBackupNow.mockResolvedValueOnce({ success: true, skipped: true });
    const skipped = await mod.backUpNow(state);
    expect(skipped).toEqual({ success: true, message: 'Your cloud backup is already up to date.' });
  });

  it('RESOLVES a failure message when the service REJECTS, instead of rejecting', async () => {
    // The button handler is invoked as `void handleBackUp()` and only alerts on
    // the resolved value, so a rejection here is an unhandled promise rejection
    // and a tap that gets no answer at all.
    const mod = loadCloudBackup(CLOUD_ENV);
    mockBackupNow.mockRejectedValueOnce(new Error('socket hang up'));

    const result = await mod.backUpNow(createTestGameState({ weeksLived: 130 }));

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Check your connection/);
  });

  it('does not hold the debounce window after a rejected manual push', async () => {
    jest.useFakeTimers();
    try {
      const mod = loadCloudBackup(CLOUD_ENV);
      mockBackupNow.mockRejectedValueOnce(new Error('socket hang up'));
      await mod.backUpNow(createTestGameState({ weeksLived: 140 }));

      mod.scheduleCloudBackup(createTestGameState({ weeksLived: 141 }));
      jest.advanceTimersByTime(0);

      expect(mockQueueSync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers with the flag refusal instead of touching the service when cloud save is off', async () => {
    const mod = loadCloudBackup({});
    const result = await mod.backUpNow(createTestGameState({ weeksLived: 150 }));
    expect(result.success).toBe(false);
    expect(mockBackupNow).not.toHaveBeenCalled();
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

  it('refuses everything when the flag is off - no download is even attempted', async () => {
    const mod = loadCloudBackup({});
    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 0 });
    expect(outcome.status).toBe('disabled');
    expect(mockDownloadState).not.toHaveBeenCalled();
  });

  it('refuses a copy written by a NEWER build rather than repairing it down', async () => {
    // The one refusal that has to come from the MIGRATION step: a future-version
    // save cannot be safely stepped down, and repairing it would strip whatever
    // the newer build added. `runMigrations` flags it; this asserts the seam
    // reports it instead of hydrating whatever survived.
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce({
      ...createTestGameState({ weeksLived: 900 }),
      version: CURRENT_STATE_VERSION + 5,
    });

    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 100 });

    expect(outcome.status).toBe('future');
    expect(outcome.message).toMatch(/newer version of the app/i);
  });

  it('never claims a restore it did not perform - the verdict is not persisted', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 500 }));

    const outcome = await mod.fetchCloudRestoreCandidate({ slot: 1, localWeeksLived: 420 });

    // It downloads and hydrates; applying is the caller's half, so nothing is
    // on disk yet and the flag has to say so.
    expect(outcome).toMatchObject({ status: 'applied', persisted: false });
    expect(mockForceSave).not.toHaveBeenCalled();
  });
});

describe('cloud restore into a SLOT (the pre-game path)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes the blob, drops the cached slot summary, and reports it persisted', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 800 }));

    const outcome = await mod.restoreCloudSaveToSlot(3, 100);

    expect(outcome).toMatchObject({ status: 'applied', persisted: true });
    expect(mockForceSave).toHaveBeenCalledTimes(1);
    expect(mockForceSave.mock.calls[0][0]).toBe(3);
    expect(mockDeleteSaveSlotMeta).toHaveBeenCalledWith(3);
  });

  it('reports an error when the slot write REJECTS, and does not stale the summary', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 800 }));
    mockForceSave.mockRejectedValueOnce(new Error('disk full'));

    const outcome = await mod.restoreCloudSaveToSlot(2, 100);

    expect(outcome.status).toBe('error');
    expect(outcome.message).toMatch(/could not be written to this slot/);
    // The cached summary still matches what is actually on disk — dropping it
    // after a failed write would make the slot card re-derive from the OLD blob
    // and look like something changed.
    expect(mockDeleteSaveSlotMeta).not.toHaveBeenCalled();
  });

  it('drops an auto-upload armed with the PRE-restore state', async () => {
    const mod = loadCloudBackup(CLOUD_ENV);
    // The last in-game save armed an upload carrying the life the player then
    // walked out of. If it fired after the restore it would push that state
    // over the cloud copy this restore just pulled down.
    mod.scheduleCloudBackup(createTestGameState({ weeksLived: 300 }));
    expect(mod.hasPendingCloudBackup()).toBe(true);

    mockDownloadState.mockResolvedValueOnce(createTestGameState({ weeksLived: 800 }));
    const outcome = await mod.restoreCloudSaveToSlot(1, 100);

    expect(outcome.status).toBe('applied');
    expect(mod.hasPendingCloudBackup()).toBe(false);
    jest.runOnlyPendingTimers();
    expect(mockQueueSync).not.toHaveBeenCalled();
  });
});

/**
 * The LIVE-game half of the restore lives in `contexts/game/GameActionsContext.tsx`
 * (it needs `setGameState` + `saveGame`, so it cannot live in this module).
 * Two rules there are ordering/wording rules that no unit of this module can
 * observe, so they are pinned against the source — the same mechanism
 * `__tests__/save/autosaveSuspension.test.ts` uses for its ordering rule.
 */
describe('the live-game restore (contexts/game/GameActionsContext.tsx)', () => {
  const source = readFileSync(join(__dirname, '../../contexts/game/GameActionsContext.tsx'), 'utf8');
  const restoreBody = source.slice(
    source.indexOf('const restoreFromCloud'),
    source.indexOf('const nextWeekInProgressRef')
  );

  it('slices out a real function body', () => {
    expect(restoreBody).toContain('fetchCloudRestoreCandidate');
    expect(restoreBody.length).toBeGreaterThan(200);
  });

  it('disarms the armed upload BEFORE the live state is replaced', () => {
    const disarm = restoreBody.indexOf('resetCloudBackupSchedule()');
    const swap = restoreBody.indexOf('setGameState(outcome.state)');
    expect(disarm).toBeGreaterThan(-1);
    expect(swap).toBeGreaterThan(-1);
    // After the swap is too late: the upload is a timer callback carrying the
    // PRE-restore state, and it would land on the cloud copy the restore came
    // from — the restore destroying its own backup.
    expect(disarm).toBeLessThan(swap);
  });

  it('reports a failed persist as live-but-unsaved instead of a clean restore', () => {
    expect(restoreBody).toContain('persisted: false, message: CLOUD_RESTORE_UNSAVED_MESSAGE');
    expect(restoreBody).toContain('persisted: true');
  });
});

describe('CLOUD_RESTORE_UNSAVED_MESSAGE', () => {
  it('tells the player the restore is live but NOT saved, and what that costs', () => {
    const message = mod0().CLOUD_RESTORE_UNSAVED_MESSAGE;
    expect(message).toMatch(/restored/i);
    expect(message).toMatch(/could not be saved/i);
    // The consequence is the part a player can act on: closing the app now
    // brings the replaced save back.
    expect(message).toMatch(/previous save/i);
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

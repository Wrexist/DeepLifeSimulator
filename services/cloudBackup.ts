/**
 * Cloud DEVICE BACKUP — the seam between the app and `CloudSyncService`.
 *
 * Everything here is a no-op unless the `cloudSave` flag is on, which requires
 * BOTH `EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true` and a non-empty
 * `EXPO_PUBLIC_CLOUD_SAVE_URL` (`lib/config/featureFlags.ts`). Shipping to the
 * `preview` profile first is the owner's rollout decision.
 *
 * Three jobs, deliberately in one module so the flag check, the debounce and
 * the restore verdict cannot drift apart between their call sites:
 *
 *   1. `scheduleCloudBackup` — the auto-upload hook, called from `saveGame`
 *      after a save actually succeeded.
 *   2. `backUpNow` — the Settings "Back up now" button, which needs an answer.
 *   3. `fetchCloudRestoreCandidate` — the download + migrate + hydrate verdict
 *      shared by the Settings row and the SaveSlots restore offer. It does NOT
 *      apply anything: applying a state is the caller's business, because the
 *      live-game path (set state + save) and the pre-game path (write the slot
 *      blob) are genuinely different.
 *
 * WHY THE DEBOUNCE. `saveGame` fires on every `nextWeek`, on a 2-minute
 * autosave timer, on backgrounding, and after each IAP grant — uploading a
 * multi-MB blob on each of those would be a battery and data-plan bug, and the
 * backend rate limiter (`rateLimited('CLOUD_SYNC')`) would drop most of them
 * anyway. One upload per window, carrying the LATEST state, is what a backup
 * actually needs.
 */
import type { GameState } from '@/contexts/game/types';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { isLifeAutosaveSuspended } from '@/utils/autosaveSuspension';
import { hydrateRemoteState } from '@/utils/hydrateLoadedState';
import { logger } from '@/utils/logger';
import { getCloudSyncService } from './CloudSyncService';

/**
 * Minimum spacing between automatic uploads, in ms.
 *
 * 5 minutes. Chosen against what it is protecting: a full save blob is
 * hundreds of KB to a few MB, `saveGame` can fire several times a minute
 * during fast play, and the value of a backup barely changes between two
 * saves five minutes apart — losing at most five minutes of play to a lost
 * device is the trade this buys. Not shorter, because the rate limiter and the
 * upload cost are real; not longer, because a backup a player cannot feel is
 * one they will not trust.
 */
export const MIN_CLOUD_BACKUP_INTERVAL_MS = 5 * 60 * 1000;

/** Shown when the cloud copy is BEHIND the live game (`hydrateRemoteState` refuses it). */
export const CLOUD_RESTORE_OLDER_MESSAGE =
  'Cloud save is older than your current game, so restoring it would erase weeks you already played. Nothing was changed.';

/**
 * Shown when the backup WAS applied over the live game but could not be written
 * to disk (`saveGame` refused or threw).
 *
 * The distinction is not pedantic: the player is looking at the restored life,
 * so "nothing was restored" would be a lie — but the slot on disk still holds
 * the state it replaced, so the next load brings the old life back. Saying
 * "restored" and stopping there is the version of this that loses a save and
 * blames the player for closing the app.
 */
export const CLOUD_RESTORE_UNSAVED_MESSAGE =
  'Your cloud backup was restored and is running now, but it could not be saved to this device. Keep playing to save it — if you close the game first, your previous save comes back.';

export type CloudRestoreOutcome =
  | {
      status: 'applied';
      state: GameState;
      localWeeks: number;
      remoteWeeks: number;
      message: string;
      /**
       * Is the restored state ON DISK?
       *
       * A separate field rather than a sixth `status`, because "applied" is what
       * every caller branches on to decide whether a life was actually replaced —
       * folding a persist failure into the status would make each of them treat a
       * live restore as a refusal. `fetchCloudRestoreCandidate` returns `false`:
       * it downloads and hydrates, and deliberately applies nothing (the caller
       * owns that half), so nothing has been written when it hands the verdict
       * back. The caller that persists stamps `true`.
       */
      persisted: boolean;
    }
  | { status: 'disabled'; message: string }
  | { status: 'empty'; message: string }
  | { status: 'older'; localWeeks: number; remoteWeeks: number; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'future'; message: string }
  | { status: 'error'; message: string };

export function isCloudBackupEnabled(): boolean {
  return isFeatureEnabled('cloudSave');
}

// ── The debounce ───────────────────────────────────────────────────────────
// Module-level, because there is exactly one device and one upload pipeline.
let pendingState: GameState | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastUploadStartedAt = 0;

/**
 * Note that a local save succeeded; queue a cloud upload, coalesced.
 *
 * SYNCHRONOUS BY CONTRACT. The only work it does inline is arming a timer, so
 * the caller (`saveGame`, which is holding the save/load mutex when it calls
 * this) never waits on the network and never holds the mutex across it. The
 * upload itself happens in the timer callback, long after the mutex is
 * released, via `queueSync` — the service owns the retry/offline handling.
 *
 * Two saves inside the window produce ONE upload, carrying whichever state was
 * newest when the timer fired.
 */
export function scheduleCloudBackup(state: GameState): void {
  if (!isCloudBackupEnabled()) return;
  // R3-S1 parity with `saveGame`: the player is out in the pre-game stack and
  // the loaded life is not authoritative. Uploading it would push a state the
  // menus have just deleted or replaced over the cloud copy.
  if (isLifeAutosaveSuspended()) return;

  pendingState = state;
  // A timer is already armed — this save just replaces the payload. This is
  // what collapses a burst of saves into a single upload.
  if (pendingTimer) return;

  const elapsed = Date.now() - lastUploadStartedAt;
  const wait = lastUploadStartedAt === 0 ? 0 : Math.max(0, MIN_CLOUD_BACKUP_INTERVAL_MS - elapsed);

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const state2 = pendingState;
    pendingState = null;
    if (!state2) return;
    // Re-checked at FIRE time, not just at schedule time: the window is
    // minutes long, and the player can have walked out to the menus since.
    if (!isCloudBackupEnabled() || isLifeAutosaveSuspended()) return;
    const startedAt = Date.now();
    lastUploadStartedAt = startedAt;
    void getCloudSyncService()
      .queueSync(state2)
      .catch((error) => {
        logger.warn('[CloudBackup] Scheduled upload failed to queue', { error });
        // The upload never started, so the window it consumed was never earned.
        // Leaving the marker set makes the NEXT save wait the full 5 minutes for
        // an upload that did not happen — the debounce exists to space out real
        // uploads, not to punish a failed enqueue. Guarded on the marker still
        // being OURS: a manual `backUpNow` can have run between the throw and
        // this microtask, and clearing its marker would drop a real window.
        if (lastUploadStartedAt === startedAt) lastUploadStartedAt = 0;
      });
  }, wait);

  // Never keep the JS runtime alive for a backup (Node/Jest only; RN's timer
  // handles have no `unref`).
  const handle = pendingTimer as unknown as { unref?: () => void };
  if (typeof handle?.unref === 'function') handle.unref();
}

/** Drop any armed upload. Called on teardown and by tests. */
export function resetCloudBackupSchedule(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  pendingState = null;
  lastUploadStartedAt = 0;
}

/** True while an upload is armed but not yet fired (diagnostics + tests). */
export function hasPendingCloudBackup(): boolean {
  return pendingTimer !== null;
}

/**
 * The Settings "Back up now" button: upload immediately and report what
 * happened. Resets the debounce window so the manual push counts as the most
 * recent upload.
 *
 * NEVER REJECTS. The caller is a button handler that shows an Alert in its
 * happy path only (`components/settings/CloudBackupRow.tsx`), invoked as
 * `void handleBackUp()` — so a rejection here reaches the player as an
 * unhandled promise rejection and a row that answers a deliberate tap with
 * silence. `CloudSyncService.backupNow` catches its own errors today, but that
 * is its choice to change, and it is one `await` away from being wrong here.
 */
export async function backUpNow(state: GameState): Promise<{ success: boolean; message: string }> {
  if (!isCloudBackupEnabled()) {
    return { success: false, message: 'Cloud backup is not available in this build.' };
  }
  const startedAt = Date.now();
  lastUploadStartedAt = startedAt;
  try {
    const result = await getCloudSyncService().backupNow(state);
    if (result.success) {
      return {
        success: true,
        message: result.skipped
          ? 'Your cloud backup is already up to date.'
          : 'Your game was backed up to the cloud.',
      };
    }
    return {
      success: false,
      message: result.error
        ? `Backup failed: ${result.error}`
        : 'Backup failed. Check your connection and try again.',
    };
  } catch (error) {
    logger.error('[CloudBackup] Manual backup threw', { error });
    // Same reasoning as the scheduled path: no upload landed, so the debounce
    // window it claimed is released rather than charged to the next autosave.
    if (lastUploadStartedAt === startedAt) lastUploadStartedAt = 0;
    return { success: false, message: 'Backup failed. Check your connection and try again.' };
  }
}

/** Epoch ms of the last successful upload from this device, or null. */
export async function getLastCloudBackupAt(): Promise<number | null> {
  if (!isCloudBackupEnabled()) return null;
  try {
    return await getCloudSyncService().getLastBackupAt();
  } catch (error) {
    // Null renders as "Not backed up yet" — indistinguishable from a device
    // that genuinely never uploaded, which is the one reading a player would
    // act on. Swallowing the cause left nothing to diagnose it with.
    logger.warn('[CloudBackup] Could not read the last backup timestamp', { error });
    return null;
  }
}

/** "Last backup: 12 minutes ago" — the Settings status line. Pure, so it is testable. */
export function formatLastBackupLabel(at: number | null, now: number = Date.now()): string {
  if (!at || !Number.isFinite(at) || at <= 0) return 'Not backed up yet';
  const minutes = Math.floor(Math.max(0, now - at) / 60000);
  if (minutes < 1) return 'Last backup: just now';
  if (minutes < 60) return `Last backup: ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last backup: ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last backup: ${days}d ago`;
}

/**
 * Download the cloud save for a slot and decide whether it may be applied.
 *
 * The order is the one `loadGame` uses and is not optional: migrate FIRST
 * (a cloud copy can be older — or newer — than this build's STATE_VERSION,
 * and a future-version save must be refused rather than repaired), then run
 * the shared hydration through `hydrateRemoteState`, which re-validates and
 * refuses a state whose `weeksLived` sits behind the local one (§4.2 — the
 * absolute counter only grows, so a behind-remote is a rollback of weeks
 * actually played).
 *
 * The refusal is REPORTED, never overridable. There is no confirm-to-overwrite
 * option because there is nothing to confirm: the guard fires exactly when the
 * cloud copy is strictly worse than what the player has, and "are you sure you
 * want to lose progress?" on a question nobody asked is a trap, not a choice
 * (the same reasoning `hydrateRemoteState` records for the conflict path).
 */
export async function fetchCloudRestoreCandidate(options: {
  slot?: number;
  localWeeksLived: number;
  localState?: GameState;
}): Promise<CloudRestoreOutcome> {
  if (!isCloudBackupEnabled()) {
    return { status: 'disabled', message: 'Cloud backup is not available in this build.' };
  }

  try {
    const remoteRaw = await getCloudSyncService().downloadState(options.localState, {
      slot: options.slot,
      detectConflicts: false,
    });
    if (!remoteRaw) {
      return { status: 'empty', message: 'No cloud backup was found for this slot.' };
    }

    let remote: unknown = remoteRaw;
    try {
      const { runMigrations } = await import('@/utils/saveMigrations');
      const migrationResult = runMigrations(remote);
      if (migrationResult.versionFromFuture) {
        return {
          status: 'future',
          message: 'This cloud backup was made by a newer version of the app. Update the app and try again.',
        };
      }
      remote = migrationResult.state;
    } catch (migrationError) {
      logger.error('[CloudBackup] Migration of cloud state failed', { error: migrationError });
      return { status: 'invalid', message: 'This cloud backup could not be read and was not applied.' };
    }

    const decision = hydrateRemoteState(remote, {
      localWeeksLived: options.localWeeksLived,
      source: `cloudBackup:restore${options.slot ? `-slot-${options.slot}` : ''}`,
      logTag: '[CloudBackup]',
    });

    if (!decision.applied) {
      if (decision.reason === 'regression') {
        return {
          status: 'older',
          localWeeks: decision.localWeeks,
          remoteWeeks: decision.remoteWeeks,
          message: CLOUD_RESTORE_OLDER_MESSAGE,
        };
      }
      return { status: 'invalid', message: 'This cloud backup could not be read and was not applied.' };
    }

    if (decision.repairs.length > 0) {
      logger.warn('[CloudBackup] Restored state required repair:', decision.repairs);
    }

    return {
      status: 'applied',
      state: decision.state,
      localWeeks: decision.localWeeks,
      remoteWeeks: decision.remoteWeeks,
      message: 'Your cloud backup was restored.',
      // Nothing has been written yet — this function only produces the verdict.
      // Whoever applies it stamps `true` once the state is on disk.
      persisted: false,
    };
  } catch (error) {
    logger.error('[CloudBackup] Restore failed', { error });
    return { status: 'error', message: 'Could not reach the cloud backup. Check your connection and try again.' };
  }
}

/**
 * Is there a cloud backup for this slot that is AHEAD of the local copy?
 *
 * What SaveSlots offers a restore on. Cheap to reason about, not cheap to run
 * (it downloads the save), so callers must gate it on the flag and run it off
 * the render path. `remoteWeeks` is `weeksLived`, the absolute counter — the
 * same measure `hydrateRemoteState` uses to refuse a regression, so a slot that
 * shows an offer here cannot then be refused as "older".
 */
export async function probeCloudSlot(
  slot: number,
  localWeeksLived: number
): Promise<{ newer: boolean; remoteWeeks: number } | null> {
  if (!isCloudBackupEnabled()) return null;
  try {
    const remote = await getCloudSyncService().downloadState(undefined, { slot, detectConflicts: false });
    if (!remote) return null;
    const remoteWeeks = typeof remote.weeksLived === 'number' ? remote.weeksLived : 0;
    return { newer: remoteWeeks > localWeeksLived, remoteWeeks };
  } catch (error) {
    logger.warn('[CloudBackup] Cloud slot probe failed', { slot, error });
    return null;
  }
}

/**
 * Restore a slot's cloud backup into the SLOT ON DISK, without touching live
 * state. The pre-game path: SaveSlots has no life loaded, so there is nothing
 * to `setGameState` — the player picks the slot and taps Continue afterwards,
 * and `loadGame` runs its own hydration over what this wrote.
 *
 * `forceSave` (not `queueSave`) because the write must be on disk before the
 * screen re-reads the slot, and it manages the save/load mutex itself here —
 * unlike the `saveGame` call site, nothing in the menus is already holding it.
 */
export async function restoreCloudSaveToSlot(
  slot: number,
  localWeeksLived: number
): Promise<CloudRestoreOutcome> {
  const outcome = await fetchCloudRestoreCandidate({ slot, localWeeksLived });
  if (outcome.status !== 'applied') return outcome;

  // Drop any auto-upload still armed with the PRE-restore live state. The
  // window is minutes long, so a timer armed by the last in-game save can
  // easily outlive the walk out to the slot picker; if it fired now it would
  // push that state over the very cloud copy this restore just pulled down —
  // the restore destroying its own backup. `isLifeAutosaveSuspended` already
  // refuses it on the normal navigation paths (Settings → Switch Save Slot,
  // death → Save Slots), but that is a property of how the player GOT here, not
  // of this operation, so it is not something to lean on.
  resetCloudBackupSchedule();

  try {
    const [{ forceSave }, { deleteSaveSlotMeta }] = await Promise.all([
      import('@/utils/saveQueue'),
      import('@/utils/saveSlotMeta'),
    ]);
    await forceSave(slot, {
      ...outcome.state,
      lastSaved: new Date().toISOString(),
      updatedAt: Date.now(),
    });
    // The blob changed underneath the cached summary — drop it so the slot card
    // re-derives from what was actually written (the RestoreBackupSheet rule).
    await deleteSaveSlotMeta(slot);
  } catch (error) {
    logger.error('[CloudBackup] Failed to write restored cloud save to slot', { slot, error });
    return { status: 'error', message: 'The cloud backup was downloaded but could not be written to this slot.' };
  }

  // The blob is on disk — unlike the live-game path, there is no in-memory copy
  // that could outlive a failed write, because the `catch` above returns an
  // error rather than an `applied` outcome.
  return { ...outcome, persisted: true };
}

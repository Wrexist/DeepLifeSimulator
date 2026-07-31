/**
 * Phantom-save self-heal.
 *
 * Builds ≤ 2.5.6 could persist the pristine boot state on a clean install: the
 * background/periodic autosave fired while the user was still on the main
 * menu and wrote the untouched default ("Unnamed Character" · $200 · age 18 ·
 * 0 weeks) into slot 1, which also set `lastSlot` and lit up the Continue
 * card. `saveGame` now refuses to persist such states, but installs that
 * already have the phantom on disk keep showing it — this module deletes it.
 *
 * Safety: a slot is only purged after decoding its FULL blob and confirming
 * `isPristineUnstartedState` (no scenario chosen AND no character name).
 * Every real save has both, because onboarding requires a scenario and a
 * name before a game can exist. Unreadable/corrupt blobs are never touched.
 */
import { logger as _loggerForStorage } from '@/utils/logger';

/**
 * LAZY. This was the only static top-level `@react-native-async-storage`
 * import left in the app source — every other module (`safeStorage`,
 * `saveValidation`, `ErrorBoundary`, `bootBreadcrumbs`, …) uses this
 * require-in-a-getter pattern, and CLAUDE.md §4.6 requires it: "Load native
 * modules lazily via `require()` in a try/catch, never at module top level."
 *
 * It mattered here because `MainMenu` — the first screen the router navigates
 * to — imports `saveSlotMetaLooksPhantom` from this file statically. That is a
 * two-line pure function needing no storage at all, but the import dragged an
 * eager AsyncStorage module init into MainMenu's graph. If the TurboModule is
 * not ready at that point the failure lands during module evaluation of the
 * first screen, which is the blank-launch / "Element type is invalid" class
 * this repo has already shipped twice. MainMenu even imports the LAZY wrapper
 * one line earlier for its own use. 2026-07-30 audit SAVE-2.
 */
let _asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _loadAttempted = false;

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  if (_asyncStorage) return _asyncStorage;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch {
    _loggerForStorage.warn('[PhantomSaveCleanup] AsyncStorage unavailable');
    return null;
  }
}

/** Same surface the module used before, minus the eager module init. */
const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const s = getAsyncStorage();
    return s ? s.getItem(key) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const s = getAsyncStorage();
    if (s) await s.setItem(key, value);
  },
  async multiRemove(keys: string[]): Promise<void> {
    const s = getAsyncStorage();
    if (s) await s.multiRemove(keys);
  },
};
import { logger } from '@/utils/logger';
import { readSaveSlotMeta, deleteSaveSlotMeta, type SaveSlotMeta } from '@/utils/saveSlotMeta';

const log = logger.scope('PhantomSaveCleanup');

/** Cheap pre-filter: only a summary like this can possibly be a phantom. */
export function saveSlotMetaLooksPhantom(meta: SaveSlotMeta): boolean {
  return meta.name.trim().length === 0 && meta.weeksLived === 0;
}

/**
 * Verify a suspicious slot against its full blob and delete it if it is the
 * pristine unstarted state. Returns true when the slot was purged.
 * Never throws.
 */
export async function purgeSlotIfPhantom(slot: number): Promise<boolean> {
  try {
    const {
      readSaveSlotDetailed,
      decodePersistedSaveEnvelope,
      shouldAllowUnsignedLegacySaves,
      isPristineUnstartedState,
      deleteSaveSlot,
    } = await import('@/utils/saveValidation');

    const allowLegacy = shouldAllowUnsignedLegacySaves();
    const read = await readSaveSlotDetailed(slot, undefined, { allowLegacy });
    const raw = read.data;

    // A slot we merely could not READ is not a phantom. This used to fall
    // straight through to the marker-clearing below and report `true`, so an
    // unverifiable save (an HMAC key change, a transient storage failure) had
    // its summary and slot pointers wiped and its Continue card vanished —
    // while the blob itself sat on disk, recoverable and unreachable.
    // 2026-07-29 audit SAVE-OW-8.
    if (!raw && read.blobPresent) {
      log.warn('Slot has unreadable data — not treating it as a phantom', {
        slot,
        source: read.source,
      });
      return false;
    }

    if (raw) {
      const decoded = decodePersistedSaveEnvelope(raw, { allowLegacy });
      // Unreadable / unverifiable blob → leave it alone (might be recoverable).
      if (!decoded.valid || typeof decoded.data !== 'string') return false;

      let parsed: unknown;
      try {
        parsed = JSON.parse(decoded.data);
      } catch {
        return false;
      }
      if (!isPristineUnstartedState(parsed)) return false;

      await deleteSaveSlot(slot);
      // Best-effort cleanup: once the blob itself is gone the purge HAS
      // happened — a backup/protected-state failure must not flip the return
      // to "not purged" (MainMenu would re-show a Continue card for a slot
      // that no longer exists).
      try {
        const { deleteAllBackupsForSlot, clearProtectedState } = await import('@/utils/saveBackup');
        await deleteAllBackupsForSlot(slot);
        await clearProtectedState(slot);
      } catch (cleanupError) {
        log.warn('Backup/protected-state cleanup failed after phantom purge (non-critical)', {
          slot,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
    // Blob already gone (or just deleted): clear the summary either way so the
    // pre-game screens stop advertising the phantom.
    await deleteSaveSlotMeta(slot);

    // Clear/repoint the slot markers so Continue doesn't target the purged slot.
    try {
      const [lastSlotRaw, currentSlotRaw] = await Promise.all([
        AsyncStorage.getItem('lastSlot'),
        AsyncStorage.getItem('currentSlot'),
      ]);
      const pointsAtPurged = (v: string | null) => v !== null && parseInt(v, 10) === slot;

      if (pointsAtPurged(lastSlotRaw) || pointsAtPurged(currentSlotRaw)) {
        let repointTo: number | null = null;
        for (let i = 1; i <= 3; i++) {
          if (i === slot) continue;
          const meta = await readSaveSlotMeta(i);
          if (meta && !saveSlotMetaLooksPhantom(meta)) {
            repointTo = i;
            break;
          }
        }
        if (repointTo !== null) {
          if (pointsAtPurged(lastSlotRaw)) await AsyncStorage.setItem('lastSlot', String(repointTo));
          if (pointsAtPurged(currentSlotRaw)) await AsyncStorage.setItem('currentSlot', String(repointTo));
        } else {
          const keys: string[] = [];
          if (pointsAtPurged(lastSlotRaw)) keys.push('lastSlot');
          if (pointsAtPurged(currentSlotRaw)) keys.push('currentSlot');
          if (keys.length > 0) await AsyncStorage.multiRemove(keys);
        }
      }
    } catch (markerError) {
      log.warn('Failed to clear slot markers after phantom purge (non-critical)', {
        error: markerError instanceof Error ? markerError.message : String(markerError),
      });
    }

    log.info('Purged phantom pristine save', { slot });
    return true;
  } catch (error) {
    log.warn('Phantom purge failed (non-critical)', {
      slot,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

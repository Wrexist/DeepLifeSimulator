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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      readSaveSlot,
      decodePersistedSaveEnvelope,
      shouldAllowUnsignedLegacySaves,
      isPristineUnstartedState,
      deleteSaveSlot,
    } = await import('@/utils/saveValidation');

    const allowLegacy = shouldAllowUnsignedLegacySaves();
    const raw = await readSaveSlot(slot, undefined, { allowLegacy });

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

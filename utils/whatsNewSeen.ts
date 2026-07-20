// Tracks whether the player has seen the latest "What's New" entry, so the
// Main Menu can show a small "NEW" badge until they open the update log once.
//
// Stores the last version the player acknowledged. If it doesn't match the
// newest changelog entry, there's something new to show.
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { LATEST_VERSION } from '@/lib/config/changelog';
import { logger } from '@/utils/logger';

const log = logger.scope('whatsNewSeen');
const STORAGE_KEY = 'whatsNewSeenVersion';

/**
 * True when the newest release hasn't been acknowledged yet. Never throws —
 * on any storage error it resolves false so we simply don't nag the player.
 */
export async function hasUnseenWhatsNew(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(STORAGE_KEY);
    return seen !== LATEST_VERSION;
  } catch (error) {
    log.warn('read failed', { error });
    return false;
  }
}

/**
 * Marks the current latest release as seen (called when the popup opens).
 * Never throws — worst case the NEW badge simply shows again next launch.
 */
export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, LATEST_VERSION);
  } catch (error: any) {
    // Storage full: drop the disposable log cache and retry once (per the
    // repo's AsyncStorage error-handling convention). This key is a tiny
    // version string, so a single retry after cleanup is enough.
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
      try {
        await AsyncStorage.removeItem('unsynced_logs');
        await AsyncStorage.setItem(STORAGE_KEY, LATEST_VERSION);
        return;
      } catch (retryError) {
        log.warn('write retry after quota cleanup failed', { error: retryError });
        return;
      }
    }
    log.warn('write failed', { error });
  }
}

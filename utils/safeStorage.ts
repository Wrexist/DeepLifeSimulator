/**
 * Safe Storage Utilities
 * 
 * Provides safe wrappers around AsyncStorage operations with:
 * - QuotaExceededError handling
 * - Automatic cleanup and retry
 * - Consistent error logging
 */

import { logger } from './logger';

const log = logger.scope('SafeStorage');

// Lazy-load AsyncStorage to prevent TurboModule crash at module load time
let _asyncStorage: any = null;
let _loadAttempted = false;

function getAsyncStorage(): any {
  if (_asyncStorage) return _asyncStorage;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch {
    return null;
  }
}

// Keep backward-compatible reference
const AsyncStorage = {
  get instance() { return getAsyncStorage(); },
  async setItem(key: string, value: string) { const s = getAsyncStorage(); if (!s) throw new Error('AsyncStorage not available'); return s.setItem(key, value); },
  async getItem(key: string) { const s = getAsyncStorage(); if (!s) return null; return s.getItem(key); },
  async removeItem(key: string) { const s = getAsyncStorage(); if (!s) return; return s.removeItem(key); },
  async multiGet(keys: string[]) { const s = getAsyncStorage(); if (!s) return keys.map((k: string) => [k, null] as const); return s.multiGet(keys); },
  async multiSet(pairs: [string, string][]) { const s = getAsyncStorage(); if (!s) throw new Error('AsyncStorage not available'); return s.multiSet(pairs); },
  async multiRemove(keys: string[]) { const s = getAsyncStorage(); if (!s) return; return s.multiRemove(keys); },
  async getAllKeys() { const s = getAsyncStorage(); if (!s) return []; return s.getAllKeys(); },
};

/**
 * Safely set an item in AsyncStorage with QuotaExceededError handling
 * @param key - The storage key
 * @param value - The value to store
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const safeSetItem = async (key: string, value: string): Promise<boolean> => {
  return (await safeSetItemResult(key, value)).ok;
};

/** Why a write failed, for callers whose recovery differs by cause. */
export interface SafeSetResult {
  ok: boolean;
  /**
   * True only for a CONFIRMED quota failure.
   *
   * `safeSetItem` collapses every failure to `false`, so a caller that responds
   * to failure with quota recovery — e.g. `createBackup`, which deletes backups
   * across every slot down to one apiece — would take that scorched-earth path
   * after a transient I/O blip. Callers that do something destructive on
   * failure must branch on this rather than on `!ok`.
   * 2026-07-30 review of SAVE-1.
   */
  quotaExceeded: boolean;
}

const isQuotaError = (error: unknown): boolean => {
  const e = error as { name?: string; message?: string } | null;
  // Case-insensitive, and covers the wordings native wrappers actually use.
  // `includes('quota')` missed "QuotaExceededError"/"Quota exceeded" when it
  // appeared only in the message, so a genuine quota failure was reported as
  // `quotaExceeded: false` and `createBackup` skipped its cleanup-and-retry.
  return (
    e?.name === 'QuotaExceededError' ||
    (typeof e?.message === 'string' && /quota|disk is full|SQLITE_FULL|no space left/i.test(e.message))
  );
};

export const safeSetItemResult = async (key: string, value: string): Promise<SafeSetResult> => {
  try {
    await AsyncStorage.setItem(key, value);
    return { ok: true, quotaExceeded: false };
  } catch (error: any) {
    // Handle quota exceeded error
    if (isQuotaError(error)) {
      log.warn('Storage quota exceeded, attempting cleanup...');
      try {
        // Clear non-essential data to free up space
        await AsyncStorage.removeItem('unsynced_logs');
        await AsyncStorage.removeItem('cache_data');
        await AsyncStorage.removeItem('temp_data');
        // Retry the operation
        await AsyncStorage.setItem(key, value);
        log.info(`Successfully saved ${key} after cleanup`);
        return { ok: true, quotaExceeded: false };
      } catch (retryError) {
        log.error('Storage failed even after cleanup:', retryError);
        return { ok: false, quotaExceeded: isQuotaError(retryError) };
      }
    }
    log.error(`Failed to save ${key}:`, error);
    return { ok: false, quotaExceeded: false };
  }
};

/**
 * Safely remove an item from AsyncStorage
 * @param key - The storage key to remove
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const safeRemoveItem = async (key: string): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    log.error(`Failed to remove ${key}:`, error);
    return false;
  }
};

/**
 * Safely get an item from AsyncStorage
 * @param key - The storage key to retrieve
 * @returns Promise<string | null> - The value or null if not found/error
 */
export const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    log.error(`Failed to get ${key}:`, error);
    return null;
  }
};

/**
 * Safely get multiple items from AsyncStorage
 * @param keys - Array of storage keys to retrieve
 * @returns Promise<[string, string | null][]> - Array of key-value pairs
 */
export const safeMultiGet = async (keys: string[]): Promise<readonly [string, string | null][]> => {
  try {
    return await AsyncStorage.multiGet(keys);
  } catch (error) {
    log.error('Failed to get multiple items:', error);
    return keys.map(key => [key, null] as const);
  }
};

/**
 * Safely remove multiple items from AsyncStorage
 * @param keys - Array of storage keys to remove
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const safeMultiRemove = async (keys: string[]): Promise<boolean> => {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    log.error('Failed to remove multiple items:', error);
    return false;
  }
};

/**
 * Safely get all keys from AsyncStorage
 * @returns Promise<string[]> - Array of all storage keys
 */
export const safeGetAllKeys = async (): Promise<string[]> => {
  try {
    return [...(await AsyncStorage.getAllKeys())];
  } catch (error) {
    log.error('Failed to get all keys:', error);
    return [];
  }
};

/**
 * Safely set multiple items in AsyncStorage with QuotaExceededError handling
 * @param keyValuePairs - Array of [key, value] pairs to store
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const safeMultiSet = async (keyValuePairs: [string, string][]): Promise<boolean> => {
  try {
    await AsyncStorage.multiSet(keyValuePairs);
    return true;
  } catch (error: any) {
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
      log.warn('Storage quota exceeded during multiSet, attempting cleanup...');
      try {
        await AsyncStorage.removeItem('unsynced_logs');
        await AsyncStorage.removeItem('cache_data');
        await AsyncStorage.removeItem('temp_data');
        await AsyncStorage.multiSet(keyValuePairs);
        log.info('Successfully saved multiple items after cleanup');
        return true;
      } catch (retryError) {
        log.error('MultiSet failed even after cleanup:', retryError);
        return false;
      }
    }
    log.error('Failed to set multiple items:', error);
    return false;
  }
};


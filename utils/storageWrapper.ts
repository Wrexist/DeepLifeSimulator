// CRITICAL: Lazy load AsyncStorage to prevent TurboModule crash on iOS 26 Beta
let _realAsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _lastLoadAttempt = 0;
const LOAD_RETRY_COOLDOWN_MS = 2000; // Retry every 2s if first attempt failed

function getRealAsyncStorage() {
  if (_realAsyncStorage) return _realAsyncStorage;

  // Allow retrying after cooldown if previous attempt failed
  const now = Date.now();
  if (_lastLoadAttempt > 0 && now - _lastLoadAttempt < LOAD_RETRY_COOLDOWN_MS) {
    return null;
  }
  _lastLoadAttempt = now;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _realAsyncStorage = require('@react-native-async-storage/async-storage').default;
    return _realAsyncStorage;
  } catch {
    return null;
  }
}

// Lazy-loaded AsyncStorage proxy - same interface as real AsyncStorage
const AsyncStorage = {
  getItem: async (key: string) => {
    const storage = getRealAsyncStorage();
    return storage ? storage.getItem(key) : null;
  },
  setItem: async (key: string, value: string) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.removeItem(key);
  },
  getAllKeys: async (): Promise<readonly string[]> => {
    const storage = getRealAsyncStorage();
    return storage ? storage.getAllKeys() : [];
  },
  multiGet: async (keys: readonly string[]): Promise<readonly [string, string | null][]> => {
    const storage = getRealAsyncStorage();
    return storage ? storage.multiGet(keys) : keys.map(k => [k, null] as [string, null]);
  },
  multiSet: async (keyValuePairs: readonly [string, string][]) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.multiSet(keyValuePairs);
  },
  multiRemove: async (keys: readonly string[]) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.multiRemove(keys);
  },
  clear: async () => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.clear();
  },
};

import { logger } from '@/utils/logger';

/**
 * Retry configuration for storage operations
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 2000,
  backoffMultiplier: 2,
};

/**
 * PHASE 2.1: Wait for AsyncStorage to be ready
 * CRITICAL FIX: Use native module check instead of storage to check storage
 * This breaks the circular dependency where we use storage to check if storage is ready
 */
async function waitForStorageReady(maxWait = 3000): Promise<boolean> {
  const start = Date.now();

  // CRITICAL FIX: Check if React Native bridge is ready first
  // AsyncStorage requires the bridge to be ready
  try {
    const { NativeModules, Platform } = require('react-native');
    if (!NativeModules || Platform.OS === 'web') {
      // Web doesn't need AsyncStorage ready check
      return true;
    }
  } catch {
    // React Native not ready yet, wait
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // After bridge is ready, try a simple operation with timeout
  while (Date.now() - start < maxWait) {
    try {
      // Use getAllKeys() instead of getItem() - less likely to fail if storage is partially ready
      // Wrap in Promise.race with timeout to prevent hanging
      const checkPromise = AsyncStorage.getAllKeys();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Storage check timeout')), 500)
      );

      await Promise.race([checkPromise, timeoutPromise]);
      return true;
    } catch {
      // Storage not ready, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return false;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Retry a storage operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  attempt = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= config.maxRetries) {
      throw error;
    }

    const delay = calculateDelay(attempt, config);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryOperation(operation, config, attempt + 1);
  }
}

/**
 * Safe AsyncStorage wrapper with error handling and retry logic
 */
export const safeAsyncStorage = {
  /**
   * Get item from storage with error handling
   * PHASE 2.1: Enhanced with storage ready check
   */
  async getItem(key: string, fallback: any = null, retries = 3): Promise<any> {
    try {
      // Wait for storage to be ready
      const ready = await waitForStorageReady();
      if (!ready) {
        if (__DEV__) {
          logger.warn(`[Storage] AsyncStorage not ready after timeout, using fallback for ${key}`);
        }
        return fallback;
      }

      const value = await retryOperation(async () => {
        return await AsyncStorage.getItem(key);
      }, { ...DEFAULT_RETRY_CONFIG, maxRetries: retries });

      if (value === null) {
        return fallback;
      }

      try {
        return JSON.parse(value);
      } catch (parseError) {
        if (__DEV__) {
          logger.error(`Failed to parse storage value for ${key}:`, parseError);
        }
        return fallback;
      }
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage get error for ${key}:`, error);
      }
      return fallback;
    }
  },

  /**
   * Set item in storage with error handling
   */
  async setItem(key: string, value: any): Promise<boolean> {
    try {
      const stringValue = JSON.stringify(value);
      await retryOperation(async () => {
        await AsyncStorage.setItem(key, stringValue);
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage set error for ${key}:`, error);
      }
      return false;
    }
  },

  /**
   * Remove item from storage with error handling
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      await retryOperation(async () => {
        await AsyncStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage remove error for ${key}:`, error);
      }
      return false;
    }
  },

  /**
   * Get multiple items from storage
   */
  async multiGet(keys: string[]): Promise<[string, any][]> {
    try {
      const results = await retryOperation(async () => {
        return await AsyncStorage.multiGet(keys);
      });

      return results.map(([key, value]) => {
        if (value === null) {
          return [key, null];
        }
        try {
          return [key, JSON.parse(value)];
        } catch (parseError) {
          if (__DEV__) {
            logger.error(`Failed to parse storage value for ${key}:`, parseError);
          }
          return [key, null];
        }
      });
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage multiGet error:`, error);
      }
      return keys.map(key => [key, null]);
    }
  },

  /**
   * Set multiple items in storage
   */
  async multiSet(keyValuePairs: [string, any][]): Promise<boolean> {
    try {
      const stringPairs: [string, string][] = keyValuePairs.map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]);

      await retryOperation(async () => {
        await AsyncStorage.multiSet(stringPairs);
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage multiSet error:`, error);
      }
      return false;
    }
  },

  /**
   * Remove multiple items from storage
   */
  async multiRemove(keys: string[]): Promise<boolean> {
    try {
      await retryOperation(async () => {
        await AsyncStorage.multiRemove(keys);
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage multiRemove error:`, error);
      }
      return false;
    }
  },

  /**
   * Get all keys from storage
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await retryOperation(async () => {
        return await AsyncStorage.getAllKeys();
      });
      return [...keys]; // Convert readonly array to mutable array
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage getAllKeys error:`, error);
      }
      return [];
    }
  },

  /**
   * Clear all storage (use with caution)
   */
  async clear(): Promise<boolean> {
    try {
      await retryOperation(async () => {
        await AsyncStorage.clear();
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        logger.error(`Storage clear error:`, error);
      }
      return false;
    }
  },
};


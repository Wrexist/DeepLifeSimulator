import AsyncStorage from '@react-native-async-storage/async-storage';
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
   */
  async getItem(key: string, fallback: any = null): Promise<any> {
    try {
      const value = await retryOperation(async () => {
        return await AsyncStorage.getItem(key);
      });

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


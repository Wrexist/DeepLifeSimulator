/**
 * Fallback Error Storage
 * 
 * Stores critical errors locally when external logging services fail.
 * Provides last-resort error persistence for debugging.
 */

import { safeSetItem, safeGetItem, safeRemoveItem } from '@/utils/safeStorage';
import type { QueuedError, ErrorLogContext } from '@/lib/types/errors';
import { logger } from '@/utils/logger';
import { sanitizeErrorContext, truncateError, truncateStack } from '@/lib/types/errors';

const ERROR_STORAGE_KEY = 'error_storage';
const MAX_STORED_ERRORS = 10;
const MAX_ERROR_SIZE = 5000; // 5KB per error

interface StoredError {
  id: string;
  timestamp: number;
  error: QueuedError;
  context?: ErrorLogContext;
  size: number;
}

/**
 * Store an error locally as fallback
 */
export async function storeErrorLocally(
  error: QueuedError,
  context?: ErrorLogContext
): Promise<boolean> {
  try {
    // Sanitize and truncate context
    const sanitizedContext = context ? sanitizeErrorContext(context as Record<string, unknown>) : undefined;
    
    // Create stored error
    const storedError: StoredError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      error: {
        ...error,
        message: truncateError(error.message, 200),
        stack: truncateStack(error.stack, 500),
      },
      context: sanitizedContext as ErrorLogContext,
      size: 0, // Will calculate
    };
    
    // Calculate size
    const serialized = JSON.stringify(storedError);
    storedError.size = serialized.length;
    
    // Skip if too large
    if (storedError.size > MAX_ERROR_SIZE) {
      if (__DEV__) {
        logger.warn('[errorStorage] Error too large to store, skipping');
      }
      return false;
    }
    
    // Get existing errors
    const existingErrors = await getStoredErrors();
    
    // Add new error
    existingErrors.push(storedError);
    
    // Sort by timestamp (newest first) and limit
    existingErrors.sort((a, b) => b.timestamp - a.timestamp);
    const limitedErrors = existingErrors.slice(0, MAX_STORED_ERRORS);
    
    // Store back
    await safeSetItem(ERROR_STORAGE_KEY, JSON.stringify(limitedErrors));
    
    if (__DEV__) {
      logger.info(`[errorStorage] Stored error locally: ${storedError.id}`);
    }
    
    return true;
  } catch (storageError) {
    // Don't log to avoid infinite loop - just return false
    if (__DEV__) {
      console.warn('[errorStorage] Failed to store error locally:', storageError);
    }
    return false;
  }
}

/**
 * Get all stored errors
 */
export async function getStoredErrors(): Promise<StoredError[]> {
  try {
    const stored = await safeGetItem(ERROR_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    
    const errors = JSON.parse(stored) as StoredError[];
    // Validate structure
    return Array.isArray(errors) ? errors : [];
  } catch {
    return [];
  }
}

/**
 * Clear all stored errors
 */
export async function clearStoredErrors(): Promise<void> {
  try {
    await safeRemoveItem(ERROR_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get most recent stored error
 */
export async function getMostRecentError(): Promise<StoredError | null> {
  const errors = await getStoredErrors();
  return errors.length > 0 ? errors[0] : null;
}

/**
 * Get errors within time range
 */
export async function getErrorsInRange(
  startTime: number,
  endTime: number
): Promise<StoredError[]> {
  const errors = await getStoredErrors();
  return errors.filter(
    error => error.timestamp >= startTime && error.timestamp <= endTime
  );
}

/**
 * Clean up old errors (older than 7 days)
 */
export async function cleanupOldErrors(): Promise<number> {
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const errors = await getStoredErrors();
    const recentErrors = errors.filter(error => error.timestamp > sevenDaysAgo);
    
    if (recentErrors.length < errors.length) {
      await safeSetItem(ERROR_STORAGE_KEY, JSON.stringify(recentErrors));
      const removed = errors.length - recentErrors.length;
      if (__DEV__) {
        logger.info(`[errorStorage] Cleaned up ${removed} old errors`);
      }
      return removed;
    }
    
    return 0;
  } catch {
    return 0;
  }
}


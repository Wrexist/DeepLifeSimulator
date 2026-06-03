/**
 * Save/Load Mutex
 * 
 * Prevents race conditions between save and load operations.
 * Ensures only one operation can access AsyncStorage at a time.
 */

import { logger } from '@/utils/logger';

const log = logger.scope('SaveLoadMutex');

// P0-15: 30s upper bound on any acquire — a hung save (AsyncStorage stuck,
// thrown setGameState inside saveGame) must NOT deadlock the queue. If a
// release is missed the next operation will time out and reject, surfacing
// the bug instead of silently freezing all future saves.
const DEFAULT_ACQUIRE_TIMEOUT_MS = 30_000;

class SaveLoadMutex {
  private isLocked = false;
  private queue: (() => void)[] = [];
  private currentOperation: 'save' | 'load' | null = null;
  private acquireTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Acquire lock for save or load operation.
   * Rejects with a timeout error if the lock cannot be acquired within
   * `timeoutMs` (default 30s) — prevents deadlocks from missed releases.
   */
  async acquire(operation: 'save' | 'load', timeoutMs: number = DEFAULT_ACQUIRE_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isLocked) {
        this.isLocked = true;
        this.currentOperation = operation;
        log.debug(`Lock acquired for ${operation}`);
        // Watchdog: if release isn't called within the timeout, force-release
        // and log loudly so the underlying bug is visible.
        this.armWatchdog(operation, timeoutMs);
        resolve();
        return;
      }
      log.debug(`Lock busy (${this.currentOperation}), queuing ${operation}`);
      let settled = false;
      const queueEntry = () => {
        if (settled) return;
        settled = true;
        clearTimeout(queueTimer);
        this.isLocked = true;
        this.currentOperation = operation;
        log.debug(`Lock acquired for ${operation} (from queue)`);
        this.armWatchdog(operation, timeoutMs);
        resolve();
      };
      const queueTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Remove the entry from the queue so the next release doesn't fire it.
        const idx = this.queue.indexOf(queueEntry);
        if (idx >= 0) this.queue.splice(idx, 1);
        log.error(`Lock acquire timeout for ${operation} after ${timeoutMs}ms (held by ${this.currentOperation})`);
        reject(new Error(`SaveLoadMutex acquire timeout for ${operation}`));
      }, timeoutMs);
      this.queue.push(queueEntry);
    });
  }

  private armWatchdog(operation: 'save' | 'load', timeoutMs: number): void {
    if (this.acquireTimer) clearTimeout(this.acquireTimer);
    this.acquireTimer = setTimeout(() => {
      log.error(`Lock holder ${operation} exceeded ${timeoutMs}ms — force-releasing to prevent deadlock`);
      this.release(true);
    }, timeoutMs);
  }

  /**
   * Release lock and process next queued operation.
   * Pass `forced=true` only from the watchdog — application code should use
   * the normal `release()` without arguments.
   */
  release(forced: boolean = false): void {
    if (!this.isLocked) {
      if (!forced) log.warn('Attempted to release lock that was not locked');
      return;
    }

    if (this.acquireTimer) {
      clearTimeout(this.acquireTimer);
      this.acquireTimer = null;
    }
    const operation = this.currentOperation;
    this.isLocked = false;
    this.currentOperation = null;
    log.debug(`Lock released for ${operation}${forced ? ' (forced)' : ''}`);

    // Process next queued operation
    const next = this.queue.shift();
    if (next) {
      // Use setTimeout to allow current operation to complete
      setTimeout(() => {
        next();
      }, 0);
    }
  }

  /**
   * Check if lock is currently held
   */
  isHeld(): boolean {
    return this.isLocked;
  }

  /**
   * Get current operation type
   */
  getCurrentOperation(): 'save' | 'load' | null {
    return this.currentOperation;
  }
}

// Export singleton instance
export const saveLoadMutex = new SaveLoadMutex();


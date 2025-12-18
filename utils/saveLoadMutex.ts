/**
 * Save/Load Mutex
 * 
 * Prevents race conditions between save and load operations.
 * Ensures only one operation can access AsyncStorage at a time.
 */

import { logger } from '@/utils/logger';

const log = logger.scope('SaveLoadMutex');

class SaveLoadMutex {
  private isLocked = false;
  private queue: Array<() => void> = [];
  private currentOperation: 'save' | 'load' | null = null;

  /**
   * Acquire lock for save or load operation
   */
  async acquire(operation: 'save' | 'load'): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isLocked) {
        this.isLocked = true;
        this.currentOperation = operation;
        log.debug(`Lock acquired for ${operation}`);
        resolve();
      } else {
        log.debug(`Lock busy (${this.currentOperation}), queuing ${operation}`);
        this.queue.push(() => {
          this.isLocked = true;
          this.currentOperation = operation;
          log.debug(`Lock acquired for ${operation} (from queue)`);
          resolve();
        });
      }
    });
  }

  /**
   * Release lock and process next queued operation
   */
  release(): void {
    if (!this.isLocked) {
      log.warn('Attempted to release lock that was not locked');
      return;
    }

    const operation = this.currentOperation;
    this.isLocked = false;
    this.currentOperation = null;
    log.debug(`Lock released for ${operation}`);

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


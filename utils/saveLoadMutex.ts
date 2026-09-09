/**
 * Save/Load Mutex
 * 
 * Prevents race conditions between save and load operations.
 * Ensures only one operation can access AsyncStorage at a time.
 */

import { logger } from '@/utils/logger';

const log = logger.scope('SaveLoadMutex');

// P0-15: 30s upper bound on a waiting acquire. If a holder stalls or misses
// release, waiting operations reject rather than hang silently. The holder's
// watchdog reports the stall but cannot cancel its in-flight storage I/O.
const DEFAULT_ACQUIRE_TIMEOUT_MS = 30_000;

/** Opaque proof that the holder is the holder. See `release`. */
export type MutexToken = number;

class SaveLoadMutex {
  private isLocked = false;
  /**
   * Waiters, in FIFO order. Each entry GRANTS the lock to itself when invoked
   * and reports whether it did: an entry whose acquire already timed out
   * removes itself from the queue, but the boolean keeps `release` correct even
   * if a settled entry is ever reached — it moves on to the next waiter instead
   * of leaving the lock held by nobody.
   */
  private queue: (() => boolean)[] = [];
  private currentOperation: 'save' | 'load' | null = null;
  private acquireTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Incremented on every grant, so a token from an earlier holder cannot
   * release a later holder.
   *
   * `release()` used to check only `if (!this.isLocked) return;` — it never
   * verified the caller held the lock. After the 30s watchdog force-released
   * holder A and handed the lock to B, A's own `finally { release() }` saw
   * `isLocked === true` (B's lock), cleared B's watchdog, unlocked, and shifted
   * C off the queue — leaving B and C both believing they held it, writing the
   * same slot. 2026-07-29 audit PIPE-3.
   */
  private holderId: MutexToken = 0;

  /**
   * Acquire lock for save or load operation.
   * Rejects with a timeout error if the lock cannot be acquired within
   * `timeoutMs` (default 30s) — prevents deadlocks from missed releases.
   *
   * Returns a token. Pass it back to `release(token)` so a stale holder cannot
   * release someone else's lock.
   */
  async acquire(
    operation: 'save' | 'load',
    timeoutMs: number = DEFAULT_ACQUIRE_TIMEOUT_MS
  ): Promise<MutexToken> {
    return new Promise((resolve, reject) => {
      if (!this.isLocked) {
        this.isLocked = true;
        this.currentOperation = operation;
        const token = ++this.holderId;
        log.debug(`Lock acquired for ${operation}`);
        // Watchdog reports stalled holders without admitting concurrent I/O.
        this.armWatchdog(operation, timeoutMs);
        resolve(token);
        return;
      }
      log.debug(`Lock busy (${this.currentOperation}), queuing ${operation}`);
      let settled = false;
      const queueEntry = (): boolean => {
        if (settled) return false;
        settled = true;
        clearTimeout(queueTimer);
        // The lock is handed over SYNCHRONOUSLY from `release` - it was never
        // unlocked in between (see the comment there), so this assignment is a
        // transfer of ownership, not a fresh acquisition.
        this.isLocked = true;
        this.currentOperation = operation;
        const token = ++this.holderId;
        log.debug(`Lock acquired for ${operation} (from queue)`);
        this.armWatchdog(operation, timeoutMs);
        resolve(token);
        return true;
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
      this.acquireTimer = null;
      log.error(`Lock holder ${operation} exceeded ${timeoutMs}ms - retaining lock until its I/O settles`);
      // AsyncStorage writes cannot be cancelled. Handing the lock to another
      // writer here lets the old write resume later and overwrite a newer save.
      // Keep ownership until finally releases it. Waiters still reject on their
      // own acquire deadlines, so a stalled operation surfaces as a failure.
    }, timeoutMs);
  }

  /**
   * Release lock and process next queued operation.
   *
   * Pass the token returned by `acquire`. A token that no longer matches the
   * current holder, because the lock has since been handed on, is ignored.
   * This stops a late holder unlocking somebody else's write.
   * Calling with no token keeps the old unchecked
   * behaviour so an un-migrated site still works.
   */
  release(token?: MutexToken): void {
    if (!this.isLocked) {
      log.warn('Attempted to release lock that was not locked');
      return;
    }

    if (token !== undefined && token !== this.holderId) {
      log.error('Stale mutex release ignored', { token, holder: this.holderId });
      return;
    }

    if (this.acquireTimer) {
      clearTimeout(this.acquireTimer);
      this.acquireTimer = null;
    }
    const operation = this.currentOperation;
    log.debug(`Lock released for ${operation}`);

    // SYNCHRONOUS HAND-OFF. This used to set `isLocked = false` here and then
    // grant the lock to the queued waiter from a `setTimeout(…, 0)`. Every
    // pending microtask - and every `await` continuation already scheduled -
    // runs before that macrotask, so any caller that hit `acquire()` inside the
    // window took the fast path (`if (!this.isLocked)`), got the lock, and then
    // the timer handed the SAME lock to the queued waiter. Two holders, both
    // with valid tokens, writing one slot. 2026-08-16 audit F-8.
    //
    // So when a waiter exists the lock is never unlocked at all: ownership
    // (isLocked / currentOperation / holderId / the watchdog) transfers
    // directly to the shifted waiter, and only an EMPTY queue clears the lock.
    // The waiter's `acquire` promise still resolves on the normal microtask
    // timeline; what changed is that the lock is provably held by exactly one
    // operation at every instant.
    let handedOff = false;
    while (!handedOff) {
      const next = this.queue.shift();
      if (!next) break;
      handedOff = next();
    }

    if (!handedOff) {
      this.isLocked = false;
      this.currentOperation = null;
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

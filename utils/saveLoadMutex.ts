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
   * Incremented on every grant AND on every forced release, so a token issued
   * before a force-release can never match afterwards.
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
        // Watchdog: if release isn't called within the timeout, force-release
        // and log loudly so the underlying bug is visible.
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
        // The lock is handed over SYNCHRONOUSLY from `release` — it was never
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
      log.error(`Lock holder ${operation} exceeded ${timeoutMs}ms — force-releasing to prevent deadlock`);
      // Invalidate the current holder's token BEFORE releasing, so its late
      // `release(token)` is provably stale and gets ignored.
      this.holderId++;
      this.release(undefined, true);
    }, timeoutMs);
  }

  /**
   * Release lock and process next queued operation.
   *
   * Pass the token returned by `acquire`. A token that no longer matches the
   * current holder — because the watchdog force-released and the lock has since
   * been handed on — is IGNORED, which is what stops a late holder unlocking
   * somebody else's write. Calling with no token keeps the old unchecked
   * behaviour so an un-migrated site still works.
   *
   * `forced=true` is for the watchdog only.
   */
  release(token?: MutexToken, forced: boolean = false): void {
    if (!this.isLocked) {
      if (!forced) log.warn('Attempted to release lock that was not locked');
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
    log.debug(`Lock released for ${operation}${forced ? ' (forced)' : ''}`);

    // SYNCHRONOUS HAND-OFF. This used to set `isLocked = false` here and then
    // grant the lock to the queued waiter from a `setTimeout(…, 0)`. Every
    // pending microtask — and every `await` continuation already scheduled —
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


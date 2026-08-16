import { logger } from '@/utils/logger';
import { isWritableSlot } from '@/utils/slotNumber';
import { listBackups } from '@/utils/saveBackup';
import { safeSetItem, safeMultiRemove, safeGetAllKeys, safeGetItem, safeRemoveItem } from '@/utils/safeStorage';
import { isSaveSigningConfigError, SAVE_SIGNING_CONFIG_ERROR_CODE } from '@/utils/saveValidation';
// Keep the per-slot summary cache fresh straight from the in-memory state object
// (zero parse cost — we never re-parse the serialized output). safeStorage/logger
// are already this module's dependency style and saveSlotMeta only imports those
// plus saveSlotHelpers, so this static import introduces no require cycle.
import { extractSaveSlotMeta, writeSaveSlotMeta } from '@/utils/saveSlotMeta';
import { MAX_SAVE_SIZE } from '@/lib/config/gameConstants';

interface SaveOperation {
  id: string;
  slot: number;
  data: any;
  timestamp: number;
  retryCount: number;
  /**
   * Settles the promise `addToQueue` returns, once THIS operation has finished
   * processing (written, permanently failed, or been dropped as invalid). Not
   * part of the persisted shape — `JSON.stringify` drops function-valued keys,
   * so a restored operation simply has none. See `addToQueue` for why the
   * enqueuer needs to know when the write actually landed.
   */
  onSettled?: () => void;
}

type ToastCallback = (message: string, type: 'success' | 'error') => void;

/**
 * How old a persisted queue operation may be and still be replayed on the next
 * launch. Past this, whatever the player has done since matters more than a
 * write they abandoned.
 */
const MAX_REPLAYABLE_QUEUE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

class SaveQueue {
  private queue: SaveOperation[] = [];
  private processingPromise: Promise<void> | null = null;
  /** Set by `restoreQueue`: drop the persisted blob once the replay drains. */
  private clearPersistedAfterDrain = false;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private toastCallback: ToastCallback | null = null;
  private log = logger.scope('SaveQueue');

  // Register toast callback
  setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }

  // Check if currently processing (used by getStatus and external checks)
  private get isProcessing(): boolean {
    return this.processingPromise !== null;
  }

  async addToQueue(slot: number, data: any): Promise<void> {
    // REFUSE, don't substitute. A NaN, undefined or out-of-range slot is
    // exactly the state you are in when something upstream has already gone
    // wrong, and this used to redirect that write onto whatever the player had
    // in slot 1 and commit it. The correct failure mode for an unknown target
    // is not to write. 2026-07-29 audit SAVE-OW-6.
    if (!isWritableSlot(slot)) {
      this.log.error(`Refusing to queue a save for an invalid slot: ${String(slot)}`);
      throw new Error(`Cannot save: invalid save slot (${String(slot)})`);
    }

    // F-9: RESOLVE ON COMPLETION, NOT ON ENQUEUE.
    //
    // This used to return as soon as the operation was pushed. `saveGame` holds
    // the save/load mutex across its `await queueSave(...)` and releases it in a
    // `finally` — so the mutex came off while `performSave` was still writing
    // the slot, and a `loadGame` that acquired next read the slot mid-write.
    // The lock protected the ENQUEUE, which needs no protection at all.
    //
    // Why this shape rather than having `performSave` acquire the mutex itself:
    // the enqueuer is normally still holding it, and the mutex is not reentrant,
    // so the drain would block on a lock only the (now blocked) enqueuer can
    // release — a hard deadlock on every autosave. Making the enqueuer's own
    // await span the write keeps the single existing holder and needs no lock
    // inside the queue. Nothing on the `performSave` path acquires the mutex,
    // so the drain can never wait on the enqueuer.
    //
    // Bounded: three retries with a 1s/2s/3s backoff is ~6s worst case, well
    // inside the mutex's 30s watchdog.
    let settle: () => void = () => {};
    const completed = new Promise<void>(resolve => {
      settle = resolve;
    });

    const operation: SaveOperation = {
      id: `save_${Date.now()}_${Math.random()}`,
      slot,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      onSettled: settle,
    };

    // Immutable push to prevent mid-iteration mutation
    this.queue = [...this.queue, operation];

    // Persist queue after adding (non-blocking)
    this.persistQueue().catch(err => {
      this.log.warn('Failed to persist queue after add (non-critical):', err);
    });

    // Chain onto existing processing promise to guarantee serialized processing
    const drain = this.kickProcessing();

    // Race against the drain so a `processQueue` that rejected outright (it
    // shouldn't — every operation is caught individually) surfaces as a failed
    // save instead of hanging the caller and, with it, the mutex.
    await Promise.race([completed, drain]);
  }

  /**
   * Start draining the queue if nothing is draining it already, and return the
   * promise for the drain in flight.
   *
   * The re-kick in the `finally` closes a window that pre-dates F-9 and that
   * F-9's await would otherwise turn from "a save lands late" into "the caller
   * hangs": `processQueue` returns as soon as it observes an empty queue, but
   * `processingPromise` is only cleared one microtask later, so an operation
   * pushed in between saw a non-null `processingPromise`, started no drain of
   * its own, and sat in the queue until some unrelated save arrived.
   */
  private kickProcessing(): Promise<void> {
    if (this.processingPromise) return this.processingPromise;

    this.processingPromise = this.processQueue().finally(() => {
      this.processingPromise = null;
      if (this.clearPersistedAfterDrain && this.queue.length === 0) {
        this.clearPersistedAfterDrain = false;
        // Best-effort remove the persisted queue after a successful drain. If
        // processQueue threw we keep the persisted entry so the next session
        // can retry.
        void safeRemoveItem('save_queue_persisted').catch(() => {});
      }
      if (this.queue.length > 0) void this.kickProcessing().catch(() => {});
    });

    return this.processingPromise;
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      // Atomic dequeue: take first, assign remainder
      const [operation, ...rest] = this.queue;
      this.queue = rest;
      if (!operation) continue;

      // Validate operation has valid slot
      if (typeof operation.slot !== 'number' || isNaN(operation.slot) || operation.slot < 1 || operation.slot > 3) {
        this.log.error(`Invalid slot in queue operation: ${operation.slot}. Skipping operation.`);
        this.settleOperation(operation);
        continue;
      }

      try {
        await this.performSave(operation);
        this.log.debug(`Save successful for slot ${operation.slot}`);

        // Persist queue state after successful save (in case there are more operations)
        await this.persistQueue();

        // Clear persisted queue only if queue is completely empty
        if (this.queue.length === 0) {
          safeRemoveItem('save_queue_persisted').catch((error) => {
            if (__DEV__) {
              this.log.warn('[SaveQueue] Failed to remove persisted queue (non-critical):', error);
            }
          });
        }

        // Don't show success toast - silent saves
        this.settleOperation(operation);
      } catch (error) {
        this.log.error(`Save failed for slot ${operation.slot}:`, error);

        if (operation.retryCount < this.maxRetries) {
          operation.retryCount++;
          operation.timestamp = Date.now();

          // Wait for retry delay inline (no setTimeout re-entrance)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * operation.retryCount));

          // Re-add to front of queue for the while loop to pick up
          this.queue = [operation, ...this.queue];
        } else {
          this.log.error(`Save operation failed permanently for slot ${operation.slot} after ${this.maxRetries} retries`);

          // Show error toast (always show errors)
          if (this.toastCallback) {
            this.toastCallback('Save Failed! Please try again.', 'error');
          }
          this.settleOperation(operation);
        }
      }
    }
  }

  /**
   * Release the enqueuer waiting on this operation.
   *
   * RESOLVES on a permanent failure too, rather than rejecting: the queue
   * already owns the user-facing failure report (the error toast above), and
   * rejecting would make `saveGame` raise a SECOND "Save Error" dialog for the
   * same write. The contract `addToQueue` keeps is "your operation is no longer
   * pending" — which is exactly what the mutex holder needs to know.
   */
  private settleOperation(operation: SaveOperation): void {
    const settle = operation.onSettled;
    if (!settle) return;
    operation.onSettled = undefined;
    try {
      settle();
    } catch {
      // A settle callback cannot fail, but it must never break the drain.
    }
  }

  // Refresh the per-slot summary cache from the IN-MEMORY state object so the
  // pre-game menus (MainMenu "Continue", SaveSlots) render instantly without
  // ever re-parsing the multi-MB save blob. AWAITED by callers (the write is a
  // few hundred bytes) so an earlier save's still-pending cache write can never
  // land after — and overwrite — a later save's summary. Errors stay swallowed:
  // the cache is non-critical and must never affect save success/failure
  // semantics (writeSaveSlotMeta never throws anyway).
  private async refreshSlotMeta(slot: number, data: unknown): Promise<void> {
    try {
      await writeSaveSlotMeta(slot, extractSaveSlotMeta(data));
    } catch {
      // non-critical
    }
  }

  private async performSave(operation: SaveOperation): Promise<void> {
    // D-4: Save duration telemetry
    const saveStartTime = Date.now();

    // Validate slot before proceeding
    // processQueue already drops invalid operations, so this is unreachable —
    // but if it ever is reached, refusing is the only safe answer.
    if (!isWritableSlot(operation.slot)) {
      this.log.error(`Refusing to write an operation with an invalid slot: ${String(operation.slot)}`);
      throw new Error(`Cannot save: invalid save slot (${String(operation.slot)})`);
    }

    const key = `save_slot_${operation.slot}`;

    // ANTI-EXPLOIT: Embed critical protected state inside the save data itself
    // This prevents bypass by deleting AsyncStorage protected_state keys
    const dataWithProtection: Record<string, unknown> = { ...operation.data };
    try {
      const { getProtectedState } = await import('./saveBackup');
      const protectedState = await getProtectedState(operation.slot);
      if (protectedState) {
        dataWithProtection._embeddedProtectedState = protectedState;
      }
    } catch (err) {
      this.log.warn('Failed to embed protected state (non-critical):', { error: err instanceof Error ? err.message : String(err) });
    }

    // Prune save data to reduce size
    const prunedData = this.pruneSaveData(dataWithProtection);
    let serializedData: string;

    // R6 H-2: yield to the event loop before the expensive JSON.stringify so
    // any pending render / input frame can land first. JSON.stringify on a
    // late-game state (5000+ weeks, full event log + journal + memories) can
    // block the JS thread for 500ms–2s; without the yield, the autosave that
    // runs every 2 minutes janks the UI mid-interaction. The serialization
    // itself is still synchronous — this only moves WHEN it blocks.
    await new Promise<void>(resolve => {
      if (typeof setImmediate === 'function') {
        setImmediate(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

    // Protect JSON.stringify from circular references and other errors
    try {
      serializedData = JSON.stringify(prunedData);
    } catch (error) {
      this.log.error('Failed to serialize save data (attempt 1):', error);
      // Try with safe replacer to handle circular references
      try {
        const seen = new WeakSet();
        serializedData = JSON.stringify(prunedData, (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              this.log.warn('Circular reference detected in save data, omitting field');
              return undefined;
            }
            seen.add(value);
          }
          return value;
        });
        this.log.warn('Serialized with circular reference handling');
      } catch (retryError) {
        this.log.error('Failed to serialize even with circular handling:', retryError);
        throw new Error('Failed to serialize game state. State may be corrupted.');
      }
    }
    
    try {
      // Check if data is too large (localStorage limit is typically 5-10MB)
      if (serializedData.length > MAX_SAVE_SIZE) {
        this.log.warn(`Save data is large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB`);
        // P1-8: actually prune MORE aggressively (halved caps) this pass. The
        // previous code re-ran pruneSaveData with the same caps — a no-op — so an
        // over-size save still threw and the player could never save again.
        const morePruned = this.pruneSaveData(prunedData, true);
        try {
          serializedData = JSON.stringify(morePruned);
        } catch (error) {
          this.log.error('Failed to serialize pruned data:', error);
          throw new Error('Failed to serialize game state even after pruning.');
        }
        
        if (serializedData.length > MAX_SAVE_SIZE) {
          throw new Error(`Save data too large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB. Please delete old saves or reduce game data.`);
        }
      }
      
      // ANTI-EXPLOIT: Wrap save data in canonical envelope with HMAC-SHA256 signature
      // This prevents save file tampering (modifying money, stats, etc.)
      // CRASH FIX (A-1): Use double-buffer save for crash resilience
      const { doubleBufferSave, createSaveEnvelope } = await import('@/utils/saveValidation');
      const envelope = createSaveEnvelope(serializedData);
      const saveResult = await doubleBufferSave(key, envelope);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Double-buffer save failed');
      }

      // BRC-7: bootstrap the protected-state keys. Nothing wrote them, so
      // `getProtectedState` returned null for the whole lifetime of the app —
      // which made the embed above a closed loop (nothing to embed, so nothing
      // ever got written) and left the anti-exploit layer inert. Written AFTER
      // the save succeeds so a failed write cannot advance the high-water marks.
      // Non-blocking and non-critical: this must never fail a save.
      // Awaited, not fire-and-forget: everything after this point is already
      // awaited post-save bookkeeping, and a dangling dynamic import can
      // resolve after the surrounding context is gone.
      try {
        const { updateProtectedState } = await import('./saveBackup');
        await updateProtectedState(operation.slot, operation.data);
      } catch (err) {
        this.log.warn('Failed to update protected state (non-critical):', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Also save the last slot reference (non-critical, can use regular save)
      const slotToSave = (typeof operation.slot === 'number' && !isNaN(operation.slot)) ? operation.slot : 1;
      await safeSetItem('lastSlot', slotToSave.toString());

      // Save timestamp for auto-save indicator (non-critical, can use regular save)
      await safeSetItem('lastSaveTime', Date.now().toString());

      await this.refreshSlotMeta(operation.slot, operation.data);

      // D-4: Log save duration and size for telemetry
      const saveDurationMs = Date.now() - saveStartTime;
      const saveSizeKb = Math.round(serializedData.length / 1024);
      this.log.info(`[SAVE_TELEMETRY] slot=${operation.slot} duration=${saveDurationMs}ms size=${saveSizeKb}KB`);
    } catch (error: any) {
      if (isSaveSigningConfigError(error)) {
        this.log.error(`[SAVE_SECURITY] ${SAVE_SIGNING_CONFIG_ERROR_CODE}`, {
          slot: operation.slot,
          message: error?.message || 'Missing save signing configuration',
        });
        throw error;
      }

      // Handle quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        this.log.error('Storage quota exceeded. Attempting comprehensive cleanup...');

        // Perform comprehensive cleanup
        const cleanupResult = await this.performQuotaCleanup(operation.slot);

        if (cleanupResult.success && cleanupResult.cleaned > 0) {
          this.log.info(`Cleaned up ${cleanupResult.cleaned} items, retrying save...`);

          try {
            // CRITICAL FIX: Use canonical envelope and double-buffer save for retry.
            const { doubleBufferSave, createSaveEnvelope } = await import('@/utils/saveValidation');
            const retryEnvelope = createSaveEnvelope(serializedData);
            const retrySaveResult = await doubleBufferSave(key, retryEnvelope);
            if (retrySaveResult.success) {
              const slotToSave = (typeof operation.slot === 'number' && !isNaN(operation.slot)) ? operation.slot : 1;
              await safeSetItem('lastSlot', slotToSave.toString());
              await safeSetItem('lastSaveTime', Date.now().toString());
              await this.refreshSlotMeta(operation.slot, operation.data);
              this.log.info('Save succeeded after cleanup');
              return; // Success after cleanup
            } else {
              this.log.error(`Save failed even after comprehensive cleanup: ${retrySaveResult.error}`);
            }
          } catch (retryError) {
            this.log.error('Save failed even after comprehensive cleanup:', retryError);
          }
        }
        
        // If cleanup didn't help, show user-friendly error
        this.log.error('Save failed even after cleanup. Storage may be full.');
        if (this.toastCallback) {
          this.toastCallback(
            'Storage full! Please delete old saves in Settings or free up device storage.',
            'error'
          );
        }
        throw new Error('Storage quota exceeded. Please free up space or delete old saves.');
      }
      
      this.log.error('AsyncStorage save error:', error);
      throw error;
    }
  }

  // Force save a specific slot immediately (waits for queue to finish first)
  async forceSave(slot: number, data: any, manageMutex: boolean = true): Promise<void> {
    // Wait for any in-progress queue processing to finish before force saving
    // This prevents concurrent writes to the same slot
    if (this.processingPromise) {
      this.log.debug('forceSave: waiting for queue processing to complete...');
      await this.processingPromise;
    }

    // P1-11: also acquire the save/load mutex so a concurrent `loadGame` can't
    // be midway through reading the slot while we overwrite it. Without this,
    // an IAP-triggered forceSave during a slot-switch can write the prior
    // character's data into the freshly-loaded slot.
    // C-1 (R8): when `saveGame` already holds the mutex it calls us with
    // manageMutex=false. The mutex is NOT reentrant, so re-acquiring it here
    // would self-deadlock for 30s (until the watchdog) and then double-release,
    // corrupting concurrent slot writes (this path fires on every IAP). Only
    // manage the lock when forceSave is invoked standalone.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { saveLoadMutex } = require('@/utils/saveLoadMutex');
    const mutexToken = manageMutex ? await saveLoadMutex.acquire('save') : undefined;
    try {

    // Same rule as addToQueue: refuse rather than redirect onto slot 1. This
    // check runs after the mutex is held, so the finally below still releases.
    if (!isWritableSlot(slot)) {
      this.log.error(`Refusing to force-save to an invalid slot: ${String(slot)}`);
      throw new Error(`Cannot save: invalid save slot (${String(slot)})`);
    }

    const key = `save_slot_${slot}`;

    // Yield before the expensive stringify, exactly as `performSave` does.
    // `forceSave` runs on the paths where a dropped frame reads as "my purchase
    // hung": IAP grant fulfilment, redeem codes, the death popup and onboarding
    // perks. The mitigation existed on the periodic-autosave branch and simply
    // was not applied to this one. 2026-07-30 audit PERF-6.
    await new Promise<void>(resolve => {
      if (typeof setImmediate === 'function') {
        setImmediate(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

    // Prune save data to reduce size
    const prunedData = this.pruneSaveData(data);
    let serializedData: string;
    
    // Protect JSON.stringify from circular references and other errors
    try {
      serializedData = JSON.stringify(prunedData);
    } catch (error) {
      this.log.error('Failed to serialize save data in forceSave:', error);
      // Try with safe replacer to handle circular references
      try {
        const seen = new WeakSet();
        serializedData = JSON.stringify(prunedData, (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              this.log.warn('Circular reference detected in save data, omitting field');
              return undefined;
            }
            seen.add(value);
          }
          return value;
        });
        this.log.warn('Force save serialized with circular reference handling');
      } catch (retryError) {
        this.log.error('Failed to serialize even with circular handling:', retryError);
        throw new Error('Failed to serialize game state. State may be corrupted.');
      }
    }
    
    try {
      // Check if data is too large
      if (serializedData.length > MAX_SAVE_SIZE) {
        this.log.warn(`Save data is large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB`);
        // P1-8: actually prune MORE aggressively (halved caps) this pass. The
        // previous code re-ran pruneSaveData with the same caps — a no-op — so an
        // over-size save still threw and the player could never save again.
        const morePruned = this.pruneSaveData(prunedData, true);
        try {
          serializedData = JSON.stringify(morePruned);
        } catch (error) {
          this.log.error('Failed to serialize pruned data in forceSave:', error);
          throw new Error('Failed to serialize game state even after pruning.');
        }
        
        if (serializedData.length > MAX_SAVE_SIZE) {
          throw new Error(`Save data too large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB. Please delete old saves or reduce game data.`);
        }
      }
      
      // ANTI-EXPLOIT: Wrap save data in canonical envelope with HMAC-SHA256 signature
      // CRASH FIX (A-1): Use double-buffer save for crash resilience
      const { doubleBufferSave, createSaveEnvelope } = await import('@/utils/saveValidation');
      const envelope = createSaveEnvelope(serializedData);
      let saveResult = await doubleBufferSave(key, envelope);

      // Retry once if verification failed (AsyncStorage timing issue)
      if (!saveResult.success && saveResult.error?.includes('verification')) {
        this.log.warn('Double-buffer save verification failed, retrying once...');
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        saveResult = await doubleBufferSave(key, envelope);
      }

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Double-buffer save failed');
      }

      // Also save the last slot reference (non-critical, can use regular save)
      const slotToSave = (typeof slot === 'number' && !isNaN(slot)) ? slot : 1;
      await safeSetItem('lastSlot', slotToSave.toString());

      // Save timestamp for auto-save indicator (non-critical, can use regular save)
      await safeSetItem('lastSaveTime', Date.now().toString());

      await this.refreshSlotMeta(slot, data);

      this.log.debug(`Force save successful for slot ${slotToSave}`);

      // Don't show success toast - silent saves
    } catch (error: any) {
      // Handle quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        this.log.error('Storage quota exceeded. Attempting comprehensive cleanup...');

        // Perform comprehensive cleanup
        const cleanupResult = await this.performQuotaCleanup(slot);

        if (cleanupResult.success && cleanupResult.cleaned > 0) {
          this.log.info(`Cleaned up ${cleanupResult.cleaned} items, retrying force save...`);

          try {
            // Retry the save after cleanup using canonical envelope and double-buffer save.
            const { doubleBufferSave, createSaveEnvelope } = await import('@/utils/saveValidation');
            const retryEnvelope = createSaveEnvelope(serializedData);
            const retrySaveResult = await doubleBufferSave(key, retryEnvelope);
            if (retrySaveResult.success) {
              const slotToSave = (typeof slot === 'number' && !isNaN(slot)) ? slot : 1;
              await safeSetItem('lastSlot', slotToSave.toString());
              await safeSetItem('lastSaveTime', Date.now().toString());
              await this.refreshSlotMeta(slot, data);
              this.log.info('Force save succeeded after cleanup');
              return; // Success after cleanup
            } else {
              this.log.error(`Force save failed for slot ${slot} even after comprehensive cleanup: ${retrySaveResult.error}`);
            }
          } catch (retryError) {
            this.log.error(`Force save failed for slot ${slot} even after comprehensive cleanup:`, retryError);
          }
        }
        
        // If cleanup didn't help, show user-friendly error
        this.log.error(`Force save failed for slot ${slot} even after cleanup`);
        if (this.toastCallback) {
          this.toastCallback(
            'Storage full! Please delete old saves in Settings or free up device storage.',
            'error'
          );
        }
        throw new Error('Storage quota exceeded. Please free up space or delete old saves.');
      }
      
      this.log.error(`Force save failed for slot ${slot}:`, error);

      // Show error toast (always show errors)
      if (this.toastCallback) {
        this.toastCallback('Save Failed! Please try again.', 'error');
      }

      throw error;
    }
    } finally {
      // P1-11: always release the mutex, even on error (only if we acquired it).
      // C-1 (R8): skip release when manageMutex=false — saveGame owns the lock.
      if (manageMutex) saveLoadMutex.release(mutexToken);
    }
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  // Clear queue (useful for testing or emergency situations)
  clearQueue(): void {
    const dropped = this.queue;
    this.queue = [];
    this.processingPromise = null;
    // Anything waiting on a dropped operation must be told it is no longer
    // pending, or it waits forever — and, since F-9, holds the save/load mutex
    // while it does.
    for (const operation of dropped) this.settleOperation(operation);
  }

  private async persistQueue(): Promise<void> {
    try {
      // Only persist if queue has operations
      if (this.queue.length === 0) {
        return;
      }
      
      // Only persist operations that haven't failed too many times
      const operationsToPersist = this.queue.filter(op => op.retryCount < 2);
      if (operationsToPersist.length === 0) {
        return;
      }
      
      // F-11: SIGN THE PERSISTED QUEUE.
      //
      // Each entry carries a WHOLE GameState that `restoreQueue` replays
      // through `performSave` — which wraps it in a canonical envelope and
      // SIGNS it. Persisted as plain JSON, this key was therefore a laundry for
      // arbitrary state: edit `save_queue_persisted` (unsigned, no checksum),
      // relaunch, and the next save turns the edit into a validly-signed save
      // file. That defeats the entire HMAC layer protecting `save_slot_N`.
      //
      // The queue blob now goes through the same envelope as a save — CRC32 for
      // corruption, HMAC-SHA256 for tampering — and `restoreQueue` refuses
      // anything that does not verify. `createSaveEnvelope` throws on a build
      // that requires signing but cannot sign; the catch below then leaves the
      // queue unpersisted, which is the right way to fail: a blob we could not
      // sign is a blob we would have to refuse on the way back in anyway.
      //
      // Cost: one extra HMAC-SHA256 pass over the serialized queue, on a path
      // that already pays a full `JSON.stringify` of the same state — the same
      // order of magnitude as work this path already does, and it stays off the
      // awaited save path (this whole method is fire-and-forget from
      // `addToQueue`).
      const queueData = JSON.stringify(operationsToPersist);
      const { createSaveEnvelope } = await import('@/utils/saveValidation');
      await safeSetItem('save_queue_persisted', createSaveEnvelope(queueData));
      this.log.debug(`Persisted ${operationsToPersist.length} queue operations`);
    } catch (error) {
      this.log.warn('Failed to persist queue (non-critical):', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Flush queue to storage (for critical operations like background saves)
  async flushQueue(): Promise<void> {
    try {
      await this.persistQueue();
      // Give a small delay to ensure AsyncStorage has time to flush
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      this.log.warn('Failed to flush queue (non-critical):', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async restoreQueue(): Promise<void> {
    try {
      const queueData = await safeGetItem('save_queue_persisted');
      if (!queueData) {
        return;
      }

      // F-11: verify before trusting a single byte of it. `allowLegacy: false`
      // is explicit — the unsigned raw-JSON form this key used to hold is
      // exactly the shape an attacker (or an older build) leaves behind, and
      // replaying it would sign whatever it says. A blob that does not verify
      // is dropped, not replayed: at worst a device upgrading across this
      // change loses one queued write that it had already survived a kill
      // without, which the age/pristine/regression guards below would have
      // second-guessed anyway.
      const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
      const decodedQueue = decodePersistedSaveEnvelope(queueData, { allowLegacy: false });
      if (!decodedQueue.valid || typeof decodedQueue.data !== 'string') {
        this.log.error('[SAVE_SECURITY] Persisted save queue failed verification — discarding', {
          error: decodedQueue.error,
        });
        await safeRemoveItem('save_queue_persisted');
        return;
      }

      const operations: SaveOperation[] = JSON.parse(decodedQueue.data);
      if (Array.isArray(operations) && operations.length > 0) {
        // A persisted operation is a WHOLE GameState from a previous session,
        // replayed on the next launch. The only thing checked was the slot
        // number, so a write queued before the app died was committed later
        // regardless of how old it was or what had happened to the slot since —
        // and any guard that lives in `saveGame` is bypassed entirely, because
        // the replay does not go through it. That is what carried the pristine
        // boot state across an app kill on <=2.5.6, and it still would today
        // for a device that updates while carrying a persisted queue.
        // 2026-07-29 audit SAVE-OW-7.
        const now = Date.now();
        const { isPristineUnstartedState } = await import('@/utils/saveValidation');
        const { readSaveSlotMeta } = await import('@/utils/saveSlotMeta');

        const validOperations: SaveOperation[] = [];
        for (const op of operations) {
          if (!op || typeof op !== 'object') continue;
          if (!isWritableSlot(op.slot)) {
            this.log.warn(`Skipping invalid operation with slot: ${String(op?.slot)}`);
            continue;
          }

          // (a) Too old to be trusted. A save the player abandoned days ago
          // should not land on top of what they have played since.
          if (typeof op.timestamp !== 'number' || now - op.timestamp > MAX_REPLAYABLE_QUEUE_AGE_MS) {
            this.log.warn('Skipping stale persisted save operation', { slot: op.slot, timestamp: op.timestamp });
            continue;
          }

          // (b) The untouched boot default is never worth replaying, whoever
          // queued it. Same guard `saveGame` applies, moved to the replay
          // boundary where it cannot be bypassed.
          try {
            if (isPristineUnstartedState(op.data)) {
              this.log.warn('Skipping persisted save of a pristine unstarted state', { slot: op.slot });
              continue;
            }
          } catch {
            // Guard threw on a malformed payload — drop it rather than write it.
            continue;
          }

          // (c) Would it move the slot BACKWARDS? A replay that regresses
          // weeksLived is a rollback the player never asked for.
          try {
            const meta = await readSaveSlotMeta(op.slot);
            const queuedWeeks = typeof op.data?.weeksLived === 'number' ? op.data.weeksLived : -1;
            const currentWeeks = typeof meta?.weeksLived === 'number' ? meta.weeksLived : -1;
            if (currentWeeks > queuedWeeks) {
              this.log.warn('Skipping persisted save that would regress the slot', {
                slot: op.slot,
                queuedWeeks,
                currentWeeks,
              });
              continue;
            }
          } catch {
            // Could not read the summary: fall through and let the op run. It
            // already passed the age and pristine checks.
          }

          validOperations.push(op);
        }
        
        if (validOperations.length > 0) {
          // Add restored operations to queue (immutable)
          this.queue = [...this.queue, ...validOperations];
          this.log.info(`Restored ${validOperations.length} queue operations from previous session (${operations.length - validOperations.length} invalid operations skipped)`);
        } else {
          this.log.warn('No valid operations found in persisted queue');
        }

        // P2-12: only clear the persisted queue once processing has actually
        // finished. The previous code removed it eagerly here, so if the app
        // was killed between restore and processQueue completing, those
        // operations were lost permanently. The flag is honoured by whichever
        // drain finishes last (`kickProcessing`), so an already-running drain
        // clears it just the same.
        this.clearPersistedAfterDrain = true;
        void this.kickProcessing().catch(() => {});
      }
    } catch (error) {
      this.log.warn('Failed to restore queue (non-critical):', { error: error instanceof Error ? error.message : String(error) });
      // Clear corrupted persisted queue
      try {
        await safeRemoveItem('save_queue_persisted');
      } catch {}
    }
  }

  async restoreOnStartup(): Promise<void> {
    await this.restoreQueue();
  }

  /**
   * Cleanup old backups, keeping only the most recent ones
   */
  private async cleanupOldBackups(slot: number): Promise<number> {
    let cleanedCount = 0;
    try {
      const backups = await listBackups(slot);
      // Keep only the 2 most recent backups (instead of 3) when cleaning up
      if (backups.length > 2) {
        const toDelete = backups.slice(2);
        const keysToDelete = toDelete.map(b => b.id);
        if (keysToDelete.length > 0) {
          await safeMultiRemove(keysToDelete);
          cleanedCount = keysToDelete.length;
          this.log.info(`Cleaned up ${cleanedCount} old backups for slot ${slot}`);
        }
      }
    } catch (error) {
      this.log.error('Error cleaning up old backups:', error);
    }
    return cleanedCount;
  }

  /**
   * Cleanup cache data and non-essential storage
   */
  private async cleanupCacheData(): Promise<number> {
    let cleanedCount = 0;
    try {
      const keys = await safeGetAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes('_cache') ||
        key === 'unsynced_logs' ||
        key.startsWith('cloud_sync_data') ||
        key.startsWith('leaderboard_cache') ||
        key.startsWith('achievements_cache')
      );
      
      if (cacheKeys.length > 0) {
        await safeMultiRemove(cacheKeys);
        cleanedCount = cacheKeys.length;
        this.log.info(`Cleaned up ${cleanedCount} cache entries`);
      }
    } catch (error) {
      this.log.error('Error cleaning up cache data:', error);
    }
    return cleanedCount;
  }

  /**
   * Prune save data by removing old/unused properties
   * This is a lightweight compression that removes unnecessary data
   */
  private pruneSaveData(data: any, aggressive: boolean = false): any {
    try {
      const pruned = { ...data };

      // P1-8: many history arrays grew forever and could push a late-game save
      // past MAX_SAVE_SIZE (4MB), after which the save throws and the player can
      // no longer save AT ALL. Cap them here. `aggressive` (used by the over-size
      // retry) halves the caps for a genuinely smaller second pass.
      const k = aggressive ? 0.5 : 1;
      const cap = (n: number) => Math.max(20, Math.floor(n * k));
      const tail = (arr: any, n: number) =>
        Array.isArray(arr) && arr.length > n ? arr.slice(-n) : arr;

      if (pruned.lifetimeStatistics && typeof pruned.lifetimeStatistics === 'object') {
        const ls = { ...pruned.lifetimeStatistics };
        ls.netWorthHistory = tail(ls.netWorthHistory, cap(200));
        ls.careerHistory = tail(ls.careerHistory, cap(100));
        ls.weeklyEarningsHistory = tail(ls.weeklyEarningsHistory, cap(200));
        pruned.lifetimeStatistics = ls;
      }
      if (pruned.cryptoMarket && typeof pruned.cryptoMarket === 'object') {
        const cm = { ...pruned.cryptoMarket };
        cm.orderHistory = tail(cm.orderHistory, cap(100));
        if (cm.coinMarkets && typeof cm.coinMarkets === 'object') {
          const coins: any = {};
          for (const [id, coin] of Object.entries<any>(cm.coinMarkets)) {
            coins[id] =
              coin && Array.isArray(coin.priceHistory)
                ? { ...coin, priceHistory: tail(coin.priceHistory, cap(104)) }
                : coin;
          }
          cm.coinMarkets = coins;
        }
        pruned.cryptoMarket = cm;
      }
      if (pruned.darkWeb && typeof pruned.darkWeb === 'object') {
        pruned.darkWeb = {
          ...pruned.darkWeb,
          jobHistory: tail(pruned.darkWeb.jobHistory, cap(100)),
          recentEvents: tail(pruned.darkWeb.recentEvents, cap(50)),
        };
      }
      if (pruned.sparkApp && typeof pruned.sparkApp === 'object') {
        pruned.sparkApp = {
          ...pruned.sparkApp,
          jealousyHistory: tail(pruned.sparkApp.jealousyHistory, cap(50)),
          // swipes is a ring buffer (doc cap 200) but nothing trimmed it on the
          // save path — a daily swiper accumulated thousands over a long life.
          swipes: tail(pruned.sparkApp.swipes, cap(200)),
        };
      }
      // Banking history arrays grow every week on a long-lived save; cap the
      // credit-score timeline, inquiry log, and weekly budget buckets so they
      // can't march the save toward MAX_SAVE_SIZE (after which saving fails).
      if (pruned.banking && typeof pruned.banking === 'object') {
        const bank = { ...pruned.banking };
        if (bank.creditScore && typeof bank.creditScore === 'object') {
          bank.creditScore = {
            ...bank.creditScore,
            history: tail(bank.creditScore.history, cap(104)),
            inquiries: tail(bank.creditScore.inquiries, cap(104)),
          };
        }
        bank.budgetSpend = tail(bank.budgetSpend, cap(104));
        pruned.banking = bank;
      }
      pruned.travelHistory = tail(pruned.travelHistory, cap(100));
      if (pruned.socialMedia && typeof pruned.socialMedia === 'object') {
        const sm = { ...pruned.socialMedia };
        sm.scandalHistory = tail(sm.scandalHistory, cap(50));
        sm.recentPosts = tail(sm.recentPosts, cap(100));
        // commentThreads grows unbounded across a life. Drop threads whose post
        // is no longer in the (already-capped) recentPosts, and tail each
        // retained thread to its last 50 comments. Mirrors the runtime cap.
        if (sm.commentThreads && typeof sm.commentThreads === 'object') {
          const livePostIds = new Set(
            (Array.isArray(sm.recentPosts) ? sm.recentPosts : []).map((p: any) => p?.id),
          );
          const prunedThreads: Record<string, any[]> = {};
          for (const [postId, thread] of Object.entries<any>(sm.commentThreads)) {
            if (livePostIds.has(postId) && Array.isArray(thread)) {
              prunedThreads[postId] = tail(thread, cap(50));
            }
          }
          sm.commentThreads = prunedThreads;
        }
        // notifications is a runtime ring buffer (cap 100) but was never pruned
        // on the save path — add a defensive cap here too.
        sm.notifications = tail(sm.notifications, cap(100));
        // pendingBoosts is append-only (one entry per gem-boosted post) and was
        // never drained or capped anywhere — cap it so it can't march the save
        // toward MAX_SAVE_SIZE on a heavy-boost life.
        sm.pendingBoosts = tail(sm.pendingBoosts, cap(100));
        // brandInbox.history / .declined accumulate one entry per resolved brand
        // deal for the whole life with no cap (activeBrandDeals itself IS bounded).
        if (sm.brandInbox && typeof sm.brandInbox === 'object') {
          sm.brandInbox = {
            ...sm.brandInbox,
            history: tail(sm.brandInbox.history, cap(100)),
            declined: tail(sm.brandInbox.declined, cap(100)),
          };
        }
        pruned.socialMedia = sm;
      }
      if (pruned.gamingStreaming && typeof pruned.gamingStreaming === 'object') {
        const gs = { ...pruned.gamingStreaming };
        gs.streamHistory = tail(gs.streamHistory, cap(100));
        gs.videos = tail(gs.videos, cap(100));
        pruned.gamingStreaming = gs;
      }
      if (pruned.hustleApp && pruned.hustleApp.companies && typeof pruned.hustleApp.companies === 'object') {
        const companies: any = {};
        for (const [id, c] of Object.entries<any>(pruned.hustleApp.companies)) {
          companies[id] =
            c && Array.isArray(c.scandalHistory) ? { ...c, scandalHistory: tail(c.scandalHistory, cap(40)) } : c;
        }
        pruned.hustleApp = { ...pruned.hustleApp, companies };
      }
      pruned.socialPosts = tail(pruned.socialPosts, cap(100));
      pruned.previousLives = tail(pruned.previousLives, cap(50));

      // Relationships accumulate over a long life with no in-game cap, growing the
      // save and the per-tick relationship passes. Trim ONLY casual `friend`
      // entries (keeping the highest-scored) — never a parent/partner/spouse/child,
      // so no meaningful relationship is ever dropped.
      if (Array.isArray(pruned.relationships) && pruned.relationships.length > cap(150)) {
        const keep: any[] = [];
        const friends: any[] = [];
        for (const r of pruned.relationships) {
          if (r && r.type === 'friend') friends.push(r);
          else keep.push(r); // parent/partner/spouse/child are always retained
        }
        const friendBudget = Math.max(0, cap(150) - keep.length);
        if (friends.length > friendBudget) {
          friends.sort((a, b) => (b?.relationshipScore ?? 0) - (a?.relationshipScore ?? 0));
          pruned.relationships = [...keep, ...friends.slice(0, friendBudget)];
        }
      }

      // PERFORMANCE FIX: Enforce event log limit (keep only last 500 events)
      if (pruned.eventLog && Array.isArray(pruned.eventLog) && pruned.eventLog.length > 500) {
        pruned.eventLog = pruned.eventLog.slice(-500);
      }
      
      // PERFORMANCE FIX: Enforce journal limit (keep only last 50 entries)
      if (pruned.journal && Array.isArray(pruned.journal) && pruned.journal.length > 50) {
        pruned.journal = pruned.journal.slice(-50);
      }
      
      // PERFORMANCE FIX: Cap memories to last 200 (prevent unbounded growth)
      if (pruned.memories && Array.isArray(pruned.memories) && pruned.memories.length > 200) {
        pruned.memories = pruned.memories.slice(-200);
      }
      
      // PERFORMANCE FIX: Cap ancestors to last 50 generations (older ancestors rarely accessed)
      if (pruned.ancestors && Array.isArray(pruned.ancestors) && pruned.ancestors.length > 50) {
        pruned.ancestors = pruned.ancestors.slice(-50);
      }
      
      // LONG-TERM DEGRADATION FIX: Cap life milestones to last 200 (older milestones rarely displayed)
      if (pruned.lifeMilestones && Array.isArray(pruned.lifeMilestones) && pruned.lifeMilestones.length > 200) {
        pruned.lifeMilestones = pruned.lifeMilestones.slice(-200);
      }
      
      // Keep pending events intact.
      // They represent unresolved player choices; time-based pruning can silently erase content.
      if (pruned.pendingEvents && Array.isArray(pruned.pendingEvents)) {
        pruned.pendingEvents = pruned.pendingEvents.filter((event: any) => {
          return event && typeof event === 'object' && typeof event.id === 'string';
        });
      }
      
      // Checkpoints were the ONE sub-tree pruning never touched, and each one
      // carries a whole (slimmed) game snapshot — so on a long save they are
      // typically the largest thing in the payload, and the over-size retry
      // provably could not shrink them. 2026-07-28 audit save-4.
      //
      // Each snapshot is run through THIS SAME function rather than a parallel
      // list of caps, so the checkpoint path and the top-level path cannot drift
      // apart as new arrays are added. Any nested `checkpoints` key is dropped
      // before recursing — a snapshot should never contain snapshots, and that
      // also bounds the recursion at one level.
      if (Array.isArray(pruned.checkpoints) && pruned.checkpoints.length > 0) {
        // Dropping checkpoints entirely is reserved for the aggressive retry:
        // they are visible rewind targets in the Time Machine, so the normal
        // pass must only slim them, never remove them.
        const checkpoints = aggressive ? tail(pruned.checkpoints, 2) : pruned.checkpoints;
        pruned.checkpoints = checkpoints.map((cp: any) => {
          if (!cp || typeof cp !== 'object' || !cp.snapshot || typeof cp.snapshot !== 'object') return cp;
          const { checkpoints: _nested, ...snapshot } = cp.snapshot;
          return { ...cp, snapshot: this.pruneSaveData(snapshot, aggressive) };
        });
      }

      return pruned;
    } catch (error) {
      this.log.error('Error pruning save data:', error);
      return data; // Return original if pruning fails
    }
  }

  /**
   * Comprehensive cleanup when quota is exceeded
   */
  private async performQuotaCleanup(slot: number): Promise<{ success: boolean; cleaned: number }> {
    let totalCleaned = 0;
    
    try {
      // 1. Clean up old backups (keep only 2 most recent)
      const backupsCleaned = await this.cleanupOldBackups(slot);
      totalCleaned += backupsCleaned;
      
      // 2. Clean up cache data
      const cacheCleaned = await this.cleanupCacheData();
      totalCleaned += cacheCleaned;
      
      // 3. Clean up old cloud sync metadata
      try {
        const keys = await safeGetAllKeys();
        const cloudKeys = keys.filter(key => 
          key.startsWith('cloud_save_slot_') && 
          !key.includes('_backup') &&
          !key.endsWith(`_${slot}`)
        );
        if (cloudKeys.length > 0) {
          await safeMultiRemove(cloudKeys);
          totalCleaned += cloudKeys.length;
          this.log.info(`Cleaned up ${cloudKeys.length} old cloud sync entries`);
        }
      } catch (error) {
        this.log.error('Error cleaning cloud sync metadata:', error);
      }
      
      return { success: true, cleaned: totalCleaned };
    } catch (error) {
      this.log.error('Error during quota cleanup:', error);
      return { success: false, cleaned: totalCleaned };
    }
  }
}

// Export singleton instance
export const saveQueue = new SaveQueue();

// Helper function for easy usage
export const queueSave = (slot: number, data: any): Promise<void> => {
  return saveQueue.addToQueue(slot, data);
};

export const forceSave = (slot: number, data: any, manageMutex: boolean = true): Promise<void> => {
  return saveQueue.forceSave(slot, data, manageMutex);
};

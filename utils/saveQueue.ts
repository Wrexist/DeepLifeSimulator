import { logger } from '@/utils/logger';
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
}

type ToastCallback = (message: string, type: 'success' | 'error') => void;

class SaveQueue {
  private queue: SaveOperation[] = [];
  private processingPromise: Promise<void> | null = null;
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
    // Validate slot
    if (typeof slot !== 'number' || isNaN(slot) || slot < 1 || slot > 3) {
      this.log.error(`Invalid slot provided to addToQueue: ${slot}. Using default slot 1.`);
      slot = 1;
    }

    const operation: SaveOperation = {
      id: `save_${Date.now()}_${Math.random()}`,
      slot,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Immutable push to prevent mid-iteration mutation
    this.queue = [...this.queue, operation];

    // Persist queue after adding (non-blocking)
    this.persistQueue().catch(err => {
      this.log.warn('Failed to persist queue after add (non-critical):', err);
    });

    // Chain onto existing processing promise to guarantee serialized processing
    if (!this.processingPromise) {
      this.processingPromise = this.processQueue().finally(() => {
        this.processingPromise = null;
      });
    }
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
        }
      }
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
    if (typeof operation.slot !== 'number' || isNaN(operation.slot) || operation.slot < 1 || operation.slot > 3) {
      const defaultSlot = 1;
      this.log.error(`Invalid slot in performSave: ${operation.slot}. Using default slot ${defaultSlot}.`);
      operation.slot = defaultSlot;
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
    if (manageMutex) await saveLoadMutex.acquire('save');
    try {

    // Validate slot
    if (typeof slot !== 'number' || isNaN(slot) || slot < 1 || slot > 3) {
      this.log.error(`Invalid slot provided to forceSave: ${slot}. Using default slot 1.`);
      slot = 1;
    }

    const key = `save_slot_${slot}`;
    
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
      if (manageMutex) saveLoadMutex.release();
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
    this.queue = [];
    this.processingPromise = null;
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
      
      const queueData = JSON.stringify(operationsToPersist);
      await safeSetItem('save_queue_persisted', queueData);
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
      
      const operations: SaveOperation[] = JSON.parse(queueData);
      if (Array.isArray(operations) && operations.length > 0) {
        // Validate and filter out invalid operations
        const validOperations = operations.filter(op => {
          if (!op || typeof op !== 'object') return false;
          if (typeof op.slot !== 'number' || isNaN(op.slot) || op.slot < 1 || op.slot > 3) {
            this.log.warn(`Skipping invalid operation with slot: ${op.slot}`);
            return false;
          }
          return true;
        });
        
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
        // operations were lost permanently.
        if (!this.processingPromise) {
          this.processingPromise = this.processQueue().finally(() => {
            this.processingPromise = null;
            // Best-effort remove the persisted queue after a successful drain.
            // If processQueue threw we keep the persisted entry so the next
            // session can retry.
            void safeRemoveItem('save_queue_persisted').catch(() => {});
          });
        } else {
          // Another process is already draining; let its finally block clear
          // the persisted queue.
        }
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

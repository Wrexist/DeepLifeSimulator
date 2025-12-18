import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { listBackups } from '@/utils/saveBackup';
import { safeSetItem, safeGetItem, safeRemoveItem, safeMultiRemove, safeGetAllKeys } from '@/utils/safeStorage';

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
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private toastCallback: ToastCallback | null = null;
  private lastToastTime = 0;
  private toastCooldown = 2000; // 2 seconds cooldown between toasts
  private log = logger.scope('SaveQueue');

  // Register toast callback
  setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }


  async addToQueue(slot: number, data: any): Promise<void> {
    const operation: SaveOperation = {
      id: `save_${Date.now()}_${Math.random()}`,
      slot,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(operation);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (!operation) continue;

      try {
        await this.performSave(operation);
        this.log.debug(`Save successful for slot ${operation.slot}`);
        
        // Don't show success toast - silent saves
      } catch (error) {
        this.log.error(`Save failed for slot ${operation.slot}:`, error);
        
        if (operation.retryCount < this.maxRetries) {
          operation.retryCount++;
          operation.timestamp = Date.now();
          
          // Add back to queue with delay
          setTimeout(() => {
            this.queue.unshift(operation);
            if (!this.isProcessing) {
              this.processQueue();
            }
          }, this.retryDelay * operation.retryCount);
        } else {
          this.log.error(`Save operation failed permanently for slot ${operation.slot} after ${this.maxRetries} retries`);
          
          // Show error toast (always show errors)
          if (this.toastCallback) {
            this.toastCallback('Save Failed! Please try again.', 'error');
          }
        }
      }
    }

    this.isProcessing = false;
  }

  private async performSave(operation: SaveOperation): Promise<void> {
    const key = `save_slot_${operation.slot}`;
    
    // Prune save data to reduce size
    const prunedData = this.pruneSaveData(operation.data);
    let serializedData = JSON.stringify(prunedData);
    
    try {
      // Check if data is too large (localStorage limit is typically 5-10MB)
      const MAX_SAVE_SIZE = 4 * 1024 * 1024; // 4MB safety limit
      if (serializedData.length > MAX_SAVE_SIZE) {
        this.log.warn(`Save data is large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB`);
        // Try more aggressive pruning
        const morePruned = this.pruneSaveData(prunedData);
        serializedData = JSON.stringify(morePruned);
        
        if (serializedData.length > MAX_SAVE_SIZE) {
          throw new Error(`Save data too large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB. Please delete old saves or reduce game data.`);
        }
      }
      
      // Use atomic save for data integrity
      const { atomicSave } = await import('@/utils/saveValidation');
      const atomicResult = await atomicSave(key, serializedData);
      if (!atomicResult.success) {
        throw new Error(atomicResult.error || 'Atomic save failed');
      }
      
      // Also save the last slot reference (non-critical, can use regular save)
      await safeSetItem('lastSlot', operation.slot.toString());
      
      // Save timestamp for auto-save indicator (non-critical, can use regular save)
      await safeSetItem('lastSaveTime', Date.now().toString());
    } catch (error: any) {
      // Handle quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
        this.log.error('Storage quota exceeded. Attempting comprehensive cleanup...');
        
        // Perform comprehensive cleanup
        const cleanupResult = await this.performQuotaCleanup(operation.slot);
        
        if (cleanupResult.success && cleanupResult.cleaned > 0) {
          this.log.info(`Cleaned up ${cleanupResult.cleaned} items, retrying save...`);
          
          try {
            // Retry the save after cleanup
            const retrySuccess = await safeSetItem(key, serializedData);
            if (retrySuccess) {
              await safeSetItem('lastSlot', operation.slot.toString());
              await safeSetItem('lastSaveTime', Date.now().toString());
              this.log.info('Save succeeded after cleanup');
              return; // Success after cleanup
            } else {
              this.log.error('Save failed even after comprehensive cleanup');
            }
          } catch (retryError) {
            this.log.error('Save failed even after comprehensive cleanup');
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

  // Force save a specific slot immediately (bypasses queue)
  async forceSave(slot: number, data: any): Promise<void> {
    const key = `save_slot_${slot}`;
    
    // Prune save data to reduce size
    const prunedData = this.pruneSaveData(data);
    let serializedData = JSON.stringify(prunedData);
    
    try {
      // Check if data is too large
      const MAX_SAVE_SIZE = 4 * 1024 * 1024; // 4MB safety limit
      if (serializedData.length > MAX_SAVE_SIZE) {
        this.log.warn(`Save data is large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB`);
        // Try more aggressive pruning
        const morePruned = this.pruneSaveData(prunedData);
        serializedData = JSON.stringify(morePruned);
        
        if (serializedData.length > MAX_SAVE_SIZE) {
          throw new Error(`Save data too large: ${(serializedData.length / 1024 / 1024).toFixed(2)}MB. Please delete old saves or reduce game data.`);
        }
      }
      
      const saveSuccess = await safeSetItem(key, serializedData);
      if (!saveSuccess) {
        throw new Error('Failed to save game data');
      }
      await safeSetItem('lastSlot', slot.toString());
      
      // Save timestamp for auto-save indicator
      await safeSetItem('lastSaveTime', Date.now().toString());
      
      this.log.debug(`Force save successful for slot ${slot}`);
      
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
            // Retry the save after cleanup
            const retrySuccess = await safeSetItem(key, serializedData);
            if (retrySuccess) {
              await safeSetItem('lastSlot', slot.toString());
              await safeSetItem('lastSaveTime', Date.now().toString());
              this.log.info('Force save succeeded after cleanup');
              return; // Success after cleanup
            } else {
              this.log.error(`Force save failed for slot ${slot} even after comprehensive cleanup`);
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
    this.isProcessing = false;
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
  private pruneSaveData(data: any): any {
    try {
      const pruned = { ...data };
      
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
      
      // Remove old pending events if they're too old
      if (pruned.pendingEvents && Array.isArray(pruned.pendingEvents)) {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        pruned.pendingEvents = pruned.pendingEvents.filter((event: any) => {
          return event.timestamp && event.timestamp > oneWeekAgo;
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

export const forceSave = (slot: number, data: any): Promise<void> => {
  return saveQueue.forceSave(slot, data);
};

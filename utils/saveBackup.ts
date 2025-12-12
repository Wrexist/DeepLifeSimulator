import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import { calculateChecksum } from './saveValidation';

const BACKUP_PREFIX = 'save_backup_';
const MAX_BACKUPS_PER_SLOT = 5; // Increased from 3 to 5 for better recovery options

export interface BackupMetadata {
  id: string;
  slot: number;
  timestamp: number;
  size: number;
  reason: string;
}

/**
 * Create a backup of a save slot
 */
export async function createBackup(
  slot: number, 
  data: string, 
  checksum: string, 
  reason: string = 'auto'
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const backupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
    
    const backupData = {
      data,
      checksum,
      metadata: {
        id: backupId,
        slot,
        timestamp,
        size: data.length,
        reason
      }
    };

    await AsyncStorage.setItem(backupId, JSON.stringify(backupData));
    logger.info(`Created backup for slot ${slot}: ${backupId} (${reason})`);
    
    // Rotate backups to keep only the latest ones
    await rotateBackups(slot);
    
    return backupId;
  } catch (error: any) {
    // Handle quota exceeded error by cleaning up old backups and retrying
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
      logger.warn(`Storage quota exceeded when creating backup for slot ${slot}. Attempting cleanup...`);
      
      try {
        // Clean up old backups more aggressively (keep only 1 most recent)
        const backups = await listBackups(slot);
        if (backups.length > 1) {
          const toDelete = backups.slice(1); // Keep only the most recent
          const keysToDelete = toDelete.map(b => b.id);
          
          if (keysToDelete.length > 0) {
            await AsyncStorage.multiRemove(keysToDelete);
            logger.info(`Cleaned up ${keysToDelete.length} old backups for slot ${slot} due to quota`);
          }
        }
        
        // Also clean up old backups from other slots if needed
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const allBackupKeys = allKeys.filter(key => key.startsWith(BACKUP_PREFIX));
          
          // Group by slot
          const backupsBySlot: { [slot: number]: BackupMetadata[] } = {};
          for (const key of allBackupKeys) {
            try {
              const item = await AsyncStorage.getItem(key);
              if (item) {
                const parsed = JSON.parse(item);
                if (parsed.metadata) {
                  const backupSlot = parsed.metadata.slot;
                  if (!backupsBySlot[backupSlot]) {
                    backupsBySlot[backupSlot] = [];
                  }
                  backupsBySlot[backupSlot].push(parsed.metadata);
                }
              }
            } catch (e) {
              // Skip corrupted entries
            }
          }
          
          // Clean up old backups from all slots (keep only 1 per slot)
          let totalCleaned = 0;
          for (const [slotNum, slotBackups] of Object.entries(backupsBySlot)) {
            if (slotBackups.length > 1) {
              const sorted = slotBackups.sort((a, b) => b.timestamp - a.timestamp);
              const toDelete = sorted.slice(1).map(b => b.id);
              if (toDelete.length > 0) {
                await AsyncStorage.multiRemove(toDelete);
                totalCleaned += toDelete.length;
              }
            }
          }
          
          if (totalCleaned > 0) {
            logger.info(`Cleaned up ${totalCleaned} old backups across all slots`);
          }
        } catch (cleanupError) {
          logger.error('Error during aggressive backup cleanup:', cleanupError);
        }
        
        // Retry creating the backup after cleanup
        try {
          const retryBackupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
          await AsyncStorage.setItem(retryBackupId, JSON.stringify(backupData));
          logger.info(`Created backup for slot ${slot} after cleanup: ${retryBackupId} (${reason})`);
          return retryBackupId;
        } catch (retryError) {
          logger.error(`Failed to create backup for slot ${slot} even after cleanup`, retryError);
          return null;
        }
      } catch (cleanupError) {
        logger.error(`Failed to cleanup backups for slot ${slot}:`, cleanupError);
        return null;
      }
    }
    
    logger.error(`Failed to create backup for slot ${slot}`, error);
    return null;
  }
}

/**
 * Helper to create a backup directly from a state object
 */
export async function createBackupFromState(
  slot: number,
  state: any,
  reason: string
): Promise<string | null> {
  try {
    const data = JSON.stringify(state);
    const checksum = calculateChecksum(data);
    return createBackup(slot, data, checksum, reason);
  } catch (error) {
    logger.error('Failed to create backup from state', error);
    return null;
  }
}

/**
 * List available backups for a slot
 */
export async function listBackups(slot: number): Promise<BackupMetadata[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(`${BACKUP_PREFIX}${slot}_`));
    
    const backups: BackupMetadata[] = [];
    
    for (const key of backupKeys) {
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.metadata) {
            backups.push(parsed.metadata);
          }
        }
      } catch (e) {
        // Skip corrupted backup entries
        logger.warn(`Found corrupted backup entry: ${key}`);
      }
    }
    
    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error(`Failed to list backups for slot ${slot}`, error);
    return [];
  }
}

/**
 * Load a specific backup
 */
export async function loadBackup(backupId: string): Promise<{ data: string; checksum: string } | null> {
  try {
    const item = await AsyncStorage.getItem(backupId);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    return {
      data: parsed.data,
      checksum: parsed.checksum
    };
  } catch (error) {
    logger.error(`Failed to load backup ${backupId}`, error);
    return null;
  }
}

/**
 * Restore a slot from a backup
 * Returns the restored state object if successful, null otherwise
 */
export async function restoreFromBackup(slot: number, backupId: string): Promise<any | null> {
  try {
    const backup = await loadBackup(backupId);
    if (!backup) {
      logger.error(`Backup not found: ${backupId}`);
      return null;
    }
    
    const mainSaveKey = `save_slot_${slot}`;
    // const mainSaveChecksumKey = `save_slot_${slot}_checksum`; // Not always used separately, often inside state
    
    await AsyncStorage.setItem(mainSaveKey, backup.data);
    
    logger.info(`Restored slot ${slot} from backup ${backupId}`);
    return JSON.parse(backup.data);
  } catch (error) {
    logger.error(`Failed to restore backup ${backupId} to slot ${slot}`, error);
    return null;
  }
}

/**
 * Delete old backups to save space
 */
async function rotateBackups(slot: number) {
  try {
    const backups = await listBackups(slot);
    
    if (backups.length > MAX_BACKUPS_PER_SLOT) {
      const toDelete = backups.slice(MAX_BACKUPS_PER_SLOT);
      const keysToDelete = toDelete.map(b => b.id);
      
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
        logger.info(`Removed ${keysToDelete.length} old backups for slot ${slot}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to rotate backups for slot ${slot}`, error);
  }
}

// Compatibility aliases
export const createBackupBeforeMajorAction = createBackupFromState;
export const saveBackupManager = {
  listBackups,
  restoreBackup: restoreFromBackup
};

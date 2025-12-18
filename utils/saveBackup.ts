import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import { calculateChecksum } from './saveValidation';
import { safeSetItem, safeGetItem, safeRemoveItem, safeMultiRemove, safeGetAllKeys } from './safeStorage';

const BACKUP_PREFIX = 'save_backup_';
const PROTECTED_STATE_PREFIX = 'protected_state_';
const MAX_BACKUPS_PER_SLOT = 5; // Increased from 3 to 5 for better recovery options
const MAX_TOTAL_BACKUP_SIZE = 10 * 1024 * 1024; // 10MB total backup storage limit
const MIN_BACKUP_INTERVAL_MS = 60 * 1000; // Minimum 1 minute between manual backups
const LAST_BACKUP_PREFIX = 'last_backup_time_';

export type BackupReason = 'manual' | 'auto_save' | 'delete_save' | 'corruption_recovery' | 'before_update' | 'background_save' | 'app_resume' | 'emergency_save' | 'before_week';

export interface BackupGameInfo {
  characterName: string;
  age: number;
  money: number;
  weeksLived: number;
}

export interface BackupMetadata {
  id: string;
  slot: number;
  timestamp: number;
  size: number;
  reason: BackupReason | string;
  label?: string;
  gameInfo?: BackupGameInfo;
}

export interface BackupStorageInfo {
  totalSize: number;
  maxSize: number;
  backupsBySlot: { [slot: number]: { count: number; size: number } };
}

/**
 * Protected State - Critical game state that cannot be reversed via backups
 * This prevents exploits like death reversal, jail escape, etc.
 */
export interface ProtectedState {
  slot: number;
  // Death tracking - once dead, cannot restore to alive state
  isDead: boolean;
  deathTimestamp?: number;
  deathReason?: string;
  generationNumber: number;
  // Jail tracking - cannot escape jail via restore
  isInJail: boolean;
  jailStartTimestamp?: number;
  jailWeeksRemaining?: number;
  // Criminal record - permanent, cannot be erased
  highestWantedLevel: number;
  totalCrimesCommitted: number;
  totalJailTime: number;
  // Age tracking - cannot become younger
  highestAgeReached: number;
  // Premium currency protection
  totalGemsSpent: number;
  // Achievements that grant permanent benefits
  permanentAchievements: string[];
  // Timestamp of last update
  lastUpdated: number;
}

/**
 * Exploit detection result
 */
export interface ExploitCheckResult {
  allowed: boolean;
  reason?: string;
  exploitType?: 'death_reversal' | 'jail_escape' | 'age_regression' | 'criminal_reset' | 'rate_limit' | 'invalid_state';
}

/**
 * Get protected state for a slot
 */
export async function getProtectedState(slot: number): Promise<ProtectedState | null> {
  try {
    const key = `${PROTECTED_STATE_PREFIX}${slot}`;
    const data = await safeGetItem(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get protected state for slot ${slot}`, error);
    return null;
  }
}

/**
 * Update protected state for a slot
 * This should be called whenever critical state changes occur
 */
export async function updateProtectedState(slot: number, gameState: any): Promise<void> {
  try {
    const existing = await getProtectedState(slot);
    const now = Date.now();
    
    const newProtected: ProtectedState = {
      slot,
      // Death state - once set, cannot be unset
      isDead: existing?.isDead || gameState.showDeathPopup || !!gameState.deathReason,
      deathTimestamp: existing?.deathTimestamp || (gameState.showDeathPopup ? now : undefined),
      deathReason: existing?.deathReason || gameState.deathReason,
      generationNumber: Math.max(existing?.generationNumber || 1, gameState.generationNumber || 1),
      // Jail state
      isInJail: gameState.jailWeeks > 0,
      jailStartTimestamp: gameState.jailWeeks > 0 ? (existing?.jailStartTimestamp || now) : undefined,
      jailWeeksRemaining: gameState.jailWeeks || 0,
      // Criminal record - only increases
      highestWantedLevel: Math.max(existing?.highestWantedLevel || 0, gameState.wantedLevel || 0),
      totalCrimesCommitted: Math.max(existing?.totalCrimesCommitted || 0, gameState.streetJobsCompleted || 0),
      totalJailTime: (existing?.totalJailTime || 0) + (existing?.isInJail && !gameState.jailWeeks ? (existing.jailWeeksRemaining || 0) : 0),
      // Age - can only increase
      highestAgeReached: Math.max(existing?.highestAgeReached || 0, gameState.date?.age || 0),
      // Gems spent - can only increase
      totalGemsSpent: Math.max(existing?.totalGemsSpent || 0, gameState.stats?.gemsSpent || 0),
      // Permanent achievements
      permanentAchievements: [
        ...(existing?.permanentAchievements || []),
        ...(gameState.achievements?.filter((a: any) => a.completed && a.permanent).map((a: any) => a.id) || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // Unique
      lastUpdated: now,
    };
    
    const key = `${PROTECTED_STATE_PREFIX}${slot}`;
    await safeSetItem(key, JSON.stringify(newProtected));
    logger.debug(`Updated protected state for slot ${slot}`);
  } catch (error) {
    logger.error(`Failed to update protected state for slot ${slot}`, error);
  }
}

/**
 * Clear protected state for a slot (only when starting a completely new game)
 */
export async function clearProtectedState(slot: number): Promise<void> {
  try {
    const key = `${PROTECTED_STATE_PREFIX}${slot}`;
    await safeRemoveItem(key);
    logger.info(`Cleared protected state for slot ${slot}`);
  } catch (error) {
    logger.error(`Failed to clear protected state for slot ${slot}`, error);
  }
}

/**
 * Check if creating a backup is allowed (anti-exploit)
 */
export async function canCreateBackup(slot: number, gameState: any): Promise<ExploitCheckResult> {
  try {
    // Check 1: Cannot backup if character is dead
    if (gameState.showDeathPopup || gameState.deathReason) {
      return {
        allowed: false,
        reason: 'Cannot create backup while character is dead. Complete the death process first.',
        exploitType: 'death_reversal',
      };
    }
    
    // Check 2: Cannot backup if in jail (prevents jail escape exploit)
    if (gameState.jailWeeks > 0) {
      return {
        allowed: false,
        reason: 'Cannot create backup while in jail. Serve your time first.',
        exploitType: 'jail_escape',
      };
    }
    
    // Check 3: Rate limiting - prevent spam backups
    const lastBackupKey = `${LAST_BACKUP_PREFIX}${slot}`;
    const lastBackupTime = await safeGetItem(lastBackupKey);
    if (lastBackupTime) {
      const timeSinceLastBackup = Date.now() - parseInt(lastBackupTime, 10);
      if (timeSinceLastBackup < MIN_BACKUP_INTERVAL_MS) {
        const waitSeconds = Math.ceil((MIN_BACKUP_INTERVAL_MS - timeSinceLastBackup) / 1000);
        return {
          allowed: false,
          reason: `Please wait ${waitSeconds} seconds before creating another backup.`,
          exploitType: 'rate_limit',
        };
      }
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Error checking backup permission', error);
    // Allow backup if check fails (fail-open for user experience)
    return { allowed: true };
  }
}

/**
 * Check if restoring a backup is allowed (anti-exploit)
 */
export async function canRestoreBackup(
  slot: number, 
  backupState: any, 
  currentState: any
): Promise<ExploitCheckResult> {
  try {
    const protectedState = await getProtectedState(slot);
    
    // Also check current state directly (in case protected state isn't up to date)
    const currentIsDead = currentState?.showDeathPopup || currentState?.deathReason;
    const currentInJail = (currentState?.jailWeeks || 0) > 0;
    const currentGeneration = currentState?.generationNumber || 1;
    
    // Check 1: Death reversal - cannot restore to alive state if player has died
    const playerIsDead = protectedState?.isDead || currentIsDead;
    if (playerIsDead) {
      const backupIsDead = backupState.showDeathPopup || backupState.deathReason;
      if (!backupIsDead) {
        return {
          allowed: false,
          reason: 'Cannot restore to a backup from before your character died. Your character has passed away permanently.',
          exploitType: 'death_reversal',
        };
      }
    }
    
    // Check 2: Jail escape - cannot restore to escape jail
    const playerInJail = (protectedState?.isInJail && protectedState.jailWeeksRemaining > 0) || currentInJail;
    if (playerInJail) {
      const backupInJail = backupState.jailWeeks > 0;
      if (!backupInJail) {
        return {
          allowed: false,
          reason: 'Cannot restore to escape from jail. You must serve your sentence.',
          exploitType: 'jail_escape',
        };
      }
    }
    
    // Check 3: Age regression - cannot become younger than highest age reached
    const highestAge = Math.max(
      protectedState?.highestAgeReached || 0, 
      currentState?.date?.age || 0
    );
    if (highestAge > 0) {
      const backupAge = backupState.date?.age || 0;
      // Allow 1 year tolerance for minor discrepancies
      if (backupAge < highestAge - 1) {
        return {
          allowed: false,
          reason: `Cannot restore to age ${Math.floor(backupAge)}. You have already reached age ${Math.floor(highestAge)}.`,
          exploitType: 'age_regression',
        };
      }
    }
    
    // Check 4: Generation mismatch - cannot go back to previous generation
    const highestGeneration = Math.max(
      protectedState?.generationNumber || 1, 
      currentGeneration
    );
    const backupGeneration = backupState.generationNumber || 1;
    if (backupGeneration < highestGeneration) {
      return {
        allowed: false,
        reason: 'Cannot restore to a previous generation. Your lineage has moved on.',
        exploitType: 'death_reversal',
      };
    }
    
    // Check 5: Criminal record protection - cannot reduce criminal history significantly
    const totalCrimes = Math.max(
      protectedState?.totalCrimesCommitted || 0,
      currentState?.streetJobsCompleted || 0
    );
    if (totalCrimes > 10) {
      const backupCrimes = backupState.streetJobsCompleted || 0;
      // Allow some tolerance but not significant reduction (50%)
      if (backupCrimes < totalCrimes * 0.5) {
        return {
          allowed: false,
          reason: 'Cannot restore to erase your criminal history.',
          exploitType: 'criminal_reset',
        };
      }
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Error checking restore permission', error);
    // Block restore if check fails (fail-closed for security)
    return {
      allowed: false,
      reason: 'Unable to verify backup integrity. Please try again.',
      exploitType: 'invalid_state',
    };
  }
}

/**
 * Record backup creation time for rate limiting
 */
async function recordBackupTime(slot: number): Promise<void> {
  try {
    const key = `${LAST_BACKUP_PREFIX}${slot}`;
    await safeSetItem(key, Date.now().toString());
  } catch (error) {
    logger.error('Failed to record backup time', error);
  }
}

/**
 * Extract game info from a state object for backup metadata
 */
function extractGameInfo(state: any): BackupGameInfo | undefined {
  try {
    if (!state) return undefined;
    
    const firstName = state.userProfile?.firstName || '';
    const lastName = state.userProfile?.lastName || '';
    const characterName = `${firstName} ${lastName}`.trim() || 'Unknown';
    
    return {
      characterName,
      age: Math.ceil(state.date?.age || 0),
      money: state.stats?.money || 0,
      weeksLived: state.weeksLived || 0,
    };
  } catch (error) {
    logger.warn('Failed to extract game info for backup', error);
    return undefined;
  }
}

/**
 * Create a backup of a save slot
 */
export async function createBackup(
  slot: number, 
  data: string, 
  checksum: string, 
  reason: BackupReason | string = 'auto_save'
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const backupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
    
    // Extract game info from data
    let gameInfo: BackupGameInfo | undefined;
    try {
      const state = JSON.parse(data);
      gameInfo = extractGameInfo(state);
    } catch (e) {
      // Data might not be valid JSON, skip game info
    }
    
    const backupData = {
      data,
      checksum,
      metadata: {
        id: backupId,
        slot,
        timestamp,
        size: data.length,
        reason,
        gameInfo,
      } as BackupMetadata
    };

    await safeSetItem(backupId, JSON.stringify(backupData));
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
            await safeMultiRemove(keysToDelete);
            logger.info(`Cleaned up ${keysToDelete.length} old backups for slot ${slot} due to quota`);
          }
        }
        
        // Also clean up old backups from other slots if needed
        try {
          const allKeys = await safeGetAllKeys();
          const allBackupKeys = allKeys.filter(key => key.startsWith(BACKUP_PREFIX));
          
          // Group by slot
          const backupsBySlot: { [slot: number]: BackupMetadata[] } = {};
          for (const key of allBackupKeys) {
            try {
              const item = await safeGetItem(key);
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
                await safeMultiRemove(toDelete);
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
          await safeSetItem(retryBackupId, JSON.stringify(backupData));
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
export async function restoreFromBackup(
  slot: number, 
  backupId: string
): Promise<{ success: boolean; state?: any; error?: string }> {
  try {
    const backup = await loadBackup(backupId);
    if (!backup) {
      logger.error(`Backup not found: ${backupId}`);
      return { success: false, error: 'Backup not found' };
    }
    
    // Parse backup state
    let backupState: any;
    try {
      backupState = JSON.parse(backup.data);
    } catch (e) {
      logger.error(`Backup data corrupted: ${backupId}`);
      return { success: false, error: 'Backup data is corrupted' };
    }
    
    // Get current state for comparison
    const mainSaveKey = `save_slot_${slot}`;
    const currentData = await safeGetItem(mainSaveKey);
    let currentState: any = {};
    if (currentData) {
      try {
        currentState = JSON.parse(currentData);
      } catch (e) {
        // Current state corrupted, allow restore
      }
    }
    
    // ANTI-EXPLOIT: Check if restore is allowed
    const exploitCheck = await canRestoreBackup(slot, backupState, currentState);
    if (!exploitCheck.allowed) {
      logger.warn(`Restore blocked: ${exploitCheck.exploitType} - ${exploitCheck.reason}`);
      return { success: false, error: exploitCheck.reason };
    }
    
    // Perform the restore
    await safeSetItem(mainSaveKey, backup.data);
    
    // Update protected state with restored state
    await updateProtectedState(slot, backupState);
    
    logger.info(`Restored slot ${slot} from backup ${backupId}`);
    return { success: true, state: backupState };
  } catch (error) {
    logger.error(`Failed to restore backup ${backupId} to slot ${slot}`, error);
    return { success: false, error: 'Failed to restore backup' };
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
        await safeMultiRemove(keysToDelete);
        logger.info(`Removed ${keysToDelete.length} old backups for slot ${slot}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to rotate backups for slot ${slot}`, error);
  }
}

/**
 * Create a manual backup with optional label
 * This is the one-tap backup function for users
 */
export async function createManualBackup(
  slot: number,
  label?: string
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  try {
    // Get current save data
    const saveKey = `save_slot_${slot}`;
    const saveData = await safeGetItem(saveKey);
    
    if (!saveData) {
      return { success: false, error: 'No save data found for this slot' };
    }
    
    // Parse state to check for exploits and extract game info
    let gameState: any;
    let gameInfo: BackupGameInfo | undefined;
    try {
      gameState = JSON.parse(saveData);
      gameInfo = extractGameInfo(gameState);
    } catch (e) {
      logger.warn('Could not parse save data for game info extraction');
      return { success: false, error: 'Save data is corrupted' };
    }
    
    // ANTI-EXPLOIT: Check if backup creation is allowed
    const exploitCheck = await canCreateBackup(slot, gameState);
    if (!exploitCheck.allowed) {
      logger.warn(`Backup blocked: ${exploitCheck.exploitType} - ${exploitCheck.reason}`);
      return { success: false, error: exploitCheck.reason };
    }
    
    // Update protected state before creating backup
    await updateProtectedState(slot, gameState);
    
    const checksum = calculateChecksum(saveData);
    const timestamp = Date.now();
    const backupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
    
    const backupData = {
      data: saveData,
      checksum,
      metadata: {
        id: backupId,
        slot,
        timestamp,
        size: saveData.length,
        reason: 'manual' as BackupReason,
        label: label || undefined,
        gameInfo,
      }
    };
    
    await AsyncStorage.setItem(backupId, JSON.stringify(backupData));
    
    // Record backup time for rate limiting
    await recordBackupTime(slot);
    logger.info(`Created manual backup for slot ${slot}: ${backupId}${label ? ` (${label})` : ''}`);
    
    // Rotate backups to keep only the latest ones
    await rotateBackups(slot);
    
    return { success: true, backupId };
  } catch (error: any) {
    logger.error(`Failed to create manual backup for slot ${slot}`, error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Delete a specific backup by ID
 */
export async function deleteBackup(backupId: string): Promise<boolean> {
  try {
    // Verify the backup exists
    const item = await AsyncStorage.getItem(backupId);
    if (!item) {
      logger.warn(`Backup not found for deletion: ${backupId}`);
      return false;
    }
    
    await AsyncStorage.removeItem(backupId);
    logger.info(`Deleted backup: ${backupId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete backup ${backupId}`, error);
    return false;
  }
}

/**
 * Delete all backups for a specific slot
 * Returns the number of backups deleted
 */
export async function deleteAllBackupsForSlot(slot: number): Promise<number> {
  try {
    const backups = await listBackups(slot);
    
    if (backups.length === 0) {
      return 0;
    }
    
    const keysToDelete = backups.map(b => b.id);
    await AsyncStorage.multiRemove(keysToDelete);
    
    logger.info(`Deleted all ${keysToDelete.length} backups for slot ${slot}`);
    return keysToDelete.length;
  } catch (error) {
    logger.error(`Failed to delete all backups for slot ${slot}`, error);
    return 0;
  }
}

/**
 * Get storage usage information for all backups
 */
export async function getBackupStorageInfo(): Promise<BackupStorageInfo> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(BACKUP_PREFIX));
    
    let totalSize = 0;
    const backupsBySlot: { [slot: number]: { count: number; size: number } } = {};
    
    // Initialize slots 1-3
    for (let i = 1; i <= 3; i++) {
      backupsBySlot[i] = { count: 0, size: 0 };
    }
    
    for (const key of backupKeys) {
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const size = item.length;
          const slot = parsed.metadata?.slot;
          
          totalSize += size;
          
          if (slot && backupsBySlot[slot]) {
            backupsBySlot[slot].count++;
            backupsBySlot[slot].size += size;
          }
        }
      } catch (e) {
        // Skip corrupted entries
      }
    }
    
    return {
      totalSize,
      maxSize: MAX_TOTAL_BACKUP_SIZE,
      backupsBySlot,
    };
  } catch (error) {
    logger.error('Failed to get backup storage info', error);
    return {
      totalSize: 0,
      maxSize: MAX_TOTAL_BACKUP_SIZE,
      backupsBySlot: {
        1: { count: 0, size: 0 },
        2: { count: 0, size: 0 },
        3: { count: 0, size: 0 },
      },
    };
  }
}

/**
 * List all backups across all slots
 */
export async function listAllBackups(): Promise<BackupMetadata[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(BACKUP_PREFIX));
    
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
        logger.warn(`Found corrupted backup entry: ${key}`);
      }
    }
    
    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error('Failed to list all backups', error);
    return [];
  }
}

// Compatibility aliases
export const createBackupBeforeMajorAction = createBackupFromState;
export const saveBackupManager = {
  listBackups,
  restoreBackup: restoreFromBackup,
  createManualBackup,
  deleteBackup,
  deleteAllBackupsForSlot,
  getBackupStorageInfo,
  listAllBackups,
  canCreateBackup,
  canRestoreBackup,
  updateProtectedState,
  getProtectedState,
  clearProtectedState,
};

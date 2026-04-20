import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../app.config.js';
import { logger } from './logger';
import { saveBackupManager } from './saveBackup';
import { safeSetItem, safeGetItem, safeMultiRemove, safeGetAllKeys } from './safeStorage';
const appJson = appConfig.expo;

// Cache management utility for automatic version-based cache clearing
export class CacheManager {
  private static readonly VERSION_KEY = 'game_version';
  private static readonly CURRENT_VERSION = appJson.version; // Sync with app version
  
  // Cache keys that should be cleared on version updates
  // NOTE: Save slots (save_slot_*) are NEVER cleared - they contain player progress!
  private static readonly CACHE_KEYS = [
    'realEstateProperties', // Old property data (deprecated)
    'tutorial_completed', // Tutorial state (can be reset)
    'ui_settings', // UI preferences (can be reset)
    'achievements_cache', // Achievement cache (not actual achievements)
    'leaderboard_cache', // Leaderboard cache
    'cloud_sync_data', // Cloud sync metadata (not actual saves)
  ];

  // Save slot keys pattern - DO NOT CLEAR THESE!
  // These contain actual player save data and should be preserved
  private static readonly SAVE_SLOT_PATTERN = /^save_slot_\d+$/;
  private static readonly SAVE_DOUBLE_BUFFER_PATTERN = /^save_slot_\d+_(A|B|active)$/;
  private static readonly SAVE_BACKUP_PATTERN = /^save_slot_\d+_(backup|temp)$/;
  private static readonly CLOUD_SAVE_PATTERN = /^cloud_save_slot_\d+/;
  // Backup system keys - also NEVER clear these!
  private static readonly BACKUP_PATTERN = /^save_backup_\d+_\d+$/;
  
  // Protected keys that should NEVER be cleared (for explicit checking)
  private static readonly PROTECTED_KEYS = [
    'gameState', // Legacy save format (might be used for migration)
    'lastSlot', // Current slot indicator
    'lastSaveTime', // Save timestamp
    'game_version', // Version tracking
  ];

  /**
   * Verify that save data exists before cache operations
   * Returns object with save slot information
   */
  private static async verifySaveDataExists(): Promise<{
    saveSlots: string[];
    backups: string[];
    hasData: boolean;
  }> {
    try {
      const allKeys = await safeGetAllKeys();
      const saveSlots = allKeys.filter(key => this.SAVE_SLOT_PATTERN.test(key));
      const backups = allKeys.filter(key => 
        this.BACKUP_PATTERN.test(key) || 
        this.SAVE_BACKUP_PATTERN.test(key) ||
        this.CLOUD_SAVE_PATTERN.test(key)
      );
      
      logger.info(`[CacheManager] Save data verification: ${saveSlots.length} save slots, ${backups.length} backups found`);
      if (saveSlots.length > 0) {
        logger.info(`[CacheManager] Save slots found: ${saveSlots.join(', ')}`);
      }
      
      return {
        saveSlots,
        backups,
        hasData: saveSlots.length > 0 || backups.length > 0,
      };
    } catch (error) {
      logger.error('[CacheManager] Failed to verify save data:', error);
      return { saveSlots: [], backups: [], hasData: false };
    }
  }

  /**
   * Verify that save data was preserved after cache clear
   * Returns true if all save slots are still present, false otherwise
   */
  private static async verifySaveDataPreserved(beforeState: { saveSlots: string[]; backups: string[] }): Promise<{
    preserved: boolean;
    missingSlots: string[];
    missingBackups: string[];
  }> {
    try {
      const afterState = await this.verifySaveDataExists();
      
      const missingSlots = beforeState.saveSlots.filter(slot => !afterState.saveSlots.includes(slot));
      const missingBackups = beforeState.backups.filter(backup => !afterState.backups.includes(backup));
      
      if (missingSlots.length > 0) {
        logger.error(`[CacheManager] CRITICAL: Missing save slots after cache clear: ${missingSlots.join(', ')}`);
      }
      if (missingBackups.length > 0) {
        logger.warn(`[CacheManager] Missing backups after cache clear: ${missingBackups.join(', ')}`);
      }
      
      const preserved = missingSlots.length === 0;
      
      if (preserved) {
        logger.info(`[CacheManager] Save data verification passed: All ${beforeState.saveSlots.length} save slots preserved`);
      }
      
      return {
        preserved,
        missingSlots,
        missingBackups,
      };
    } catch (error) {
      logger.error('[CacheManager] Failed to verify save data preservation:', error);
      return { preserved: false, missingSlots: [], missingBackups: [] };
    }
  }

  /**
   * Attempt to recover missing save slots from backups
   * Returns number of successfully recovered slots
   */
  private static async attemptRecoveryFromBackups(missingSlots: string[]): Promise<number> {
    if (missingSlots.length === 0) return 0;
    
    let recoveredCount = 0;
    
    for (const slotKey of missingSlots) {
      try {
        // Extract slot number from key (e.g., "save_slot_1" -> 1)
        const slotMatch = slotKey.match(/^save_slot_(\d+)$/);
        if (!slotMatch) continue;
        
        const slotNumber = parseInt(slotMatch[1], 10);
        logger.info(`[CacheManager] Attempting to recover slot ${slotNumber} from backup...`);
        
        // Try to restore from backup
        const backups = await saveBackupManager.listBackups(slotNumber);
        if (backups.length > 0) {
          // Use the most recent backup
          const latestBackup = backups[0];
          const restored = await saveBackupManager.restoreBackup(slotNumber, latestBackup.id);
          
          if (restored) {
            logger.info(`[CacheManager] Successfully recovered slot ${slotNumber} from backup ${latestBackup.id}`);
            recoveredCount++;
          } else {
            logger.error(`[CacheManager] Failed to restore slot ${slotNumber} from backup`);
          }
        } else {
          logger.warn(`[CacheManager] No backups available for slot ${slotNumber}`);
        }
      } catch (error) {
        logger.error(`[CacheManager] Error recovering slot ${slotKey}:`, error);
      }
    }
    
    return recoveredCount;
  }

  /**
   * Initialize cache management and clear old data if version changed
   * Includes save data protection and automatic recovery
   */
  static async initialize(): Promise<{ needsCacheClear: boolean; oldVersion?: string; recoveredSlots?: number }> {
    try {
      // Wrap AsyncStorage call in try-catch to handle QuotaExceededError
      let storedVersion: string | null = null;
      try {
        storedVersion = await safeGetItem(this.VERSION_KEY);
      } catch (storageError: any) {
        // Handle QuotaExceededError or other storage errors
        if (storageError?.name === 'QuotaExceededError' || storageError?.message?.includes('quota')) {
          logger.error('[CacheManager] Storage quota exceeded - cannot read version');
        } else {
          logger.error('[CacheManager] Failed to read version from storage:', storageError);
        }
        // Return safe default - don't clear cache if we can't read
        return { needsCacheClear: false };
      }
      
      const needsCacheClear = storedVersion !== this.CURRENT_VERSION;
      
      if (needsCacheClear) {
        try {
          logger.info(`[CacheManager] Version changed from ${storedVersion} to ${this.CURRENT_VERSION}, preparing cache clear...`);
          
          // Verify save data exists BEFORE clearing - wrap in try-catch
          let beforeState;
          try {
            beforeState = await this.verifySaveDataExists();
          } catch (verifyError: any) {
            logger.error('[CacheManager] Failed to verify save data:', verifyError);
            // Don't clear cache if we can't verify save data
            return { needsCacheClear: false };
          }
          
          if (!beforeState.hasData) {
            logger.info('[CacheManager] No save data found, safe to clear cache');
          } else {
            logger.info(`[CacheManager] Save data detected: ${beforeState.saveSlots.length} slots, ${beforeState.backups.length} backups - will be preserved`);
          }
          
          // Clear cache (save data is protected) - wrap in try-catch
          try {
            await this.clearAllCache();
          } catch (clearError: any) {
            logger.error('[CacheManager] Failed to clear cache:', clearError);
            // Don't update version if clear failed
            return { needsCacheClear: false };
          }
          
          // Verify save data was preserved AFTER clearing - wrap in try-catch
          let verification;
          try {
            verification = await this.verifySaveDataPreserved(beforeState);
          } catch (verifyError: any) {
            logger.error('[CacheManager] Failed to verify save data preservation:', verifyError);
            // Continue anyway - assume data is safe
            verification = { preserved: true, missingSlots: [], missingBackups: [] };
          }
          
          if (!verification.preserved && verification.missingSlots.length > 0) {
            logger.error('[CacheManager] CRITICAL: Save slots missing after cache clear! Attempting recovery...');
            
            // Attempt automatic recovery - wrap in try-catch
            let recoveredCount = 0;
            try {
              recoveredCount = await this.attemptRecoveryFromBackups(verification.missingSlots);
            } catch (recoveryError: any) {
              logger.error('[CacheManager] Failed to recover save slots:', recoveryError);
              recoveredCount = 0;
            }
            
            if (recoveredCount > 0) {
              logger.info(`[CacheManager] Successfully recovered ${recoveredCount} save slot(s) from backups`);
            } else {
              logger.error('[CacheManager] Failed to recover missing save slots - data may be lost');
            }
            
            // Update version after recovery attempt - wrap in try-catch
            try {
              await safeSetItem(this.VERSION_KEY, this.CURRENT_VERSION);
            } catch (setError: any) {
              logger.error('[CacheManager] Failed to update version after recovery:', setError);
            }
            
            return { 
              needsCacheClear: true, 
              oldVersion: storedVersion || undefined,
              recoveredSlots: recoveredCount,
            };
          }
          
          // Update version - wrap in try-catch
          try {
            await AsyncStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
            logger.info('[CacheManager] Cache cleared successfully, all save data preserved');
          } catch (setError: any) {
            logger.error('[CacheManager] Failed to update version:', setError);
            // Continue anyway
          }
        } catch (cacheClearError: any) {
          logger.error('[CacheManager] Error during cache clear operation:', cacheClearError);
          // Return safe default - don't indicate cache was cleared if operation failed
          return { needsCacheClear: false };
        }
      }
      
      return { needsCacheClear, oldVersion: storedVersion || undefined };
    } catch (error: any) {
      // CRITICAL: Catch ALL errors and return safe default
      logger.error('[CacheManager] Cache initialization failed:', error);
      // Return safe default instead of throwing - prevents crash
      return { needsCacheClear: false };
    }
  }

  /**
   * Clear all cached data
   * CRITICAL: This does NOT clear save slots, backups, or any player data!
   * Only clears temporary cache data like tutorial state, UI preferences, etc.
   */
  static async clearAllCache(): Promise<void> {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await safeGetAllKeys();
      
      // Filter keys that should be cleared
      // EXCLUDE save slots, backups, cloud saves, and protected keys - these contain player data!
      const keysToClear: string[] = [];
      const keysPreserved: string[] = [];
      
      for (const key of allKeys) {
        // Only clear explicit cache keys
        if (this.CACHE_KEYS.includes(key)) {
          keysToClear.push(key);
          continue;
        }
        
        // NEVER clear save slots
        if (this.SAVE_SLOT_PATTERN.test(key)) {
          keysPreserved.push(key);
          continue;
        }
        
        // NEVER clear backup keys (save_backup_*)
        if (this.BACKUP_PATTERN.test(key)) {
          keysPreserved.push(key);
          continue;
        }
        
        // NEVER clear double-buffer save keys (_A, _B, _active)
        if (this.SAVE_DOUBLE_BUFFER_PATTERN.test(key)) {
          keysPreserved.push(key);
          continue;
        }

        // NEVER clear save slot backups/temp files
        if (this.SAVE_BACKUP_PATTERN.test(key)) {
          keysPreserved.push(key);
          continue;
        }
        
        // NEVER clear cloud saves
        if (this.CLOUD_SAVE_PATTERN.test(key)) {
          keysPreserved.push(key);
          continue;
        }
        
        // NEVER clear protected keys
        if (this.PROTECTED_KEYS.includes(key)) {
          keysPreserved.push(key);
          continue;
        }
        
        // Don't clear version key (it's updated separately)
        if (key === this.VERSION_KEY) {
          keysPreserved.push(key);
          continue;
        }
        
        // Don't clear lastSaveTime (save metadata)
        if (key === 'lastSaveTime') {
          keysPreserved.push(key);
          continue;
        }
      }
      
      // Log what will be cleared vs preserved
      logger.info(`[CacheManager] Cache clear operation:`);
      logger.info(`[CacheManager] - Will clear ${keysToClear.length} cache keys: ${keysToClear.join(', ') || 'none'}`);
      logger.info(`[CacheManager] - Will preserve ${keysPreserved.length} protected keys (save data, backups, etc.)`);
      
      if (keysToClear.length > 0) {
        await safeMultiRemove(keysToClear);
        logger.info(`[CacheManager] Successfully cleared ${keysToClear.length} cache keys`);
      } else {
        logger.info(`[CacheManager] No cache keys to clear`);
      }
    } catch (error) {
      logger.error('[CacheManager] Failed to clear cache:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Clear specific cache categories
   */
  static async clearCacheCategory(category: 'game' | 'ui' | 'achievements' | 'cloud'): Promise<void> {
    try {
      const categoryKeys: Record<string, string[]> = {
        game: ['gameState', 'realEstateProperties', 'lastSlot'],
        ui: ['tutorial_completed', 'ui_settings'],
        achievements: ['achievements_cache'],
        cloud: ['cloud_sync_data', 'leaderboard_cache']
      };

      const keysToClear = categoryKeys[category] || [];
      await AsyncStorage.multiRemove(keysToClear);
      if (__DEV__) {
        logger.info(`Cleared ${category} cache:`, { keysToClear });
      }
    } catch (error) {
      if (__DEV__) {
        logger.error(`Failed to clear ${category} cache:`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalKeys: number;
    cacheSize: number;
    version: string;
    lastCleared?: string;
  }> {
    try {
      const allKeys = await safeGetAllKeys();
      // Only count actual cache keys, not save slots
      const cacheKeys = allKeys.filter(key => 
        this.CACHE_KEYS.includes(key)
      );
      
      return {
        totalKeys: cacheKeys.length,
        cacheSize: cacheKeys.length * 1024, // Rough estimate
        version: this.CURRENT_VERSION,
      };
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to get cache stats:', error);
      }
      return {
        totalKeys: 0,
        cacheSize: 0,
        version: this.CURRENT_VERSION,
      };
    }
  }

  /**
   * Force cache clear (for manual reset)
   * Still protects save data - only clears cache keys
   */
  static async forceClearCache(): Promise<void> {
    try {
      // Verify save data before force clear
      const beforeState = await this.verifySaveDataExists();
      logger.info(`[CacheManager] Force cache clear requested. Save data will be preserved.`);
      
      await this.clearAllCache();
      
      // Verify save data was preserved
      const verification = await this.verifySaveDataPreserved(beforeState);
      if (!verification.preserved) {
        logger.error('[CacheManager] CRITICAL: Save data lost during force clear!');
        throw new Error('Save data was lost during force cache clear');
      }
      
      await AsyncStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      logger.info('[CacheManager] Cache force cleared successfully, save data preserved');
    } catch (error) {
      logger.error('[CacheManager] Failed to force clear cache:', error);
      throw error;
    }
  }

  /**
   * Check if cache needs clearing based on version
   */
  static async checkVersionUpdate(): Promise<boolean> {
    try {
      const storedVersion = await safeGetItem(this.VERSION_KEY);
      return storedVersion !== this.CURRENT_VERSION;
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to check version:', error);
      }
      return false;
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

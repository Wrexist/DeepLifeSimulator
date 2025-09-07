import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache management utility for automatic version-based cache clearing
export class CacheManager {
  private static readonly VERSION_KEY = 'game_version';
  private static readonly CURRENT_VERSION = '1.0.0'; // Update this when making breaking changes
  
  // Cache keys that should be cleared on version updates
  private static readonly CACHE_KEYS = [
    'gameState', // Old single-slot save
    'realEstateProperties', // Old property data
    'lastSlot', // Save slot info
    'tutorial_completed', // Tutorial state
    'ui_settings', // UI preferences
    'achievements_cache', // Achievement data
    'leaderboard_cache', // Leaderboard data
    'cloud_sync_data', // Cloud sync data
  ];

  // Save slot keys pattern
  private static readonly SAVE_SLOT_PATTERN = /^save_slot_\d+$/;

  /**
   * Initialize cache management and clear old data if version changed
   */
  static async initialize(): Promise<{ needsCacheClear: boolean; oldVersion?: string }> {
    try {
      const storedVersion = await AsyncStorage.getItem(this.VERSION_KEY);
      const needsCacheClear = storedVersion !== this.CURRENT_VERSION;
      
      if (needsCacheClear) {
        console.log(`Version changed from ${storedVersion} to ${this.CURRENT_VERSION}, clearing cache...`);
        await this.clearAllCache();
        await AsyncStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
        console.log('Cache cleared successfully');
      }
      
      return { needsCacheClear, oldVersion: storedVersion || undefined };
    } catch (error) {
      console.error('Cache initialization failed:', error);
      return { needsCacheClear: false };
    }
  }

  /**
   * Clear all cached data
   */
  static async clearAllCache(): Promise<void> {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys that should be cleared
      const keysToClear = allKeys.filter(key => 
        this.CACHE_KEYS.includes(key) || 
        this.SAVE_SLOT_PATTERN.test(key)
      );
      
      if (keysToClear.length > 0) {
        await AsyncStorage.multiRemove(keysToClear);
        console.log(`Cleared ${keysToClear.length} cache keys:`, keysToClear);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
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
      console.log(`Cleared ${category} cache:`, keysToClear);
    } catch (error) {
      console.error(`Failed to clear ${category} cache:`, error);
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
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        this.CACHE_KEYS.includes(key) || 
        this.SAVE_SLOT_PATTERN.test(key)
      );
      
      return {
        totalKeys: cacheKeys.length,
        cacheSize: cacheKeys.length * 1024, // Rough estimate
        version: this.CURRENT_VERSION,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        cacheSize: 0,
        version: this.CURRENT_VERSION,
      };
    }
  }

  /**
   * Force cache clear (for manual reset)
   */
  static async forceClearCache(): Promise<void> {
    try {
      await this.clearAllCache();
      await AsyncStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      console.log('Cache force cleared successfully');
    } catch (error) {
      console.error('Failed to force clear cache:', error);
    }
  }

  /**
   * Check if cache needs clearing based on version
   */
  static async checkVersionUpdate(): Promise<boolean> {
    try {
      const storedVersion = await AsyncStorage.getItem(this.VERSION_KEY);
      return storedVersion !== this.CURRENT_VERSION;
    } catch (error) {
      console.error('Failed to check version:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

/**
 * Save Coordinator - Prevents concurrent save conflicts
 * Ensures atomic save operations when multiple services try to save simultaneously
 */

import { Mutex } from 'async-mutex';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger as log } from './logger';

type SaveSource = 'queue' | 'iap' | 'cloud' | 'manual';

interface SaveOperation {
  slot: number;
  data: any;
  source: SaveSource;
  timestamp: number;
}

class SaveCoordinator {
  private static instance: SaveCoordinator;
  private saveMutex = new Mutex();
  private saveInProgress = false;
  private lastSaveTime = 0;
  private saveHistory: SaveOperation[] = [];
  private readonly MAX_HISTORY = 10;

  private constructor() {
    log.info('SaveCoordinator initialized');
  }

  static getInstance(): SaveCoordinator {
    if (!SaveCoordinator.instance) {
      SaveCoordinator.instance = new SaveCoordinator();
    }
    return SaveCoordinator.instance;
  }

  /**
   * Coordinate a save operation with mutex protection
   * @param slot Save slot number
   * @param data Game state data to save
   * @param source Source of the save operation
   */
  async coordinatedSave(
    slot: number,
    data: any,
    source: SaveSource = 'manual'
  ): Promise<void> {
    return this.saveMutex.runExclusive(async () => {
      const operation: SaveOperation = {
        slot,
        data,
        source,
        timestamp: Date.now(),
      };

      log.info(`Starting ${source} save for slot ${slot}`);
      this.saveInProgress = true;

      try {
        // Load existing data to merge
        const existing = await this.loadLatest(slot);

        // Merge with any pending changes (intelligent merge strategy)
        const merged = this.mergeGameState(existing, data, source);

        // Perform atomic save with backup
        const slotKey = `save_slot_${slot}`;

        // Create backup before overwriting
        if (existing) {
          await AsyncStorage.setItem(`${slotKey}_backup`, JSON.stringify(existing));
        }

        // Save merged data
        await AsyncStorage.setItem(slotKey, JSON.stringify(merged));

        // Update last save time
        this.lastSaveTime = Date.now();

        // Track in history
        this.saveHistory.push(operation);
        if (this.saveHistory.length > this.MAX_HISTORY) {
          this.saveHistory.shift();
        }

        log.info(`Completed ${source} save for slot ${slot}`);
      } catch (error) {
        log.error(`Save failed for slot ${slot}:`, error);
        throw error;
      } finally {
        this.saveInProgress = false;
      }
    });
  }

  /**
   * Load the latest save data for a slot
   * @param slot Save slot number
   * @returns Parsed game state or null
   */
  private async loadLatest(slot: number): Promise<any> {
    try {
      const slotKey = `save_slot_${slot}`;
      const data = await AsyncStorage.getItem(slotKey);

      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      log.error(`Failed to load save slot ${slot}:`, error);
      return null;
    }
  }

  /**
   * Intelligently merge two game states
   * Priority: newer timestamp wins, but preserve maximum gems/money
   * @param base Base game state
   * @param updates Updates to apply
   * @param source Source of the updates
   * @returns Merged game state
   */
  private mergeGameState(base: any, updates: any, source: SaveSource): any {
    if (!base) return updates;
    if (!updates) return base;

    // Determine which state is newer
    const baseTime = base.updatedAt || 0;
    const updateTime = updates.updatedAt || 0;

    // Start with the newer state
    const newer = updateTime > baseTime ? updates : base;
    const older = updateTime > baseTime ? base : updates;

    // Merge with intelligent conflict resolution
    const merged = {
      ...newer,
      stats: {
        ...(newer.stats || {}),
        // Always use maximum values for gems and money to prevent loss
        gems: Math.max(
          newer.stats?.gems || 0,
          older.stats?.gems || 0
        ),
        money: source === 'iap'
          ? (newer.stats?.money || 0) // IAP should always win for money
          : Math.max(newer.stats?.money || 0, older.stats?.money || 0),
      },
      updatedAt: Math.max(baseTime, updateTime),
    };

    log.info(`Merged save states: base=${baseTime}, update=${updateTime}, source=${source}`);

    return merged;
  }

  /**
   * Check if a save is currently in progress
   * @returns True if save is in progress
   */
  isSaveInProgress(): boolean {
    return this.saveInProgress;
  }

  /**
   * Get time since last save
   * @returns Milliseconds since last save
   */
  getTimeSinceLastSave(): number {
    return Date.now() - this.lastSaveTime;
  }

  /**
   * Get recent save history
   * @returns Array of recent save operations
   */
  getSaveHistory(): ReadonlyArray<SaveOperation> {
    return [...this.saveHistory];
  }

  /**
   * Wait for any in-progress saves to complete
   * @param timeout Maximum wait time in ms
   */
  async waitForSaves(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (this.saveInProgress && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.saveInProgress) {
      log.warn('Save operation did not complete within timeout');
    }
  }
}

export const saveCoordinator = SaveCoordinator.getInstance();
export default saveCoordinator;

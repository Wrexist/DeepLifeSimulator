import { GameState, Relationship } from '@/contexts/game/types';
import { uploadGameState, downloadGameState } from '@/lib/progress/cloud';
import { logger } from '@/utils/logger';

export interface SyncConflict {
  localVersion: number;
  remoteVersion: number;
  localTimestamp: number;
  remoteTimestamp: number;
}

export type ConflictResolution = 'local' | 'remote' | 'merge';

class CloudSyncService {
  private static instance: CloudSyncService;
  private syncQueue: { state: GameState; timestamp: number }[] = [];
  private isSyncing = false;
  private lastSyncTime = 0;
  private syncInterval = 30000; // 30 seconds
  private listeners: ((status: SyncStatus) => void)[] = [];
  private isOnline = true;

  private constructor() {
    this.initializeNetworkListener();
    this.startPeriodicSync();
  }

  static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  /**
   * Initialize network status listener
   */
  private initializeNetworkListener(): void {
    // In a real implementation, use NetInfo or similar
    // For now, assume online
    this.isOnline = true;
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.sync();
      }
    }, this.syncInterval);
  }

  /**
   * Queue a state for sync
   */
  async queueSync(state: GameState): Promise<void> {
    this.syncQueue.push({
      state,
      timestamp: Date.now(),
    });

    // Trigger immediate sync if online
    if (this.isOnline) {
      this.sync();
    }
  }

  /**
   * Sync queued states
   */
  private async sync(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0 || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ status: 'syncing', progress: 0 });

    try {
      while (this.syncQueue.length > 0) {
        const { state, timestamp } = this.syncQueue.shift()!;
        
        try {
          await uploadGameState({
            state,
            updatedAt: timestamp,
          });
          
          this.lastSyncTime = Date.now();
          this.notifyListeners({ status: 'synced', progress: 100 });
        } catch (error) {
          logger.error('Sync error:', error);
          // Re-queue failed sync
          this.syncQueue.unshift({ state, timestamp });
          this.notifyListeners({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
          break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Download state from cloud
   */
  async downloadState(): Promise<GameState | null> {
    try {
      const cloudSave = await downloadGameState();
      if (!cloudSave || !cloudSave.state) return null;
      return cloudSave.state as GameState;
    } catch (error) {
      logger.error('Download error:', error);
      return null;
    }
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    localState: GameState,
    remoteState: GameState,
    resolution: ConflictResolution
  ): Promise<GameState> {
    switch (resolution) {
      case 'local':
        return localState;
      case 'remote':
        return remoteState;
      case 'merge':
        // Merge strategy: use most recent for most fields, combine arrays
        const localTimestamp = (localState as any).updatedAt || localState.lastLogin || 0;
        const remoteTimestamp = (remoteState as any).updatedAt || remoteState.lastLogin || 0;
        return {
          ...(localTimestamp > remoteTimestamp ? localState : remoteState),
          // Merge arrays (combine unique items)
          achievements: [
            ...new Set([...localState.achievements, ...remoteState.achievements]),
          ],
          relationships: [
            ...Array.from(new Map<string, Relationship>([
              ...localState.relationships.map((r: Relationship) => [r.id, r] as [string, Relationship]),
              ...remoteState.relationships.map((r: Relationship) => [r.id, r] as [string, Relationship]),
            ]).values()),
          ],
        };
      default:
        return localState;
    }
  }

  /**
   * Check for conflicts
   */
  async checkConflict(localState: GameState): Promise<SyncConflict | null> {
    try {
      const cloudSave = await downloadGameState();
      if (!cloudSave) return null;

      const remoteState = cloudSave.state as GameState;
      const localTimestamp = (localState as any).updatedAt || localState.lastLogin || 0;
      const remoteTimestamp = cloudSave.updatedAt || (remoteState as any).updatedAt || remoteState.lastLogin || 0;

      if (remoteTimestamp > localTimestamp) {
        return {
          localVersion: localState.version || 0,
          remoteVersion: (remoteState as GameState).version || 0,
          localTimestamp,
          remoteTimestamp,
        };
      }

      return null;
    } catch (error) {
      logger.error('Conflict check error:', error);
      return null;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      status: this.isSyncing ? 'syncing' : this.syncQueue.length > 0 ? 'pending' : 'idle',
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      isOnline: this.isOnline,
    };
  }

  /**
   * Add sync status listener
   */
  addListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(status: SyncStatus): void {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('Error in sync listener:', error);
      }
    });
  }
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'pending' | 'synced' | 'error';
  queueLength?: number;
  lastSyncTime?: number;
  isOnline?: boolean;
  progress?: number;
  error?: string;
}

export const cloudSyncService = CloudSyncService.getInstance();
export default cloudSyncService;


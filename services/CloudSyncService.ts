import { GameState, Relationship } from '@/contexts/game/types';
import { uploadGameState, downloadGameState } from '@/lib/progress/cloud';
import { logger } from '@/utils/logger';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { offlineManager } from '@/utils/offlineManager';
import { calculateChecksum, calculateHmacSignature } from '@/utils/saveValidation';

export interface SyncConflict {
  localVersion: number;
  remoteVersion: number;
  localTimestamp: number;
  remoteTimestamp: number;
}

export type ConflictResolution = 'local' | 'remote' | 'merge';

// A-6: Conflict callback for UI integration
export type ConflictCallback = (conflict: SyncConflict & { remoteState: GameState; localState: GameState }) => void;

class CloudSyncService {
  private static instance: CloudSyncService;
  private static readonly CLOUD_USER_ID_KEY = 'cloud_user_id';
  private static readonly RESERVED_USER_IDS = new Set(['local_player', 'guest', 'anonymous', 'unknown', 'null', 'undefined']);
  private syncQueue: { state: GameState; timestamp: number; retries: number }[] = [];
  private isSyncing = false;
  private lastSyncTime = 0;
  private syncInterval = 30000; // 30 seconds
  private listeners: ((status: SyncStatus) => void)[] = [];
  private isOnline = true;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeNetwork: (() => void) | null = null;
  private lastSyncedRevisionBySlot: Map<string, number> = new Map();
  private static readonly MAX_RETRIES = 3;
  // A-6: Conflict detection
  private onConflictDetected: ConflictCallback | null = null;

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
    this.isOnline = offlineManager.isConnected();
    this.unsubscribeNetwork = offlineManager.addNetworkListener((online: boolean) => {
      this.isOnline = online;
      if (online && this.syncQueue.length > 0) {
        void this.sync();
      }
    });
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        void this.sync();
      }
    }, this.syncInterval);
  }

  private async resolveSlotId(): Promise<string> {
    const currentSlotRaw = await safeGetItem('currentSlot');
    const lastSlotRaw = await safeGetItem('lastSlot');
    const parsedCurrent = currentSlotRaw ? parseInt(currentSlotRaw, 10) : NaN;
    const parsedLegacy = lastSlotRaw ? parseInt(lastSlotRaw, 10) : NaN;
    const slot = [parsedCurrent, parsedLegacy].find(v => Number.isFinite(v) && v >= 1 && v <= 3) || 1;
    return `slot_${slot}`;
  }

  private isValidCloudUserId(userId?: string): boolean {
    if (!userId || typeof userId !== 'string') return false;
    const normalized = userId.trim().toLowerCase();
    return normalized.length >= 3 && !CloudSyncService.RESERVED_USER_IDS.has(normalized);
  }

  private async resolveUserId(state: GameState): Promise<string | null> {
    const candidates = [
      state.userProfile?.username,
      state.userProfile?.handle,
    ];

    for (const candidate of candidates) {
      if (this.isValidCloudUserId(candidate)) {
        return candidate!.trim();
      }
    }

    const existing = await safeGetItem(CloudSyncService.CLOUD_USER_ID_KEY);
    if (this.isValidCloudUserId(existing ?? undefined)) {
      return existing!.trim();
    }

    const generated = `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await safeSetItem(CloudSyncService.CLOUD_USER_ID_KEY, generated);
    return generated;
  }

  private buildIntegrityProof(state: GameState, userId: string, slotId: string, revision: number): { hash: string; signature: string } {
    const serializedState = JSON.stringify(state);
    const hash = calculateChecksum(serializedState);
    const signature = calculateHmacSignature(`${userId}:${slotId}:${revision}:${hash}`);
    return { hash, signature };
  }

  /**
   * Queue a state for sync
   */
  async queueSync(state: GameState): Promise<void> {
    const nextRevision = state.weeksLived ?? state.updatedAt ?? Date.now();
    // Keep only newest queued state per revision to reduce replay/race windows.
    this.syncQueue = this.syncQueue.filter(item => (item.state.weeksLived ?? item.state.updatedAt ?? item.timestamp) !== nextRevision);
    this.syncQueue.push({
      state,
      timestamp: Date.now(),
      retries: 0,
    });

    // CRASH FIX (C-3): Cap queue to last 5 items (only latest state matters for full-state sync)
    if (this.syncQueue.length > 5) {
      this.syncQueue = this.syncQueue.slice(-5);
    }

    // Trigger immediate sync if online
    if (this.isOnline) {
      void this.sync();
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
        const item = this.syncQueue.shift()!;

        try {
          const userId = await this.resolveUserId(item.state);
          if (!userId) {
            throw new Error('Cloud sync blocked: no trusted user identity');
          }
          const slotId = await this.resolveSlotId();
          const revision = item.state.weeksLived || item.state.updatedAt || item.timestamp;
          if (!Number.isFinite(revision) || revision <= 0) {
            throw new Error(`Cloud sync blocked: invalid revision ${revision}`);
          }
          const lastSyncedRevision = this.lastSyncedRevisionBySlot.get(slotId) || 0;
          if (revision <= lastSyncedRevision) {
            logger.warn('Skipping stale cloud upload revision', {
              slotId,
              revision,
              lastSyncedRevision,
            });
            continue;
          }
          const { hash, signature } = this.buildIntegrityProof(item.state, userId, slotId, revision);
          const uploadResult = await uploadGameState({
            state: item.state,
            updatedAt: item.state.updatedAt || item.timestamp,
            userId,
            slotId,
            revision,
            hash,
            signature,
          });
          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Cloud upload failed');
          }

          this.lastSyncedRevisionBySlot.set(slotId, revision);
          this.lastSyncTime = Date.now();
          this.notifyListeners({ status: 'synced', progress: 100 });
        } catch (error) {
          logger.error('Sync error:', error);

          if (item.retries < CloudSyncService.MAX_RETRIES) {
            // Re-queue with incremented retry count
            this.syncQueue.unshift({ ...item, retries: item.retries + 1 });
            this.notifyListeners({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
          } else {
            // Max retries exceeded - drop this sync item
            logger.error(`Sync failed after ${CloudSyncService.MAX_RETRIES} retries, dropping sync item`);
            this.notifyListeners({ status: 'error', error: 'Sync failed after multiple retries' });
          }
          break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Download state from cloud
   * A-6: Now checks for conflicts and notifies callback when local/remote diverge
   */
  async downloadState(localState?: GameState): Promise<GameState | null> {
    try {
      const userId = localState ? await this.resolveUserId(localState) : null;
      if (!userId) {
        logger.warn('Cloud download skipped: missing trusted user identity');
        return null;
      }
      const cloudSave = await downloadGameState({
        userId,
        slotId: await this.resolveSlotId(),
      });
      if (!cloudSave || !cloudSave.state) return null;

      // Validate state before returning - ensure it's a proper GameState
      const { validateGameState } = require('@/utils/saveValidation');
      const validation = validateGameState(cloudSave.state);

      if (!validation.valid) {
        logger.warn('Downloaded cloud state failed validation', { errors: validation.errors });
        return null;
      }

      // Verify integrity proof if present (anti-tamper check)
      if (cloudSave.hash) {
        const serialized = JSON.stringify(cloudSave.state);
        const actualHash = calculateChecksum(serialized);
        if (actualHash !== cloudSave.hash) {
          logger.warn('[CloudSync] Downloaded state failed integrity check — hash mismatch', {
            expected: cloudSave.hash,
            actual: actualHash,
          });
          return null;
        }
      }

      const remoteState = cloudSave.state as GameState;

      // A-6: Detect conflict when both local and remote have diverged
      if (localState && this.onConflictDetected) {
        const localTimestamp = localState.updatedAt || localState.lastLogin || 0;
        const remoteTimestamp = cloudSave.updatedAt ||
          (remoteState.updatedAt || remoteState.lastLogin || 0);
        const localWeeks = localState.weeksLived || 0;
        const remoteWeeks = remoteState.weeksLived || 0;

        // Conflict: remote is newer AND local has progressed since last sync
        // (both devices played offline)
        if (remoteTimestamp > localTimestamp && localWeeks > 0 && remoteWeeks > 0 && localWeeks !== remoteWeeks) {
          logger.warn('[CloudSync] Conflict detected: both devices have offline changes', {
            localWeeks, remoteWeeks, localTimestamp, remoteTimestamp,
          });
          this.onConflictDetected({
            localVersion: localState.version || 0,
            remoteVersion: remoteState.version || 0,
            localTimestamp,
            remoteTimestamp,
            remoteState,
            localState,
          });
          // Don't auto-overwrite — let UI decide
          return null;
        }
      }

      return remoteState;
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
        // Use optional chaining and type guards instead of 'as any'
        const localTimestamp = ('updatedAt' in localState && typeof localState.updatedAt === 'number') 
          ? localState.updatedAt 
          : localState.lastLogin || 0;
        const remoteTimestamp = ('updatedAt' in remoteState && typeof remoteState.updatedAt === 'number')
          ? remoteState.updatedAt
          : remoteState.lastLogin || 0;
        return {
          ...(localTimestamp > remoteTimestamp ? localState : remoteState),
          // Merge arrays with stable key dedupe.
          achievements: Array.from(new Map(
            [...(localState.achievements || []), ...(remoteState.achievements || [])]
              .map(achievement => [achievement.id, achievement] as const)
          ).values()),
          relationships: [
            ...Array.from(new Map<string, Relationship>([
              ...(localState.relationships || []).map((r: Relationship) => [r.id, r] as [string, Relationship]),
              ...(remoteState.relationships || []).map((r: Relationship) => [r.id, r] as [string, Relationship]),
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
      const userId = await this.resolveUserId(localState);
      if (!userId) {
        logger.warn('Cloud conflict check skipped: missing trusted user identity');
        return null;
      }
      const cloudSave = await downloadGameState({
        userId,
        slotId: await this.resolveSlotId(),
      });
      if (!cloudSave) return null;

      // Validate remote state before using
      const { validateGameState } = require('@/utils/saveValidation');
      if (!cloudSave.state) return null;
      
      const validation = validateGameState(cloudSave.state);
      if (!validation.valid) {
        logger.warn('Remote cloud state failed validation', { errors: validation.errors });
        return null;
      }
      
      // SAFETY: This assertion is safe because:
      // 1. validation.valid ensures the state passed all validation checks
      // 2. validateGameState() checks all required properties exist
      // 3. We return null if validation fails (above)
      const remoteState = cloudSave.state as GameState; // ✅ SAFE - Only after validation.valid check
      // Use optional chaining and type guards instead of 'as any'
      const localTimestamp = ('updatedAt' in localState && typeof localState.updatedAt === 'number') 
        ? localState.updatedAt 
        : localState.lastLogin || 0;
      const remoteTimestamp = cloudSave.updatedAt || 
        (('updatedAt' in remoteState && typeof remoteState.updatedAt === 'number') 
          ? remoteState.updatedAt 
          : remoteState.lastLogin || 0);

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
   * A-6: Set conflict detection callback for UI integration
   */
  setConflictCallback(callback: ConflictCallback | null): void {
    this.onConflictDetected = callback;
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

  // CRASH FIX (B-5): Pause sync timer when app is backgrounded to save battery/CPU
  pauseSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.debug('[CloudSync] Paused periodic sync (app backgrounded)');
    }
  }

  // CRASH FIX (B-5): Resume sync timer when app returns to foreground
  resumeSync(): void {
    if (!this.syncTimer) {
      this.startPeriodicSync();
      logger.debug('[CloudSync] Resumed periodic sync (app foregrounded)');
      // Trigger immediate sync if there are queued items
      if (this.isOnline && this.syncQueue.length > 0) {
        void this.sync();
      }
    }
  }

  dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    this.listeners = [];
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

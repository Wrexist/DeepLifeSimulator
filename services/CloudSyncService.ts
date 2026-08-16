/**
 * Cloud save sync — STATUS: wired as a DEVICE BACKUP, flag-gated (`cloudSave`).
 *
 * What runs today. `services/cloudBackup.ts` schedules a debounced `queueSync`
 * after every successful local save, and the Settings "Cloud backup" row and
 * the SaveSlots restore offer call `backupNow` / `downloadState` through the
 * same module. Boot arms `start()` from the deferred-service pattern in
 * `app/_layout.tsx`. All of it is off unless BOTH
 * `EXPO_PUBLIC_ENABLE_CLOUD_SAVE=true` and a non-empty
 * `EXPO_PUBLIC_CLOUD_SAVE_URL` are set — shipping to the `preview` profile
 * first (owner decision).
 *
 * SCOPE: this is a backup of THIS DEVICE, not a cross-device account. The
 * identity is the anonymous per-device id in `cloud_user_id` (see
 * `resolveUserId`), so a reinstall still orphans the old saves and there is no
 * "sign in on a new phone and get your game" path. That is the remaining
 * future work, and it is an IDENTITY problem, not a transport one:
 *
 *   1. A real account (sign-in) to key saves on, replacing the device id.
 *   2. Server-side verification of the `hash`/`signature` integrity proof this
 *      client already sends — a proof only the client checks is decoration.
 *   3. A cross-device conflict UX beyond the single alert wired here.
 *
 * The class stays INERT ON IMPORT regardless. It used to arm a network
 * listener and a 30-second `setInterval` in its constructor, and the module
 * called `getInstance()` at the bottom — so merely importing the file (which
 * the AppState listener does) started a timer. Construction is lazy
 * (`getCloudSyncService()`) and the listener/timer are armed only by an
 * explicit `start()`, which only the flag-gated boot task calls. 2026-08-16
 * architecture audit M6.
 */
import { GameState, Relationship } from '@/contexts/game/types';
import { uploadGameState, downloadGameState } from '@/lib/progress/cloud';
import { logger } from '@/utils/logger';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { offlineManager } from '@/utils/offlineManager';
import { calculateChecksum, calculateHmacSignature } from '@/utils/saveValidation';
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';

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
  /** Epoch ms of the last successful upload — survives a cold start (see `performUpload`). */
  private static readonly LAST_BACKUP_AT_KEY = 'cloud_backup_last_at';
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

  /** Set by `start()`. Nothing here touches the network or a timer until then. */
  private started = false;

  // Deliberately empty: constructing the service must not observe or schedule
  // anything. See the file header — this class is imported by a live code path
  // for `pauseSync`/`resumeSync` while the sync feature itself is unwired.
  private constructor() {}

  static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  /**
   * Arm the network listener and the periodic sync timer.
   *
   * The ONLY entry point that starts background work, and it has no caller
   * today — by design (see the file header). Idempotent, so a future wiring
   * can call it from a boot sequence without tracking whether it already ran.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.initializeNetworkListener();
    this.startPeriodicSync();
    logger.debug('[CloudSync] Started (network listener + periodic sync armed)');
  }

  /** True once `start()` has armed the listener/timer and before `dispose()`. */
  isStarted(): boolean {
    return this.started;
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

  private async resolveSlotId(explicitSlot?: number): Promise<string> {
    if (Number.isFinite(explicitSlot) && (explicitSlot as number) >= 1 && (explicitSlot as number) <= 3) {
      return `slot_${explicitSlot}`;
    }
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

  /**
   * The backup identity: the anonymous per-device id in `cloud_user_id`,
   * minted on first use and never derived from game state.
   *
   * This used to prefer `userProfile.username` / `.handle` and fall back to the
   * device id. Both halves of that were wrong for a device backup, and the
   * first was actively dangerous: `initialGameState` ships
   * `userProfile.username = 'player'`, which passes `isValidCloudUserId`, so
   * EVERY install would have uploaded to the single cloud key `player` and
   * restored whichever device wrote last. The fallback was unreachable for the
   * same reason. A display name is not an identity — it is player-editable and
   * not unique — so the device id is now the only answer, which also makes the
   * id stable across the pre-game menus, where no life is loaded and the
   * profile fields are still the defaults. Nothing was wired before this
   * change, so there is no installed base of `player`-keyed cloud saves to
   * migrate. Cross-device identity (sign-in) is the future work in the header.
   */
  private async resolveUserId(): Promise<string | null> {
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
   * Upload ONE state. Throws on failure so the caller decides about retries.
   *
   * Extracted from the `sync` drain so the user-initiated "Back up now" button
   * can run exactly the same upload — identity, slot, revision, integrity
   * proof and the stale-revision guard — and still learn whether it worked.
   * Duplicating any of that for the manual path is how the two drift.
   */
  private async performUpload(state: GameState, timestamp: number): Promise<'uploaded' | 'stale'> {
    const userId = await this.resolveUserId();
    if (!userId) {
      throw new Error('Cloud sync blocked: no trusted user identity');
    }
    const slotId = await this.resolveSlotId();
    const revision = state.weeksLived || state.updatedAt || timestamp;
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
      return 'stale';
    }
    const { hash, signature } = this.buildIntegrityProof(state, userId, slotId, revision);
    const uploadResult = await uploadGameState({
      state,
      updatedAt: state.updatedAt || timestamp,
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
    // Persisted, not just held in memory: the Settings row shows "Last backup
    // …" and a number that resets to "never" on every cold start would read as
    // a lost backup. Best-effort — a failed write must not fail the upload.
    void safeSetItem(CloudSyncService.LAST_BACKUP_AT_KEY, String(this.lastSyncTime)).catch(() => {});
    return 'uploaded';
  }

  /**
   * Upload the given state right now and report the outcome.
   *
   * The manual "Back up now" path. `queueSync` is fire-and-forget by design
   * (it serves the debounced autosave hook), but a button the player pressed
   * owes them an answer.
   */
  async backupNow(state: GameState): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    try {
      const result = await this.performUpload(state, Date.now());
      this.notifyListeners({ status: 'synced', progress: 100 });
      // 'stale' means the cloud already holds this revision — nothing to do,
      // which is a success from the player's point of view, not a failure.
      return { success: true, skipped: result === 'stale' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud backup failed';
      logger.error('[CloudSync] Manual backup failed:', error);
      this.notifyListeners({ status: 'error', error: message });
      return { success: false, error: message };
    }
  }

  /** Epoch ms of the last successful upload, or null if this device never uploaded. */
  async getLastBackupAt(): Promise<number | null> {
    if (this.lastSyncTime > 0) return this.lastSyncTime;
    const raw = await safeGetItem(CloudSyncService.LAST_BACKUP_AT_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
          const outcome = await this.performUpload(item.state, item.timestamp);
          if (outcome === 'stale') continue;
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
  async downloadState(
    localState?: GameState,
    options?: { slot?: number; detectConflicts?: boolean }
  ): Promise<GameState | null> {
    try {
      // Identity no longer depends on `localState` — it is the device id (see
      // `resolveUserId`), which is what lets the pre-game SaveSlots screen read
      // a slot's cloud save with no life loaded.
      const userId = await this.resolveUserId();
      if (!userId) {
        logger.warn('Cloud download skipped: missing trusted user identity');
        return null;
      }
      const cloudSave = await downloadGameState({
        userId,
        slotId: await this.resolveSlotId(options?.slot),
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

      // A-6: Detect conflict when both local and remote have diverged.
      // Opt-OUT for an explicit restore: the player has already asked for the
      // cloud copy, so raising the "which version?" alert and returning null
      // would answer a question nobody asked and silently do nothing.
      if (localState && this.onConflictDetected && options?.detectConflicts !== false) {
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
      case 'merge': {
        // Merge strategy: use most recent for most fields, combine arrays
        // Use optional chaining and type guards instead of 'as any'
        const localTimestamp = ('updatedAt' in localState && typeof localState.updatedAt === 'number')
          ? localState.updatedAt
          : localState.lastLogin || 0;
        const remoteTimestamp = ('updatedAt' in remoteState && typeof remoteState.updatedAt === 'number')
          ? remoteState.updatedAt
          : remoteState.lastLogin || 0;
        const merged: GameState = {
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
        // M6: the union above merges `relationships` by id but takes
        // `family.children` from whichever side won on TIMESTAMP, so a child
        // present in the loser's relationships arrived with no matching
        // `family.children` entry — the exact family↔relationships split that
        // `loadGame` reconciles on every load and that the relationship
        // validator reports as corruption. Hand-merging the two arrays here
        // would be a third copy of that reconciliation; run the shared
        // hydration instead, which owns it (and heals whatever else the
        // union left partial).
        return hydrateLoadedState(merged, {
          source: 'cloudSync:resolveConflict-merge',
          logTag: '[CloudSync]',
        }).state;
      }
      default:
        return localState;
    }
  }

  /**
   * Check for conflicts
   */
  async checkConflict(localState: GameState): Promise<SyncConflict | null> {
    try {
      const userId = await this.resolveUserId();
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

  // CRASH FIX (B-5): Resume sync timer when app returns to foreground.
  //
  // Resumes only what `start()` armed. Without the `started` gate this would
  // become a second, accidental start(): the AppState listener calls it on every
  // foreground, so a service nobody ever started would end up running a timer
  // anyway — exactly the import-time side effect this change removes.
  resumeSync(): void {
    if (!this.started) return;
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
    this.started = false;
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

/**
 * The singleton, constructed on FIRST USE.
 *
 * This was `export const cloudSyncService = CloudSyncService.getInstance()` —
 * evaluated at module load, and the constructor armed a network listener and a
 * 30-second timer. Importing the file was therefore enough to start background
 * work for a feature with no call sites. Accessing the service still costs
 * nothing until `start()` is called.
 */
export function getCloudSyncService(): CloudSyncService {
  return CloudSyncService.getInstance();
}

export type { CloudSyncService };
export default getCloudSyncService;

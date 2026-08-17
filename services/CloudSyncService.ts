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
import { uploadGameState, downloadGameState, getCloudSyncStatus } from '@/lib/progress/cloud';
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
  /** The backend column is `revision integer CHECK (revision >= 1)` — int4. */
  private static readonly MIN_CLOUD_REVISION = 1;
  private static readonly MAX_CLOUD_REVISION = 2147483647;
  private syncQueue: { state: GameState; timestamp: number; retries: number }[] = [];
  private isSyncing = false;
  private lastSyncTime = 0;
  private syncInterval = 30000; // 30 seconds
  private listeners: ((status: SyncStatus) => void)[] = [];
  private isOnline = true;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeNetwork: (() => void) | null = null;
  /** Last revision NUMBER actually sent per slot — the monotonic floor, see `nextRevision`. */
  private lastSyncedRevisionBySlot: Map<string, number> = new Map();
  /** Last STATE (`updatedAt`) actually uploaded per slot — the "nothing changed" guard. */
  private lastUploadedStateAtBySlot: Map<string, number> = new Map();
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
   *
   * Returns null when there is no identity this device could use AGAIN — every
   * caller already treats null as "skip this operation" (`performUpload` throws,
   * `downloadState` / `checkConflict` warn and return null).
   */
  private async resolveUserId(): Promise<string | null> {
    const existing = await safeGetItem(CloudSyncService.CLOUD_USER_ID_KEY);
    if (this.isValidCloudUserId(existing ?? undefined)) {
      return existing!.trim();
    }

    const generated = `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    // A generated id is only an identity if it SURVIVES a restart. The write
    // result used to be discarded, so a storage failure returned an id the
    // device could never recover: the next launch mints a DIFFERENT one, and
    // everything uploaded under the first is orphaned in the cloud — a backup
    // that reports success and can never be restored.
    //
    // No retry here on purpose: `safeSetItem` already does the
    // QuotaExceededError cleanup-and-retry internally (`utils/safeStorage.ts`),
    // so a `false` means the value is genuinely not stored, and the honest
    // answer is then "no identity", not "here is a throwaway one".
    const persisted = await safeSetItem(CloudSyncService.CLOUD_USER_ID_KEY, generated);
    if (!persisted) {
      logger.error(
        '[CloudSync] Could not persist a new cloud user id — refusing to sync under an unrecoverable identity'
      );
      return null;
    }
    return generated;
  }

  /**
   * The state's own "this is a different save" marker, or null when it has none.
   *
   * `updatedAt` is stamped on EVERY committed mutation by
   * `GameStateContext.wrappedSetGameState`, which takes
   * `Math.max(now, prev.updatedAt + 1)` — so it strictly increases per save and
   * is the only field that answers "has anything changed since the last
   * upload?". A state without it cannot be compared, and an unknown state must
   * upload rather than be assumed synced.
   */
  private stateMarker(state: GameState): number | null {
    const updatedAt = state.updatedAt;
    return typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : null;
  }

  /**
   * The revision to send: strictly increasing PER SAVE and inside the backend's
   * `revision integer CHECK (revision >= 1)` column, which also refuses any
   * value at or below the one it already stores (`409 Stale revision` — see
   * `docs/CLOUD-SAVE-BACKEND.md`).
   *
   * It used to be `state.weeksLived`, which only moves once per PLAYED GAME
   * WEEK. Every later save inside the same week therefore produced the same
   * number, `lastSyncedRevisionBySlot` read it as already-synced, and both the
   * automatic queue and "Back up now" reported success while the cloud copy
   * stayed behind. A revision has to track the SAVE, not the week.
   *
   * Why epoch SECONDS and not `Date.now()`: epoch milliseconds (~1.8e12)
   * overflow int4 (max 2 147 483 647), so a raw `Date.now()` revision would be
   * rejected by the column on the very first upload. Seconds fit until
   * **2038-01-19**, after which the backend column must widen to `bigint` (or
   * this must become a persisted per-slot counter). `MAX_CLOUD_REVISION` turns
   * that day into a loud, explained failure instead of silent corruption.
   *
   * Why the `lastSynced + 1` floor: two saves inside the same wall-clock second
   * would otherwise share a number — the original bug in miniature. The floor
   * makes the sequence strictly increasing per upload whatever the clock's
   * resolution, and keeps it from ever decreasing for a slot when the device
   * clock is rewound. Drift above wall-clock is bounded by the number of
   * uploads, against ~3.6e8 seconds of headroom left in the column.
   *
   * `weeksLived` is deliberately NOT a fallback any more: an epoch-ms source is
   * always available (the caller's `timestamp`, else `Date.now()`), and mixing a
   * ~1e3 value into a ~1.8e9 sequence could only ever read as stale.
   */
  private nextRevision(state: GameState, timestamp: number, lastSyncedRevision: number): number {
    const isEpochMs = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0;
    const baseMs = [state.updatedAt, timestamp].find(isEpochMs) ?? Date.now();
    return Math.max(
      Math.floor(baseMs / 1000),
      lastSyncedRevision + 1,
      CloudSyncService.MIN_CLOUD_REVISION
    );
  }

  private buildIntegrityProof(state: GameState, userId: string, slotId: string, revision: number): { hash: string; signature: string } {
    const serializedState = JSON.stringify(state);
    const hash = calculateChecksum(serializedState);
    const signature = calculateHmacSignature(`${userId}:${slotId}:${revision}:${hash}`);
    return { hash, signature };
  }

  /**
   * Queue a state for sync.
   *
   * The queue holds AT MOST ONE pending state. An upload is a full-state write,
   * so the newest state supersedes every older one; draining the superseded
   * ones costs a multi-MB body each and trips the backend's "two writes to the
   * same slot inside 5 s" throttle (429) for nothing.
   *
   * This used to dedupe by revision and cap the queue at 5 (CRASH FIX C-3),
   * which collapsed same-week saves only because the revision WAS `weeksLived`.
   * Now that a revision is per-save, nothing would ever match that filter and
   * up to five superseded bodies would drain. Replacing outright keeps C-3's
   * bound (one item is fewer than five) and its stated reason ("only latest
   * state matters for full-state sync").
   */
  async queueSync(state: GameState): Promise<void> {
    this.syncQueue = [{
      state,
      timestamp: Date.now(),
      retries: 0,
    }];

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
   * proof and the unchanged-state guard — and still learn whether it worked.
   * Duplicating any of that for the manual path is how the two drift.
   */
  private async performUpload(state: GameState, timestamp: number): Promise<'uploaded' | 'stale'> {
    const userId = await this.resolveUserId();
    if (!userId) {
      throw new Error('Cloud sync blocked: no trusted user identity');
    }
    const slotId = await this.resolveSlotId();

    // "The cloud already has this" is a question about the STATE, not about the
    // revision number, and it is answered by `updatedAt` (see `stateMarker`).
    // Asking it of the revision instead is what made every save after the first
    // in a game week silently skip its upload.
    const marker = this.stateMarker(state);
    const lastUploadedStateAt = this.lastUploadedStateAtBySlot.get(slotId);
    if (marker !== null && lastUploadedStateAt !== undefined && marker <= lastUploadedStateAt) {
      logger.debug('[CloudSync] Cloud already holds this state — nothing to upload', {
        slotId,
        stateUpdatedAt: marker,
        lastUploadedStateAt,
      });
      return 'stale';
    }

    const revision = this.nextRevision(state, timestamp, this.lastSyncedRevisionBySlot.get(slotId) || 0);
    if (!Number.isFinite(revision) || revision < CloudSyncService.MIN_CLOUD_REVISION) {
      throw new Error(`Cloud sync blocked: invalid revision ${revision}`);
    }
    if (revision > CloudSyncService.MAX_CLOUD_REVISION) {
      // The backend stores `revision` as PostgreSQL `integer`. Past 2038-01-19
      // an epoch-seconds revision no longer fits; widen the column to `bigint`
      // (or switch to a persisted per-slot counter) rather than truncating,
      // which would make every later upload read as stale.
      throw new Error(`Cloud sync blocked: revision ${revision} exceeds the backend's int4 range`);
    }

    const { hash, signature } = this.buildIntegrityProof(state, userId, slotId, revision);
    // `uploadGameState` reports SUCCESS for writes that never happened. It
    // returns `{success:true}` without touching the network once the transport
    // has disabled itself after repeated failures — deliberate, so a failing
    // cloud cannot block a local save — and its `withErrorRecovery` fallback
    // swallows a failed write the same way. Recording either as a backup is a
    // lie the player can see: `lastUploadedStateAtBySlot` advances so later
    // saves skip, and the Settings row shows "Last backup: just now" for a
    // backup that does not exist.
    //
    // The transport's own counters are the in-band evidence of what happened: a
    // real write resets `failureCount` to 0, while a disabled transport stays
    // `disabled` and a swallowed failure raises `failureCount`. (The remaining
    // no-op — no `EXPO_PUBLIC_CLOUD_SAVE_URL` configured — is gated upstream:
    // every caller goes through `cloudBackup`, whose `cloudSave` flag requires
    // a non-empty URL.)
    const transportBefore = getCloudSyncStatus();
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
    const transportAfter = getCloudSyncStatus();
    if (transportAfter.disabled) {
      throw new Error('Cloud upload skipped: cloud sync is disabled after repeated failures');
    }
    if (transportAfter.failureCount > transportBefore.failureCount) {
      throw new Error('Cloud upload did not reach the server (fell back to local storage only)');
    }

    this.lastSyncedRevisionBySlot.set(slotId, revision);
    if (marker !== null) {
      this.lastUploadedStateAtBySlot.set(slotId, marker);
    }
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
      // 'stale' means the cloud already holds this exact state (nothing has
      // changed since the last upload) — nothing to do, which is a success from
      // the player's point of view, not a failure.
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

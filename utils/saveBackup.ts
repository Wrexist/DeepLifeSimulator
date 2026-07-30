import { logger } from './logger';
import {
  doubleBufferSave,
  calculateHmacSignature,
  calculateChecksum,
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
  shouldAllowUnsignedLegacySaves,
  verifySaveData,
  verifySaveEnvelopeData,
} from './saveValidation';
import { safeSetItem, safeGetItem, safeRemoveItem, safeMultiRemove, safeGetAllKeys } from './safeStorage';

const BACKUP_PREFIX = 'save_backup_';
const PROTECTED_STATE_PREFIX = 'protected_state_';
const MAX_BACKUPS_PER_SLOT = 5; // Increased from 3 to 5 for better recovery options
/** Recent rotatable backups always kept, whatever their age. */
const KEEP_NEWEST_BACKUPS = 3;
/**
 * Age bands for generational retention: the newest backup at least this old
 * survives rotation. Bounds the total at KEEP_NEWEST_BACKUPS + 3 per slot while
 * guaranteeing a copy that predates the current play session.
 */
const GENERATIONAL_BACKUP_BANDS = [
  60 * 60 * 1000, // 1 hour
  24 * 60 * 60 * 1000, // 1 day
  7 * 24 * 60 * 60 * 1000, // 1 week
];
const MAX_TOTAL_BACKUP_SIZE = 10 * 1024 * 1024; // 10MB total backup storage limit
const MIN_BACKUP_INTERVAL_MS = 60 * 1000; // Minimum 1 minute between manual backups
const LAST_BACKUP_PREFIX = 'last_backup_time_';

/**
 * Why a restore is being performed.
 * - `recovery`: the player is repairing a broken or lost save. Progression
 *   protections are skipped — they would block the case they exist to survive.
 * - `rewind`: an in-run rollback. Full anti-exploit checks apply.
 */
export type RestoreIntent = 'recovery' | 'rewind';

export type BackupReason = 'manual' | 'auto_save' | 'delete_save' | 'corruption_recovery' | 'before_update' | 'background_save' | 'app_resume' | 'emergency_save' | 'before_week' | 'before_overwrite' | 'before_prestige' | 'before_restore';

/**
 * Backups that rotation may never evict.
 *
 * The ring is `MAX_BACKUPS_PER_SLOT` deep and the 2-minute autosave writes into
 * it unconditionally, so a flat newest-5 policy meant the entire recovery window
 * was about ten minutes of play. A snapshot taken because something irreversible
 * was ABOUT to happen is the one copy a player actually needs, and it was the
 * first thing evicted. These are kept regardless of age or count.
 */
const PROTECTED_BACKUP_REASONS: ReadonlySet<string> = new Set<string>([
  'manual',
  'before_overwrite',
  'before_prestige',
  'before_restore',
  'delete_save',
]);

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

interface NormalizedBackupPayload {
  state: any;
  canonicalSaveData: string;
}

function normalizeBackupPayload(rawSaveData: string): NormalizedBackupPayload {
  const decoded = decodePersistedSaveEnvelope(rawSaveData, { allowLegacy: shouldAllowUnsignedLegacySaves() });
  if (!decoded.valid || typeof decoded.data !== 'string') {
    throw new Error(decoded.error || 'Failed to decode save payload');
  }

  const state = JSON.parse(decoded.data);
  const canonicalSaveData = createSaveEnvelope(decoded.data);
  return { state, canonicalSaveData };
}

// ANTI-EXPLOIT: Redundant storage key for protected state.
// Even if a player deletes the primary key, the redundant copy still protects.
const PROTECTED_STATE_REDUNDANT_PREFIX = 'ps_mirror_';

/**
 * Get protected state for a slot.
 * ANTI-EXPLOIT: Reads from both primary and redundant storage keys.
 * Returns the MORE restrictive state (higher age, isDead=true wins, etc.)
 * to prevent bypass by deleting one key.
 */
export async function getProtectedState(slot: number): Promise<ProtectedState | null> {
  try {
    const primaryKey = `${PROTECTED_STATE_PREFIX}${slot}`;
    const redundantKey = `${PROTECTED_STATE_REDUNDANT_PREFIX}${slot}`;

    let primary: ProtectedState | null = null;
    let redundant: ProtectedState | null = null;

    const [primaryData, redundantData] = await Promise.all([
      safeGetItem(primaryKey),
      safeGetItem(redundantKey),
    ]);

    if (primaryData) {
      try { primary = JSON.parse(primaryData); } catch { /* corrupted */ }
    }
    if (redundantData) {
      try { redundant = JSON.parse(redundantData); } catch { /* corrupted */ }
    }

    if (!primary && !redundant) return null;
    if (!primary) return redundant;
    if (!redundant) return primary;

    // Merge: take the MORE restrictive value for each field
    return {
      slot,
      isDead: primary.isDead || redundant.isDead,
      deathTimestamp: primary.deathTimestamp || redundant.deathTimestamp,
      deathReason: primary.deathReason || redundant.deathReason,
      generationNumber: Math.max(primary.generationNumber || 1, redundant.generationNumber || 1),
      isInJail: primary.isInJail || redundant.isInJail,
      jailStartTimestamp: primary.jailStartTimestamp || redundant.jailStartTimestamp,
      jailWeeksRemaining: Math.max(primary.jailWeeksRemaining || 0, redundant.jailWeeksRemaining || 0),
      highestWantedLevel: Math.max(primary.highestWantedLevel || 0, redundant.highestWantedLevel || 0),
      totalCrimesCommitted: Math.max(primary.totalCrimesCommitted || 0, redundant.totalCrimesCommitted || 0),
      totalJailTime: Math.max(primary.totalJailTime || 0, redundant.totalJailTime || 0),
      highestAgeReached: Math.max(primary.highestAgeReached || 0, redundant.highestAgeReached || 0),
      totalGemsSpent: Math.max(primary.totalGemsSpent || 0, redundant.totalGemsSpent || 0),
      permanentAchievements: [
        ...(primary.permanentAchievements || []),
        ...(redundant.permanentAchievements || []),
      ].filter((v, i, a) => a.indexOf(v) === i),
      lastUpdated: Math.max(primary.lastUpdated || 0, redundant.lastUpdated || 0),
    };
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
        // Live claimed store; the `completed` flag is never set in play, so this
        // list was always empty. GP-3.
        ...((gameState as { claimedProgressAchievements?: string[] }).claimedProgressAchievements || []),
      ].filter((v, i, a) => a.indexOf(v) === i), // Unique
      lastUpdated: now,
    };
    
    // ANTI-EXPLOIT: Write to both primary and redundant keys
    // Player must delete BOTH keys to bypass protection
    const primaryKey = `${PROTECTED_STATE_PREFIX}${slot}`;
    const redundantKey = `${PROTECTED_STATE_REDUNDANT_PREFIX}${slot}`;
    const serialized = JSON.stringify(newProtected);
    await Promise.all([
      safeSetItem(primaryKey, serialized),
      safeSetItem(redundantKey, serialized),
    ]);
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
    const primaryKey = `${PROTECTED_STATE_PREFIX}${slot}`;
    const redundantKey = `${PROTECTED_STATE_REDUNDANT_PREFIX}${slot}`;
    await Promise.all([
      safeRemoveItem(primaryKey),
      safeRemoveItem(redundantKey),
    ]);
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
    return {
      allowed: false,
      reason: 'Unable to verify backup safety. Please try again.',
      exploitType: 'invalid_state',
    };
  }
}

/**
 * Check if restoring a backup is allowed (anti-exploit)
 */
export async function canRestoreBackup(
  slot: number,
  backupState: any,
  currentState: any,
  intent: RestoreIntent = 'rewind'
): Promise<ExploitCheckResult> {
  try {
    // A RECOVERY restore is the player getting their own save back after
    // something went wrong. Progression-protection checks exist to stop a
    // player rewinding past a bad outcome mid-run; applied to a recovery they
    // do the opposite of their job. Concretely: `continueAsChild` bumps
    // generationNumber, so check 4 made every backup from the run that just
    // ended permanently unrestorable — including one taken seconds earlier —
    // and the autosave keeps running while dead, so check 1 filled the ring
    // with dead-state backups that became the only legal restores.
    const isRecovery = intent === 'recovery';

    const protectedState = await getProtectedState(slot);
    
    // Also check current state directly (in case protected state isn't up to date)
    const currentIsDead = currentState?.showDeathPopup || currentState?.deathReason;
    const currentInJail = (currentState?.jailWeeks || 0) > 0;
    const currentGeneration = currentState?.generationNumber || 1;
    
    // Check 1: Death reversal - cannot restore to alive state if player has died
    const playerIsDead = !isRecovery && (protectedState?.isDead || currentIsDead);
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
    const playerInJail = (protectedState?.isInJail && (protectedState.jailWeeksRemaining ?? 0) > 0) || currentInJail;
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
    
    // Check 4: Generation mismatch - cannot go back to previous generation.
    // Skipped for a recovery, and otherwise off-by-one so the immediately
    // preceding generation stays restorable: continuing your legacy must not
    // make the life you just finished unrecoverable.
    const highestGeneration = Math.max(
      protectedState?.generationNumber || 1, 
      currentGeneration
    );
    const backupGeneration = backupState.generationNumber || 1;
    if (!isRecovery && backupGeneration < highestGeneration - 1) {
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
    if (!isRecovery && totalCrimes > 10) {
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
    // Fail OPEN. This used to fail closed "for security", which trades a
    // single-player progression exploit against permanent, unrecoverable data
    // loss for a player whose save is already broken — an exception in the
    // permission check is exactly the moment they need the restore most.
    logger.error('Error checking restore permission — allowing restore', error);
    return { allowed: true };
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
    logger.warn('Failed to extract game info for backup', { error: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}

/**
 * Create a backup of a save slot.
 *
 * `data` is a PERSISTED save payload — a v2 envelope, or a legacy raw payload
 * on builds that still accept those. Callers holding a live GameState must use
 * `createBackupFromState`, which wraps it first: handing a raw state string in
 * here is rejected by the envelope decode on every signed build (see the
 * comment on that function).
 *
 * `preparsed` lets a caller that already holds both the state object and the
 * canonical envelope skip the decode + re-encode round trip entirely.
 */
export async function createBackup(
  slot: number,
  data: string,
  reason: BackupReason | string = 'auto_save',
  preparsed?: NormalizedBackupPayload,
): Promise<string | null> {
  try {
    // Rate-limit the automatic ring only. `createBackup` never went through
    // `canCreateBackup`, so every 2-minute autosave — and every one of the 88
    // saveGame call sites — wrote a backup and rotated. Five entries deep, that
    // made the whole recovery history a few minutes long. Deliberate snapshots
    // (manual, before_overwrite, before_prestige…) are never throttled.
    if (reason === 'auto_save') {
      const [newest] = await listBackups(slot);
      if (newest && Date.now() - newest.timestamp < MIN_BACKUP_INTERVAL_MS) return null;
    }

    const { state, canonicalSaveData } = preparsed ?? normalizeBackupPayload(data);
    const canonicalChecksum = calculateChecksum(canonicalSaveData);
    const canonicalHmac = calculateHmacSignature(canonicalSaveData);
    const timestamp = Date.now();
    const backupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
    
    const gameInfo = extractGameInfo(state);
    
    const backupData = {
      data: canonicalSaveData,
      checksum: canonicalChecksum,
      hmac: canonicalHmac,
      metadata: {
        id: backupId,
        slot,
        timestamp,
        size: canonicalSaveData.length,
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
          for (const [_slotNum, slotBackups] of Object.entries(backupsBySlot)) {
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
          const retryTimestamp = Date.now();
          const retryBackupId = `${BACKUP_PREFIX}${slot}_${retryTimestamp}`;

          // Re-derive from the original data parameter (same as outer scope)
          const retryPayload = normalizeBackupPayload(data);
          const retryCanonicalSaveData = retryPayload.canonicalSaveData;
          const retryCanonicalChecksum = calculateChecksum(retryCanonicalSaveData);
          const retryCanonicalHmac = calculateHmacSignature(retryCanonicalSaveData);
          const retryGameInfo = extractGameInfo(retryPayload.state);

          const retryBackupData = {
            data: retryCanonicalSaveData,
            checksum: retryCanonicalChecksum,
            hmac: retryCanonicalHmac,
            metadata: {
              id: retryBackupId,
              slot,
              timestamp: retryTimestamp,
              size: retryCanonicalSaveData.length,
              reason,
              gameInfo: retryGameInfo,
            } as BackupMetadata
          };

          await safeSetItem(retryBackupId, JSON.stringify(retryBackupData));
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
 * Create a backup directly from a live GameState object.
 *
 * This used to stringify the RAW state and hand it to `createBackup`, whose
 * first step is `normalizeBackupPayload` → `decodePersistedSaveEnvelope`. A raw
 * state has no `v: 2`, so on any build where unsigned legacy saves are refused
 * — which is EVERY shipped build (`shouldAllowUnsignedLegacySaves()` is true
 * only under __DEV__ or an env flag that `scripts/preflightSaveSigning.js`
 * hard-errors on for production) — the decode returned "Unsigned legacy save
 * format is not accepted", `normalizeBackupPayload` threw, and `createBackup`'s
 * catch swallowed it into `return null`. Because it never rejected, the
 * `.catch()` at the call site never fired and the save path reported success:
 * no shipped build has ever written a backup, while dev worked fine. Wrapping
 * the state in a canonical envelope here is the fix (2026-07-28 audit PERF-1).
 *
 * The state object and the envelope are both passed through, so `createBackup`
 * does not decode and re-encode what we just built (PERF-1's sibling PERF-3);
 * the stringify is also deferred by one macrotask so a large save does not
 * block the frame that triggered it.
 */
export async function createBackupFromState(
  slot: number,
  state: any,
  reason: string
): Promise<string | null> {
  try {
    // Yield first: the caller (auto-save, onboarding) is on the JS thread and
    // does not await the result, so the stringify below should not run in the
    // same frame. Same idiom as the save queue's pre-serialize yield.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const stateJson = JSON.stringify(state);
    const canonicalSaveData = createSaveEnvelope(stateJson);
    return createBackup(slot, canonicalSaveData, reason, { state, canonicalSaveData });
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
    const keys = await safeGetAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(`${BACKUP_PREFIX}${slot}_`));

    const backups: BackupMetadata[] = [];

    for (const key of backupKeys) {
      try {
        const item = await safeGetItem(key);
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
    const item = await safeGetItem(backupId);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (!parsed || typeof parsed.data !== 'string' || typeof parsed.checksum !== 'string') {
      logger.warn(`Backup envelope malformed: ${backupId}`);
      return null;
    }

    const expectedHmac = typeof parsed.hmac === 'string' ? parsed.hmac : undefined;
    const expectedSignature = typeof parsed.signature === 'string' ? parsed.signature : undefined;
    // P1-9: verify backups with the SAME strict envelope check as primary saves —
    // requires HMAC or signature (CRC32 alone is not tamper-evidence). Previously
    // loadBackup used verifySaveData, which accepts checksum-only during the weak
    // migration window, making the recovery path a weaker integrity tier than the
    // main slot loader.
    const valid = verifySaveEnvelopeData(parsed.data, parsed.checksum, expectedSignature, expectedHmac);
    if (!valid) {
      logger.warn(`Backup verification failed (missing/invalid HMAC or signature): ${backupId}`);
      return null;
    }
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
  backupId: string,
  intent: RestoreIntent = 'recovery'
): Promise<{ success: boolean; state?: any; error?: string }> {
  try {
    const backup = await loadBackup(backupId);
    if (!backup) {
      logger.error(`Backup not found: ${backupId}`);
      return { success: false, error: 'Backup not found' };
    }
    
    // Parse backup payload
    let backupState: any;
    let canonicalBackupData = '';
    try {
      const normalized = normalizeBackupPayload(backup.data);
      backupState = normalized.state;
      canonicalBackupData = normalized.canonicalSaveData;
    } catch (e) {
      logger.error(`Backup data corrupted: ${backupId}`);
      return { success: false, error: 'Backup data is corrupted' };
    }
    
    // CRASH FIX (A-1): Read from double-buffer system
    const { readSaveSlot } = await import('@/utils/saveValidation');
    const currentData = await readSaveSlot(slot);
    let currentState: any = {};
    if (currentData) {
      try {
        const decodedCurrent = decodePersistedSaveEnvelope(currentData, { allowLegacy: shouldAllowUnsignedLegacySaves() });
        if (decodedCurrent.valid && typeof decodedCurrent.data === 'string') {
          currentState = JSON.parse(decodedCurrent.data);
        }
      } catch (e) {
        // Current state corrupted, allow restore.
      }
    }
    
    // ANTI-EXPLOIT: Check if restore is allowed
    const exploitCheck = await canRestoreBackup(slot, backupState, currentState, intent);
    if (!exploitCheck.allowed) {
      logger.warn(`Restore blocked: ${exploitCheck.exploitType} - ${exploitCheck.reason}`);
      return { success: false, error: exploitCheck.reason };
    }
    
    // BRC-14: a restore is itself destructive — it discards the state it
    // replaces. Snapshot that first, so picking the wrong entry out of the list
    // is not a one-way door. `currentData` is already a persisted envelope,
    // which is exactly what createBackup takes, so nothing is re-encoded and a
    // save that no longer verifies is still captured byte-for-byte.
    if (currentData) {
      await createBackup(slot, currentData, 'before_restore').catch(() => null);
    }

    // Write through the SAME path a real save uses. This used to be
    // `atomicSave`, which writes only the legacy single key `save_slot_N` —
    // but every save since the double-buffer landed writes `_A`/`_B` and sets
    // the `_active` pointer, and `doubleBufferLoad` consults that pointer FIRST,
    // falling through to the legacy key only when the pointer is missing AND
    // both buffers fail (and even then only when `allowLegacy`, which is false
    // on every signed production build). So on any device that had saved even
    // once, a "successful" restore reported success and the next load served
    // the pre-restore buffer — the player was told it worked and got their
    // unrestored save back.
    const mainSaveKey = `save_slot_${slot}`;
    const restoreResult = await doubleBufferSave(mainSaveKey, canonicalBackupData);
    if (!restoreResult.success) {
      logger.error(`Atomic restore failed for slot ${slot}: ${restoreResult.error}`);
      return { success: false, error: restoreResult.error || 'Failed to restore backup atomically' };
    }

    // Drop any stale legacy blob so it can never outrank the restore on a build
    // that does allow legacy reads. Non-critical: the pointer already wins.
    await safeRemoveItem(mainSaveKey).catch(() => {});

    // The slot blob was just OVERWRITTEN with the backup, so the cached per-slot
    // summary is now stale — invalidate it BEFORE reporting success so no caller
    // can navigate to a menu that still reads the pre-restore name/age.
    // ensureSaveSlotMeta regenerates it from the restored blob on the next menu
    // visit. Errors swallowed (invalidation must not fail the restore).
    await import('@/utils/saveSlotMeta').then((m) => m.deleteSaveSlotMeta(slot)).catch(() => {});

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
 * Snapshot whatever a slot currently holds, BEFORE something overwrites it.
 *
 * The two production backup call sites both passed the state being WRITTEN: the
 * autosave under 'auto_save', and onboarding under the tag 'before_onboarding'
 * — which reads like a pre-overwrite snapshot and was a snapshot of the thing
 * doing the overwriting. Nothing in the app ever copied the outgoing save, so
 * an overwrite had no rescue copy at all.
 *
 * Reads the persisted envelope and stores it verbatim — no decode, no re-encode,
 * so a save that no longer verifies is still captured byte-for-byte and stays
 * recoverable. Returns the backup id, or null when the slot held nothing.
 * Never throws: this must not be able to block the write it precedes.
 */
export async function snapshotOutgoingSave(
  slot: number,
  reason: BackupReason = 'before_overwrite',
): Promise<string | null> {
  try {
    const { readSaveSlot, shouldAllowUnsignedLegacySaves: allowLegacyFn } = await import(
      '@/utils/saveValidation'
    );
    const existing = await readSaveSlot(slot, undefined, { allowLegacy: allowLegacyFn() });
    if (!existing) return null;
    return await createBackup(slot, existing, reason);
  } catch (error) {
    logger.warn(`Could not snapshot outgoing save for slot ${slot} (non-critical)`, { error });
    return null;
  }
}

/**
 * Delete old backups to save space
 */
async function rotateBackups(slot: number) {
  try {
    const backups = await listBackups(slot); // newest first

    // Protected reasons are exempt entirely — they exist precisely because
    // something destructive was about to happen.
    const rotatable = backups.filter((b) => !PROTECTED_BACKUP_REASONS.has(b.reason));

    // Generational retention over the rotatable ones: the newest few, plus the
    // newest survivor in each older age band. A flat newest-5 spanned roughly
    // ten minutes of play on the 2-minute autosave, so a player who noticed the
    // problem an hour later had nothing left that predated it. This keeps the
    // count bounded while guaranteeing something older than the current session.
    const keep = new Set<string>();
    for (const b of rotatable.slice(0, KEEP_NEWEST_BACKUPS)) keep.add(b.id);

    const now = Date.now();
    for (const minAgeMs of GENERATIONAL_BACKUP_BANDS) {
      const survivor = rotatable.find((b) => now - b.timestamp >= minAgeMs);
      if (survivor) keep.add(survivor.id);
    }

    const keysToDelete = rotatable.filter((b) => !keep.has(b.id)).map((b) => b.id);
    if (keysToDelete.length > 0) {
      await safeMultiRemove(keysToDelete);
      logger.info(`Removed ${keysToDelete.length} old backups for slot ${slot}`);
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
    // CRASH FIX (A-1): Read from double-buffer system
    const { readSaveSlot } = await import('@/utils/saveValidation');
    const saveData = await readSaveSlot(slot);
    
    if (!saveData) {
      return { success: false, error: 'No save data found for this slot' };
    }
    
    // Parse state to check for exploits and extract game info
    let gameState: any;
    let canonicalSaveData = '';
    let gameInfo: BackupGameInfo | undefined;
    try {
      const normalized = normalizeBackupPayload(saveData);
      gameState = normalized.state;
      canonicalSaveData = normalized.canonicalSaveData;
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
    
    const checksum = calculateChecksum(canonicalSaveData);
    const hmac = calculateHmacSignature(canonicalSaveData);
    const timestamp = Date.now();
    const backupId = `${BACKUP_PREFIX}${slot}_${timestamp}`;
    
    const backupData = {
      data: canonicalSaveData,
      checksum,
      hmac,
      metadata: {
        id: backupId,
        slot,
        timestamp,
        size: canonicalSaveData.length,
        reason: 'manual' as BackupReason,
        label: label || undefined,
        gameInfo,
      }
    };
    
    await safeSetItem(backupId, JSON.stringify(backupData));

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
    const item = await safeGetItem(backupId);
    if (!item) {
      logger.warn(`Backup not found for deletion: ${backupId}`);
      return false;
    }

    await safeRemoveItem(backupId);
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
    await safeMultiRemove(keysToDelete);

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
    const keys = await safeGetAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(BACKUP_PREFIX));

    let totalSize = 0;
    const backupsBySlot: { [slot: number]: { count: number; size: number } } = {};

    // Initialize slots 1-3
    for (let i = 1; i <= 3; i++) {
      backupsBySlot[i] = { count: 0, size: 0 };
    }

    for (const key of backupKeys) {
      try {
        const item = await safeGetItem(key);
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
    const keys = await safeGetAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(BACKUP_PREFIX));

    const backups: BackupMetadata[] = [];

    for (const key of backupKeys) {
      try {
        const item = await safeGetItem(key);
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

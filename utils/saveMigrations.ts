/**
 * Save Migration Registry (A-4)
 *
 * Ordered migration functions that transform save state from version N to N+1.
 * Each migration handles renames, restructures, enum remaps, and type changes
 * that `repairGameState()` (which only fills defaults) cannot handle.
 *
 * On load: read `state.version`, run all migrations from `state.version + 1`
 * to `CURRENT_STATE_VERSION` in order, then run `repairGameState()` for remaining defaults.
 */
import { logger } from '@/utils/logger';
import { STATE_VERSION } from '@/contexts/game/initialState';

// Import from initialState.ts to prevent manual sync drift
export const CURRENT_STATE_VERSION = STATE_VERSION;

/**
 * Migration registry: key is the TARGET version (the version after migration runs).
 * e.g., migration[10] transforms version 9 → 10.
 *
 * Each function receives the raw parsed state object (any) and returns the transformed state.
 * Migrations MUST be idempotent — running them on an already-migrated state should be a no-op.
 */
const migrations: Record<number, (state: any) => any> = {
  // Version 10: Initial production release — all v10 defaults are handled by repairGameState()
  10: (state) => {
    // No explicit migration needed: repairGameState fills all missing v10 fields with defaults.
    // This entry exists so the migration loop doesn't skip v10 silently.
    return state;
  },

  // Version 11: Engagement & addiction systems (play streak, lucky bonus, legacy points, etc.)
  11: (state) => {
    // Play streak system
    if (state.playStreak === undefined) {
      state.playStreak = { count: 0, lastPlayTimestamp: 0, longestStreak: 0 };
    }
    // Weekly result — transient, reset each week. Default to undefined (set fresh in advanceToNextWeek).
    // No backfill needed: code uses optional chaining (gameState.weekResult?.luckyBonus).

    // Legacy points (mini-prestige currency)
    if (state.legacyPoints === undefined) {
      state.legacyPoints = 0;
    }
    // Legacy buffs — initialize if missing so code can safely read .activeBuff without crash
    if (state.legacyBuffs === undefined) {
      state.legacyBuffs = undefined; // Explicitly set (no-op but makes intent clear)
    }

    // Challenge streak — initialize with defaults for saves that had daily challenges
    if (state.challengeStreak === undefined && state.dailyChallenges?.lastCompletionDay) {
      state.challengeStreak = { count: 0, lastCompletionDayKey: '' };
    }

    // Life chapters
    if (state.activeChapterId === undefined) {
      state.activeChapterId = 'ch1_fresh_start';
    }
    if (state.completedChapters === undefined) {
      state.completedChapters = [];
    }

    // Tutorial step completion
    if (state.completedTutorialSteps === undefined) {
      state.completedTutorialSteps = [];
    }

    // Career startedWeeksLived — backfill for existing careers
    if (Array.isArray(state.careers)) {
      for (const career of state.careers) {
        if (career.startedWeeksLived === undefined) {
          // Best guess: assume they started at the beginning
          career.startedWeeksLived = 0;
        }
      }
    }

    state.version = 11;
    return state;
  },

  // Version 12: Wave 2 addiction mechanics (secrets, cliffhangers, ribbons, challenges, time machine)
  12: (state) => {
    if (state.discoveredSecrets === undefined) {
      state.discoveredSecrets = [];
    }
    // pendingCliffhanger — transient, no backfill needed (undefined = no pending)
    if (state.ribbonCollection === undefined) {
      state.ribbonCollection = { earned: [], discoveredIds: [] };
    }
    // weeklyChallenge — transient, initialized on next week advance
    if (state.checkpoints === undefined) {
      state.checkpoints = [];
    }
    if (state.timeMachineUsesThisLife === undefined) {
      state.timeMachineUsesThisLife = 0;
    }
    // Event spacing tracker — must exist so event engine can compute intervals
    if (state.lastEventWeeksLived === undefined) {
      state.lastEventWeeksLived = state.weeksLived || 0;
    }
    // Campus event pending state — undefined means no pending event
    if (state.pendingCampusEventEducationId === undefined) {
      state.pendingCampusEventEducationId = undefined;
    }
    // Processed IAP transaction IDs — prevents duplicate purchase fulfillment
    if (state.processedIAPTransactions === undefined) {
      state.processedIAPTransactions = [];
    }
    state.version = 12;
    return state;
  },
};

/**
 * Run all applicable migrations on a loaded save state.
 * @param state The raw parsed state from storage
 * @returns The migrated state with updated version, and a list of migrations applied
 */
export function runMigrations(state: any): { state: any; migrationsApplied: number[]; errors: string[] } {
  const migrationsApplied: number[] = [];
  const errors: string[] = [];

  if (!state || typeof state !== 'object') {
    return { state, migrationsApplied, errors: ['State is null or not an object'] };
  }

  // Determine current version (default to 1 if missing)
  let currentVersion = typeof state.version === 'number' && state.version >= 1 ? state.version : 1;

  if (currentVersion >= CURRENT_STATE_VERSION) {
    // Already at or beyond current version — no migrations needed
    return { state, migrationsApplied, errors };
  }

  logger.info(`[MIGRATION] Starting migration from v${currentVersion} to v${CURRENT_STATE_VERSION}`);

  for (let targetVersion = currentVersion + 1; targetVersion <= CURRENT_STATE_VERSION; targetVersion++) {
    const migrationFn = migrations[targetVersion];
    if (migrationFn) {
      try {
        state = migrationFn(state);
        migrationsApplied.push(targetVersion);
        logger.info(`[MIGRATION] Applied migration to v${targetVersion}`);
      } catch (error) {
        const errorMsg = `Migration to v${targetVersion} failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        logger.error(`[MIGRATION] ${errorMsg}`);
        // Continue with remaining migrations — partial migration is better than none
      }
    }
    // Always update version even if no explicit migration exists
    // (version may have been bumped without structural changes)
    state.version = targetVersion;
  }

  if (migrationsApplied.length > 0) {
    logger.info(`[MIGRATION] Completed: applied ${migrationsApplied.length} migrations (${migrationsApplied.join(', ')})`);
  }

  return { state, migrationsApplied, errors };
}

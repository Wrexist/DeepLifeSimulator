/**
 * Time Machine / Checkpoint System
 *
 * Auto-saves checkpoints at key moments (every "year" of WEEKS_PER_YEAR weeks,
 * and right before death). Players can rewind to checkpoints for gems
 * with escalating cost. Cheaper than revive (15K gems) but loses more progress.
 *
 * Max 5 checkpoints to limit save size (~50-100KB each).
 */
import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export const MAX_CHECKPOINTS = 5;
export const BASE_REWIND_COST = 500;
export const COST_MULTIPLIER = 2;

export interface Checkpoint {
  id: string;
  label: string;
  weeksLived: number;
  age: number;
  timestamp: number;
  snapshot: string; // JSON.stringify of GameState (minus checkpoints)
}

/**
 * Create a checkpoint from the current game state.
 * Strips the checkpoints field from the snapshot to prevent recursion.
 */
export function createCheckpoint(
  state: GameState,
  label: string
): Checkpoint {
  // Remove checkpoints and other transient data from snapshot to save space
  // Destructure known transient fields from GameState — remaining fields form the snapshot
  const { checkpoints, weekResult, showDeathPopup, showZeroStatPopup, pendingCliffhanger, ...snapshotData } = state;

  return {
    id: `cp_${state.weeksLived ?? 0}_${Date.now()}`,
    label,
    weeksLived: state.weeksLived ?? 0,
    age: Math.floor(state.date?.age ?? 18),
    timestamp: Date.now(),
    snapshot: JSON.stringify(snapshotData),
  };
}

/**
 * Add a checkpoint to the state, maintaining the max limit.
 */
export function addCheckpoint(
  existingCheckpoints: Checkpoint[],
  newCheckpoint: Checkpoint
): Checkpoint[] {
  const updated = [...existingCheckpoints, newCheckpoint];

  // Keep only the most recent MAX_CHECKPOINTS
  while (updated.length > MAX_CHECKPOINTS) {
    updated.shift();
  }

  return updated;
}

/**
 * Get the gem cost to rewind to a checkpoint.
 * Cost doubles with each use this life.
 */
export function getRewindCost(usesThisLife: number): number {
  return BASE_REWIND_COST * Math.pow(COST_MULTIPLIER, usesThisLife);
}

/**
 * Rewind to a checkpoint. Returns the restored GameState or null if failed.
 * Preserves cross-life data (ribbons, secrets, checkpoints array).
 */
export function rewindToCheckpoint(
  currentState: GameState,
  checkpointId: string
): GameState | null {
  const checkpoints = currentState.checkpoints ?? [];
  const checkpoint = checkpoints.find((c) => c.id === checkpointId);
  if (!checkpoint) {
    logger.error(`[TIME_MACHINE] Checkpoint not found: ${checkpointId}`);
    return null;
  }

  const cost = getRewindCost(currentState.timeMachineUsesThisLife ?? 0);
  const gems = currentState.stats?.gems ?? 0;
  if (gems < cost) {
    logger.warn(`[TIME_MACHINE] Not enough gems: have ${gems}, need ${cost}`);
    return null;
  }

  try {
    const restored = JSON.parse(checkpoint.snapshot) as GameState;

    // Preserve cross-life data from current state
    restored.ribbonCollection = currentState.ribbonCollection;
    restored.discoveredSecrets = currentState.discoveredSecrets;
    restored.checkpoints = currentState.checkpoints; // Keep full checkpoint list
    restored.timeMachineUsesThisLife = (currentState.timeMachineUsesThisLife ?? 0) + 1;

    // Deduct gem cost from CURRENT state's gems, carry into restored state
    // This prevents negative gems when the checkpoint was saved with fewer gems than the cost
    if (restored.stats) {
      restored.stats = {
        ...restored.stats,
        gems: gems - cost,
      };
    }

    // Clear any death/popup state
    restored.showDeathPopup = false;
    restored.deathReason = undefined;
    restored.showZeroStatPopup = false;

    logger.info(`[TIME_MACHINE] Rewound to checkpoint "${checkpoint.label}" (cost: ${cost} gems)`);
    return restored;
  } catch (err) {
    logger.error('[TIME_MACHINE] Failed to parse checkpoint snapshot:', err);
    return null;
  }
}

/**
 * Should we create an auto-checkpoint this week?
 * Creates one every WEEKS_PER_YEAR weeks (roughly once per "year").
 */
export function shouldAutoCheckpoint(weeksLived: number): boolean {
  return weeksLived > 0 && weeksLived % WEEKS_PER_YEAR === 0;
}

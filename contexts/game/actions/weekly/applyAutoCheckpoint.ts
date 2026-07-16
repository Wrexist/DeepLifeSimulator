/**
 * Auto-checkpoint creation — R7 Phase 2 step 2.8-C.
 *
 * Scope: previously an inline IIFE in `GameActionsContext.tsx:1587-1616`
 * (~30 lines) spread into the final state-merge object. Two
 * independently-firing gates:
 *
 *   1. Year boundary. `shouldAutoCheckpoint(nextWeeksLived)` is true
 *      every WEEKS_PER_YEAR weeks. Label: `Age <yearAge>` where
 *      `yearAge = floor(ADULTHOOD_AGE + nextWeeksLived / WEEKS_PER_YEAR)`.
 *      Snapshot uses the SYNTHETIC post-tick state (prevState + newStats
 *      + nextWeeksLived) so the checkpoint reflects what the player just
 *      finished, not what they started the tick with.
 *   2. Pre-death snapshot. `newShowDeathPopup && !prevState.showDeathPopup`.
 *      Label: `Before Death`. CRUCIALLY uses `prevState` UNMODIFIED — the
 *      checkpoint captures the moment BEFORE the death-triggering decay
 *      so the player can rewind to a still-alive state. Preserved 1:1.
 *
 * Both gates can fire in the same tick. If both fire, the year-boundary
 * checkpoint is added first, then the pre-death one. Order matters for
 * `addCheckpoint`'s slot-rotation logic.
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the catalog of checkpoint
 * slots + snapshot serialization can throw on edge cases; legacy code
 * silently logged and returned `{}` so the state-merge could still succeed.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `{ partial: { checkpoints } }` on success.
 *   - `{ partial: {} }` (empty) when neither gate fires or on throw.
 */

import type { GameState, GameStats } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { ADULTHOOD_AGE, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import {
  shouldAutoCheckpoint,
  createCheckpoint,
  addCheckpoint,
} from '@/lib/timeMachine/checkpointSystem';
import { decayCommitmentLevels } from '@/lib/commitments/commitmentSystem';

export interface AutoCheckpointInput {
  prevState: GameState;
  newStats: GameStats;
  nextWeeksLived: number;
  /** True when the death popup is being shown for the first time this tick. */
  newShowDeathPopup: boolean;
}

export interface AutoCheckpointResult {
  partial: {
    checkpoints?: GameState['checkpoints'];
    /**
     * Weekly-decayed activity commitment levels (see below). Present only when the
     * player has an `activityCommitments` slice — otherwise omitted so the final
     * `...prevState` passthrough is preserved untouched.
     */
    activityCommitments?: GameState['activityCommitments'];
  };
}

export function applyAutoCheckpoint(input: AutoCheckpointInput): AutoCheckpointResult {
  // ---------------------------------------------------------------------------
  // Weekly activity-commitment decay (Fix 5a).
  // ---------------------------------------------------------------------------
  // `decayCommitmentLevels` (lib/commitments) had ZERO callers, so committed
  // levels never dropped and the ActivityCommitmentModal's bars never moved. The
  // natural once-per-tick composition point is inside GameActionsContext.nextWeek,
  // which is owned by another agent this wave. This reducer is a clean host: it
  // already runs exactly once per tick and its `.partial` is spread into the final
  // nextState AFTER `...prevState`, so returning a decayed `activityCommitments`
  // here overrides the passthrough and PERSISTS the decay — without editing the
  // forbidden composition point. It is immutable (never mutates prevState) and
  // idempotent under a double-invoked updater (recomputed from prevState each
  // time), and pure arithmetic so the weekly tick stays deterministic. Only areas
  // that are NOT the primary/secondary commitment decay, by 1/wk, floored at 0.
  const activityCommitments = input.prevState.activityCommitments
    ? {
        ...input.prevState.activityCommitments,
        commitmentLevels: decayCommitmentLevels(input.prevState.activityCommitments),
      }
    : undefined;
  const decayPartial = activityCommitments ? { activityCommitments } : {};

  try {
    // The legacy code ALWAYS returns `{ checkpoints: currentCheckpoints }`
    // (including when neither gate fires) — `prevState.checkpoints ?? []`
    // means an undefined slice becomes `[]` in the final state. Preserved 1:1.
    let currentCheckpoints = input.prevState.checkpoints ?? [];

    if (shouldAutoCheckpoint(input.nextWeeksLived)) {
      const yearAge = Math.floor(ADULTHOOD_AGE + input.nextWeeksLived / WEEKS_PER_YEAR);
      const cp = createCheckpoint(
        { ...input.prevState, stats: input.newStats, weeksLived: input.nextWeeksLived },
        `Age ${yearAge}`,
      );
      currentCheckpoints = addCheckpoint(currentCheckpoints, cp);
    }

    // Pre-death checkpoint snapshots the PREVIOUS week's state (before
    // death-triggering decay) — so the player can rewind to alive state.
    if (input.newShowDeathPopup && !input.prevState.showDeathPopup) {
      const deathCp = createCheckpoint(input.prevState, 'Before Death');
      currentCheckpoints = addCheckpoint(currentCheckpoints, deathCp);
    }

    return { partial: { ...decayPartial, checkpoints: currentCheckpoints } };
  } catch (cpErr) {
    logger.error('[TIME_MACHINE] Checkpoint error:', cpErr);
    // Even on a checkpoint failure, still persist the commitment decay.
    return { partial: { ...decayPartial } };
  }
}

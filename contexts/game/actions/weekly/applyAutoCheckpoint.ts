/**
 * Auto-checkpoint creation — R7 Phase 2 step 2.8-C.
 *
 * Scope: previously an inline IIFE in `GameActionsContext.tsx:1587-1616`
 * (~30 lines) spread into the final state-merge object. ONE gate:
 *
 *   1. Year boundary. `shouldAutoCheckpoint(nextWeeksLived)` is true
 *      every WEEKS_PER_YEAR weeks. Label: `Age <yearAge>` where
 *      `yearAge = floor(ADULTHOOD_AGE + nextWeeksLived / WEEKS_PER_YEAR)`.
 *      Snapshot uses the SYNTHETIC post-tick state (prevState + newStats
 *      + nextWeeksLived) so the checkpoint reflects what the player just
 *      finished, not what they started the tick with.
 *
 * A second gate used to snapshot `prevState` as "Before Death" on the tick
 * that killed you. It is gone — see the note at the removal site. In short, a
 * 500-gem rewind to it returned a living character one week older, which is
 * what Revive charges thousands for and what the $2.99 Revival Pack sells.
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

    // ── No pre-death checkpoint ──────────────────────────────────────────
    // There used to be one: on the tick that killed you, the PREVIOUS week's
    // state was snapshotted as "Before Death" so you could rewind to being
    // alive. It undercut the whole death economy. Rewinding to it cost
    // `BASE_REWIND_COST` - 500 gems - and handed back a living character one
    // week older, which is what Revive charges thousands for and what the
    // $2.99 Revival Pack sells. Nobody informed would ever have bought either.
    //
    // Year checkpoints stay, because they are a genuinely different product:
    // they cost you up to a year of progress, so paying to use one is a real
    // trade rather than a discount on dying.
    //
    // Removing it also gives back a slot. `MAX_CHECKPOINTS` is 3 and each is a
    // ~50-100KB clone, so the death snapshot was evicting a real year
    // checkpoint from the ring AND paying save size for the privilege.

    return { partial: { ...decayPartial, checkpoints: currentCheckpoints } };
  } catch (cpErr) {
    logger.error('[TIME_MACHINE] Checkpoint error:', cpErr);
    // Even on a checkpoint failure, still persist the commitment decay.
    return { partial: { ...decayPartial } };
  }
}

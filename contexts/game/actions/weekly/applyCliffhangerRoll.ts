/**
 * End-of-week cliffhanger roll — R7 Phase 2 step 2.10.
 *
 * Scope: previously inline in `GameActionsContext.tsx:1136-1156` (~21 lines).
 * SYMMETRIC counterpart to `applyCliffhangerResolution` (2.7-C):
 *
 *   - 2.7-C runs at the START of the tick — if a pending cliffhanger was
 *     SET LAST WEEK, inject its resolve event into pendingEvents.
 *   - 2.10 runs at the END of the tick — small chance (~7%, ~10% in the first
 *     12 weeks) to SET a new teaser that will resolve next week.
 *
 * Calls `rollCliffhanger(syntheticState, nextWeeksLived)` (the seed is
 * the absolute week so re-runs are deterministic per week). On hit,
 * returns the new `pendingCliffhanger` plus the teaser text. The caller
 * attaches the teaser to `weekResult.cliffhangerTeaser` for display.
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the roller looks up a
 * catalog of cliffhanger definitions; a missing/malformed entry throws
 * and the legacy code silently logs and returns null.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `pendingCliffhanger` — the new pending entry, or undefined when no
 *     cliffhanger fires (or on throw). Written to gameState.pendingCliffhanger.
 *   - `teaser` — the teaser text on fire, or null. Caller attaches to
 *     weekResult for the result sheet to display.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { rollCliffhanger } from '@/lib/events/cliffhangerEvents';

export interface CliffhangerRollInput {
  prevState: GameState;
  /** `prevState.weeksLived + 1`. Also doubles as the RNG seed. */
  nextWeeksLived: number;
}

type PendingCliffhanger = NonNullable<GameState['pendingCliffhanger']>;

export interface CliffhangerRollResult {
  pendingCliffhanger: PendingCliffhanger | undefined;
  teaser: string | null;
}

export function applyCliffhangerRoll(input: CliffhangerRollInput): CliffhangerRollResult {
  try {
    const cliffResult = rollCliffhanger(
      {
        ...input.prevState,
        weeksLived: input.nextWeeksLived,
        pendingCliffhanger: input.prevState.pendingCliffhanger,
      },
      input.nextWeeksLived,
    );
    if (cliffResult) {
      logger.info(`[CLIFFHANGER] Set: "${cliffResult.teaser}"`);
      return {
        pendingCliffhanger: {
          teaser: cliffResult.teaser,
          resolveEventId: cliffResult.resolveEventId,
          setWeeksLived: input.nextWeeksLived + 1,
        },
        teaser: cliffResult.teaser,
      };
    }
  } catch (cliffErr) {
    logger.error('[CLIFFHANGER] Roll failed:', cliffErr);
  }
  return { pendingCliffhanger: undefined, teaser: null };
}

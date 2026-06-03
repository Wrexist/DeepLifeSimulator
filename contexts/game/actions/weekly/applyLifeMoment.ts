/**
 * Weekly life moment generation — R7 Phase 2 step 2.7-D.
 *
 * Scope: previously inline in `GameActionsContext.tsx:1004-1034` (~31 lines).
 *
 *   1. Call `generateLifeMoment(<synthetic state with nextWeeksLived>)`.
 *      The generator internally gates on `state.lifeMoments?.pendingMoment`
 *      (returns null if one is already pending) plus its own cooldowns —
 *      we just forward the result here.
 *   2. If a moment was generated, merge it into `lifeMoments` along with
 *      `lastMomentWeek = nextWeeksLived` and incremented counters.
 *   3. If NO moment was generated, preserve the existing `lifeMoments`
 *      state (or initialize a fresh zero-valued object if none exists).
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the generator can throw
 * on malformed state shapes; the legacy code silently logs and falls
 * through to the no-moment branch.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `updatedLifeMoments` — written to gameState.lifeMoments later.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { generateLifeMoment } from '@/lib/lifeMoments/lifeMomentGenerator';

type LifeMomentsSlice = GameState['lifeMoments'];

export interface LifeMomentInput {
  prevState: GameState;
  /** `prevState.weeksLived + 1`. */
  nextWeeksLived: number;
}

export interface LifeMomentResult {
  updatedLifeMoments: LifeMomentsSlice;
}

const EMPTY_LIFE_MOMENTS: NonNullable<LifeMomentsSlice> = {
  lastMomentWeek: 0,
  momentsThisWeek: 0,
  totalMoments: 0,
  pendingMoment: undefined,
};

export function applyLifeMoment(input: LifeMomentInput): LifeMomentResult {
  let newLifeMoment;
  try {
    newLifeMoment = generateLifeMoment({
      ...input.prevState,
      weeksLived: input.nextWeeksLived,
    });
  } catch (momentError) {
    logger.error('[WEEK PROGRESSION] Life moment generation failed:', momentError);
  }

  if (newLifeMoment) {
    return {
      updatedLifeMoments: {
        ...(input.prevState.lifeMoments || {}),
        pendingMoment: newLifeMoment,
        lastMomentWeek: input.nextWeeksLived,
        momentsThisWeek: (input.prevState.lifeMoments?.momentsThisWeek || 0) + 1,
        totalMoments: (input.prevState.lifeMoments?.totalMoments || 0) + 1,
      },
    };
  }

  // Preserve existing lifeMoments state but fall back to an initialized zero-valued
  // object if none exists.
  return {
    updatedLifeMoments: input.prevState.lifeMoments || EMPTY_LIFE_MOMENTS,
  };
}

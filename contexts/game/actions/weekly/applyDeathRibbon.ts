/**
 * Death ribbon awarding — R7 Phase 2 step 2.8-B.
 *
 * Scope: previously an inline IIFE in `GameActionsContext.tsx:1396-1412`
 * (~15 lines) spread into the final state-merge object. Fires ONLY when
 * the player just died this tick (`newShowDeathPopup &&
 * !prevState.showDeathPopup`) — the new-edge detection prevents the
 * ribbon from being re-awarded on every subsequent tick while the
 * death popup is still showing.
 *
 *   1. Classify the just-completed life via `classifyLife(state)` — the
 *      passed state is a synthetic "post-tick" view (prevState + the
 *      mutated newStats + nextWeeksLived).
 *   2. Add the resulting ribbon to the collection via
 *      `addRibbonToCollection`. The library handles dedupe + ordering.
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the classifier and
 * collection-merger touch a large ribbon catalog; the legacy code silently
 * logged and returned an empty partial on any throw so the state-merge
 * could still succeed.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `{ ribbonCollection }` partial on success (caller spreads into state).
 *   - `{}` (empty) when death didn't just happen, or on throw.
 */

import type { GameState, GameStats } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { classifyLife, addRibbonToCollection } from '@/lib/legacy/ribbonSystem';

export interface DeathRibbonInput {
  prevState: GameState;
  newStats: GameStats;
  nextWeeksLived: number;
  /** True when the death popup is being shown for the first time this tick. */
  newShowDeathPopup: boolean;
}

export interface DeathRibbonResult {
  /** Partial fragment for the state-merge object. Empty when no fire. */
  partial: { ribbonCollection?: GameState['ribbonCollection'] };
}

export function applyDeathRibbon(input: DeathRibbonInput): DeathRibbonResult {
  if (!input.newShowDeathPopup || input.prevState.showDeathPopup) {
    return { partial: {} };
  }
  try {
    const syntheticState = {
      ...input.prevState,
      stats: input.newStats,
      weeksLived: input.nextWeeksLived,
    };
    const ribbon = classifyLife(syntheticState);
    const updatedCollection = addRibbonToCollection(
      input.prevState.ribbonCollection,
      ribbon,
      syntheticState,
    );
    logger.info(`[RIBBON] Life classified as: ${ribbon.name} (${ribbon.emoji})`);
    return { partial: { ribbonCollection: updatedCollection } };
  } catch (ribbonErr) {
    logger.error('[RIBBON] Classification failed:', ribbonErr);
    return { partial: {} };
  }
}

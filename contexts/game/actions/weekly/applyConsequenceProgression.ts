/**
 * Weekly consequence progression — R7 Phase 2 step 2.8-A.
 *
 * Scope: previously inline in `GameActionsContext.tsx:374-397` (~21 lines).
 *
 *   1. Call `processConsequenceProgression(prevState)` which advances any
 *      delayed/pending consequences toward their activation week.
 *   2. Initialize a baseline consequence state (`initializeConsequenceState`)
 *      and shallow-merge the result over it. This is what handles both the
 *      "first tick after save migration" case (no consequenceState yet) and
 *      the "normal progression" case (existing state + new partial diffs).
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the consequence progressor
 * can throw on a malformed save (e.g. a consequence with no `weekTrigger`
 * field); the legacy code silently logs and falls back to either the
 * existing consequenceState or a freshly-initialized one.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `mergedConsequenceState` — written to gameState.consequenceState later.
 */

import type { GameState } from '@/contexts/game/types';
import type { ConsequenceState } from '@/lib/lifeMoments/types';
import { logger } from '@/utils/logger';
import {
  processConsequenceProgression,
  initializeConsequenceState,
} from '@/lib/lifeMoments/consequenceTracker';

export interface ConsequenceProgressionResult {
  mergedConsequenceState: ConsequenceState;
}

export function applyConsequenceProgression(prevState: GameState): ConsequenceProgressionResult {
  let mergedConsequenceState: ConsequenceState;
  try {
    const updatedConsequenceState = processConsequenceProgression(prevState);
    const currentConsequenceState = initializeConsequenceState(prevState);
    mergedConsequenceState = {
      ...currentConsequenceState,
      ...updatedConsequenceState,
    };
  } catch (consequenceError) {
    logger.error('[WEEK PROGRESSION] Consequence progression failed:', consequenceError);
    mergedConsequenceState = prevState.consequenceState || initializeConsequenceState(prevState);
  }
  return { mergedConsequenceState };
}

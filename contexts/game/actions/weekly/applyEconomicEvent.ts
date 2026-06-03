/**
 * Weekly economic event roll — R7 Phase 2 step 2.7-A.
 *
 * Scope: previously inline in `GameActionsContext.tsx:937-948` (~12 lines).
 * If `shouldTriggerEconomicEvent(prevState)` says yes, generate a new
 * economic event and merge it into `economy.economyEvents`. Otherwise the
 * economy slice passes through unchanged.
 *
 * The try/catch is PRESERVED VERBATIM from the inline code. Reason:
 * `generateEconomicEvent` is impure (RNG + time-dependent), and tests can
 * inject failing impls; on any throw, the tick should silently continue
 * with the previous economy state and log an error. Removing the swallow
 * would be a behavior change.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 * No ctx mutations.
 *
 * Returns:
 *   - `updatedEconomy` — either `prevState.economy` (no trigger or error)
 *     or `{ ...prevState.economy, economyEvents: <new> }`.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { shouldTriggerEconomicEvent, generateEconomicEvent } from '@/lib/events/economyEvents';

export interface EconomicEventResult {
  updatedEconomy: GameState['economy'];
}

export function applyEconomicEvent(prevState: GameState): EconomicEventResult {
  let updatedEconomy = prevState.economy;
  try {
    if (shouldTriggerEconomicEvent(prevState)) {
      const newEconomicState = generateEconomicEvent(prevState);
      updatedEconomy = {
        ...prevState.economy,
        economyEvents: newEconomicState,
      };
    }
  } catch (error) {
    logger.error('[WEEK PROGRESSION] Economic event generation failed:', error);
  }
  return { updatedEconomy };
}

/**
 * Weekly events generation + pending-event cap — R7 Phase 2 step 2.7-B.
 *
 * Scope: previously inline in `GameActionsContext.tsx:950-982` (~33 lines).
 *
 *   1. Build a synthetic state with updated economy + advanced week
 *      values (so `rollWeeklyEvents` sees the post-tick world, not the
 *      pre-tick world).
 *   2. Call `rollWeeklyEvents(stateForEventGeneration)` and stamp each
 *      result with `generatedAtWeeksLived: nextWeeksLived`. The stamp is
 *      what lets persistence safely retain unresolved events across
 *      saves — otherwise the cyclic `state.week` (1-4) is unable to
 *      identify how old an event is.
 *   3. Append to `prevState.pendingEvents`. Cap at `MAX_PENDING_EVENTS = 100`
 *      by dropping the OLDEST (slice(-100)). ANTI-BLOAT: players who skip
 *      events accumulate them indefinitely; over a full life that grows
 *      ~131KB/1000 weeks of save data. Keep recent prompts visible, stays
 *      well above any realistic interactive load.
 *
 * The try/catch around `rollWeeklyEvents` is PRESERVED VERBATIM. Reason:
 * the generator depends on RNG + several lookup tables (events catalog,
 * economy state); a runtime error must not kill the tick — log and skip.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `updatedPendingEvents` — written to gameState.pendingEvents later.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { rollWeeklyEvents } from '@/lib/events/engine';

export const MAX_PENDING_EVENTS = 100;

export interface WeeklyEventsInput {
  prevState: GameState;
  /** From `applyEconomicEvent({...}).updatedEconomy` — the post-roll economy. */
  updatedEconomy: GameState['economy'];
  /** `prevState.weeksLived + 1`. */
  nextWeeksLived: number;
  /** Cyclic UI value, 1-4. */
  nextWeek: number;
}

export interface WeeklyEventsResult {
  updatedPendingEvents: NonNullable<GameState['pendingEvents']>;
  /**
   * Count of events generated this tick (BEFORE stamping / appending / capping).
   * Caller uses this to update `lastEventWeeksLived` for the event-pity system:
   * if at least one event was generated, the pity counter resets to nextWeeksLived.
   */
  newEventCount: number;
}

export function applyWeeklyEvents(input: WeeklyEventsInput): WeeklyEventsResult {
  const stateForEventGeneration = {
    ...input.prevState,
    economy: input.updatedEconomy,
    weeksLived: input.nextWeeksLived,
    week: input.nextWeek,
  };

  let newEvents: any[] = [];
  try {
    newEvents = rollWeeklyEvents(stateForEventGeneration);
  } catch (eventError) {
    logger.error('[WEEK PROGRESSION] Event generation failed:', eventError);
    // Continue without new events
  }

  const stampedNewEvents = newEvents.map((event: any) => ({
    ...event,
    generatedAtWeeksLived: input.nextWeeksLived,
  }));
  let updatedPendingEvents = [
    ...(input.prevState.pendingEvents || []),
    ...stampedNewEvents,
  ];

  if (updatedPendingEvents.length > MAX_PENDING_EVENTS) {
    updatedPendingEvents = updatedPendingEvents.slice(-MAX_PENDING_EVENTS);
  }

  return { updatedPendingEvents, newEventCount: newEvents.length };
}

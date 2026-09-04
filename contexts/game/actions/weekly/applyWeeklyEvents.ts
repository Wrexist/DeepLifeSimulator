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
 *   3. Append to `prevState.pendingEvents`, SKIPPING any event whose id is
 *      already queued unresolved (see the dedupe note below). Cap at
 *      `MAX_PENDING_EVENTS = 100` by dropping the OLDEST (slice(-100)).
 *      ANTI-BLOAT: players who skip events accumulate them indefinitely; over a
 *      full life that grows ~131KB/1000 weeks of save data. Keep recent prompts
 *      visible, stays well above any realistic interactive load.
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

  /**
   * An event id may appear in the queue AT MOST ONCE.
   *
   * PLAYER REPORT (BBQ, 2026-08-31): "There are too many frequent pop ups of
   * events that have already happened. They pop up every time the game is
   * refreshed. In this manner are they re-occurring."
   *
   * `rollWeeklyEvents` never consulted `pendingEvents`, so a template it picked
   * again while an unresolved copy was still queued was simply appended - and an
   * event id IS the template id, so the two copies are indistinguishable in the
   * modal, in the inbox and in the log. Two things follow, and the player hit
   * both. The same prompt is presented twice, which reads as an event that
   * "already happened". And answering it only clears one: `resolveEvent` removes
   * a single entry by index, so the duplicate is still there on the next open -
   * "every time the game is refreshed". (The modal's emergency dismiss removes
   * every copy by id, so the two paths did not even agree.)
   *
   * Dropping the re-roll rather than the queued copy is the conservative choice:
   * the queued one may already be stamped, routed to the mail app, or carrying an
   * expiry, and it is the one the player has seen.
   */
  const existingPending = input.prevState.pendingEvents || [];
  const queuedIds = new Set(existingPending.map((e) => e?.id).filter(Boolean));
  const freshEvents = stampedNewEvents.filter((event: any) => {
    if (!event?.id) return true;
    if (queuedIds.has(event.id)) {
      logger.info(`[EVENTS] Skipped duplicate '${event.id}' - an unresolved copy is already queued.`);
      return false;
    }
    // Guard the batch against itself too: one tick can roll several sources.
    queuedIds.add(event.id);
    return true;
  });

  let updatedPendingEvents = [
    ...existingPending,
    ...freshEvents,
  ];

  if (updatedPendingEvents.length > MAX_PENDING_EVENTS) {
    updatedPendingEvents = updatedPendingEvents.slice(-MAX_PENDING_EVENTS);
  }

  return { updatedPendingEvents, newEventCount: newEvents.length };
}

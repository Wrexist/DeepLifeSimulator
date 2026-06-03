/**
 * Weekly cliffhanger resolution — R7 Phase 2 step 2.7-C.
 *
 * Scope: previously inline in `GameActionsContext.tsx:984-1002` (~19 lines).
 * If `prevState.pendingCliffhanger` is set, call `resolveCliffhanger` with
 * its `resolveEventId` and the post-tick synthetic state. If the resolver
 * returns an event, stamp it with `generatedAtWeeksLived: nextWeeksLived`
 * and APPEND to `pendingEvents` (after the `applyWeeklyEvents` cap step).
 *
 * The append happens UNCAPPED — i.e. a cliffhanger resolution can push
 * `pendingEvents` to 101 entries even after `applyWeeklyEvents` capped
 * at 100. Preserved 1:1 from the legacy inline code.
 *
 * The try/catch is PRESERVED VERBATIM. Reason: the cliffhanger resolver
 * looks up a static event by id; a missing/malformed id throws. The legacy
 * code silently logs and continues — must keep that.
 *
 * Pure with respect to inputs (apart from logger / module side effects).
 *
 * Returns:
 *   - `updatedPendingEvents` — either unchanged input array (no
 *     cliffhanger / lookup miss / throw) or `[...input, <resolveEvent>]`.
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { resolveCliffhanger } from '@/lib/events/cliffhangerEvents';

export interface CliffhangerResolutionInput {
  prevState: GameState;
  /** Output of `applyWeeklyEvents` — appended to in-place is fine since this
   * step always returns a NEW array. */
  pendingEventsAfterWeekly: NonNullable<GameState['pendingEvents']>;
  /** `prevState.weeksLived + 1`. */
  nextWeeksLived: number;
}

export interface CliffhangerResolutionResult {
  updatedPendingEvents: NonNullable<GameState['pendingEvents']>;
}

export function applyCliffhangerResolution(
  input: CliffhangerResolutionInput,
): CliffhangerResolutionResult {
  if (!input.prevState.pendingCliffhanger) {
    return { updatedPendingEvents: input.pendingEventsAfterWeekly };
  }

  try {
    const resolveEvent = resolveCliffhanger(input.prevState.pendingCliffhanger.resolveEventId, {
      ...input.prevState,
      weeksLived: input.nextWeeksLived,
    });
    if (resolveEvent) {
      logger.info(`[CLIFFHANGER] Resolved: ${input.prevState.pendingCliffhanger.resolveEventId}`);
      return {
        updatedPendingEvents: [
          ...input.pendingEventsAfterWeekly,
          {
            ...resolveEvent,
            generatedAtWeeksLived: input.nextWeeksLived,
          },
        ],
      };
    }
  } catch (cliffErr) {
    logger.error('[CLIFFHANGER] Resolution failed:', cliffErr);
  }
  return { updatedPendingEvents: input.pendingEventsAfterWeekly };
}

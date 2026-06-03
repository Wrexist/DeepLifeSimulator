/**
 * Weekly scheduled-wedding handling — R7 Phase 2 step 2.6-iii-C.
 *
 * Scope: the two per-rel branches previously inline in
 * `GameActionsContext.tsx:882-917` (~35 lines). Three anti-exploit gates:
 *
 *   1. Execute. `rel.weddingPlanned.scheduledWeek === nextWeeksLived` AND
 *      the player can afford the remaining 75% of the budget → charge
 *      `floor(budget * 0.75)`, promote to spouse, +20 score, clear
 *      `weeksAtLowRelationship`, raise the wedding popup.
 *   2. Postpone or expire (insufficient funds). `scheduledWeek == this
 *      week` but player can't afford the balance → postpone +4 weeks UNLESS
 *      the wedding is already 1 calendar year past its original date,
 *      in which case the plan expires (deposit forfeited, -15 score).
 *   3. Stale cleanup. Any wedding still on file whose `scheduledWeek` is
 *      more than 1 year in the past (e.g. left over from a save migration
 *      or a player who never came back) → clear plan, -10 score.
 *
 * Side effects on `ctx`:
 *   - `ctx.newStats.money` — decremented by `remainingBalance` on execute.
 *
 * Returns:
 *   - `null` when none of the three gates fire (caller falls through to
 *     subsequent branches in the per-rel reducer).
 *   - `{ rel: <updated>, weddingPopup: { partnerName } | null }` when one
 *     of the gates fired. `weddingPopup` is non-null ONLY on the execute
 *     path. The caller assigns it to `newShowWeddingPopup` /
 *     `newWeddingPartnerName` closure vars.
 *
 * Pure with respect to `rel` (always spreads, never mutates).
 */

import type { Relationship } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { clampRelationshipScore } from '@/utils/stateValidation';
import type { WeekContext } from './weekContext';

export interface ScheduledWeddingResult {
  rel: Relationship;
  weddingPopup: { partnerName: string } | null;
}

export function applyScheduledWedding(
  rel: Relationship,
  ctx: WeekContext,
): ScheduledWeddingResult | null {
  const nextWeeksLived = ctx.nextWeeksLived;

  // Gate 1+2: wedding scheduled for THIS exact week.
  if (rel.weddingPlanned && rel.weddingPlanned.scheduledWeek === nextWeeksLived) {
    // ANTI-EXPLOIT: Deduct remaining 75% of wedding budget on auto-execution
    // Prevents exploit where player plans wedding (pays 25% deposit) but gets married for free
    const weddingBudget = rel.weddingPlanned.budget || 0;
    const remainingBalance = Math.floor(weddingBudget * 0.75);
    if (ctx.newStats.money >= remainingBalance) {
      ctx.newStats.money -= remainingBalance;
      logger.info(
        `[WEDDING] Wedding happening for ${rel.name} in week ${nextWeeksLived}! Charged $${remainingBalance} remaining balance.`,
      );
      return {
        rel: {
          ...rel,
          type: 'spouse' as const,
          weddingPlanned: undefined,
          relationshipScore: clampRelationshipScore(rel.relationshipScore + 20),
          weeksAtLowRelationship: 0,
        },
        weddingPopup: { partnerName: rel.name },
      };
    }
    // Can't afford wedding - postpone by 4 weeks, but expire after WEEKS_PER_YEAR weeks from original date
    const originalScheduled = rel.weddingPlanned.scheduledWeek || nextWeeksLived;
    const weddingAge = nextWeeksLived - originalScheduled;
    if (weddingAge >= WEEKS_PER_YEAR) {
      // ANTI-EXPLOIT: Wedding plan expires after 1 year - deposit forfeited
      logger.info(
        `[WEDDING] Wedding plan for ${rel.name} expired after ${WEEKS_PER_YEAR} weeks. Deposit forfeited.`,
      );
      return {
        rel: {
          ...rel,
          weddingPlanned: undefined,
          relationshipScore: clampRelationshipScore(rel.relationshipScore - 15),
        },
        weddingPopup: null,
      };
    }
    logger.info(
      `[WEDDING] Can't afford wedding for ${rel.name} ($${remainingBalance} needed). Postponed 4 weeks.`,
    );
    return {
      rel: {
        ...rel,
        weddingPlanned: { ...rel.weddingPlanned, scheduledWeek: nextWeeksLived + 4 },
      },
      weddingPopup: null,
    };
  }

  // Gate 3: stale cleanup — wedding still on file but >1yr past its scheduled date.
  if (
    rel.weddingPlanned &&
    rel.weddingPlanned.scheduledWeek &&
    rel.weddingPlanned.scheduledWeek < nextWeeksLived - WEEKS_PER_YEAR
  ) {
    logger.info(`[WEDDING] Stale wedding plan for ${rel.name} cleaned up.`);
    return {
      rel: {
        ...rel,
        weddingPlanned: undefined,
        relationshipScore: clampRelationshipScore(rel.relationshipScore - 10),
      },
      weddingPopup: null,
    };
  }

  return null;
}

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
 *   - `ctx.notifications.push(...)` — on postpone and on expiry. See the note on
 *     gate 2: both used to be silent, which is what "the wedding is planned but
 *     never occurs" looks like from the outside.
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
import { WEEKS_PER_YEAR, WEDDING_REMAINDER_RATE } from '@/lib/config/gameConstants';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { buildSpouseRecord } from '@/lib/dating/spouseRecord';
import type { WeekContext } from './weekContext';

export interface ScheduledWeddingResult {
  rel: Relationship;
  weddingPopup: { partnerName: string } | null;
  /**
   * Set (to the just-married relationship) ONLY on the execute path.
   * The caller must mirror `executeWedding` (DatingActions.ts) and write
   * this into `family.spouse` — otherwise a scheduled wedding leaves
   * `family` inconsistent with `relationships` (spouse in one, not the
   * other).
   */
  familySpouse: Relationship | null;
}

export function applyScheduledWedding(
  rel: Relationship,
  ctx: WeekContext,
): ScheduledWeddingResult | null {
  const nextWeeksLived = ctx.nextWeeksLived;

  // P1-2: if the relationship is ALREADY a spouse but still carries a planned
  // wedding (e.g. an event-resolution "marry" path promoted to spouse without
  // clearing the plan), drop the stale plan WITHOUT charging again. Otherwise
  // Gate 1 below would deduct the remaining 75% a second time on the scheduled
  // week — a double-charge for one wedding.
  if (rel.type === 'spouse' && rel.weddingPlanned) {
    logger.info(`[WEDDING] Clearing leftover wedding plan for spouse ${rel.name} (no re-charge).`);
    return {
      rel: { ...rel, weddingPlanned: undefined },
      weddingPopup: null,
      familySpouse: null,
    };
  }

  // Gate 1+2: wedding scheduled for THIS exact week.
  if (rel.weddingPlanned && rel.weddingPlanned.scheduledWeek === nextWeeksLived) {
    // ANTI-EXPLOIT: Deduct remaining 75% of wedding budget on auto-execution
    // Prevents exploit where player plans wedding (pays 25% deposit) but gets married for free
    const weddingBudget = rel.weddingPlanned.budget || 0;
    const remainingBalance = Math.floor(weddingBudget * WEDDING_REMAINDER_RATE);
    if (ctx.newStats.money >= remainingBalance) {
      ctx.newStats.money -= remainingBalance;
      logger.info(
        `[WEDDING] Wedding happening for ${rel.name} in week ${nextWeeksLived}! Charged $${remainingBalance} remaining balance.`,
      );
      // Build the spouse record via the shared factory so this auto path and
      // the manual executeWedding (DatingActions.ts) can never drift - the two
      // are reached purely by timing, so they must produce identical spouse
      // shapes. (The auto path previously set only type/score, leaving
      // marriageWeek + anniversaryWeek undefined, which permanently disabled
      // anniversaries and left stale engagement flags on a married partner.)
      // The +20 score / weeksAtLowRelationship reset are this path's own reward,
      // layered on top of the shared shape.
      const marriedRel: Relationship = {
        ...buildSpouseRecord(rel, nextWeeksLived),
        relationshipScore: clampRelationshipScore(rel.relationshipScore + 20),
        weeksAtLowRelationship: 0,
      };
      return {
        rel: marriedRel,
        weddingPopup: { partnerName: rel.name },
        // Mirror executeWedding (DatingActions.ts): family.spouse must be
        // set to the updated relationship on wedding execution.
        familySpouse: marriedRel,
      };
    }
    // Can't afford wedding - postpone by 4 weeks, but expire after WEEKS_PER_YEAR weeks from original date
    // R3-F6: measure from the ORIGINAL date. This read `scheduledWeek`, which
    // the enclosing gate has just asserted equals `nextWeeksLived` - so
    // `weddingAge` was always 0 and the expiry below was unreachable. The
    // postpone path then rewrote `scheduledWeek` to `nextWeeksLived + 4`,
    // discarding the original, so a player who could not afford the balance was
    // postponed +4 weeks indefinitely - holding the engagement slot forever,
    // which `findCommittedPartner` and `planWedding`'s bigamy gate then use to
    // block any other engagement. The documented "expires after 1 year, deposit
    // forfeited" anti-exploit never fired once.
    const originalScheduled =
      rel.weddingPlanned.originalScheduledWeek ?? rel.weddingPlanned.scheduledWeek ?? nextWeeksLived;
    const weddingAge = nextWeeksLived - originalScheduled;
    if (weddingAge >= WEEKS_PER_YEAR) {
      // ANTI-EXPLOIT: Wedding plan expires after 1 year - deposit forfeited
      logger.info(
        `[WEDDING] Wedding plan for ${rel.name} expired after ${WEEKS_PER_YEAR} weeks. Deposit forfeited.`,
      );
      // Also silent until now, and this one takes the deposit and 15 points of
      // relationship with it - the single most expensive thing that can happen
      // to a player without being told.
      ctx.notifications.push({
        id: `wedding-expired-${rel.id}`,
        title: 'Wedding Called Off',
        message:
          `A year past the date and the balance was still unpaid, so the venue cancelled the ` +
          `wedding to ${rel.name} and kept the deposit. You are still engaged - plan a wedding ` +
          `you can afford when you are ready.`,
      });
      return {
        rel: {
          ...rel,
          weddingPlanned: undefined,
          relationshipScore: clampRelationshipScore(rel.relationshipScore - 15),
        },
        weddingPopup: null,
        familySpouse: null,
      };
    }
    logger.info(
      `[WEDDING] Can't afford wedding for ${rel.name} ($${remainingBalance} needed). Postponed 4 weeks.`,
    );
    /**
     * PLAYER REPORT (BBQ, 2026-08-31): "The wedding is planned but never occurs.
     * Forever engaged... After about a year can re-plan the wedding and it works
     * as intended."
     *
     * That is this branch, seen from outside the code. The postponement was
     * announced to `logger.info` and to nobody else: the player is told at
     * planning time that the wedding "happens on its week", the week arrives,
     * the balance is short by any amount, and the date silently slides four
     * weeks - over and over, until gate 2's one-year expiry finally clears the
     * plan and lets them re-plan. Nothing in the game ever said why, so the
     * feature reads as broken rather than as a bill they have not paid.
     *
     * A wedding that does not happen is news. Say so, and say what it costs.
     */
    ctx.notifications.push({
      id: `wedding-postponed-${rel.id}`,
      title: 'Wedding Postponed',
      message:
        `The wedding to ${rel.name} could not go ahead - the venue needed the remaining ` +
        `$${remainingBalance.toLocaleString()} and you had $${Math.max(0, Math.floor(ctx.newStats.money)).toLocaleString()}. ` +
        `It is rebooked for 4 weeks' time. The plan is cancelled and the deposit lost if it ` +
        `still cannot go ahead a year after the original date - you can call off the engagement ` +
        `or re-plan a cheaper wedding before then.`,
    });
    return {
      rel: {
        ...rel,
        weddingPlanned: {
          ...rel.weddingPlanned,
          scheduledWeek: nextWeeksLived + 4,
          // Stamp it on the first postponement for a legacy plan, so the
          // expiry clock starts running instead of never starting.
          originalScheduledWeek: originalScheduled,
        },
      },
      weddingPopup: null,
      familySpouse: null,
    };
  }

  // Gate 3: stale cleanup — wedding still on file but >1yr past its scheduled date.
  if (
    rel.weddingPlanned &&
    rel.weddingPlanned.scheduledWeek &&
    rel.weddingPlanned.scheduledWeek < nextWeeksLived - WEEKS_PER_YEAR
  ) {
    logger.info(`[WEDDING] Stale wedding plan for ${rel.name} cleaned up.`);
    ctx.notifications.push({
      id: `wedding-lapsed-${rel.id}`,
      title: 'Wedding Called Off',
      message:
        `The wedding to ${rel.name} was booked more than a year ago and never went ahead, ` +
        `so the venue released the date. You are still engaged - plan a new one when you are ready.`,
    });
    return {
      rel: {
        ...rel,
        weddingPlanned: undefined,
        relationshipScore: clampRelationshipScore(rel.relationshipScore - 10),
      },
      weddingPopup: null,
      familySpouse: null,
    };
  }

  return null;
}

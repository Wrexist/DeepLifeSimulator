/**
 * Shared spouse-record factory.
 *
 * Marriage is reached by two independent paths that MUST produce an identical
 * spouse Relationship shape, or one silently drifts:
 *
 *   1. Manual — `executeWedding` (contexts/game/actions/DatingActions.ts), when
 *      the player taps "execute" on the scheduled week.
 *   2. Automatic — `applyScheduledWedding`
 *      (contexts/game/actions/weekly/applyScheduledWedding.ts), when the weekly
 *      tick resolves a wedding the player left to run.
 *
 * Which path fires is purely a matter of timing, so both must set the same
 * fields. They previously duplicated the field list and drifted: the auto path
 * left `marriageWeek`/`anniversaryWeek` undefined, permanently disabling
 * anniversaries (checkAnniversary bails on `!spouse.anniversaryWeek`) and
 * leaving stale engagement flags on a married partner. Centralizing the shape
 * here guarantees the two paths can never diverge again.
 *
 * This covers ONLY the fields intrinsic to being a spouse. Path-specific
 * rewards (e.g. the auto path's +20 relationshipScore / weeksAtLowRelationship
 * reset, or the manual path's happiness/reputation bonuses and milestone) are
 * layered on by the caller.
 */

import type { Relationship } from '@/contexts/game/types';

/**
 * Convert a partner/engaged relationship into a spouse record.
 *
 * @param rel     the relationship being married
 * @param weekNum absolute week (`weeksLived`) the marriage occurs — stamped as
 *                both `marriageWeek` and `anniversaryWeek`
 */
export function buildSpouseRecord(rel: Relationship, weekNum: number): Relationship {
  return {
    ...rel,
    type: 'spouse' as const,
    marriageWeek: weekNum,
    anniversaryWeek: weekNum,
    // Clear all engagement properties when becoming spouse.
    engagementWeek: undefined,
    engagementRing: undefined,
    weddingPlanned: undefined,
    // Spouses automatically live together.
    livingTogether: true,
  };
}

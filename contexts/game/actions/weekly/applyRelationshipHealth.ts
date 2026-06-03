/**
 * Weekly relationship health — R7 Phase 2 step 2.6-iii-E.
 *
 * Scope: the per-rel breakup / disappointed / healthy-reset / fall-through
 * branches previously inline in `GameActionsContext.tsx:860-920` (~60 lines).
 * Caller invokes for EVERY non-handled rel (i.e. after pregnancy, wedding,
 * and child-aging gates have all returned null/undefined).
 *
 * Internal sub-gates (in order):
 *
 *   1. Low-relationship branch. `(rel.type === 'partner' || 'spouse') &&
 *      rel.relationshipScore < 30`. weeksAtLow := (rel.weeksAtLowRelationship
 *      || 0) + 1. If weeksAtLow >= 2:
 *        a. Breakup roll. `preRolls.relBreakup[relIdx] <
 *           min(0.4, (30 - score)/100)`. Result: rel = null, -25 happiness
 *           penalty, push 'relationship-breakup' notification.
 *        b. ELSE Disappointed roll. `preRolls.relDisappointed[relIdx] < 0.3`.
 *           Result: rel = { ...rel, score-5, weeksAtLow }, -10 happiness
 *           penalty, push 'relationship-disappointed' notification.
 *        c. Neither roll fires → just track weeksAtLow (clamp score).
 *      If weeksAtLow < 2 → just bump the counter (clamp score).
 *
 *   2. Healthy partner/spouse. `(partner | spouse) && score >= 30`.
 *      Reset weeksAtLowRelationship to 0, clamp score.
 *
 *   3. Fall-through (every other rel type — friend, family, etc.).
 *      Clamp score, otherwise unchanged.
 *
 * `preRolls.relBreakup` and `preRolls.relDisappointed` are size-20 arrays.
 * For `relIdx >= 20`, the access returns `undefined`, and `undefined < x`
 * is `false` in JS — so neither roll ever fires for the 21st+ rel.
 * This quirk is PRESERVED VERBATIM (not "fixed") — same as the legacy.
 *
 * Side effects on `ctx`:
 *   - `ctx.notifications.push(...)` — one 'relationship-breakup' OR one
 *     'relationship-disappointed' entry per fire.
 *
 * Returns:
 *   - `rel`: the updated relationship, or `null` on breakup (caller
 *     filters those out at end of map).
 *   - `happinessPenalty`: 0 (no event), -25 (breakup), or -10
 *     (disappointed). Caller accumulates these into a closure variable and
 *     applies the cumulative penalty AFTER the .map() — preserved 1:1.
 */

import type { Relationship } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { clampRelationshipScore } from '@/utils/stateValidation';
import type { WeekContext } from './weekContext';

export interface RelationshipHealthResult {
  rel: Relationship | null;
  happinessPenalty: number;
}

export function applyRelationshipHealth(
  rel: Relationship,
  relIdx: number,
  ctx: WeekContext,
): RelationshipHealthResult {
  const preRolls = ctx.preRolls;

  // Branch 1: low relationship partner/spouse.
  if ((rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore < 30) {
    const weeksAtLow = (rel.weeksAtLowRelationship || 0) + 1;

    if (weeksAtLow >= 2) {
      const breakupChance = Math.min(0.4, (30 - rel.relationshipScore) / 100);
      const disappointedChance = 0.3;

      if (preRolls.relBreakup[relIdx] < breakupChance) {
        logger.info(`[RELATIONSHIP] ${rel.name} broke up due to low relationship (${rel.relationshipScore}%)`);
        ctx.notifications.push({
          id: 'relationship-breakup',
          message: `${rel.name} has ended the relationship. Your relationship score was too low (${rel.relationshipScore}%).`,
          title: '💔 Relationship Ended',
        });
        return { rel: null, happinessPenalty: -25 };
      }

      if (preRolls.relDisappointed[relIdx] < disappointedChance) {
        logger.info(`[RELATIONSHIP] ${rel.name} is disappointed (${rel.relationshipScore}%)`);
        ctx.notifications.push({
          id: 'relationship-disappointed',
          message: `${rel.name} is disappointed with you. Your relationship is at ${rel.relationshipScore}%. Consider going on dates or giving gifts to improve it.`,
          title: '😔 Partner Disappointed',
        });
        return {
          rel: {
            ...rel,
            relationshipScore: clampRelationshipScore(rel.relationshipScore - 5),
            weeksAtLowRelationship: weeksAtLow,
          },
          happinessPenalty: -10,
        };
      }
    }

    // Either weeksAtLow < 2, or no roll fired: track weeksAtLow.
    return {
      rel: {
        ...rel,
        weeksAtLowRelationship: weeksAtLow,
        relationshipScore: clampRelationshipScore(rel.relationshipScore),
      },
      happinessPenalty: 0,
    };
  }

  // Branch 2: healthy partner/spouse — reset the low-week counter.
  if ((rel.type === 'partner' || rel.type === 'spouse') && rel.relationshipScore >= 30) {
    return {
      rel: {
        ...rel,
        weeksAtLowRelationship: 0,
        relationshipScore: clampRelationshipScore(rel.relationshipScore),
      },
      happinessPenalty: 0,
    };
  }

  // Branch 3: every other relationship type — just clamp.
  return {
    rel: {
      ...rel,
      relationshipScore: clampRelationshipScore(rel.relationshipScore),
    },
    happinessPenalty: 0,
  };
}

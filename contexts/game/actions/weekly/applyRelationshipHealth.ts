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
 * `relIdx` is the raw index into the FULL relationships list (parents, children,
 * friends, partners), which is uncapped — so for `relIdx >= 20` the raw access
 * returned `undefined`, and `undefined < x` is `false` in JS, making the 21st+
 * relationship permanently immune to breakup/disappointment. That is the same
 * silent-immunity buffer-overflow class as the pet-sickness lesson (2026-06-21),
 * so the index is now wrapped modulo the buffer length — matching the pet,
 * vehicle, and disease consumers — instead of being preserved as a quirk.
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

/**
 * Score below which a parent / child / friend counts as neglected.
 *
 * Deliberately BELOW the `contactsNeedingAttention` warning threshold (strength
 * < 50) so the Attention tab flags a relationship well before anything happens
 * to it. Warning and consequence must not fire on the same week or the warning
 * is pointless.
 */
export const NEGLECT_THRESHOLD = 25;

/** Sustained weeks below the threshold before a friendship can fade. */
export const FRIEND_DRIFT_MIN_WEEKS = 4;

/** Ceiling on the weekly drift roll — a friendship never evaporates instantly. */
export const FRIEND_DRIFT_MAX_CHANCE = 0.25;

/** Standing weekly happiness cost of one neglected family member or friend. */
export const NEGLECT_HAPPINESS_DRAG = -1;

/**
 * Ceiling on the TOTAL neglect drag one week can apply.
 *
 * The caller accumulates `happinessPenalty` across every relationship, so a
 * player with two parents, three children and a handful of friends all below the
 * threshold would take -6 or worse every week from this branch alone — on top of
 * the partner branch's -10 / -25. Only the final happiness value is clamped, so
 * without a cap a large family is a bigger happiness liability than a neglected
 * marriage, which is not the intent. Applied by the caller.
 */
export const NEGLECT_HAPPINESS_DRAG_CAP = -3;

/** One-off happiness hit when a friendship finally fades. */
export const FRIEND_DRIFT_HAPPINESS_PENALTY = -8;

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
      // Life Skills: Empathy softens relationship decay — it scales DOWN both the
      // breakup and disappointment chance (mult ≤ 1, clamped). Neutral when unset.
      const decayMult = ctx.lifeSkillMods?.relationshipDecayMult ?? 1;
      const safeDecayMult = typeof decayMult === 'number' && isFinite(decayMult) && decayMult > 0 && decayMult <= 1
        ? decayMult
        : 1;
      const breakupChance = Math.min(0.4, (30 - rel.relationshipScore) / 100) * safeDecayMult;
      const disappointedChance = 0.3 * safeDecayMult;

      if (preRolls.relBreakup[relIdx % preRolls.relBreakup.length] < breakupChance) {
        logger.info(`[RELATIONSHIP] ${rel.name} broke up due to low relationship (${rel.relationshipScore}%)`);
        ctx.notifications.push({
          id: 'relationship-breakup',
          message: `${rel.name} has ended the relationship. Your relationship score was too low (${rel.relationshipScore}%).`,
          title: '💔 Relationship Ended',
        });
        return { rel: null, happinessPenalty: -25 };
      }

      if (preRolls.relDisappointed[relIdx % preRolls.relDisappointed.length] < disappointedChance) {
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

  // Branch 2: healthy partner/spouse - reset the low-week counter.
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

  /**
   * Branch 3: parent · child · friend - neglect finally costs something.
   *
   * PLAYER REPORT (BBQ, 2026-08-11): "There's no penalty for letting relations
   * go to 1 or bad. They can be at risk all they want. Nothing happens."
   *
   * Exactly right. This branch used to be a clamp and nothing else, at any
   * score, forever - while `ContactsApp` renders an "At risk" counter and an
   * entire Attention triage tab off `contactsNeedingAttention`. The UI named a
   * consequence the code did not have, which is why it reads as broken rather
   * than as lenient.
   *
   * The two types are deliberately NOT symmetrical:
   *
   *   - A **friend** can drift out of your life. After
   *     `FRIEND_DRIFT_MIN_WEEKS` sustained weeks below the threshold they may
   *     fade, and the relationship is removed. That is what neglecting a
   *     friendship does.
   *   - **Family** never gets deleted. You do not stop having a mother because
   *     you did not call. Estrangement is a standing happiness cost instead,
   *     which is both truer and safer - silently removing a parent would break
   *     inheritance, the family tree and every `parent`-typed consumer.
   *
   * The warning fires well before the bite: the UI flags "at risk" at strength
   * < 50, this bites at < 25, so a player who reads the Attention tab has
   * roughly half the scale to react in.
   *
   * Scores only reach this band through sustained neglect - the only automatic
   * downward pressure is `-2` per fully-ignored want cycle in `npcDepth`, so
   * this cannot slide a player who ever interacts.
   */
  if (rel.type === 'parent' || rel.type === 'child' || rel.type === 'friend') {
    if (rel.relationshipScore < NEGLECT_THRESHOLD) {
      const weeksAtLow = (rel.weeksAtLowRelationship || 0) + 1;

      // Empathy (Life Skills) softens this exactly as it softens the partner
      // branch above - same modifier, same clamp, so one skill reads one way.
      const decayMult = ctx.lifeSkillMods?.relationshipDecayMult ?? 1;
      const safeDecayMult =
        typeof decayMult === 'number' && isFinite(decayMult) && decayMult > 0 && decayMult <= 1
          ? decayMult
          : 1;

      if (rel.type === 'friend' && weeksAtLow >= FRIEND_DRIFT_MIN_WEEKS) {
        const driftChance =
          Math.min(FRIEND_DRIFT_MAX_CHANCE, (NEGLECT_THRESHOLD - rel.relationshipScore) / 100) *
          safeDecayMult;
        // Shares `relBreakup` with the partner branch: a given index is one
        // relationship, so the buffers cannot collide, and reusing it avoids
        // widening `buildPreRolls` (and its equivalence snapshot) for a second
        // draw that is never taken on the same tick.
        if (preRolls.relBreakup[relIdx % preRolls.relBreakup.length] < driftChance) {
          logger.info(`[RELATIONSHIP] ${rel.name} drifted away (${rel.relationshipScore}%)`);
          ctx.notifications.push({
            id: 'relationship-drifted',
            message: `You and ${rel.name} have drifted apart. Neither of you reached out for a long time.`,
            title: '🍂 Friendship Faded',
          });
          return { rel: null, happinessPenalty: FRIEND_DRIFT_HAPPINESS_PENALTY };
        }
      }

      // Announce once, on the week the drag starts, rather than every week -
      // a recurring notification for a standing state is noise, and noise is
      // what taught players to swipe these away.
      if (weeksAtLow === 1) {
        ctx.notifications.push({
          id: 'relationship-neglected',
          message:
            rel.type === 'friend'
              ? `${rel.name} has noticed you never call. The friendship is fading.`
              : `Things are strained with ${rel.name}. Reach out before it hardens.`,
          title: '💤 Growing Distant',
        });
      }

      return {
        rel: {
          ...rel,
          weeksAtLowRelationship: weeksAtLow,
          relationshipScore: clampRelationshipScore(rel.relationshipScore),
        },
        happinessPenalty: NEGLECT_HAPPINESS_DRAG,
      };
    }

    // Healthy again - clear the counter, but only if one was ever set. Writing
    // `weeksAtLowRelationship: 0` onto every never-neglected parent and child
    // would churn the whole family tree to record a value that its absence
    // already means.
    return {
      rel:
        rel.weeksAtLowRelationship
          ? {
              ...rel,
              weeksAtLowRelationship: 0,
              relationshipScore: clampRelationshipScore(rel.relationshipScore),
            }
          : { ...rel, relationshipScore: clampRelationshipScore(rel.relationshipScore) },
      happinessPenalty: 0,
    };
  }

  // Branch 4: any other relationship type - just clamp.
  return {
    rel: {
      ...rel,
      relationshipScore: clampRelationshipScore(rel.relationshipScore),
    },
    happinessPenalty: 0,
  };
}

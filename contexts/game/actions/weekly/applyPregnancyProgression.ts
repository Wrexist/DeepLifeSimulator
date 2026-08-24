/**
 * Weekly pregnancy progression + birth — R7 Phase 2 step 2.6-iii-D.
 *
 * Scope: the per-rel branch previously inline in
 * `GameActionsContext.tsx:826-879` (~55 lines). Only fires when
 *   `(rel.type === 'partner' || rel.type === 'spouse') &&
 *    rel.isPregnant && rel.pregnancyStartWeek != null`.
 *
 * Three internal sub-branches:
 *
 *   1. Birth. `pregnancyWeeks >= PREGNANCY_DURATION_WEEKS`. Constructs the
 *      child relationship (uses `preRolls.childGender`,
 *      `preRolls.childIdSuffix`, `preRolls.childPersonality`,
 *      `preRolls.timestamp` for determinism), pushes it to the result's
 *      `newborn` field, charges $5000 (floored at 0), bumps happiness +30
 *      (capped at 100), and CLEARS the pregnancy state on the returning rel
 *      while bumping relationshipScore +15 (clamped).
 *   2. Late pregnancy. `pregnancyWeeks >= 7` (and < birth threshold) →
 *      `ctx.newStats.energy -= 3` (floored at 0).
 *   3. Mid pregnancy. `pregnancyWeeks === 5` → `ctx.newStats.happiness += 2`
 *      (capped at 100).
 *
 * The personality string is picked from a 5-element fixed array indexed by
 * `preRolls.childPersonality` — same array, same order, preserved verbatim.
 *
 * The default name `Baby` is intentional and present in the legacy code
 * for both genders (the male/female branches collapse to the same string).
 * Preserved 1:1 — not "fixed" here.
 *
 * Side effects on `ctx`:
 *   - `ctx.newStats.money` — `-5000` on birth (floored at 0).
 *   - `ctx.newStats.happiness` — `+30` on birth (capped at 100), or `+2`
 *     on mid-pregnancy week (capped at 100).
 *   - `ctx.newStats.energy` — `-3` from week 7 onwards (floored at 0).
 *
 * Returns:
 *   - `null` when the gate doesn't fire (caller falls through).
 *   - `{ rel, newborn: null }` for ongoing-pregnancy weeks (rel unchanged
 *     except possibly stat side effects on ctx).
 *   - `{ rel: <pregnancy cleared>, newborn: <new child>, birthMessage }`
 *     on birth.
 */

import type { Relationship, ChildInfo } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { PREGNANCY_DURATION_WEEKS } from '@/lib/config/gameConstants';
import { clampRelationshipScore } from '@/utils/stateValidation';
import type { WeekContext } from './weekContext';
import { chargeOrDefer } from './chargeOrDefer';
import { NEWBORN_BOND } from '@/lib/parenting/parentingLogic';

const CHILD_PERSONALITIES = ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous'];

// Gendered newborn name pools — previously every child was named "Baby".
// Picked deterministically from a pre-roll so StrictMode double-invoke agrees.
const MALE_BABY_NAMES = ['Liam', 'Noah', 'Ethan', 'Oliver', 'Lucas', 'Leo', 'Kai', 'Milo', 'Owen', 'Caleb', 'Aiden', 'Elias'];
const FEMALE_BABY_NAMES = ['Emma', 'Olivia', 'Ava', 'Mia', 'Sophia', 'Isla', 'Luna', 'Nora', 'Ivy', 'Elena', 'Zoe', 'Aria'];

export interface PregnancyProgressionResult {
  rel: Relationship;
  newborn: Relationship | null;
  birthMessage: string | null;
}

export function applyPregnancyProgression(
  rel: Relationship,
  ctx: WeekContext,
): PregnancyProgressionResult | null {
  if (rel.type !== 'partner' && rel.type !== 'spouse') return null;
  if (!rel.isPregnant) return null;
  if (rel.pregnancyStartWeek == null) return null;

  const nextWeeksLived = ctx.nextWeeksLived;
  const preRolls = ctx.preRolls;
  const pregnancyWeeks = nextWeeksLived - rel.pregnancyStartWeek;

  if (pregnancyWeeks >= PREGNANCY_DURATION_WEEKS) {
    // Birth! Create the child.
    const childGender = rel.pregnancyChildGender || preRolls.childGender;
    const namePool = childGender === 'male' ? MALE_BABY_NAMES : FEMALE_BABY_NAMES;
    const pickedName = namePool[Math.abs(Math.floor(preRolls.timestamp)) % namePool.length];
    const childName = rel.pregnancyChildName || pickedName;
    // Include the parent relationship's id so two births in the SAME tick (two
    // pregnant partners reaching term together) don't collide on an identical
    // child id — which dropped one twin on the next load-time child merge and
    // caused a React key collision.
    const childId = `child_${preRolls.timestamp}_${preRolls.childIdSuffix}_${rel.id}`;

    const newChild: Relationship = {
      id: childId,
      name: childName,
      type: 'child',
      // R3-F5: NOT 100. `clampNurture` caps Bond at 100, so a child created at
      // the ceiling made every positive parenting action a no-op on arrival -
      // the +1 bumps (Bedtime Story, Playtime, Park Playdate, Teach Values,
      // Driving Lessons) and the +3s (Heart-to-Heart, the $1,500 Family Trip)
      // all clamped away. Starting with headroom is what makes the parenting
      // loop mean anything.
      relationshipScore: NEWBORN_BOND,
      personality: CHILD_PERSONALITIES[preRolls.childPersonality],
      gender: childGender,
      age: 0,
      datesCount: 0,
    };
    (newChild as ChildInfo).birthWeeksLived = nextWeeksLived;

    // Hospital/birth costs - mandatory, so defer rather than forgive.
    chargeOrDefer(ctx, 5000);
    ctx.newStats.happiness = Math.min(100, ctx.newStats.happiness + 30);
    const birthMessage = `${rel.name} gave birth to a beautiful ${childGender === 'male' ? 'baby boy' : 'baby girl'} named ${childName}!`;

    logger.info(`[BIRTH] ${childName} (${childGender}) born to ${rel.name} at week ${nextWeeksLived}`);

    return {
      rel: {
        ...rel,
        isPregnant: undefined,
        pregnancyStartWeek: undefined,
        pregnancyChildGender: undefined,
        pregnancyChildName: undefined,
        relationshipScore: clampRelationshipScore(rel.relationshipScore + 15),
      },
      newborn: newChild,
      birthMessage,
    };
  }

  // Pregnancy effects on stats (minor weekly effects)
  if (pregnancyWeeks >= 7) {
    // Late pregnancy: slight energy drain
    ctx.newStats.energy = Math.max(0, ctx.newStats.energy - 3);
  }
  if (pregnancyWeeks === 5) {
    // Mid-pregnancy: small happiness bump (excitement)
    ctx.newStats.happiness = Math.min(100, ctx.newStats.happiness + 2);
  }

  // Return unchanged (pregnancy continues)
  return { rel, newborn: null, birthMessage: null };
}

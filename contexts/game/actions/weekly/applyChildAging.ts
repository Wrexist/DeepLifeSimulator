/**
 * Weekly child aging — R7 Phase 2 step 2.6-iii-B.
 *
 * Scope: the per-rel branch previously inline in
 * `GameActionsContext.tsx:918-925` (~8 lines). Tiny but exercised on every
 * tick for every child relationship.
 *
 * Caller invokes ONLY when `rel.type === 'child'`. The helper:
 *   - Increments `age` by `1 / WEEKS_PER_YEAR` (i.e. 1 calendar year over
 *     52 weeks of game time). Treats missing/undefined `age` as 0.
 *   - Re-clamps `relationshipScore` through `clampRelationshipScore` even
 *     though it isn't being modified here — this preserves the inline
 *     behavior of opportunistically clamping any drifted score.
 *
 * Pure function. No ctx. No side effects.
 *
 * Returns a NEW Relationship object (spread, never mutates input).
 */

import type { ChildInfo, Relationship } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { clampRelationshipScore } from '@/utils/stateValidation';
import { applyGrandchildWeek } from '@/lib/parenting/grandchildren';

export function applyChildAging(rel: Relationship, weeksLived?: number): Relationship {
  const aged: Relationship = {
    ...rel,
    age: (rel.age || 0) + (1 / WEEKS_PER_YEAR),
    relationshipScore: clampRelationshipScore(rel.relationshipScore),
  };

  // Grandchild births are evaluated in THIS pass rather than a loop of their
  // own: the tick already walks every child once, and the perf audit tracks
  // nested-loop density in the weekly path as a live ceiling.
  //
  // `weeksLived` is optional so every existing caller and test keeps working
  // unchanged — without it, no birth is ever rolled, which is the correct
  // conservative answer for a caller that has no clock to seed from.
  if (typeof weeksLived !== 'number' || !Number.isFinite(weeksLived)) return aged;
  return applyGrandchildWeek(aged as ChildInfo, weeksLived);
}

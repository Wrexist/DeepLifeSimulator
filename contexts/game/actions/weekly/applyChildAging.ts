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

import type { Relationship } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { clampRelationshipScore } from '@/utils/stateValidation';

export function applyChildAging(rel: Relationship): Relationship {
  return {
    ...rel,
    age: (rel.age || 0) + (1 / WEEKS_PER_YEAR),
    relationshipScore: clampRelationshipScore(rel.relationshipScore),
  };
}

/**
 * Career progress increment — R7 Phase 2 step 2.5b-iii.
 *
 * Scope: when the player has an active accepted career, advance its
 * `progress` field by a rate that combines five multiplicative factors.
 * Previously inline in `GameActionsContext.tsx:524-566` (~43 lines).
 *
 * Multiplicative factors (preserved 1:1 from the legacy code):
 *   1. `baseProgressRate = 5` — flat starting point per week.
 *   2. `earlyBoost` — engagement acceleration in the first 40 weeks of
 *      THIS career (since `startedWeeksLived`):
 *        - < 20 weeks → 2.5×
 *        - 20-39 weeks → 1.5×
 *        - 40+ weeks → 1.0× (normal)
 *   3. `mentorBuff` — Legacy points buff. `legacyBuffs.mentor` with an
 *      `expiresWeeksLived` in the future → 1.5×, else 1.0×.
 *   4. `perfModifier` — from `calcPerf(newStats)`:
 *        - perf >= 80 → 1.3×
 *        - perf >= 50 → 1.0×
 *        - perf >= 30 → 0.7×
 *        - perf < 30  → 0.3×
 *   5. `mindsetMultiplier` — Mindset perk + gold upgrade each ×1.5
 *      (multiplicative, so both → 2.25×). Previously dead-wired in
 *      `applyPerkEffects 'energy' case` which never ran.
 *
 * Side effects: NONE. Pure transformation of the careers array.
 *
 * Outputs:
 *   - `updatedCareers` — new array with the matching career's `progress`
 *     bumped (clamped at 100), `startedWeeksLived` filled in if missing,
 *     and `performance` stored for downstream event conditions + UI.
 *
 * If `currentJob` is missing or no matching accepted career is found,
 * the helper returns `prevCareers` UNCHANGED (same reference).
 */

import type { Career, GameStats, GameState } from '@/contexts/game/types';
import { calculatePerformance as calcPerf } from '@/lib/events/careerEvents';

export interface CareerProgressInput {
  /** Careers AFTER step 2.5b-ii's application processing. */
  prevCareers: Career[];
  /** Current job ID (may have just been set by application processing). */
  currentJob: string | undefined;
  /** Absolute week counter for THIS tick. */
  nextWeeksLived: number;
  /** Running stat accumulator — read only, NOT mutated. */
  newStats: GameStats;
  /** `prevState.legacyBuffs` slice. */
  legacyBuffs: GameState['legacyBuffs'];
  /** `prevState.goldUpgrades?.mindset` truthy. */
  goldMindset: boolean;
  /** `prevState.perks?.mindset` truthy. */
  perkMindset: boolean;
}

export interface CareerProgressResult {
  updatedCareers: Career[];
}

export function applyCareerProgress(input: CareerProgressInput): CareerProgressResult {
  if (!input.currentJob) {
    return { updatedCareers: input.prevCareers };
  }

  // Find the career again (currentCareer from the salary block is out of scope here).
  const careers = Array.isArray(input.prevCareers) ? input.prevCareers : [];
  const activeCareer = careers.find((c) => c && c.id === input.currentJob && c.accepted);
  if (!activeCareer) {
    return { updatedCareers: input.prevCareers };
  }

  // Calculate performance from current stats.
  const performance = calcPerf(input.newStats);

  const nextWeeksLived = input.nextWeeksLived || 0;

  const updatedCareers = input.prevCareers.map((c) => {
    if (c.id === input.currentJob && c.accepted) {
      // ENGAGEMENT: Early career acceleration — faster promotions in first career.
      const baseProgressRate = 5;
      const weeksInCareer = nextWeeksLived - (c.startedWeeksLived || 0);
      // Mentor legacy buff: +50% career progress.
      const mentorBuff = input.legacyBuffs?.mentor
        && input.legacyBuffs.mentor.expiresWeeksLived > nextWeeksLived
        ? 1.5
        : 1.0;
      const earlyBoost = weeksInCareer < 20 ? 2.5 : weeksInCareer < 40 ? 1.5 : 1.0;
      // Performance modifier: high perf boosts progress, low perf slows it.
      const perfModifier = performance >= 80 ? 1.3
        : performance >= 50 ? 1.0
        : performance >= 30 ? 0.7
        : 0.3;
      // Mindset perk + gold upgrade: +50% promotion speed each
      // (stacks at 2.25× with both — was previously dead-wired in
      // applyPerkEffects 'energy' case which never ran).
      let mindsetMultiplier = 1;
      if (input.goldMindset) mindsetMultiplier *= 1.5;
      if (input.perkMindset) mindsetMultiplier *= 1.5;
      const progressRate = Math.round(baseProgressRate * earlyBoost * mentorBuff * perfModifier * mindsetMultiplier);
      const newProgress = Math.min(100, (c.progress || 0) + progressRate);
      return {
        ...c,
        startedWeeksLived: c.startedWeeksLived ?? nextWeeksLived,
        progress: newProgress,
        performance, // Store for event conditions and UI.
      };
    }
    return c;
  });

  return { updatedCareers };
}

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
  /**
   * The tick passes `prevState.careers` straight through, and a partial save
   * can omit it — so the type must admit what the caller can actually send.
   * Declaring it non-optional here made the missing `|| []` below look safe.
   */
  prevCareers: Career[] | undefined | null;
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
  /**
   * Life Skills career-progress multiplier (Leadership +10%, Executive +15%).
   * Clamped [1, 1.5] by the accessor. Defaults to 1 (neutral) when omitted so
   * existing callers / test fixtures are unaffected.
   */
  lifeSkillCareerProgressMult?: number;
}

export interface CareerProgressResult {
  updatedCareers: Career[];
}

export function applyCareerProgress(input: CareerProgressInput): CareerProgressResult {
  // Normalise ONCE, up front, and use it everywhere below.
  //
  // CRASH GUARD: the tick passes `prevState.careers` straight through and a
  // partial save can omit it. This function already had the `Array.isArray`
  // normalisation, but only used it for the `.find()` — the two early returns
  // and the `.map()` all read `input.prevCareers` raw, so the guard protected
  // the one path that could not throw and none of the three that could. An
  // unguarded `.map()` inside the weekly updater is a permanently stuck
  // "Next Week" for that save (CLAUDE.md §4.3).
  const careers: Career[] = Array.isArray(input.prevCareers) ? input.prevCareers : [];

  if (!input.currentJob) {
    return { updatedCareers: careers };
  }

  // Find the career again (currentCareer from the salary block is out of scope here).
  const activeCareer = careers.find((c) => c && c.id === input.currentJob && c.accepted);
  if (!activeCareer) {
    return { updatedCareers: careers };
  }

  // Calculate performance from current stats.
  const performance = calcPerf(input.newStats);

  const nextWeeksLived = input.nextWeeksLived || 0;

  const updatedCareers = careers.map((c) => {
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
      // Life Skills: Leadership/Executive accelerate promotion progress.
      const lifeSkillMult = typeof input.lifeSkillCareerProgressMult === 'number'
        && isFinite(input.lifeSkillCareerProgressMult) && input.lifeSkillCareerProgressMult > 0
        ? input.lifeSkillCareerProgressMult
        : 1;
      const progressRate = Math.round(baseProgressRate * earlyBoost * mentorBuff * perfModifier * mindsetMultiplier * lifeSkillMult);
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

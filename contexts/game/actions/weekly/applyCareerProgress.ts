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
 *      THIS career, counted from the FIRST time it was started in this life:
 *        - < 20 weeks → 2.5×
 *        - 20-39 weeks → 1.5×
 *        - 40+ weeks → 1.0× (normal)
 *      `startedWeeksLived` is the start of the CURRENT stint (tenure gates and
 *      the raise cooldown need that), and every hire path re-stamps it - so a
 *      boost keyed on it alone re-armed 2.5× on every quit-and-rehire, a free
 *      reset of the most generous multiplier in the chain (owner call,
 *      2026-10-17). The first start is the earliest `careerHistory` entry for
 *      this job, which both hire paths open and nothing rewrites. A re-hire
 *      keeps its level (progress and tenure already reset on the way out) and
 *      simply does not get the newcomer's boost again.
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
 *   6. `growthMult` — the career's authored growth pace from its entry-job
 *      profile (fast 1.3× / steady 1.0× / slow 0.7×; unprofiled careers 1.0×).
 *      The job card has always advertised this pace; wired 2026-08-24.
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

import type { Career, CareerHistoryEntry, GameStats, GameState } from '@/contexts/game/types';
import { calculatePerformance as calcPerf } from '@/lib/events/careerEvents';
import { growthProgressMultiplier } from '@/lib/careers/jobMarket';

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
   * C-1: the Commitment system's career multiplier, already resolved by
   * `getCommitmentModifiers(state, 'career').progressMultiplier`. 1 when the
   * player has set no commitments; above 1 when career is their primary or
   * secondary focus; below 1 when career is the neglected area. Passed in
   * rather than read here so this stays a pure function of its input.
   */
  commitmentProgressMult?: number;
  /**
   * Life Skills career-progress multiplier (Leadership +10%, Executive +15%).
   * Clamped [1, 1.5] by the accessor. Defaults to 1 (neutral) when omitted so
   * existing callers / test fixtures are unaffected.
   */
  lifeSkillCareerProgressMult?: number;
  /**
   * The Mindset's promotion multiplier (a Perfectionist's 1.15,
   * lib/mindset/effects.ts). Defaults to 1 when omitted, like the life-skill
   * multiplier above. NOT `goldMindset`/`perkMindset`, which are a gold upgrade
   * and an IAP perk that happen to share the word.
   */
  mindsetProgressMult?: number;
  /**
   * `prevState.lifetimeStatistics.careerHistory` — this life's job record.
   * Anchors the early-career boost on the FIRST time the job was started, so a
   * quit-and-rehire does not re-arm it. Omitted → the boost counts from
   * `startedWeeksLived` alone (legacy behaviour).
   */
  careerHistory?: readonly Pick<CareerHistoryEntry, 'job' | 'startWeek'>[] | null;
}

export interface CareerProgressResult {
  updatedCareers: Career[];
}

/** Early-career multiplier by weeks since the career was first started. */
export function earlyCareerBoost(weeksInCareer: number): number {
  return weeksInCareer < 20 ? 2.5 : weeksInCareer < 40 ? 1.5 : 1.0;
}

/**
 * The week this career was FIRST started in this life: the earliest
 * `careerHistory` entry for it, or the current stint's `startedWeeksLived`,
 * whichever is earlier. Entries dated after `nowWeeksLived` are ignored (they
 * cannot belong to this life's past). An unknown start reads as week 0, which
 * is what the boost always did for a career with no `startedWeeksLived`.
 */
export function firstCareerStartWeek(
  career: Pick<Career, 'id' | 'startedWeeksLived'>,
  careerHistory: CareerProgressInput['careerHistory'],
  nowWeeksLived: number,
): number {
  let first = typeof career.startedWeeksLived === 'number' && Number.isFinite(career.startedWeeksLived)
    ? career.startedWeeksLived
    : 0;
  if (Array.isArray(careerHistory)) {
    for (const entry of careerHistory) {
      if (!entry || entry.job !== career.id) continue;
      const start = entry.startWeek;
      if (typeof start !== 'number' || !Number.isFinite(start) || start > nowWeeksLived) continue;
      if (start < first) first = start;
    }
  }
  return first;
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
      // Counted from the FIRST start of this career in this life, not the
      // current stint, so quitting and rehiring cannot re-arm it.
      const baseProgressRate = 5;
      const weeksInCareer = nextWeeksLived - firstCareerStartWeek(c, input.careerHistory, nextWeeksLived);
      // Mentor legacy buff: +50% career progress.
      const mentorBuff = input.legacyBuffs?.mentor
        && input.legacyBuffs.mentor.expiresWeeksLived > nextWeeksLived
        ? 1.5
        : 1.0;
      const earlyBoost = earlyCareerBoost(weeksInCareer);
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
      // C-1: the Commitment focus the player picked. Folded into the same
      // multiplicative chain as every other modifier and rounded once at the
      // end, so a +30% career focus is not lost to rounding on a slow week.
      const commitmentMult = typeof input.commitmentProgressMult === 'number'
        && isFinite(input.commitmentProgressMult) && input.commitmentProgressMult > 0
        ? input.commitmentProgressMult
        : 1;
      // The career's authored growth pace ("Climbs fast" on the job card —
      // advertised since jobMarket.ts shipped, simulated only since the
      // 2026-08-24 audit). 1.0 for every career without a profile.
      const growthMult = growthProgressMultiplier(c.id);
      // The life's Mindset (a Perfectionist's 1.15). Neutral when omitted.
      const lifeMindsetMult = typeof input.mindsetProgressMult === 'number'
        && isFinite(input.mindsetProgressMult) && input.mindsetProgressMult > 0
        ? input.mindsetProgressMult
        : 1;
      const rawProgress = baseProgressRate * earlyBoost * mentorBuff * perfModifier * mindsetMultiplier * commitmentMult * growthMult;
      // The two small PLAYER bonuses - the Leadership/Executive life skill
      // (+10%/+15%) and the Mindset (a Perfectionist's +15%) - are added as
      // their OWN rounded step of at least one point. Folded into the single
      // rounding they vanished: a typical week is 6.5 points, which rounds to 7
      // with a 10% or a 15% boost (7.15 -> 7, 7.475 -> 7), so a $-priced life
      // skill and a Mindset both climbed exactly as fast as nothing at all.
      // A week with neither rounds exactly as before.
      const playerBonusMult = lifeSkillMult * lifeMindsetMult;
      const playerBonusStep = playerBonusMult === 1
        ? 0
        : Math.sign(playerBonusMult - 1) * Math.max(1, Math.round(rawProgress * Math.abs(playerBonusMult - 1)));
      const progressRate = Math.max(0, Math.round(rawProgress) + playerBonusStep);
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

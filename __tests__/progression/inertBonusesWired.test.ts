/**
 * Two systems the player pays for that did nothing at all.
 *
 * GL-1 — every prestige "learning speed" bonus was inert.
 * `getExperienceMultiplier` computes a multiplier from five prestige-shop
 * entries: Quick Learner (1,500 pts × 3 levels), Fast Learner (5,000 × 3),
 * Genius Learner (20,000 × 3), the legendary `genius` (35,000, "+100% learning
 * speed") and the `synergy_learning_master` synergy. It had NO call sites
 * anywhere in the repo — it was imported once, in `MoneyActionsContext`, and
 * the identifier never appears again in that file. Meanwhile
 * `PrestigeInfoModal` renders the advertised percentage for each, so the player
 * is told the multiplier is live. The two places progression speed is actually
 * multiplied — `applyCareerProgress` and `applyEducationProgression` — never
 * looked at it.
 *
 * GL-2 — politics education perks read a key that does not exist.
 * `politicsEducationPerks` read `getCombinedPerkEffects(careerLevel).education.*`.
 * That object has exactly six keys and `PoliticalPerk['effects']` has no
 * education member, so every read was `undefined` and every value 0 — for every
 * player who has ever held office. It type-checked only because the module came
 * in via `require()`, which degrades to `any`.
 *
 * The real numbers were aggregated into `politics.activePolicyEffects.education`
 * by `enactPolicy` and read by nothing (GL-3), so the five education policies —
 * up to $200,000 each — bought an approval bump and nothing else.
 *
 * 2026-07-30 audit GL-1 / GL-2 / GL-3.
 */
import { getExperienceMultiplier } from '@/lib/prestige/applyBonuses';
import { applyEducationProgression } from '@/contexts/game/actions/weekly/applyEducationProgression';
import { quoteEnrollment } from '@/contexts/game/actions/EducationActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '../helpers/zeroPreRolls';

/** Same harness shape the existing applyEducationProgression suites use. */
const ctx: WeekContext = {
  newStats: {
    happiness: 50, energy: 50, money: 10_000, health: 50, fitness: 50, reputation: 50, gems: 0,
  },
  notifications: [],
  preRolls: zeroPreRolls(),
  nextWeeksLived: 200,
};

/** Exam + campus cadence anchored past the tick week so neither fires. */
const enrolled = () => [
  {
    id: 'business_degree',
    name: 'Business Degree',
    description: 'biz',
    cost: 48_000,
    duration: 104,
    completed: false,
    weeksRemaining: 104,
    paused: false,
    enrolledClasses: [],
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0,
    studyGroupActive: false,
    semesterNumber: 1,
    lastExamWeek: 200,
    lastCampusEventWeek: 200,
  },
] as never;

function weeksAfterATick(experienceMultiplier?: number): number {
  const result = applyEducationProgression(
    {
      prevEducations: enrolled(),
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
      experienceMultiplier,
    },
    ctx,
  );
  return (result.updatedEducations[0] as { weeksRemaining: number }).weeksRemaining;
}

describe('the prestige learning bonuses actually speed up learning', () => {
  it('computes a multiplier above 1 for an unlocked bonus', () => {
    // Guard: if the catalogue ids ever drift, the assertions below would pass
    // vacuously against a multiplier that is always 1.
    expect(getExperienceMultiplier(['genius'])).toBeGreaterThan(1);
    expect(getExperienceMultiplier([])).toBe(1);
  });

  it('advances a degree FASTER with the bonus than without', () => {
    const without = weeksAfterATick(1);
    const withGenius = weeksAfterATick(getExperienceMultiplier(['genius']));

    // The headline: this used to be identical no matter what was bought.
    expect(withGenius).toBeLessThan(without);
  });

  it('is a no-op when nothing is unlocked', () => {
    expect(weeksAfterATick(getExperienceMultiplier([]))).toBe(weeksAfterATick(1));
  });

  it('tolerates an absent or garbage multiplier (older callers, corrupt saves)', () => {
    const baseline = weeksAfterATick(1);
    expect(weeksAfterATick(undefined)).toBe(baseline);
    expect(weeksAfterATick(NaN)).toBe(baseline);
    // A multiplier below 1 must never SLOW learning down — that would turn a
    // corrupt save into a punishment.
    expect(weeksAfterATick(0)).toBe(baseline);
  });
});

describe('education policies reach the enrolment quote', () => {
  const program = { id: 'university', name: 'University', cost: 100_000, duration: 40 };

  function withEducationPolicy(effects: Record<string, number>): GameState {
    const base = createTestGameState();
    return createTestGameState({
      politics: {
        ...(base.politics ?? {}),
        careerLevel: 3,
        activePolicyEffects: { education: effects },
      } as never,
    });
  }

  it('applies a tuition discount from an enacted policy', () => {
    const none = quoteEnrollment(createTestGameState(), program);
    // 20% in POLICY units (percent), which is 0.2 as the fraction
    // `quoteScholarship` multiplies by. Passing the raw 20 would have zeroed
    // the tuition outright.
    const discounted = quoteEnrollment(withEducationPolicy({ costReduction: 20 }), program);

    expect(discounted.netCost).toBeLessThan(none.netCost);
    expect(discounted.netCost).toBeGreaterThan(0);
  });

  it('never discounts more than the tuition', () => {
    // A stacked/corrupt value must not produce a negative cost or a refund.
    const absurd = quoteEnrollment(withEducationPolicy({ costReduction: 9_999 }), program);

    expect(absurd.netCost).toBeGreaterThanOrEqual(0);
  });

  it('applies a policy scholarship', () => {
    const none = quoteEnrollment(createTestGameState(), program);
    const funded = quoteEnrollment(withEducationPolicy({ scholarshipAmount: 25_000 }), program);

    expect(funded.netCost).toBeLessThan(none.netCost);
  });

  it('is zero for a player with no education policy enacted', () => {
    const base = createTestGameState();
    const officeHolderNoPolicy = createTestGameState({
      politics: { ...(base.politics ?? {}), careerLevel: 5 } as never,
    });

    expect(quoteEnrollment(officeHolderNoPolicy, program).netCost).toBe(
      quoteEnrollment(createTestGameState(), program).netCost,
    );
  });

  it('survives a garbage effects object without throwing', () => {
    expect(() =>
      quoteEnrollment(withEducationPolicy({ costReduction: NaN, scholarshipAmount: NaN }), program),
    ).not.toThrow();
  });
});

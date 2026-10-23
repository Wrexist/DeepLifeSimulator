/**
 * Owner decisions, late game (2026-10-23): D2, D3, D8, D9, D11.
 *
 * Each block reproduces the reported hole against the production function
 * first, then asserts the decided behaviour.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import { WEEKS_PER_YEAR, computeWeeksLived } from '@/lib/config/gameConstants';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { executePrestige, continueAsChild } from '@/lib/prestige/prestigeExecution';
import { applyStartingBonuses, applyLegacyBonuses } from '@/lib/prestige/applyBonuses';
import { applyDynastyTransition } from '@/lib/dynasty/transition';
import {
  TRIAL_MIN_WEEKS_PLAYED,
  applyTrialEffectsToNewLife,
  settleTrials,
  trialWeeksRemaining,
  trialYearsLost,
} from '@/lib/dynasty/trials';
import { IPO_MIN_WEEKS_OWNED, ipoOwnershipBlocker } from '@/lib/business/hustleLogic';
import { applyYouthPill, youthPillTargetAge, YOUTH_PILL_AGE } from '@/lib/progress/youthPill';
import { getAge } from '@/lib/progress/lifeChapters';
import { calculateGovernmentContractBonus, areGovernmentContractsAvailable } from '@/lib/politics/governmentContracts';
import { companyWeeklyIncomeFor } from '@/lib/economy/passiveIncome';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import {
  LEGACY_INCOME_BONUS_CAP,
  LEGACY_LEARNING_BONUS_CAP,
  LEGACY_REPUTATION_BONUS_CAP,
  capLegacyBonuses,
  legacyIncomeMultiplier,
  legacyLearningMultiplier,
  legacyReputationBonus,
} from '@/lib/legacy/legacyBonuses';
import { computeInheritance } from '@/lib/legacy/inheritance';

const LONG_ROAD = 'trial_long_road';
const PAUPER = 'trial_pauper';

/** A life carrying `trialIds`, `played` weeks after it began at 18. */
function bearing(trialIds: string[], played: number, extra: Partial<GameState> = {}): GameState {
  const start = computeWeeksLived(18);
  return createTestGameState({
    ...extra,
    prestige: { ...createTestGameState().prestige, totalPrestiges: 4 },
    dynasty: { trials: { active: trialIds, pending: [] } },
    lifeStartWeek: start,
    weeksLived: start + played,
  });
}

describe('D2 - a Dynasty Trial pays only after a year of played weeks', () => {
  it('settles nothing in the first year, so an heir cannot prestige in week 1 and collect', () => {
    expect(settleTrials(bearing([PAUPER], 1)).points).toBe(0);
    expect(settleTrials(bearing([PAUPER], TRIAL_MIN_WEEKS_PLAYED - 1)).points).toBe(0);
    expect(trialWeeksRemaining(bearing([PAUPER], 10))).toBe(TRIAL_MIN_WEEKS_PLAYED - 10);
  });

  it('pays in full once the year is lived', () => {
    const lived = bearing([PAUPER], TRIAL_MIN_WEEKS_PLAYED);
    expect(trialWeeksRemaining(lived)).toBe(0);
    expect(settleTrials(lived)).toEqual({ points: 200, settledIds: [PAUPER] });
  });

  it('counts PLAYED weeks, not the absolute counter The Long Road inflates by twelve years', () => {
    // A Long Road life opens 624 weeks up on `weeksLived` with lifeStartWeek
    // moved by the same amount, so the raw counter is no evidence of play.
    const fresh = createTestGameState({ weeksLived: 0, lifeStartWeek: 0 });
    applyTrialEffectsToNewLife(fresh, [LONG_ROAD]);
    const state = { ...fresh, dynasty: { trials: { active: [LONG_ROAD], pending: [] } } };
    expect(state.weeksLived).toBe(12 * WEEKS_PER_YEAR);
    expect(settleTrials(state).points).toBe(0);
  });

  it('a Trial ended early is forfeit on the transition - not carried to be paid later', () => {
    const old = bearing([PAUPER], 3);
    const next = applyDynastyTransition(old, createTestGameState({ legacyPoints: old.legacyPoints }));
    expect(next.legacyPoints ?? 0).toBe(old.legacyPoints ?? 0);
    expect(next.dynasty?.trials?.active ?? []).toEqual([]);
  });

  it('a lived year still pays on the real transition', () => {
    const old = bearing([PAUPER], TRIAL_MIN_WEEKS_PLAYED + 5, { legacyPoints: 10 });
    const next = applyDynastyTransition(old, createTestGameState({ legacyPoints: 10 }));
    expect(next.legacyPoints).toBe(210);
  });
});

describe('D3 - the prestige starting company is founded the week the life begins', () => {
  it('stamps foundedWeek, so the 26-week IPO gate applies to it', () => {
    const state = createTestGameState({ companies: [], weeksLived: 104, lifeStartWeek: 104 });
    const out = applyStartingBonuses(state, ['starting_company']);
    const factory = out.companies.find((c) => c.id === 'factory')!;
    expect(factory.foundedWeek).toBe(104);
    expect(ipoOwnershipBlocker(factory, out.weeksLived, out.ipoListedCompanyIds)).toMatch(/26 more weeks/);
    expect(ipoOwnershipBlocker(factory, 104 + IPO_MIN_WEEKS_OWNED, [])).toBeNull();
  });

  it('end to end through executePrestige: no IPO on frame one', () => {
    const old = createTestGameState({
      stats: { ...createTestGameState().stats, money: getPrestigeThreshold(0) + 5_000_000 },
      weeksLived: computeWeeksLived(18) + 40 * WEEKS_PER_YEAR,
      lifeStartWeek: computeWeeksLived(18),
      prestige: { ...createTestGameState().prestige, unlockedBonuses: ['starting_company'] },
    });
    const next = executePrestige(old, 'reset');
    const factory = next.companies.find((c) => c.id === 'factory');
    expect(factory?.foundedWeek).toBe(next.weeksLived);
    expect(ipoOwnershipBlocker(factory!, next.weeksLived, next.ipoListedCompanyIds)).not.toBeNull();
  });

  it('The Long Road moves the stamp with the clock, so twelve years do not count as ownership', () => {
    const life = applyStartingBonuses(createTestGameState({ companies: [], weeksLived: 0, lifeStartWeek: 0 }), [
      'starting_company',
    ]);
    applyTrialEffectsToNewLife(life, [LONG_ROAD]);
    const factory = life.companies.find((c) => c.id === 'factory')!;
    expect(factory.foundedWeek).toBe(life.weeksLived);
    expect(life.company?.foundedWeek).toBe(life.weeksLived);
    expect(ipoOwnershipBlocker(factory, life.weeksLived, [])).not.toBeNull();
  });
});

describe('D8 - a Youth Pill does not hand back The Long Road years', () => {
  // Age 64 under The Long Road: 46 years on the counter, twelve of them the Trial's.
  const longRoadElder = () =>
    createTestGameState({
      youthPills: 1,
      dynasty: { trials: { active: [LONG_ROAD], pending: [] } },
      lifeStartWeek: 12 * WEEKS_PER_YEAR,
      weeksLived: 46 * WEEKS_PER_YEAR,
      date: { ...initialGameState.date, age: 64 },
    });

  it('resets to 18 + the Trial years, on every age reader', () => {
    const before = longRoadElder();
    expect(trialYearsLost(before)).toBe(12);
    expect(getAge(before)).toBe(64);
    const after = applyYouthPill(before);
    expect(after.youthPills).toBe(0);
    expect(getAge(after)).toBe(30);
    expect(after.date.age).toBe(30);
    expect(youthPillTargetAge(before)).toBe(30);
  });

  it('the character still ages normally from there', () => {
    const after = applyYouthPill(longRoadElder());
    expect(getAge({ ...after, weeksLived: after.weeksLived + 5 * WEEKS_PER_YEAR })).toBe(35);
  });

  it('without the Trial a pill still resets to 18 (unchanged)', () => {
    const plain = createTestGameState({
      youthPills: 1,
      lifeStartWeek: 0,
      weeksLived: 46 * WEEKS_PER_YEAR,
      date: { ...initialGameState.date, age: 64 },
    });
    expect(youthPillTargetAge(plain)).toBe(YOUTH_PILL_AGE);
    expect(getAge(applyYouthPill(plain))).toBe(YOUTH_PILL_AGE);
  });

  it('a Trial merely SWORN for the next life does not move this life\'s floor', () => {
    const sworn = createTestGameState({
      youthPills: 1,
      lifeStartWeek: 0,
      weeksLived: 30 * WEEKS_PER_YEAR,
      dynasty: { trials: { pending: [LONG_ROAD] } },
    });
    expect(getAge(applyYouthPill(sworn))).toBe(YOUTH_PILL_AGE);
  });
});

describe('D9 - government contracts stop while jailed', () => {
  const politician = (jailWeeks: number): GameState => {
    const base = createTestGameState();
    const company = {
      id: 'c1', name: 'Co', type: 'factory' as const, weeklyIncome: 10_000, baseWeeklyIncome: 10_000,
      upgrades: [], employees: 0, workerSalary: 0, workerMultiplier: 1, marketingLevel: 1, miners: {}, warehouseLevel: 0,
    };
    return {
      ...base,
      jailWeeks,
      companies: [company],
      company,
      politics: { ...base.politics, careerLevel: 6, approvalRating: 100 } as GameState['politics'],
    };
  };

  it('pays the contract bonus to a free official', () => {
    expect(calculateGovernmentContractBonus(politician(0), 'c1')).toBe(7_500);
    expect(areGovernmentContractsAvailable(politician(0))).toBe(true);
  });

  it('pays nothing while serving a sentence, and the company readout agrees', () => {
    const jailed = politician(4);
    expect(calculateGovernmentContractBonus(jailed, 'c1')).toBe(0);
    expect(areGovernmentContractsAvailable(jailed)).toBe(false);
    expect(companyWeeklyIncomeFor(jailed, jailed.companies[0])).toBeLessThan(
      companyWeeklyIncomeFor(politician(0), politician(0).companies[0]),
    );
  });
});

describe('D11 - inherited Legacy Bonuses are applied, within ceilings', () => {
  it('caps every value, and reads malformed or absent values as neutral', () => {
    expect(capLegacyBonuses({ incomeMultiplier: 1.6, learningMultiplier: 3, reputationBonus: 90 })).toEqual({
      incomeMultiplier: 1 + LEGACY_INCOME_BONUS_CAP,
      learningMultiplier: 1 + LEGACY_LEARNING_BONUS_CAP,
      reputationBonus: LEGACY_REPUTATION_BONUS_CAP,
    });
    expect(capLegacyBonuses(undefined)).toEqual({ incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 });
    expect(capLegacyBonuses({ incomeMultiplier: Number.NaN, learningMultiplier: 0.2, reputationBonus: -4 })).toEqual(
      { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 },
    );
    expect(legacyIncomeMultiplier(createTestGameState())).toBe(1);
    expect(legacyLearningMultiplier(createTestGameState())).toBe(1);
    expect(legacyReputationBonus(createTestGameState())).toBe(0);
  });

  it('computeInheritance shows the capped value - the screens show what is applied', () => {
    const rich = createTestGameState({
      stats: { ...createTestGameState().stats, money: 50_000_000, reputation: 100 },
      dynastyStats: {
        ...(createTestGameState().dynastyStats ?? initialGameState.dynastyStats!),
        heirlooms: Array.from({ length: 6 }, (_, i) => ({
          id: `h${i}`, name: 'Crown', description: '', rarity: 'legendary' as const, generationsHeld: 3,
          originalOwner: 'A', currentValue: 1, icon: 'x',
          bonuses: { incomeBonus: 15, reputationBonus: 15, learningBonus: 15 },
        })),
      },
    });
    const { legacyBonuses } = computeInheritance(rich);
    expect(legacyBonuses.incomeMultiplier).toBeLessThanOrEqual(1 + LEGACY_INCOME_BONUS_CAP);
    expect(legacyBonuses.learningMultiplier).toBeLessThanOrEqual(1 + LEGACY_LEARNING_BONUS_CAP);
    expect(legacyBonuses.reputationBonus).toBe(LEGACY_REPUTATION_BONUS_CAP);
  });

  it('reputation is added once at life creation, clamped to 100, and only on a path with a prior life', () => {
    const newLife = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: 10 },
      legacyBonuses: { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 18 },
    });
    const prior = createTestGameState();
    expect(applyLegacyBonuses(newLife, [], 0, prior).stats.reputation).toBe(28);
    expect(applyLegacyBonuses(newLife, [], 0, undefined).stats.reputation).toBe(10);
    const nearTop = { ...newLife, stats: { ...newLife.stats, reputation: 95 } };
    expect(applyLegacyBonuses(nearTop, [], 0, prior).stats.reputation).toBe(100);
  });

  it('the heir starts with the inherited reputation (death -> heir path)', () => {
    const base = createTestGameState();
    const parent = createTestGameState({
      weeksLived: 2_600,
      lifeStartWeek: 0,
      stats: { ...base.stats, money: 3_000_000, reputation: 100 },
      family: {
        ...base.family,
        children: [
          { id: 'kid1', name: 'Sam', type: 'child', relationshipScore: 80, personality: 'curious', age: 20, datesCount: 0 } as never,
        ],
      },
    });
    const inherited = computeInheritance(parent).legacyBonuses.reputationBonus;
    expect(inherited).toBeGreaterThan(0);
    const next = continueAsChild(parent, 'kid1');
    expect(next.legacyBonuses?.reputationBonus).toBe(inherited);
    // The heir's rolled reputation plus the inheritance (never above 100).
    expect(next.stats.reputation).toBeGreaterThanOrEqual(Math.min(100, inherited));
  });

  it('the income bonus reaches the weekly paycheck through computeWeeklyIncome, capped', () => {
    const input = (legacy: GameState['legacyBonuses']) => ({
      prevState: createTestGameState({
        weeksLived: 1_000,
        lifeStartWeek: 0,
        legacyBonuses: legacy,
      }),
      careerSalary: 1_000,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 1_000,
      unlockedBonuses: [],
      economyIncomeMultiplier: 1,
      retirementIncome: 0,
    });
    const none = computeWeeklyIncome(input(undefined)).totalIncome;
    const ten = computeWeeklyIncome(input({ incomeMultiplier: 1.1, learningMultiplier: 1, reputationBonus: 0 })).totalIncome;
    const huge = computeWeeklyIncome(input({ incomeMultiplier: 2.5, learningMultiplier: 1, reputationBonus: 0 })).totalIncome;
    expect(none).toBe(1_000);
    expect(ten).toBe(1_100);
    expect(huge).toBe(Math.round(1_000 * (1 + LEGACY_INCOME_BONUS_CAP)));
  });
});

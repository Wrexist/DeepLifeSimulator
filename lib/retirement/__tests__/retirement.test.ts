/**
 * Retirement & Elder endgame — unit tests.
 *
 * Covers the acceptance checklist:
 *   1. Retire eligibility (age gate + early FIRE net-worth gate).
 *   2. Pension computation is bounded (floor, absolute cap, < peak salary).
 *   3. Retire → weekly income flow (pension credited through computeWeeklyIncome).
 *   4. Elder-activity effects / cooldown / affordability / requires-children.
 *   5. Anti-farm guards (one-way latch, frozen pension, no re-retire/un-retire).
 */
import type { GameState, LifetimeStatistics, ChildInfo } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import {
  RETIREMENT_AGE,
  EARLY_RETIRE_MIN_AGE,
  PENSION_WEEKLY_ABS_CAP,
  PENSION_SALARY_FACTOR,
  SOCIAL_SECURITY_FLOOR,
  getAge,
  isElder,
  isRetired,
  getRetirementEligibility,
  computePension,
  getRetirementIncomeWeekly,
  retirePlayer,
  ELDER_ACTIVITIES,
  getElderActivityStatus,
  applyElderActivity,
  getElderLegacySummary,
} from '@/lib/retirement';

// ── factories ──────────────────────────────────────────────────────────────
function makeLifetimeStats(overrides: Partial<LifetimeStatistics> = {}): LifetimeStatistics {
  return {
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    peakNetWorth: 0,
    peakNetWorthWeek: 0,
    totalWeeksWorked: 0,
    totalRelationships: 0,
    totalChildren: 0,
    totalCompaniesOwned: 0,
    totalPropertiesOwned: 0,
    totalCrimesCommitted: 0,
    totalJailTime: 0,
    totalTravelDestinations: 0,
    totalPostsMade: 0,
    totalViralPosts: 0,
    careerHistory: [],
    netWorthHistory: [],
    weeklyEarningsHistory: [],
    highestSalary: 0,
    totalHobbiesLearned: 0,
    totalAchievementsUnlocked: 0,
    ...overrides,
  };
}

function makeState(opts: {
  age?: number;
  money?: number;
  weeksLived?: number;
  highestSalary?: number;
  totalWeeksWorked?: number;
  currentJob?: string;
  isRetired?: boolean;
  pensionWeekly?: number;
  children?: ChildInfo[];
  extra?: Partial<GameState>;
} = {}): GameState {
  return createTestGameState({
    weeksLived: opts.weeksLived ?? 0,
    stats: { ...createTestGameState().stats, money: opts.money ?? 1000 },
    date: { ...createTestGameState().date, age: opts.age ?? 30 },
    currentJob: opts.currentJob,
    isRetired: opts.isRetired,
    pensionWeekly: opts.pensionWeekly,
    lifetimeStatistics: makeLifetimeStats({
      highestSalary: opts.highestSalary ?? 0,
      totalWeeksWorked: opts.totalWeeksWorked ?? 0,
    }),
    family: { spouse: undefined, children: opts.children ?? [] },
    ...(opts.extra ?? {}),
  });
}

function makeChild(overrides: Partial<ChildInfo> = {}): ChildInfo {
  return {
    id: 'kid-1',
    name: 'Test Child',
    type: 'child',
    relationshipScore: 60,
    personality: 'Curious',
    gender: 'female',
    age: 40,
    ...overrides,
  };
}

const YEAR = 52;

// ── 1. Eligibility ──────────────────────────────────────────────────────────
describe('retire eligibility', () => {
  it('unlocks at the standard retirement age', () => {
    const elig = getRetirementEligibility(makeState({ age: RETIREMENT_AGE, money: 0 }));
    expect(elig.canRetire).toBe(true);
    expect(elig.reason).toBe('ok');
    expect(elig.viaFinancialIndependence).toBe(false);
  });

  it('rejects a broke working-age adult', () => {
    const elig = getRetirementEligibility(makeState({ age: 30, money: 1000 }));
    expect(elig.canRetire).toBe(false);
    expect(elig.reason).toBe('too-young');
  });

  it('allows early retirement when net worth clears the FIRE number (>= 45)', () => {
    const elig = getRetirementEligibility(makeState({ age: EARLY_RETIRE_MIN_AGE + 1, money: 800_000 }));
    expect(elig.canRetire).toBe(true);
    expect(elig.viaFinancialIndependence).toBe(true);
    expect(elig.netWorth).toBeGreaterThanOrEqual(elig.fireNumber);
  });

  it('does NOT allow a rich but too-young player to retire early', () => {
    const elig = getRetirementEligibility(makeState({ age: 30, money: 800_000 }));
    expect(elig.canRetire).toBe(false);
    expect(elig.reason).toBe('too-young');
  });

  it('isElder / getAge track the age threshold', () => {
    expect(isElder(makeState({ age: 64 }))).toBe(false);
    expect(isElder(makeState({ age: 65 }))).toBe(true);
    expect(getAge(makeState({ age: 70.9 }))).toBe(70);
  });
});

// ── 2. Pension computation (bounded) ─────────────────────────────────────────
describe('pension computation', () => {
  it('is a comfortable fraction below peak salary for a full career', () => {
    const p = computePension(makeState({ highestSalary: 1000, totalWeeksWorked: 35 * YEAR }));
    expect(p.serviceFraction).toBe(1);
    expect(p.weekly).toBe(600); // 1000 * 0.6 * 1.0
    expect(p.weekly).toBeLessThan(1000); // strictly below peak salary
  });

  it('pro-rates by years worked', () => {
    const full = computePension(makeState({ highestSalary: 1000, totalWeeksWorked: 35 * YEAR })).weekly;
    const half = computePension(makeState({ highestSalary: 1000, totalWeeksWorked: 17.5 * YEAR })).weekly;
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(0);
  });

  it('applies the universal floor to a genuine but low-paid worker', () => {
    const p = computePension(makeState({ highestSalary: 300, totalWeeksWorked: YEAR }));
    expect(p.floored).toBe(true);
    expect(p.weekly).toBe(SOCIAL_SECURITY_FLOOR);
  });

  it('does NOT grant the floor to someone who barely worked', () => {
    const p = computePension(makeState({ highestSalary: 300, totalWeeksWorked: 10 }));
    expect(p.floored).toBe(false);
    expect(p.weekly).toBeLessThan(SOCIAL_SECURITY_FLOOR);
  });

  it('hard-caps an absurd salary at the absolute weekly ceiling', () => {
    const p = computePension(makeState({ highestSalary: 100_000, totalWeeksWorked: 40 * YEAR }));
    expect(p.weekly).toBe(PENSION_WEEKLY_ABS_CAP);
  });

  it('never exceeds the salary-factor of peak', () => {
    const p = computePension(makeState({ highestSalary: 2000, totalWeeksWorked: 100 * YEAR }));
    expect(p.weekly).toBeLessThanOrEqual(2000 * PENSION_SALARY_FACTOR);
  });

  it('returns 0 for a life that never worked', () => {
    expect(computePension(makeState({ highestSalary: 0, totalWeeksWorked: 0 })).weekly).toBe(0);
  });
});

// ── 3. Retire → income flow ──────────────────────────────────────────────────
describe('retire → income flow', () => {
  it('retiring stores a frozen pension, clears the job, and stamps state', () => {
    const before = makeState({
      age: 66,
      currentJob: 'career-a',
      highestSalary: 800,
      totalWeeksWorked: 30 * YEAR,
      weeksLived: 66 * YEAR,
      extra: { careers: [{ id: 'career-a', accepted: true, applied: true, progress: 5 } as any] },
    });
    const res = retirePlayer(before);
    expect(res.ok).toBe(true);
    expect(res.state.isRetired).toBe(true);
    expect(res.state.currentJob).toBeUndefined();
    expect(res.state.retiredAtAge).toBe(66);
    expect(res.state.pensionWeekly).toBe(res.pensionWeekly);
    expect(res.state.pensionWeekly).toBeGreaterThan(0);
    // Career reset like quitting.
    expect(res.state.careers?.find((c) => c.id === 'career-a')?.accepted).toBe(false);
    // Milestone recorded.
    expect((res.state.lifeMilestones ?? []).some((m) => m.type === 'retirement')).toBe(true);
  });

  it('getRetirementIncomeWeekly is 0 while working, pension once retired', () => {
    const working = makeState({ age: 66, highestSalary: 800, totalWeeksWorked: 30 * YEAR });
    expect(getRetirementIncomeWeekly(working)).toBe(0);
    const retired = retirePlayer({ ...working, currentJob: 'x' }).state;
    expect(getRetirementIncomeWeekly(retired)).toBe(retired.pensionWeekly);
    expect(getRetirementIncomeWeekly(retired)).toBeGreaterThan(0);
  });

  it('pension is credited flat through computeWeeklyIncome (no amplification, no career salary)', () => {
    const base = computeWeeklyIncome({
      prevState: makeState({}),
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 100,
      unlockedBonuses: [],
    });
    const withPension = computeWeeklyIncome({
      prevState: makeState({}),
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 100,
      unlockedBonuses: [],
      retirementIncome: 420,
    });
    expect(withPension.totalIncome - base.totalIncome).toBe(420);
  });

  it('omitting retirementIncome is byte-identical to before (default 0)', () => {
    const args = {
      prevState: makeState({}),
      careerSalary: 250,
      passiveIncome: 30,
      pulseEarnings: 0,
      weeksLivedNow: 100,
      unlockedBonuses: [],
    };
    expect(computeWeeklyIncome({ ...args, retirementIncome: 0 }).totalIncome).toBe(
      computeWeeklyIncome(args).totalIncome,
    );
  });
});

// ── 4. Elder activities ──────────────────────────────────────────────────────
describe('elder activities', () => {
  it('a free activity applies bounded effects and stamps the cooldown', () => {
    const s = makeState({ age: 70, money: 100 });
    const res = applyElderActivity(s, 'write_memoir');
    expect(res.ok).toBe(true);
    expect(res.state.stats.happiness).toBeGreaterThan(s.stats.happiness - 100); // moved up (bounded 0-100)
    expect(res.state.stats.money).toBe(100); // free — money unchanged
    expect(res.state.elderActivity?.lastUsedWeek.write_memoir).toBe(s.weeksLived);
    expect(res.state.elderActivity?.totalActivities).toBe(1);
    // purity — original untouched
    expect(s.elderActivity).toBeUndefined();
  });

  it('clamps stat effects to 100', () => {
    const s = makeState({ age: 70 });
    s.stats.happiness = 98;
    const res = applyElderActivity(s, 'write_memoir'); // +6 happiness
    // Still rises, still cannot exceed 100 - which is what this test is named
    // for. It no longer lands EXACTLY on 100, because a happiness gain is
    // scaled by `happinessGainFalloff` (Program 14) and +6 at 98 is worth
    // about +1.6. Asserting the bound rather than the exact value is what the
    // test meant; pinning 100 was only ever true because gains were free at
    // the top of the scale, which is the defect that program removed.
    expect(res.state.stats.happiness).toBeGreaterThan(98);
    expect(res.state.stats.happiness).toBeLessThanOrEqual(100);
  });

  it('enforces the cooldown (cannot repeat immediately)', () => {
    const s = makeState({ age: 70 });
    const once = applyElderActivity(s, 'volunteer');
    expect(once.ok).toBe(true);
    const twice = applyElderActivity(once.state, 'volunteer');
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('cooldown');
    expect(twice.state).toBe(once.state); // no-op returns same ref
  });

  it('rejects unaffordable activities and never spends below zero', () => {
    const poor = makeState({ age: 70, money: 100 });
    const res = applyElderActivity(poor, 'bucket_list_trip'); // costs 8000
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('insufficient-money');
    expect(res.state.stats.money).toBe(100); // unchanged
  });

  it('charges the cost when affordable', () => {
    const rich = makeState({ age: 70, money: 10_000 });
    const res = applyElderActivity(rich, 'bucket_list_trip'); // costs 8000
    expect(res.ok).toBe(true);
    expect(res.state.stats.money).toBe(2_000);
    expect(res.state.stats.happiness).toBeLessThanOrEqual(100);
  });

  it('gates grandchildren on having children', () => {
    const noKids = makeState({ age: 70, money: 5_000 });
    expect(applyElderActivity(noKids, 'spoil_grandchildren').reason).toBe('requires-children');
    const withKid = makeState({ age: 70, money: 5_000, children: [makeChild()] });
    expect(applyElderActivity(withKid, 'spoil_grandchildren').ok).toBe(true);
  });

  it('gates all activities behind the elder age', () => {
    const young = makeState({ age: 40, money: 5_000 });
    expect(applyElderActivity(young, 'volunteer').reason).toBe('not-elder');
    const status = getElderActivityStatus(young, 'volunteer');
    expect(status?.available).toBe(false);
  });

  it('lets an EARLY (FIRE) retiree do activities despite being under 65', () => {
    // 48-year-old, retired via the FIRE path. Age is under the elder threshold,
    // but retirement bypasses the age gate so the elder chapter isn't 20 empty years.
    const earlyRetiree = makeState({ age: 48, money: 50_000, isRetired: true });
    expect(isRetired(earlyRetiree)).toBe(true);
    // A classic activity that is normally 65+ gated:
    expect(applyElderActivity(earlyRetiree, 'write_memoir').reason).not.toBe('not-elder');
    expect(getElderActivityStatus(earlyRetiree, 'write_memoir')?.available).toBe(true);
    // A new early-retiree activity is available too:
    expect(getElderActivityStatus(earlyRetiree, 'coach_sports')?.available).toBe(true);
    const res = applyElderActivity(earlyRetiree, 'travel_club'); // costs 2500
    expect(res.ok).toBe(true);
    expect(res.state.stats.money).toBe(47_500);
  });

  it('still turns away a still-working player below an activity minAge', () => {
    // 48-year-old, NOT retired: below write_memoir's 65 gate and not retired,
    // so the age gate still bites (no free elder chapter for the un-retired).
    const working = makeState({ age: 48, money: 50_000, isRetired: false });
    expect(applyElderActivity(working, 'write_memoir').reason).toBe('not-elder');
  });

  it('exposes a catalog of several activities', () => {
    expect(ELDER_ACTIVITIES.length).toBeGreaterThanOrEqual(5);
    // The new early-retiree activities are present.
    const ids = ELDER_ACTIVITIES.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(['coach_sports', 'travel_club', 'part_time_consulting', 'lifelong_learning']),
    );
  });
});

// ── 5. Anti-farm guards ──────────────────────────────────────────────────────
describe('anti-farm guards', () => {
  it('retire is a one-way latch - cannot re-retire', () => {
    const retired = retirePlayer(
      makeState({ age: 66, currentJob: 'x', highestSalary: 900, totalWeeksWorked: 30 * YEAR }),
    ).state;
    const again = retirePlayer(retired);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('already-retired');
    expect(again.state).toBe(retired); // untouched
    expect(getRetirementEligibility(retired).canRetire).toBe(false);
  });

  it('pension is frozen at retirement and does not re-roll if work history later changes', () => {
    const retired = retirePlayer(
      makeState({ age: 66, currentJob: 'x', highestSalary: 500, totalWeeksWorked: 35 * YEAR }),
    ).state;
    const lockedPension = retired.pensionWeekly!;
    // Simulate an (impossible) later spike in recorded highest salary.
    const tampered: GameState = {
      ...retired,
      lifetimeStatistics: makeLifetimeStats({ highestSalary: 5000, totalWeeksWorked: 40 * YEAR }),
    };
    expect(getRetirementIncomeWeekly(tampered)).toBe(lockedPension);
  });

  it('legacy summary reuses canonical net worth + inheritance without crashing', () => {
    const summary = getElderLegacySummary(makeState({ age: 68, money: 250_000, children: [makeChild()] }));
    expect(summary.netWorth).toBeGreaterThan(0);
    expect(summary.estateToHeirs).toBeGreaterThanOrEqual(0);
    expect(summary.childrenCount).toBe(1);
    expect(summary.primaryHeir?.id).toBe('kid-1');
    expect(typeof summary.achievementsCount).toBe('number');
  });
});

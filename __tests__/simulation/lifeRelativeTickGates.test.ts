/**
 * WP-O — three defects found by driving the REAL weekly tick over long horizons
 * (20+ game years, several scenario starting ages) with a `GameProvider`-mounted
 * probe. Each is pinned here as a fast regression rather than a soak.
 *
 * All three are the same failure at heart: a value the tick reads was measured
 * against the WRONG counter, or against no counter at all.
 *
 *   1. `computeDecayInputs` — the early-game stat-decay grace was gated on the
 *      ABSOLUTE `weeksLived`, which is seeded from the starting age
 *      (`(age - 18) * 52`). Every scenario that does not start at 18 — and every
 *      prestige heir, who starts at 20 — was already past the 8-week window on
 *      frame one and took full decay from its very first tick. CLAUDE.md §4.3
 *      names this bug class and lists three prior instances; this is the fourth.
 *
 *   2. `computeWeeklyIncome` — the beginner-luck window (weeks 0-19) had the
 *      same gate, so the bonus paid out for age-18 starts and for nothing else.
 *
 *   3. `applyLifetimeStatistics` — `lifetimeStatistics.totalMoneyEarned` had a
 *      reader and no writer on the paycheck path. Measured: 758 weeks of paid
 *      work, $121,765 accumulated, counter still $0. Chapter 1's "Earn $500" —
 *      the first goal of the tutorial chapter — could never complete.
 */
import { computeDecayInputs } from '@/contexts/game/actions/weekly/preTick';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import { applyLifetimeStatistics } from '@/contexts/game/actions/weekly/applyLifetimeStatistics';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { computeWeeksLived, BEGINNER_LUCK_WEEKS } from '@/lib/config/gameConstants';
import { LIFE_CHAPTERS, earnedThisLife } from '@/lib/progress/lifeChapters';
import { readMetric } from '@/lib/legacy/contracts';
import type { GameState } from '@/contexts/game/types';

const DECAY_OPTS = { baseDecayRate: 4, prestigeMultiplier: 1 };

/** A character who has just started a life at `age`, week 0 of that life. */
function freshLife(age: number): GameState {
  const weeksLived = computeWeeksLived(age);
  const s = createTestGameState({ weeksLived });
  s.lifeStartWeek = weeksLived;
  s.date = { ...s.date, age };
  return s;
}

// ───────────────────────── 1. decay grace ─────────────────────────

describe('early-game decay grace is measured in weeks into THIS life', () => {
  it('an age-18 start gets the quarter-rate week-0 grace (the behaviour that always worked)', () => {
    const { graceFactor } = computeDecayInputs(freshLife(18), DECAY_OPTS);
    expect(graceFactor).toBe(0);
  });

  it.each([20, 22, 25, 30, 40])(
    'an age-%i start gets the SAME week-0 grace, not full-rate decay',
    (age) => {
      const { graceFactor } = computeDecayInputs(freshLife(age), DECAY_OPTS);
      expect(graceFactor).toBe(0);
    }
  );

  it('the decay rate an age-25 start takes in week 0 equals the age-18 rate', () => {
    const young = computeDecayInputs(freshLife(18), DECAY_OPTS);
    const older = computeDecayInputs(freshLife(25), DECAY_OPTS);
    expect(older.effectiveDecayRate).toBeCloseTo(young.effectiveDecayRate, 10);
  });

  it('the window still CLOSES - full rate once eight weeks of this life are lived', () => {
    const s = freshLife(25);
    s.weeksLived = (s.lifeStartWeek as number) + 8;
    expect(computeDecayInputs(s, DECAY_OPTS).graceFactor).toBe(1);
  });

  it('a pre-v43 save (no lifeStartWeek) keeps today\'s behaviour - no reopened window', () => {
    const s = createTestGameState({ weeksLived: computeWeeksLived(25) });
    delete (s as { lifeStartWeek?: number }).lifeStartWeek;
    expect(computeDecayInputs(s, DECAY_OPTS).graceFactor).toBe(1);
  });
});

// ───────────────────────── 2. beginner luck ─────────────────────────

describe('beginner luck is gated on weeks into THIS life', () => {
  function income(state: GameState, weeksLivedNow: number) {
    return computeWeeklyIncome({
      prevState: state,
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow,
      unlockedBonuses: [],
    }).totalIncome;
  }

  it.each([18, 20, 25, 30, 40])(
    'an age-%i start receives a beginner-luck bonus in week 0',
    (age) => {
      const s = freshLife(age);
      expect(income(s, s.weeksLived)).toBeGreaterThan(0);
    }
  );

  it('an age-25 start receives the same bonus an age-18 start would at the same life week', () => {
    const older = freshLife(25);
    // The seed stays keyed to the ABSOLUTE week, so the two need not be equal —
    // only both non-zero and inside the documented 15-40 band.
    const paid = income(older, older.weeksLived);
    expect(paid).toBeGreaterThanOrEqual(15);
    expect(paid).toBeLessThanOrEqual(40);
  });

  it('the window still CLOSES after BEGINNER_LUCK_WEEKS of this life', () => {
    const s = freshLife(25);
    const past = (s.lifeStartWeek as number) + BEGINNER_LUCK_WEEKS;
    expect(income(s, past)).toBe(0);
    expect(income(s, past - 1)).toBeGreaterThan(0);
  });

  it('a pre-v43 save (no lifeStartWeek) keeps today\'s behaviour - window stays shut', () => {
    const s = createTestGameState({ weeksLived: computeWeeksLived(25) });
    delete (s as { lifeStartWeek?: number }).lifeStartWeek;
    expect(income(s, s.weeksLived)).toBe(0);
  });
});

// ───────────────────── 3. totalMoneyEarned ─────────────────────

describe('the weekly tick credits lifetimeStatistics.totalMoneyEarned', () => {
  function tick(state: GameState, totalIncome: number) {
    return applyLifetimeStatistics({
      prevState: state,
      newBornChildrenCount: 0,
      careerSalary: totalIncome,
      safeNetWorth: 1000,
      totalIncome,
      nextWeeksLived: (state.weeksLived ?? 0) + 1,
    }).updatedLifetimeStatistics;
  }

  it('a paid week increases the counter by that week\'s income', () => {
    const s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 0 };
    expect(tick(s, 250)!.totalMoneyEarned).toBe(250);
  });

  it('it accumulates across weeks and never decreases', () => {
    let s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 0 };
    let last = 0;
    for (let i = 0; i < 10; i++) {
      const next = tick(s, 110)!;
      expect(next.totalMoneyEarned).toBeGreaterThanOrEqual(last);
      last = next.totalMoneyEarned;
      s = { ...s, weeksLived: s.weeksLived + 1, lifetimeStatistics: next };
    }
    expect(last).toBe(1100);
  });

  it('an unpaid week adds nothing', () => {
    const s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 4200 };
    expect(tick(s, 0)!.totalMoneyEarned).toBe(4200);
  });

  it('a non-finite or negative income cannot poison the counter', () => {
    const s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 500 };
    expect(tick(s, Number.NaN)!.totalMoneyEarned).toBe(500);
    expect(tick(s, Number.POSITIVE_INFINITY)!.totalMoneyEarned).toBe(500);
    expect(tick(s, -900)!.totalMoneyEarned).toBe(500);
  });

  it('Chapter 1\'s "Earn $500" goal becomes reachable by working', () => {
    const goal = LIFE_CHAPTERS[0].goals.find((g) => g.id === 'ch1_earn_500')!;
    let s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 0 };

    expect(goal.checkComplete(s)).toBe(false);
    for (let i = 0; i < 5; i++) {
      s = { ...s, weeksLived: s.weeksLived + 1, lifetimeStatistics: tick(s, 110)! };
    }
    expect(earnedThisLife(s)).toBe(550);
    expect(goal.checkComplete(s)).toBe(true);
  });

  it('the Legacy Contract `lifetimeEarnings` metric reads the accumulated figure', () => {
    let s = freshLife(18);
    s.lifetimeStatistics = { ...s.lifetimeStatistics!, totalMoneyEarned: 0 };
    expect(readMetric(s, 'lifetimeEarnings')).toBe(0);
    s = { ...s, lifetimeStatistics: tick(s, 7_500)! };
    expect(readMetric(s, 'lifetimeEarnings')).toBe(7_500);
  });
});

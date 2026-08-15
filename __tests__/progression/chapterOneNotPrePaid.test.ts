/**
 * Chapter 1 must not be two-thirds finished before the player does anything.
 *
 * Found by playing the game, not by reading it: a fresh Food Courier life
 * (age 20, $1,500) opened on "Chapter 1: Fresh Start — 2/3 goals complete" in
 * week 1, with only "Get Hired" outstanding.
 *
 * Both pre-completions were the same mistake in different clothes — a goal
 * measured against an ABSOLUTE value that a new life does not start at zero:
 *
 *   Survive 4 Weeks   `weeksLived >= 4`. `weeksLived` is seeded from the
 *                     starting age (`computeWeeksLived` = `(age - 18) * 52`),
 *                     so an age-20 character begins at 104 and an age-25 one at
 *                     364. True at birth for every scenario except age 18.
 *   Earn $500         `wealthMark >= 500`, i.e. money HELD. Every scenario
 *                     starts with cash; Food Courier starts with $1,500.
 *
 * The chapter pays `perGoalReward` per goal, so this also banked $200 + 10 gems
 * for two things nobody did — in the tutorial chapter, whose whole job is to
 * pace and teach the first month.
 *
 * The `weeksLived` half is the THIRD time this trap has been hit. The
 * first-session coach retired before it ever rendered for the same reason, and
 * `coachStep.ts` carries a comment saying `FirstWeekGuide` had already warned
 * about it and the warning was not applied. Hence `lifeStartWeek` (v43) and a
 * shared `weeksInThisLife` helper rather than another local fix.
 */
import {
  LIFE_CHAPTERS,
  getChapterProgress,
  weeksInThisLife,
  earnedThisLife,
} from '@/lib/progress/lifeChapters';
import { computeWeeksLived } from '@/src/features/onboarding/gameStateBuilder';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const CH1 = LIFE_CHAPTERS[0];

/** A life exactly as the onboarding builder makes one, for a given start age. */
const freshLife = (age: number, cash: number, over: Partial<GameState> = {}): GameState => {
  const weeksLived = computeWeeksLived(age);
  const base = createTestGameState();
  return createTestGameState({
    weeksLived,
    lifeStartWeek: weeksLived,
    currentJob: undefined,
    stats: { ...base.stats, money: cash },
    lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 0 },
    ...over,
  });
};

const done = (state: GameState) =>
  getChapterProgress(CH1, state).goals.filter((g) => g.complete).map((g) => g.id);

describe('a brand-new life starts chapter 1 at zero', () => {
  it('completes nothing on week 1 of an age-20 start (the reported case)', () => {
    // The exact life that showed "2/3 goals complete": Food Courier, age 20,
    // $1,500 starting cash.
    expect(done(freshLife(20, 1_500))).toEqual([]);
  });

  it('and nothing for a late start either, where the numbers are worse', () => {
    // Age 25 begins at weeksLived 364 — 91x the "4 weeks" threshold.
    expect(computeWeeksLived(25)).toBeGreaterThan(300);
    expect(done(freshLife(25, 5_000))).toEqual([]);
  });

  it('the age-18 case still works — it is the one that was always right', () => {
    expect(computeWeeksLived(18)).toBe(0);
    expect(done(freshLife(18, 0))).toEqual([]);
  });
});

describe('and the goals complete when actually achieved', () => {
  it('surviving four weeks of THIS life completes the survival goal', () => {
    const start = computeWeeksLived(20);
    const after4 = freshLife(20, 1_500, { weeksLived: start + 4, lifeStartWeek: start });

    expect(weeksInThisLife(after4)).toBe(4);
    expect(done(after4)).toContain('ch1_survive');
  });

  it('three weeks is not four (the off-by-one boundary)', () => {
    const start = computeWeeksLived(20);
    const after3 = freshLife(20, 1_500, { weeksLived: start + 3, lifeStartWeek: start });

    expect(done(after3)).not.toContain('ch1_survive');
  });

  it('EARNING $500 completes the money goal; holding $50,000 does not', () => {
    const base = createTestGameState();
    const rich = freshLife(20, 50_000);
    expect(done(rich)).not.toContain('ch1_earn_500');

    const earner = freshLife(20, 0, {
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 500 },
    });
    expect(done(earner)).toContain('ch1_earn_500');
    expect(earnedThisLife(earner)).toBe(500);
  });

  it('getting hired completes the goal that was already honest (the control)', () => {
    expect(done(freshLife(20, 1_500, { currentJob: 'food_courier' }))).toEqual(['ch1_get_job']);
  });
});

describe('weeksInThisLife degrades safely', () => {
  it('falls back to the raw counter when no baseline was ever stamped', () => {
    // A save written before v43 has no `lifeStartWeek`. It cannot grow one, so
    // readers keep the behaviour that save already has rather than inventing a
    // baseline and silently un-completing a goal the player was paid for.
    const legacy = createTestGameState({ weeksLived: 104, lifeStartWeek: undefined });
    expect(weeksInThisLife(legacy)).toBe(104);
  });

  it('never returns a negative span', () => {
    // A baseline ahead of the counter would mean a corrupt save; 0 is the only
    // sane answer and a negative would make `checkProgress` render backwards.
    const odd = createTestGameState({ weeksLived: 10, lifeStartWeek: 999 });
    expect(weeksInThisLife(odd)).toBe(0);
  });

  it('survives NaN on either side', () => {
    expect(weeksInThisLife(createTestGameState({ weeksLived: NaN }))).toBe(0);
    expect(weeksInThisLife(createTestGameState({ weeksLived: 50, lifeStartWeek: NaN }))).toBe(50);
  });
});

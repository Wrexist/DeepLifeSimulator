/**
 * "Survive 4 weeks" must not be complete on frame one.
 *
 * The beginner ladder in `src/features/onboarding/achievementsData.ts` measured
 * the RAW `weeksLived` counter. That counter is ABSOLUTE and seeded from the
 * starting age (`computeWeeksLived` = `(age - 18) * 52`), so an age-20
 * character begins at 104 and an age-25 one at 364 — CLAUDE.md §4.2. Every one
 * of the four week-threshold achievements was therefore already satisfied
 * before the first tap for 7 of the 8 shipped scenario ages:
 *
 *   beginner_survivor          4 weeks    complete at every age but 18
 *   beginner_getting_started  10 weeks    complete at every age but 18
 *   milestone_100_weeks      100 weeks    complete from age 20 up
 *   milestone_500_weeks      500 weeks    complete from age 28 up
 *
 * — and they are the FIRST rungs of the early-progression ladder, the ones
 * whose whole job is to pace the first session. `joyful_life` is the same
 * defect pointing the other way: it divides `totalHappiness` (one reading per
 * week PLAYED, 0 at the start of every life) by the absolute counter, so an
 * age-25 character's average happiness read ~2 instead of ~80.
 *
 * The fix has to be careful in a way the chapter-goal fix (`chapterOneNotPrePaid`)
 * did not: achievement COMPLETION is derived from live state on every render,
 * while only the CLAIM is stored, in `claimedProgressAchievements`. Switching
 * the measurement naively would drop an already-collected achievement back out
 * of the "Completed" count and out of `isAchievementEarned` — which feeds
 * `getSatisfiedAchievementIds`, the perk unlocks and the prestige snapshot.
 * So the counters short-circuit to the goal for an id that is already claimed.
 */
import {
  achievements,
  achievementProgress,
  isAchievementEarned,
  type Achievement,
} from '@/src/features/onboarding/achievementsData';
import { getSatisfiedAchievementIds } from '@/lib/progress/earnedAchievements';
import { computeWeeksLived } from '@/lib/config/gameConstants';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** The four achievements whose goal is a number of weeks lived. */
const WEEK_GOALS: { id: string; goal: number }[] = [
  { id: 'beginner_survivor', goal: 4 },
  { id: 'beginner_getting_started', goal: 10 },
  { id: 'milestone_100_weeks', goal: 100 },
  { id: 'milestone_500_weeks', goal: 500 },
];

const byId = (id: string): Achievement => {
  const a = achievements.find((x) => x.id === id);
  if (!a) throw new Error(`achievement ${id} not found`);
  return a;
};

/** A life exactly as `gameStateBuilder` seeds one for a given start age. */
const freshLife = (age: number, over: Partial<GameState> = {}): GameState => {
  const weeksLived = computeWeeksLived(age);
  return createTestGameState({
    weeksLived,
    lifeStartWeek: weeksLived,
    claimedProgressAchievements: [],
    ...over,
  });
};

/** Weeks played into a life that started at `age`. */
const afterWeeks = (age: number, weeks: number, over: Partial<GameState> = {}): GameState => {
  const start = computeWeeksLived(age);
  return freshLife(age, { weeksLived: start + weeks, ...over });
};

const SHIPPED_AGES = [18, 19, 20, 22, 25, 28, 30, 40];

describe('week-threshold achievements are not pre-completed at birth', () => {
  it.each(SHIPPED_AGES)('an age-%i start has completed none of them', (age) => {
    const state = freshLife(age);
    for (const { id } of WEEK_GOALS) {
      expect(`${id} @ age ${age}: ${isAchievementEarned(state, id)}`).toBe(
        `${id} @ age ${age}: false`
      );
    }
  });

  it('the reported case: a fresh age-25 start has NOT survived 4 weeks', () => {
    // 364 absolute weeks — 91x the threshold — and zero weeks actually played.
    const state = freshLife(25);
    expect(state.weeksLived).toBe(364);
    expect(achievementProgress(state, byId('beginner_survivor'))).toBe(0);
    expect(isAchievementEarned(state, 'beginner_survivor')).toBe(false);
  });

  it('and it does not appear in the satisfied set the perks/prestige read', () => {
    expect(getSatisfiedAchievementIds(freshLife(25))).not.toContain('beginner_survivor');
  });
});

describe('they complete when the weeks are actually played', () => {
  it('four played weeks completes Survivor for an age-25 life', () => {
    const state = afterWeeks(25, 4);
    expect(achievementProgress(state, byId('beginner_survivor'))).toBeGreaterThanOrEqual(1);
    expect(isAchievementEarned(state, 'beginner_survivor')).toBe(true);
  });

  it('three played weeks is not four (the off-by-one boundary)', () => {
    expect(isAchievementEarned(afterWeeks(25, 3), 'beginner_survivor')).toBe(false);
  });

  it('each goal fires at exactly its own week count, whatever the start age', () => {
    for (const age of SHIPPED_AGES) {
      for (const { id, goal } of WEEK_GOALS) {
        expect(`${id}@${age}-1: ${isAchievementEarned(afterWeeks(age, goal - 1), id)}`).toBe(
          `${id}@${age}-1: false`
        );
        expect(`${id}@${age}: ${isAchievementEarned(afterWeeks(age, goal), id)}`).toBe(
          `${id}@${age}: true`
        );
      }
    }
  });

  it('the age-18 case is unchanged — it is the one that was always right', () => {
    expect(computeWeeksLived(18)).toBe(0);
    expect(isAchievementEarned(freshLife(18), 'beginner_survivor')).toBe(false);
    expect(isAchievementEarned(afterWeeks(18, 4), 'beginner_survivor')).toBe(true);
    expect(isAchievementEarned(afterWeeks(18, 100), 'milestone_100_weeks')).toBe(true);
  });
});

describe('an already-recorded claim is honoured, never revoked', () => {
  it('a claimed Survivor still reads complete in a life where the weeks no longer add up', () => {
    // The shape of an existing save: claimed under the old absolute rule, at a
    // point where weeks-in-this-life is nowhere near the goal.
    const claimed = freshLife(25, { claimedProgressAchievements: ['beginner_survivor'] });

    expect(achievementProgress(claimed, byId('beginner_survivor'))).toBeGreaterThanOrEqual(1);
    expect(isAchievementEarned(claimed, 'beginner_survivor')).toBe(true);
    expect(getSatisfiedAchievementIds(claimed)).toContain('beginner_survivor');
  });

  it('holds for every one of the four, and only for the one claimed', () => {
    for (const { id } of WEEK_GOALS) {
      const state = freshLife(30, { claimedProgressAchievements: [id] });
      for (const other of WEEK_GOALS) {
        expect(`${other.id} given ${id}: ${isAchievementEarned(state, other.id)}`).toBe(
          `${other.id} given ${id}: ${other.id === id}`
        );
      }
    }
  });

  it('the short-circuit reports exactly the goal — it cannot inflate progress', () => {
    const claimed = freshLife(40, { claimedProgressAchievements: ['milestone_500_weeks'] });
    const spec = byId('milestone_500_weeks').progressSpec;
    expect(spec.kind).toBe('counter');
    if (spec.kind !== 'counter') throw new Error('unreachable');
    expect(spec.current(claimed)).toBe(500);
    expect(achievementProgress(claimed, byId('milestone_500_weeks'))).toBe(1);
  });

  it('a claim does not survive into the NEXT life — prestige wipes the store', () => {
    // `createResetGameState` clears `claimedProgressAchievements` and re-stamps
    // `lifeStartWeek`, so the heir re-earns these against their own weeks. The
    // gem is still minted only once ever, via `prestige.claimedAchievementIds`.
    const heir = freshLife(18, { claimedProgressAchievements: [] });
    expect(isAchievementEarned(heir, 'beginner_survivor')).toBe(false);
  });
});

describe('pre-v43 saves are untouched', () => {
  it('with no lifeStartWeek the measurement falls back to the absolute counter', () => {
    // `lifeStartWeek` is a v43 carve-out with no backfill, so an older save has
    // no record of when its life began. Those saves keep exactly the behaviour
    // they have today rather than silently un-completing anything.
    const legacy = createTestGameState({ weeksLived: 400, claimedProgressAchievements: [] });
    expect(legacy.lifeStartWeek).toBeUndefined();
    expect(isAchievementEarned(legacy, 'beginner_survivor')).toBe(true);
    expect(isAchievementEarned(legacy, 'milestone_100_weeks')).toBe(true);
    expect(isAchievementEarned(legacy, 'milestone_500_weeks')).toBe(false);
  });
});

describe('average happiness divides by weeks PLAYED', () => {
  const joyful = () => byId('joyful_life');

  it('an age-25 life at 80 happiness per played week reaches the goal', () => {
    // 10 played weeks at 85 happiness. Against the absolute counter this was
    // 850/374 = 2.3 — the achievement was effectively unreachable for every
    // scenario that does not start at 18.
    const state = afterWeeks(25, 10, { totalHappiness: 850 });
    const spec = joyful().progressSpec;
    if (spec.kind !== 'counter') throw new Error('joyful_life should be a counter');

    expect(spec.current(state)).toBeCloseTo(85, 5);
    expect(isAchievementEarned(state, 'joyful_life')).toBe(true);
  });

  it('a miserable life still fails it', () => {
    const state = afterWeeks(25, 10, { totalHappiness: 300 });
    expect(isAchievementEarned(state, 'joyful_life')).toBe(false);
  });

  it('week zero does not divide by zero', () => {
    const spec = joyful().progressSpec;
    if (spec.kind !== 'counter') throw new Error('joyful_life should be a counter');
    const v = spec.current(freshLife(25, { totalHappiness: 0 }));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(0);
  });
});

describe('the counters stay null-safe', () => {
  it('every week-goal accessor survives a stripped or partial state', () => {
    const shapes: unknown[] = [{}, { weeksLived: undefined }, { claimedProgressAchievements: null }];
    for (const { id } of WEEK_GOALS) {
      const spec = byId(id).progressSpec;
      if (spec.kind !== 'counter') throw new Error(`${id} should be a counter`);
      for (const gs of shapes) {
        // DELIBERATE-CORRUPTION: this test proves the accessor survives a
        // stripped/partial state, so it must construct garbage a factory
        // cannot produce.
        const v = spec.current(gs as GameState);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('no week-threshold achievement is left reading the raw counter', () => {
  it('the four are the whole set, and none of them touches weeksLived directly', () => {
    // A source guard: the next achievement added with a week goal must go
    // through the same helper. `weeksLived` may still appear in this file for
    // genuinely absolute measures, so the check is scoped to the four ids.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/features/onboarding/achievementsData.ts'),
      'utf8'
    );

    for (const { id } of WEEK_GOALS) {
      const block = src.slice(src.indexOf(`id: '${id}'`), src.indexOf(`id: '${id}'`) + 400);
      expect(`${id}: ${/current:\s*gs\s*=>\s*gs\.weeksLived/.test(block)}`).toBe(`${id}: false`);
      expect(`${id}: ${block.includes('weeksTowardGoal(')}`).toBe(`${id}: true`);
    }
  });
});

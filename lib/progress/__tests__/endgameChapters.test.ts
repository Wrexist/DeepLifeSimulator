/**
 * Chapters 8-10 (2026-08-25) — the ladder to the end of a natural lifespan.
 *
 * Chapter 7 completes at $10M / age 60, roughly the prestige gate, so the
 * direction system and the prestige gate expired together and a marathon
 * single life had no ladder at all past that point.
 *
 * The invariant that matters most here is REACHABILITY (tasks/lessons.md
 * 2026-08-10 — two content goals shipped unreachable). Chapters pay only on
 * FULL completion, so a single impossible goal makes the whole chapter dead
 * reward.
 */
import { LIFE_CHAPTERS, getChapterProgress } from '../lifeChapters';
import { LONGEVITY_PIVOT_MAX } from '@/lib/statistics/lifeExpectancy';
import { achievements } from '@/src/features/onboarding/achievementsData';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const chapter = (id: string) => {
  const found = LIFE_CHAPTERS.find((c) => c.id === id);
  if (!found) throw new Error(`chapter ${id} missing`);
  return found;
};

const ENDGAME = ['ch8_long_reign', 'ch9_great_house', 'ch10_written_in_stone'];

describe('chapters 8-10', () => {
  it('continue the ladder in order, past chapter 7', () => {
    expect(chapter('ch8_long_reign').weekRange[0]).toBe(400);
    expect(chapter('ch9_great_house').weekRange[0]).toBe(600);
    expect(chapter('ch10_written_in_stone').weekRange[0]).toBe(900);
    // Strictly after ch7, and in array order — getActiveChapter walks the
    // array and returns the first incomplete one.
    const ids = LIFE_CHAPTERS.map((c) => c.id);
    expect(ids.indexOf('ch7_life_sealed')).toBeLessThan(ids.indexOf('ch8_long_reign'));
    expect(ids.indexOf('ch8_long_reign')).toBeLessThan(ids.indexOf('ch9_great_house'));
    expect(ids.indexOf('ch9_great_house')).toBeLessThan(ids.indexOf('ch10_written_in_stone'));
  });

  it('has unique goal ids across the whole ladder', () => {
    const goalIds = LIFE_CHAPTERS.flatMap((c) => c.goals.map((g) => g.id));
    expect(new Set(goalIds).size).toBe(goalIds.length);
  });

  it('no goal is already complete at the start of a fresh life, at any start age', () => {
    // The ch1 "Survive 4 Weeks" bug class: weeksLived is seeded from starting
    // age, so a raw-counter check is true at birth for older scenarios.
    for (const startAge of [18, 20, 25, 30]) {
      const base = createTestGameState();
      const s = createTestGameState({
        weeksLived: (startAge - 18) * 52,
        lifeStartWeek: (startAge - 18) * 52,
        date: { ...base.date, age: startAge },
      });
      for (const id of ENDGAME) {
        expect(getChapterProgress(chapter(id), s).completedGoals).toBe(0);
      }
    }
  });

  it('never gates a chapter on outliving the life-expectancy ceiling', () => {
    // An age goal above the mortality ceiling would be a coin flip on the
    // tail, and chapters pay nothing until every goal is met.
    const ageTargets = ENDGAME.flatMap((id) =>
      chapter(id)
        .goals.map((g) => /(\d+)(?:st|nd|rd|th)? birthday|Turn (\d+)/.exec(g.description + ' ' + g.title))
        .filter(Boolean)
        .map((m) => Number(m![1] ?? m![2])),
    );
    expect(ageTargets.length).toBeGreaterThan(0); // the regex actually matched
    for (const age of ageTargets) expect(age).toBeLessThan(LONGEVITY_PIVOT_MAX);
    // The capstone deliberately carries NO age goal at all.
    const capstoneAges = chapter('ch10_written_in_stone').goals.filter((g) =>
      /Turn \d+/.test(g.title),
    );
    expect(capstoneAges).toHaveLength(0);
  });

  it('never asks for more achievements than the game ships', () => {
    const s = createTestGameState({
      claimedProgressAchievements: achievements.map((a) => a.id),
    });
    for (const id of ENDGAME) {
      const achGoals = chapter(id).goals.filter((g) => /achievements/i.test(g.description));
      for (const g of achGoals) expect(g.checkComplete(s)).toBe(true);
    }
  });

  it('escalates monotonically against chapter 7', () => {
    // A rich, decorated, long-lived state that clears ch7 outright must NOT
    // clear the chapters above it — otherwise the ladder has no rungs.
    const base = createTestGameState();
    const s = createTestGameState({
      weeksLived: 3000,
      lifeStartWeek: 0,
      date: { ...base.date, age: 62 },
      stats: { ...base.stats, money: 12_000_000 },
      claimedProgressAchievements: achievements.slice(0, 42).map((a) => a.id),
      companies: [
        { id: 'a', name: 'A', type: 'factory', weeklyIncome: 100, level: 1 },
        { id: 'b', name: 'B', type: 'ai', weeklyIncome: 100, level: 1 },
        { id: 'c', name: 'C', type: 'restaurant', weeklyIncome: 100, level: 1 },
      ] as never,
    });
    expect(getChapterProgress(chapter('ch7_life_sealed'), s).isComplete).toBe(true);
    for (const id of ENDGAME) {
      expect(getChapterProgress(chapter(id), s).isComplete).toBe(false);
    }
  });

  it('every endgame goal reports movable progress, not a pinned 0 or 1', () => {
    const base = createTestGameState();
    const poor = createTestGameState({ stats: { ...base.stats, money: 0 } });
    const rich = createTestGameState({
      weeksLived: 3000,
      lifeStartWeek: 0,
      date: { ...base.date, age: 80 },
      stats: { ...base.stats, money: 2_000_000_000, health: 90, happiness: 90 },
      claimedProgressAchievements: achievements.slice(0, 90).map((a) => a.id),
    });
    for (const id of ENDGAME) {
      for (const goal of chapter(id).goals) {
        const a = goal.checkProgress(poor);
        const b = goal.checkProgress(rich);
        for (const v of [a, b]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        expect(b).toBeGreaterThanOrEqual(a);
      }
    }
  });
});

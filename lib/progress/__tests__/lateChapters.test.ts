/**
 * Chapters 6-7 (2026-08-24) — the ladder past week 100.
 *
 * The chapter ladder used to end at ch5, and lib/legacy/contracts.ts records
 * the consequence: "the Life Chapter ladder is exhausted by week ~100". These
 * tests pin that the new chapters follow the file's own safety rules — no
 * goal completes at birth (the ch1 "Survive 4 Weeks" bug class), progress
 * moves, and the sequential getActiveChapter walk reaches them.
 */
import { LIFE_CHAPTERS, getActiveChapter, getChapterProgress } from '../lifeChapters';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const chapter = (id: string) => {
  const found = LIFE_CHAPTERS.find((c) => c.id === id);
  if (!found) throw new Error(`chapter ${id} missing`);
  return found;
};

describe('chapters 6-7', () => {
  it('extend the ladder past week 100', () => {
    expect(chapter('ch6_established').weekRange[0]).toBe(100);
    expect(chapter('ch7_life_sealed').weekRange[0]).toBe(250);
  });

  it('no goal is complete at the start of a fresh life - any age scenario', () => {
    // The exact bug class ch1's "Survive 4 Weeks" shipped: weeksLived is
    // seeded from starting age, so a raw-counter or raw-age check is already
    // true at birth for older scenarios. Age goals here use getAge, which IS
    // the character's real age - so they are only safe because 40/60 exceed
    // every scenario's starting age. Pin that.
    for (const startAge of [18, 20, 25, 30]) {
      const s = createTestGameState({
        weeksLived: (startAge - 18) * 52,
        lifeStartWeek: (startAge - 18) * 52,
        date: { ...createTestGameState().date, age: startAge },
      });
      for (const ch of [chapter('ch6_established'), chapter('ch7_life_sealed')]) {
        const progress = getChapterProgress(ch, s);
        expect(progress.completedGoals).toBe(0);
      }
    }
  });

  it('getActiveChapter reaches ch6 once 1-5 are done and the week allows', () => {
    const s = createTestGameState({
      weeksLived: 150,
      lifeStartWeek: 0,
      completedChapters: [
        'ch1_fresh_start', 'ch2_settling_in', 'ch3_on_the_rise',
        'ch4_building_empire', 'ch5_legacy',
      ],
    });
    expect(getActiveChapter(s)?.id).toBe('ch6_established');
  });

  it('ch6 goals complete for a genuinely established life', () => {
    const s: GameState = createTestGameState({
      weeksLived: (45 - 18) * 52,
      lifeStartWeek: 0,
      date: { ...createTestGameState().date, age: 45 },
      claimedProgressAchievements: Array.from({ length: 22 }, (_, i) => `ach_${i}`),
      careers: [
        { id: 'tech', levels: [{ name: 'Junior', salary: 100 }, { name: 'Senior', salary: 300 }],
          level: 1, description: '', requirements: {} as never, progress: 100, applied: true, accepted: true },
      ] as never,
    });
    s.lifetimeStatistics = { ...s.lifetimeStatistics, peakNetWorth: 1_500_000 } as GameState['lifetimeStatistics'];
    const progress = getChapterProgress(chapter('ch6_established'), s);
    expect(progress.isComplete).toBe(true);
  });

  it('every goal reports progress in [0, 1]', () => {
    const s = createTestGameState({ weeksLived: 200, lifeStartWeek: 0 });
    for (const ch of LIFE_CHAPTERS) {
      for (const goal of getChapterProgress(ch, s).goals) {
        expect(goal.progress).toBeGreaterThanOrEqual(0);
        expect(goal.progress).toBeLessThanOrEqual(1);
      }
    }
  });
});

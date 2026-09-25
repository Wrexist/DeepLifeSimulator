/**
 * Exam results are drawn per LIFE, not per week.
 *
 * `applyEducationProgression` rolled exams on `makeWeeklyRoll(weeksLived)`, so
 * every life sitting the same programme in the same week got the same result.
 * An exam moves GPA, and GPA feeds scholarship merit and the hiring multiplier
 * - a life-affecting draw that the week-only audit had declared harmless.
 */
import { applyEducationProgression } from '@/contexts/game/actions/weekly/applyEducationProgression';
import type { Education, GameStats } from '@/contexts/game/types';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '../../helpers/zeroPreRolls';

function stats(): GameStats {
  return { health: 70, happiness: 70, energy: 70, fitness: 60, money: 1000, reputation: 50, gems: 0 } as GameStats;
}

function ctx(): WeekContext {
  return {
    newStats: stats(),
    notifications: [] as WeekNotification[],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 100,
  } as WeekContext;
}

function edu(): Education {
  return {
    id: 'exam-bio', name: 'Biology', description: 'A biology programme', cost: 0, duration: 52,
    completed: false, paused: false, weeksRemaining: 26, gpa: 2.5, examsPassed: 2, examsFailed: 1,
  };
}

function outcome(lineageId: string): string {
  const result = applyEducationProgression({
    prevEducations: [edu()],
    nextWeeksLived: 100,
    goldFastLearner: false,
    perkFastLearner: false,
    life: { lineageId, generationNumber: 1 },
  }, ctx());
  const e = result.updatedEducations[0];
  return `${e.examsPassed}/${e.examsFailed}/${e.gpa}`;
}

describe('exam draws are per life', () => {
  it('the same life replays the same exam', () => {
    expect(outcome('life-a')).toBe(outcome('life-a'));
  });

  it('different lives in the same week do not all share one result', () => {
    const results = new Set(Array.from({ length: 24 }, (_, i) => outcome(`life-${i}`)));
    expect(results.size).toBeGreaterThan(1);
  });
});

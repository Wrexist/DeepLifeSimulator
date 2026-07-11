/**
 * WAVE A — EducationApp: semesters that advance.
 *
 * `semesterNumber` was frozen at 1 forever (operations.ts set it once, nothing
 * bumped it). The weekly progression tick now derives it purely from progress
 * via `computeSemesterNumber`, so the "Sem N" chip/stat finally moves. This
 * suite pins: it advances on 26-week boundaries, never advances a paused/
 * completed program, and freezes at the final semester on completion.
 */
import { applyEducationProgression } from '../applyEducationProgression';
import type { WeekContext } from '../weekContext';
import type { Education, GameStats } from '@/contexts/game/types';

function makeCtx(): WeekContext {
  const newStats = {
    happiness: 50, energy: 50, money: 10_000, health: 50, fitness: 50, reputation: 50,
  } as unknown as GameStats;
  return { newStats, notifications: [], preRolls: {} as never } as unknown as WeekContext;
}

function ed(over: Partial<Education> = {}): Education {
  return {
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
    // Anchor exam + campus cadence to the tick week so neither fires (keeps the
    // semester assertion deterministic — no Math.random paths taken).
    lastExamWeek: 200,
    lastCampusEventWeek: 200,
    ...over,
  };
}

describe('applyEducationProgression — semesterNumber', () => {
  it('stays at semester 1 early on', () => {
    // 104-week degree, 1 week elapsed → still semester 1.
    const res = applyEducationProgression(
      { prevEducations: [ed({ weeksRemaining: 104, lastExamWeek: 200, lastCampusEventWeek: 200 })], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      makeCtx(),
    );
    expect(res.updatedEducations[0].semesterNumber).toBe(1);
  });

  it('advances to semester 2 once 26 weeks of progress are consumed', () => {
    // weeksRemaining 79 → after −1 = 78 elapsed=26 → semester 2.
    const res = applyEducationProgression(
      { prevEducations: [ed({ weeksRemaining: 79, lastExamWeek: 200, lastCampusEventWeek: 200 })], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      makeCtx(),
    );
    expect(res.updatedEducations[0].weeksRemaining).toBe(78);
    expect(res.updatedEducations[0].semesterNumber).toBe(2);
  });

  it('freezes at the final semester on completion (capped at ceil(duration/26))', () => {
    const res = applyEducationProgression(
      { prevEducations: [ed({ weeksRemaining: 1, lastExamWeek: 200, lastCampusEventWeek: 200 })], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      makeCtx(),
    );
    expect(res.updatedEducations[0].completed).toBe(true);
    expect(res.updatedEducations[0].semesterNumber).toBe(4); // ceil(104/26)
  });

  it('does not advance a paused program', () => {
    const paused = ed({ paused: true, weeksRemaining: 52, semesterNumber: 1 });
    const res = applyEducationProgression(
      { prevEducations: [paused], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      makeCtx(),
    );
    // Outer guard skips paused programs → returned unchanged (frozen semester).
    expect(res.updatedEducations[0].semesterNumber).toBe(1);
    expect(res.updatedEducations[0].weeksRemaining).toBe(52);
  });

  it('does not advance an already-completed program', () => {
    const done = ed({ completed: true, weeksRemaining: 0, semesterNumber: 4 });
    const res = applyEducationProgression(
      { prevEducations: [done], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      makeCtx(),
    );
    expect(res.updatedEducations[0].semesterNumber).toBe(4);
  });

  it('is idempotent for the same progress state (recomputed, not accumulated)', () => {
    const input = { prevEducations: [ed({ weeksRemaining: 60 })], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false };
    const a = applyEducationProgression(input, makeCtx());
    const b = applyEducationProgression(
      { ...input, prevEducations: [ed({ weeksRemaining: 60 })] },
      makeCtx(),
    );
    expect(a.updatedEducations[0].semesterNumber).toBe(b.updatedEducations[0].semesterNumber);
  });
});

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

  it('finalizes an education the Study button already drove to weeksRemaining 0', () => {
    // M6: applyStudySession leaves `completed` false when it hits 0 so the tick
    // does the finalization once, in one place. Before the guard changed from
    // `> 0` to `>= 0`, such an education fell through untouched — never marked
    // complete and forfeiting its enrolled-class stat bonuses.
    const ctx = makeCtx();
    const already0 = ed({
      weeksRemaining: 0,
      completed: false,
      enrolledClasses: [
        { id: 'c1', name: 'Finance 101', category: 'core', difficulty: 2, completed: false,
          statBonuses: { reputation: 5, happiness: 3 } },
      ],
    });
    const res = applyEducationProgression(
      { prevEducations: [already0], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      ctx,
    );
    expect(res.updatedEducations[0].completed).toBe(true);
    // Class bonuses applied to running stats (50 baseline in makeCtx()).
    expect(ctx.newStats.reputation).toBe(55);
    expect(ctx.newStats.happiness).toBe(53);
    // Completion toast pushed.
    expect(ctx.notifications.some((n) => n.title?.includes('Completed'))).toBe(true);
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

  // Determinism guard: runExam / shouldTriggerCampusEvent used raw Math.random,
  // making exam outcomes save-scummable and StrictMode-inconsistent. The tick
  // now threads a seeded makeWeeklyRoll stream keyed by educationId, so the same
  // state + week must yield byte-identical exam results (grade, GPA, notif).
  it('exam outcome on an exam week is deterministic across identical re-runs', () => {
    // 20 weeks since last exam (>= 13) → exam fires at nextWeeksLived 200.
    const examEdu = () => ed({ weeksRemaining: 60, lastExamWeek: 180, lastCampusEventWeek: 200 });
    const ctxA = makeCtx();
    const ctxB = makeCtx();
    const a = applyEducationProgression(
      { prevEducations: [examEdu()], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      ctxA,
    );
    const b = applyEducationProgression(
      { prevEducations: [examEdu()], nextWeeksLived: 200, goldFastLearner: false, perkFastLearner: false },
      ctxB,
    );
    // An exam actually ran this week.
    expect(a.updatedEducations[0].lastExamWeek).toBe(200);
    expect(ctxA.notifications.some((n) => n.title?.startsWith('📝'))).toBe(true);
    // Byte-identical outcomes across the two independent runs.
    expect(a.updatedEducations[0].gpa).toBe(b.updatedEducations[0].gpa);
    expect(a.updatedEducations[0].examsPassed).toBe(b.updatedEducations[0].examsPassed);
    expect(a.updatedEducations[0].examsFailed).toBe(b.updatedEducations[0].examsFailed);
    expect(ctxA.notifications).toEqual(ctxB.notifications);
    expect(ctxA.newStats).toEqual(ctxB.newStats);
  });
});

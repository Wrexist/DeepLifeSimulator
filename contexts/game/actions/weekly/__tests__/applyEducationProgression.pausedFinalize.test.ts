/**
 * A program studied down to weeksRemaining 0 via the Study button and THEN
 * paused must still finalize.
 *
 * `applyStudySession` leaves `completed` false at 0 weeks so the weekly tick does
 * the graduation once, in one place. But the tick's gate required `!edu.paused`,
 * so pausing a 0-week program stranded it at 100% / 0w / "IN PROGRESS" forever —
 * completion bonuses withheld, `entrepreneurship.completed` stuck false, company
 * founding locked until unpause. The predicate now qualifies a paused program that
 * is ALREADY at weeksRemaining <= 0 (a 0-week program has nothing left to pause),
 * while a paused program with weeks still remaining stays frozen. Uses the REAL
 * educationSystem module (like applyEducationProgression.semester.test.ts) so the
 * exam/campus suppression for <= 0 weeks is exercised end-to-end.
 */
import { applyEducationProgression, needsEducationProgressionTick } from '../applyEducationProgression';
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
    id: 'entrepreneurship',
    name: 'Entrepreneurship',
    description: 'biz',
    cost: 20_000,
    duration: 72,
    completed: false,
    weeksRemaining: 0,
    paused: true,
    enrolledClasses: [],
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0,
    studyGroupActive: false,
    semesterNumber: 3,
    // Anchor exam/campus cadence away from the tick week (belt-and-braces; a
    // 0-week program takes neither path anyway).
    lastExamWeek: 200,
    lastCampusEventWeek: 200,
    ...over,
  };
}

describe('applyEducationProgression — paused 0-week program finalizes', () => {
  describe('needsEducationProgressionTick predicate', () => {
    it('qualifies a PAUSED program already at weeksRemaining <= 0', () => {
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: 0 }))).toBe(true);
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: -3 }))).toBe(true);
    });

    it('still freezes a PAUSED program with weeks remaining', () => {
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: 5 }))).toBe(false);
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: 26 }))).toBe(false);
    });

    it('is unchanged for completed / non-finite weeksRemaining', () => {
      expect(needsEducationProgressionTick(ed({ paused: true, completed: true, weeksRemaining: 0 }))).toBe(false);
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: NaN }))).toBe(false);
      expect(needsEducationProgressionTick(ed({ paused: true, weeksRemaining: undefined }))).toBe(false);
    });
  });

  it('finalizes a paused program studied to 0 (completed=true, class bonuses once, toast)', () => {
    const ctx = makeCtx();
    const paused0 = ed({
      paused: true,
      weeksRemaining: 0,
      completed: false,
      enrolledClasses: [
        { id: 'c1', name: 'Founders 101', category: 'core', difficulty: 2, completed: false,
          statBonuses: { reputation: 5, happiness: 3 } },
      ] as Education['enrolledClasses'],
    });
    const res = applyEducationProgression(
      { prevEducations: [paused0], nextWeeksLived: 300, goldFastLearner: false, perkFastLearner: false },
      ctx,
    );
    const out = res.updatedEducations[0];
    expect(out.completed).toBe(true);
    // Enrolled-class bonuses applied exactly ONCE over the 50 baseline (not 60/56).
    expect(ctx.newStats.reputation).toBe(55);
    expect(ctx.newStats.happiness).toBe(53);
    // Money untouched (no student loan) and no stray study-group bonus.
    expect(ctx.newStats.money).toBe(10_000);
    expect(ctx.notifications.some((n) => n.title?.includes('Completed'))).toBe(true);
    // The exact gate the company-founding feature reads is now OPEN.
    expect(res.updatedEducations.find((e) => e.id === 'entrepreneurship')?.completed).toBe(true);
  });

  it('is a no-op on the NEXT tick (bonuses never granted twice)', () => {
    const ctx = makeCtx();
    const paused0 = ed({
      paused: true, weeksRemaining: 0,
      enrolledClasses: [
        { id: 'c1', name: 'Founders 101', category: 'core', difficulty: 2, completed: false,
          statBonuses: { reputation: 5, happiness: 3 } },
      ] as Education['enrolledClasses'],
    });
    const first = applyEducationProgression(
      { prevEducations: [paused0], nextWeeksLived: 300, goldFastLearner: false, perkFastLearner: false },
      ctx,
    );
    // Feed the finalized (completed=true) program back in — the guard skips it.
    const ctx2 = makeCtx();
    const second = applyEducationProgression(
      { prevEducations: first.updatedEducations, nextWeeksLived: 301, goldFastLearner: false, perkFastLearner: false },
      ctx2,
    );
    expect(second.updatedEducations[0].completed).toBe(true);
    // No further bonus applied — stats stay at the fresh baseline.
    expect(ctx2.newStats.reputation).toBe(50);
    expect(ctx2.newStats.happiness).toBe(50);
    expect(ctx2.notifications.length).toBe(0);
  });

  it('finalize-only: no exam is run and no campus event fires for the paused 0-week program', () => {
    const ctx = makeCtx();
    const paused0 = ed({ paused: true, weeksRemaining: 0, lastExamWeek: 0, gpa: 3.1, examsPassed: 4, examsFailed: 1 });
    const res = applyEducationProgression(
      { prevEducations: [paused0], nextWeeksLived: 500, goldFastLearner: false, perkFastLearner: false },
      ctx,
    );
    const out = res.updatedEducations[0];
    expect(out.completed).toBe(true);
    expect(out.gpa).toBe(3.1);          // untouched — no exam ran
    expect(out.lastExamWeek).toBe(0);   // no exam recorded this tick
    expect(res.pendingCampusEvent).toBeUndefined();
    expect(ctx.notifications.some((n) => n.title?.startsWith('📝'))).toBe(false);
  });

  it('leaves a paused program WITH weeks remaining frozen (unchanged)', () => {
    const ctx = makeCtx();
    const paused = ed({ paused: true, weeksRemaining: 40, semesterNumber: 2 });
    const res = applyEducationProgression(
      { prevEducations: [paused], nextWeeksLived: 300, goldFastLearner: false, perkFastLearner: false },
      ctx,
    );
    const out = res.updatedEducations[0];
    expect(out.completed).toBe(false);
    expect(out.weeksRemaining).toBe(40); // no decrement
    expect(out.semesterNumber).toBe(2);  // frozen
    // A frozen paused program mutates no running stats.
    expect(ctx.newStats.reputation).toBe(50);
    expect(ctx.newStats.happiness).toBe(50);
  });
});

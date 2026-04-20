import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { getNextGoal } from '@/utils/goalSystem';
import {
  getWeeksSinceStoredWeek,
  normalizeStoredWeekToAbsolute,
  resolveAbsoluteWeek,
} from '@/utils/weekCounters';

describe('weekCounters', () => {
  it('prefers weeksLived for absolute progression checks', () => {
    expect(resolveAbsoluteWeek(25, 1)).toBe(25);
  });

  it('falls back to legacy week when weeksLived is unavailable', () => {
    expect(resolveAbsoluteWeek(undefined, 3)).toBe(3);
  });

  it('normalizes legacy cyclic week markers to absolute week', () => {
    // Current state: absolute week 9, UI week 1 (first week of month)
    // Legacy marker 4 should resolve to last month week 4 -> absolute week 8.
    expect(normalizeStoredWeekToAbsolute(4, 9, 1)).toBe(8);
    expect(getWeeksSinceStoredWeek(4, 9, 1)).toBe(1);
  });

  it('keeps already-absolute markers unchanged', () => {
    expect(normalizeStoredWeekToAbsolute(6, 10, 2)).toBe(6);
    expect(getWeeksSinceStoredWeek(6, 10, 2)).toBe(4);
  });
});

describe('getNextGoal week gating regression', () => {
  it('does not show early-week job goals after week 10 when week resets to 1', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      week: 1, // UI week-of-month
      weeksLived: 11, // Absolute progression week
      currentJob: undefined,
      bankSavings: 0,
      completedGoals: [],
      stats: {
        ...base.stats,
        money: 500, // skip earn_100
        happiness: 90, // skip improve_happiness
      },
    });

    const goal = getNextGoal(state);
    expect(goal?.id).toBe('build_wealth');
  });

  it('still shows get_job during early progression', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      week: 2,
      weeksLived: 2,
      currentJob: undefined,
      bankSavings: 0,
      completedGoals: [],
      stats: {
        ...base.stats,
        money: 500,
        happiness: 90,
      },
    });

    const goal = getNextGoal(state);
    expect(goal?.id).toBe('get_job');
  });
});

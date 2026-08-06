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

// The `getNextGoal` week-gating regression suite that lived here was removed with
// `utils/goalSystem.ts`: every goal's `shouldShow` predicate was the negation of
// its completion predicate, so no goal in that system could ever complete and the
// whole module was unreachable code. The week-counter helpers it exercised are
// still covered by the suite above.

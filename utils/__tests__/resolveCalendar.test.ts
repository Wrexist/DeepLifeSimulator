/**
 * The week label and the month must come from the same divisor.
 *
 * `gameConstants` carries both `WEEKS_PER_MONTH = 4` and `WEEKS_PER_YEAR = 52`,
 * and 4 x 12 = 48. The weekly tick used one for each half of the same calendar:
 * the displayed week cycled on 4 while the month advanced on 52/12 = 4.333. They
 * desynchronised on the first month and drifted a further step every third:
 *
 *   weeksLived  4 -> week 1, months elapsed 0   (label reset, month did not)
 *   weeksLived  5 -> week 2, months elapsed 1   (month rolled mid-cycle)
 *   weeksLived 13 -> week 2, months elapsed 3
 */
import { WEEKS_PER_MONTH_EXACT, resolveCalendar } from '../weekCounters';

describe('resolveCalendar', () => {
  it('starts the life on week 1 of the starting month', () => {
    expect(resolveCalendar(0, 1)).toMatchObject({ weekOfMonth: 1, monthNumber: 1, monthsElapsed: 0 });
  });

  it('resets the week label EXACTLY on the month boundary, for 200 weeks', () => {
    // THE regression. Walk the whole range and assert the two never disagree:
    // week 1 happens if and only if the month just changed.
    let previousMonth = resolveCalendar(0, 1).monthNumber;
    for (let week = 1; week <= 200; week++) {
      const now = resolveCalendar(week, 1);
      const monthChanged = now.monthNumber !== previousMonth;
      expect(`week ${week}: label=${now.weekOfMonth} monthChanged=${monthChanged}`).toBe(
        `week ${week}: label=${now.weekOfMonth} monthChanged=${now.weekOfMonth === 1}`,
      );
      previousMonth = now.monthNumber;
    }
  });

  it('produces the occasional five-week month, which a 52-week year requires', () => {
    const labels = new Set<number>();
    for (let week = 0; week <= 200; week++) labels.add(resolveCalendar(week, 1).weekOfMonth);
    expect(labels.has(5)).toBe(true);
    // ...and never a sixth, which would break the HUD's dot strip.
    expect(labels.has(6)).toBe(false);
  });

  it('advances twelve months per game year, not thirteen', () => {
    // The old 4-week month implied a 48-week year, so a 52-week year silently
    // gained an extra month roughly every year.
    expect(resolveCalendar(52, 1).monthsElapsed).toBe(12);
    expect(resolveCalendar(52, 1).monthNumber).toBe(1);
    expect(resolveCalendar(104, 1).monthsElapsed).toBe(24);
  });

  it('wraps the month number around the year in both directions', () => {
    expect(resolveCalendar(0, 12).monthNumber).toBe(12);
    expect(resolveCalendar(Math.ceil(WEEKS_PER_MONTH_EXACT), 12).monthNumber).toBe(1);
  });

  it('is a pure function of the absolute week — no tick-over-tick drift', () => {
    // The tick recomputes from `weeksLived` every week rather than incrementing
    // a stored value, so the same input must always give the same calendar.
    for (const week of [0, 1, 4, 5, 13, 51, 52, 999]) {
      expect(resolveCalendar(week, 3)).toEqual(resolveCalendar(week, 3));
    }
  });

  it('survives corrupt input rather than emitting NaN into the save', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -10]) {
      const c = resolveCalendar(bad as number, 1);
      expect(Number.isFinite(c.monthNumber)).toBe(true);
      expect(c.weekOfMonth).toBeGreaterThanOrEqual(1);
      expect(c.weekOfMonth).toBeLessThanOrEqual(5);
      expect(c.monthNumber).toBeGreaterThanOrEqual(1);
      expect(c.monthNumber).toBeLessThanOrEqual(12);
    }
    const badStart = resolveCalendar(10, Number.NaN);
    expect(badStart.monthNumber).toBeGreaterThanOrEqual(1);
    expect(badStart.monthNumber).toBeLessThanOrEqual(12);
  });
});

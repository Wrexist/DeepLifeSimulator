/**
 * Mail dates read on the HUD's calendar.
 *
 * They were `2025 + weeksLived / 52`, and `weeksLived` is seeded from the
 * starting age, so an age-20 life's mail ran two years ahead of the HUD -
 * statements dated "Nov 22, 2028" in a game reading January 2027, and
 * "Tax year 4" after two years of play (tester pass, 2026-10-10).
 */
import { docDate, docYear, mailCalendarAnchor } from '@/lib/mail/format';

// An age-20 start (lifeStartWeek 104), two years played, HUD on January 2027.
const anchor = mailCalendarAnchor({
  weeksLived: 208,
  lifeStartWeek: 104,
  date: { year: 2027, month: 'January' },
});

describe('mail dates on the game calendar', () => {
  it('stamps a message from this week with the HUD month and year', () => {
    expect(docDate(208, anchor)).toMatch(/^Jan \d+, 2027$/);
  });

  it('places older mail on the same calendar, not two years ahead', () => {
    expect(docDate(104, anchor)).toMatch(/^Jan \d+, 2025$/);
    expect(docYear(207, anchor)).toBe(2026);
  });

  it('falls back to the old absolute form only without an anchor', () => {
    expect(docDate(208)).toMatch(/2029$/);
  });
});

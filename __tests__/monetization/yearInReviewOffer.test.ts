/**
 * `wasAGoodYear` — the gate that decides when a player is asked for money.
 *
 * The Year in Review carries the day-0 DeepLife+ offer, and roughly half of all
 * paid conversions in subscription apps happen on day 0. That makes this the
 * highest-leverage moment in the funnel — and also the easiest one to poison:
 * pitching a subscription to someone who just lost their money, got evicted, or
 * watched a year end badly is how an app collects one-star reviews.
 *
 * So the thresholds are pinned here rather than eyeballed. Same principle the
 * rating prompt already follows in `utils/reviewMoments.ts`: only ask at a real
 * peak, never after a bad beat.
 */

import { wasAGoodYear } from '@/components/YearInReviewModal';
import type { YearSummary } from '@/lib/gameMode/mode';

function summary(over: Partial<YearSummary> = {}): YearSummary {
  return {
    weeksAdvanced: 52,
    outcome: 'year-complete',
    ageBefore: 18,
    ageAfter: 19,
    moneyBefore: 200,
    moneyAfter: 5_000,
    moneyDelta: 4_800,
    netWorthBefore: 1_000,
    netWorthAfter: 6_000,
    netWorthDelta: 5_000,
    notes: [],
    ...over,
  };
}

describe('wasAGoodYear', () => {
  it('accepts a full year that grew net worth meaningfully', () => {
    expect(wasAGoodYear(summary())).toBe(true);
  });

  // ── The refusals. Each of these is a way to earn a one-star review. ──

  it('refuses after a death', () => {
    expect(wasAGoodYear(summary({ outcome: 'death' }))).toBe(false);
  });

  it('refuses when net worth went backwards', () => {
    expect(
      wasAGoodYear(summary({ netWorthDelta: -2_000, netWorthAfter: -1_000 }))
    ).toBe(false);
  });

  it('refuses when net worth was flat', () => {
    expect(wasAGoodYear(summary({ netWorthDelta: 0, netWorthAfter: 1_000 }))).toBe(false);
  });

  it('refuses a year cut short by a pending decision', () => {
    expect(wasAGoodYear(summary({ outcome: 'decision' }))).toBe(false);
  });

  it('refuses when nothing advanced', () => {
    expect(wasAGoodYear(summary({ outcome: 'blocked', weeksAdvanced: 0 }))).toBe(false);
  });

  it('refuses a stub of a year even if it went well', () => {
    // Under half a year is not the "you just lived a year" moment the offer
    // depends on, so it does not earn the ask.
    expect(wasAGoodYear(summary({ weeksAdvanced: 10 }))).toBe(false);
  });

  // ── Relative, not absolute. This is the part most likely to be got wrong. ──

  it('treats a small gain as good for a poor character', () => {
    // +$600 against nearly nothing is a real year for someone starting at $200.
    expect(
      wasAGoodYear(
        summary({ netWorthBefore: 200, netWorthDelta: 600, netWorthAfter: 800 })
      )
    ).toBe(true);
  });

  it('treats the same gain as noise for a wealthy character', () => {
    // The identical +$600 against a $2M net worth is a rounding error, and
    // calling it a good year would read as the game not paying attention.
    expect(
      wasAGoodYear(
        summary({
          netWorthBefore: 2_000_000,
          netWorthDelta: 600,
          netWorthAfter: 2_000_600,
        })
      )
    ).toBe(false);
  });

  it('scales the bar with wealth rather than using a fixed threshold', () => {
    const rich = { netWorthBefore: 1_000_000, netWorthAfter: 1_200_000, netWorthDelta: 200_000 };
    expect(wasAGoodYear(summary(rich))).toBe(true);
  });

  it('does not divide by zero on a broke character', () => {
    expect(() =>
      wasAGoodYear(summary({ netWorthBefore: 0, netWorthDelta: 500, netWorthAfter: 500 }))
    ).not.toThrow();
    expect(
      wasAGoodYear(summary({ netWorthBefore: 0, netWorthDelta: 500, netWorthAfter: 500 }))
    ).toBe(true);
  });

  it('handles a negative starting net worth without inverting the test', () => {
    // Deep in debt and clawing back is a good year; the magnitude of the debt
    // must not flip the comparison.
    expect(
      wasAGoodYear(
        summary({ netWorthBefore: -50_000, netWorthDelta: 20_000, netWorthAfter: -30_000 })
      )
    ).toBe(true);
  });
});

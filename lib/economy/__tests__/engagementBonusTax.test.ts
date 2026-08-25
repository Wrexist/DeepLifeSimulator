/**
 * Engagement bonuses (lucky bonus / play streak) — 2026-08-25 economy audit.
 *
 * The two week-advance engagement bonuses multiplied UNCAPPED income
 * (career + passive) and were credited AFTER the tick's tax line — the only
 * recurring income in the game that never paid tax, with an expected value of
 * +30-50% of every paycheck, forever, scaling to a $5M untaxed tap at
 * $500k/wk income. The fix: the qualifying base is capped
 * (ENGAGEMENT_BONUS_BASE_CAP) and the payout is taxed at the MARGINAL rate of
 * the one canonical bracket table. These tests pin the helper the tick calls.
 */
import { ENGAGEMENT_BONUS_BASE_CAP, netEngagementBonus } from '../luckyBonus';
import { calculateIncomeTax } from '../constants';

describe('netEngagementBonus', () => {
  it('withholds exactly the marginal tax the canonical brackets would charge', () => {
    const base = 3_000; // an established mid-game paycheck
    const gross = 1_500; // a small lucky windfall
    const expected = gross - (calculateIncomeTax(base + gross) - calculateIncomeTax(base));
    expect(netEngagementBonus(gross, base)).toBe(Math.round(expected));
    // Sanity: a bonus on top of a $3k/wk paycheck sits in the 20% band.
    expect(netEngagementBonus(gross, base)).toBeLessThan(gross);
    expect(netEngagementBonus(gross, base)).toBeGreaterThan(gross * 0.5);
  });

  it('applies the Tax Strategy multiplier the main tax line uses', () => {
    const full = netEngagementBonus(10_000, 30_000, 1);
    const reduced = netEngagementBonus(10_000, 30_000, 0.9);
    expect(reduced).toBeGreaterThan(full); // less tax withheld → more net
  });

  it('taxes a poverty-band bonus at ~0 (the tax-free floor still applies)', () => {
    // $100 base + $50 bonus stays inside the $200/wk tax-free bracket.
    expect(netEngagementBonus(50, 100)).toBe(50);
  });

  it('never returns a negative or non-finite credit', () => {
    expect(netEngagementBonus(0, 1000)).toBe(0);
    expect(netEngagementBonus(-50, 1000)).toBe(0);
    expect(netEngagementBonus(NaN, 1000)).toBe(0);
    expect(netEngagementBonus(1000, NaN)).toBeGreaterThan(0);
  });

  it('caps the qualifying base at the top tax threshold', () => {
    // The cap itself is load-bearing for the tick (it multiplies tiers by
    // min(weeklyIncome, cap)); pin its value so a quiet change is a decision.
    expect(ENGAGEMENT_BONUS_BASE_CAP).toBe(25_000);
  });
});

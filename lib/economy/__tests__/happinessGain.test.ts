/** The diminishing-returns curve on happiness gains - Master Program 14. */
import {
  happinessGainFalloff,
  scaledHappinessGain,
  HAPPINESS_FULL_VALUE_BELOW,
  HAPPINESS_GAIN_FLOOR,
} from '../happinessGain';

describe('happinessGainFalloff', () => {
  it('pays full value for a life that is not already thriving', () => {
    // The guarantee that matters most: nothing about a struggling life changes.
    // Every persona measured for Program 14 sat at or above 62 at its 10th
    // percentile, so this band is under the whole observed range.
    for (const at of [0, 10, 25, 40, 50, HAPPINESS_FULL_VALUE_BELOW]) {
      expect(happinessGainFalloff(at)).toBe(1);
    }
  });

  it('falls monotonically above the threshold and never below the floor', () => {
    let prev = 1;
    for (let at = HAPPINESS_FULL_VALUE_BELOW; at <= 100; at += 1) {
      const v = happinessGainFalloff(at);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      expect(v).toBeGreaterThanOrEqual(HAPPINESS_GAIN_FLOOR - 1e-9);
      prev = v;
    }
    expect(happinessGainFalloff(100)).toBeCloseTo(HAPPINESS_GAIN_FLOOR, 6);
  });

  it('is gentle in the sixties and sharp in the nineties', () => {
    // The shape is the point: doing well should not feel taxed, while the last
    // few points should have to be earned. Quadratic, so the squeeze is small
    // early and large late.
    expect(happinessGainFalloff(65)).toBeGreaterThan(0.9);
    expect(happinessGainFalloff(95)).toBeLessThan(0.45);
  });

  it('handles a non-finite reading as the bottom of the scale', () => {
    expect(happinessGainFalloff(Number.NaN)).toBe(1);
  });
});

describe('scaledHappinessGain', () => {
  it('never touches a loss', () => {
    // This is the whole safety property: the curve makes good times harder to
    // bank, never bad times worse.
    for (const at of [10, 55, 80, 100]) {
      expect(scaledHappinessGain(at, -7)).toBe(-7);
    }
  });

  it('passes a gain through untouched below the threshold', () => {
    expect(scaledHappinessGain(30, 12)).toBe(12);
  });

  it('shrinks a gain near the ceiling', () => {
    expect(scaledHappinessGain(100, 10)).toBeCloseTo(10 * HAPPINESS_GAIN_FLOOR, 6);
    expect(scaledHappinessGain(90, 10)).toBeLessThan(10);
    expect(scaledHappinessGain(90, 10)).toBeGreaterThan(scaledHappinessGain(100, 10));
  });

  it('a repeated gain approaches an equilibrium instead of pinning', () => {
    // The behaviour the whole change exists to produce. A life taking +6 a week
    // against a 3.2/week decay used to march to 100 and sit there; it should
    // now settle where the scaled gain balances the drain.
    let h = 50;
    for (let week = 0; week < 200; week++) {
      h = Math.max(0, h - 3.2);
      h = Math.min(100, h + scaledHappinessGain(h, 6));
    }
    expect(h).toBeLessThan(100);
    expect(h).toBeGreaterThan(55);
  });

  it('a bigger inflow settles higher - different lives, different equilibria', () => {
    const settle = (weeklyGain: number): number => {
      let h = 50;
      for (let week = 0; week < 300; week++) {
        h = Math.max(0, h - 3.2);
        h = Math.min(100, h + scaledHappinessGain(h, weeklyGain));
      }
      return h;
    };
    // The differentiation property, stated as an assertion: more genuine
    // happiness in a life must read as more happiness, not as the same 100.
    expect(settle(4)).toBeLessThan(settle(8));
    expect(settle(8)).toBeLessThan(settle(16));
  });
});

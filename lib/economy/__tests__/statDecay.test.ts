/**
 * Natural decay's wealth term - the Master Program 7 finding.
 *
 * The clamp ceiling was 2.0, and the multiplier hit it for every net worth
 * under $50,000 - i.e. for the whole early game of every scenario but one.
 * "Base 4" was a rate no fresh life ever lived at. These pin the new shape:
 * wealth slows decay, it never speeds it, and the shared pieces compose into
 * exactly what the tick and the recap projection compute.
 */
import {
  STAT_DECAY_BASE_RATE,
  STAT_DECAY_GRACE_WEEKS,
  WEALTH_DECAY_MULTIPLIER_MAX,
  WEALTH_DECAY_MULTIPLIER_MIN,
  graceRampFactor,
  wealthDecayMultiplier,
} from '../statDecay';
import { computeDecayInputs } from '@/contexts/game/actions/weekly/preTick';
import { projectedDecayRate } from '../vitalDrift';
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';

describe('wealthDecayMultiplier', () => {
  it('never exceeds 1: a fresh life decays at the base rate, not double it', () => {
    expect(WEALTH_DECAY_MULTIPLIER_MAX).toBe(1);
    for (const worth of [0, 150, 500, 1_500, 5_000, 25_000, 49_999, 99_999]) {
      expect(wealthDecayMultiplier(worth)).toBe(1);
    }
  });

  it('is a gradient above the pivot, floored at 0.5', () => {
    expect(wealthDecayMultiplier(100_000)).toBe(1);
    expect(wealthDecayMultiplier(150_000)).toBeCloseTo(2 / 3, 6);
    expect(wealthDecayMultiplier(200_000)).toBe(0.5);
    expect(wealthDecayMultiplier(10_000_000)).toBe(WEALTH_DECAY_MULTIPLIER_MIN);
  });

  it('treats a corrupted net worth as the floor, never as NaN', () => {
    for (const bad of [NaN, Infinity, -Infinity, -5, undefined as unknown as number]) {
      const m = wealthDecayMultiplier(bad);
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBe(1);
    }
  });
});

describe('graceRampFactor', () => {
  it('runs from a quarter at week 0 of a life to full at week 8', () => {
    expect(graceRampFactor(0)).toBe(0.25);
    expect(graceRampFactor(STAT_DECAY_GRACE_WEEKS / 2)).toBeCloseTo(0.625, 6);
    expect(graceRampFactor(STAT_DECAY_GRACE_WEEKS)).toBe(1);
    expect(graceRampFactor(500)).toBe(1);
  });

  it('a malformed week count reads as past the ramp, not as free decay', () => {
    expect(graceRampFactor(NaN)).toBe(1);
    expect(graceRampFactor(-3)).toBe(0.25);
  });
});

describe('the tick composes the same pieces', () => {
  it('a $1,500 fresh life at full grace decays at exactly the base rate', () => {
    const s = createTestGameState({ weeksLived: 112, lifeStartWeek: 104 });
    s.stats.money = 1_500;
    s.bankSavings = 0;
    s.realEstate = [];
    const { wealthMultiplier, effectiveDecayRate } = computeDecayInputs(s, {
      baseDecayRate: STAT_DECAY_BASE_RATE,
      prestigeMultiplier: 1,
    });
    expect(wealthMultiplier).toBe(1);
    expect(effectiveDecayRate).toBe(STAT_DECAY_BASE_RATE);
    // and the recap projection agrees (the parity test in vitalDrift.test.ts
    // covers more states; this is the headline number).
    expect(projectedDecayRate(s)).toBeCloseTo(effectiveDecayRate, 6);
  });
});

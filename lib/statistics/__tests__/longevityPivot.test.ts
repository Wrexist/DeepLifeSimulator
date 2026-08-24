/**
 * The longevity pivot (2026-08-24 owner-approved balance pass).
 *
 * `calculateLifeExpectancy` was display-only for its whole life while old-age
 * death was a pure function of `age - 80` — a player at 1 health lived exactly
 * as long as one at 100. The death roll now ramps from this pivot. These tests
 * pin the clamp band, the direction (care extends, neglect shortens), and the
 * degrade-to-80 guard.
 */
import {
  longevityPivot,
  LONGEVITY_PIVOT_MIN,
  LONGEVITY_PIVOT_MAX,
  calculateLifeExpectancy,
} from '../lifeExpectancy';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const withStats = (health: number, happiness: number, fitness: number): GameState =>
  createTestGameState({
    stats: { health, happiness, fitness, energy: 50, money: 1000, reputation: 50, gems: 0 },
  });

describe('longevityPivot', () => {
  it('a cared-for life ramps later than a neglected one', () => {
    const cared = longevityPivot(withStats(95, 90, 85));
    const neglected = longevityPivot(withStats(10, 10, 5));
    expect(cared).toBeGreaterThan(neglected);
  });

  it('clamps to the [72, 92] band at both extremes', () => {
    // Raw expectancy at 100/100/80+ is ~125; at 0/0/0 it is ~37.
    expect(longevityPivot(withStats(100, 100, 90))).toBe(LONGEVITY_PIVOT_MAX);
    expect(longevityPivot(withStats(0, 0, 0))).toBe(LONGEVITY_PIVOT_MIN);
  });

  it('a middling life sits near the historical 80', () => {
    const pivot = longevityPivot(withStats(50, 50, 40));
    expect(pivot).toBeGreaterThanOrEqual(78);
    expect(pivot).toBeLessThanOrEqual(84);
  });

  it('degrades to the historical 80 on a state the model cannot read', () => {
    expect(longevityPivot(null as unknown as GameState)).toBe(80);
  });

  it('reads the same model the Statistics app displays', () => {
    const state = withStats(80, 70, 60);
    const expectancy = calculateLifeExpectancy(state).totalLifeExpectancy;
    const expected = Math.max(
      LONGEVITY_PIVOT_MIN,
      Math.min(LONGEVITY_PIVOT_MAX, expectancy)
    );
    expect(longevityPivot(state)).toBe(expected);
  });
});

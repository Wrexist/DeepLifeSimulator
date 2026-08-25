/**
 * Per-life weekly-challenge rotation (2026-08-25 round 2).
 *
 * The unsalted rotation is a fixed catalogue-order cycle every player and
 * every life shares - the fixed-schedule class the lucky-bonus and
 * cliffhanger rolls were already cured of. Salting keeps determinism WITHIN
 * a life (anti-clock-scrub: still keyed on weeksLived) while a new life
 * meets the pool in a new order.
 */
import {
  getWeeklyChallengeIdForWeek,
  rotationOrder,
  WEEKLY_CHALLENGES,
  ROTATION_GAME_WEEKS,
} from '@/lib/challenges/weeklyChallenges';

describe('rotationOrder', () => {
  it('is the identity for the empty salt (what the legacy pins rely on)', () => {
    expect(rotationOrder('')).toEqual(WEEKLY_CHALLENGES.map((_, i) => i));
  });

  it('is a complete permutation for any salt - nothing lost, nothing doubled', () => {
    for (const salt of ['lineage-a:1', 'lineage-a:2', 'lineage-b:1']) {
      const order = rotationOrder(salt);
      expect([...order].sort((a, b) => a - b)).toEqual(WEEKLY_CHALLENGES.map((_, i) => i));
    }
  });

  it('differs across lives and is stable within one', () => {
    expect(rotationOrder('lineage-a:1')).toEqual(rotationOrder('lineage-a:1'));
    expect(rotationOrder('lineage-a:1')).not.toEqual(rotationOrder('lineage-a:2'));
  });
});

describe('getWeeklyChallengeIdForWeek with a salt', () => {
  it('still reaches every challenge across a full cycle', () => {
    const seen = new Set<string>();
    const cycle = ROTATION_GAME_WEEKS * WEEKLY_CHALLENGES.length;
    for (let w = 0; w < cycle; w++) seen.add(getWeeklyChallengeIdForWeek(w, 'lineage-a:1'));
    expect(seen.size).toBe(WEEKLY_CHALLENGES.length);
  });

  it('is constant within a rotation window and deterministic per (week, salt)', () => {
    expect(getWeeklyChallengeIdForWeek(0, 's')).toBe(getWeeklyChallengeIdForWeek(3, 's'));
    expect(getWeeklyChallengeIdForWeek(40, 's')).toBe(getWeeklyChallengeIdForWeek(40, 's'));
  });
});

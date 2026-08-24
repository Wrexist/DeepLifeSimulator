/**
 * Weekly-challenge rotation reachability (getWeeklyChallengeIdForWeek).
 *
 * Rotation advances every ROTATION_GAME_WEEKS (4) game weeks, but the selector
 * used to index `weeksLived % 12`. Because gcd(4, 12) = 4, only the residues hit
 * at rotation boundaries were ever selectable — just 3 of the 12 challenges
 * ({1,5,9} from week 1). The fix indexes by ROTATION COUNT
 * (floor(weeksLived / 4) % 12), so each rotation advances the challenge by one and
 * all 12 cycle over 48 game weeks.
 */
import {
  WEEKLY_CHALLENGES,
  getWeeklyChallengeIdForWeek,
  getWeeklyChallengeDefinition,
} from '@/lib/challenges/weeklyChallenges';

describe('getWeeklyChallengeIdForWeek - all challenges reachable across rotations', () => {
  it('there are 12 challenges to rotate through', () => {
    expect(WEEKLY_CHALLENGES).toHaveLength(12);
  });

  it('every one of the 12 challenges is selectable at some rotation boundary', () => {
    const seen = new Set<string>();
    // 12 rotations × 4 weeks each = 48 game weeks covers a full cycle.
    for (let rotation = 0; rotation < WEEKLY_CHALLENGES.length; rotation++) {
      const weeksLived = rotation * 4; // a rotation boundary
      seen.add(getWeeklyChallengeIdForWeek(weeksLived));
    }
    expect(seen.size).toBe(WEEKLY_CHALLENGES.length);
    for (const c of WEEKLY_CHALLENGES) expect(seen.has(c.id)).toBe(true);
  });

  it('sweeping every week 0..95 still surfaces all 12 (nothing is unreachable)', () => {
    const seen = new Set<string>();
    for (let w = 0; w < 96; w++) seen.add(getWeeklyChallengeIdForWeek(w));
    expect(seen.size).toBe(WEEKLY_CHALLENGES.length);
  });

  it('advances by exactly one challenge each 4-week rotation, holding steady within it', () => {
    // Within a rotation window the id is stable; it changes at the boundary.
    expect(getWeeklyChallengeIdForWeek(0)).toBe(getWeeklyChallengeIdForWeek(3));
    expect(getWeeklyChallengeIdForWeek(4)).not.toBe(getWeeklyChallengeIdForWeek(3));
    expect(getWeeklyChallengeIdForWeek(0)).toBe(WEEKLY_CHALLENGES[0].id);
    expect(getWeeklyChallengeIdForWeek(4)).toBe(WEEKLY_CHALLENGES[1].id);
    expect(getWeeklyChallengeIdForWeek(44)).toBe(WEEKLY_CHALLENGES[11].id);
    expect(getWeeklyChallengeIdForWeek(48)).toBe(WEEKLY_CHALLENGES[0].id); // wraps
  });

  it('the previously-reachable set {1,5,9} was only 3 challenges - now far more show', () => {
    const oldReachable = new Set([
      WEEKLY_CHALLENGES[1 % 12].id,
      WEEKLY_CHALLENGES[5 % 12].id,
      WEEKLY_CHALLENGES[9 % 12].id,
    ]);
    expect(oldReachable.size).toBe(3); // the old bug's ceiling
    const nowReachable = new Set<string>();
    for (let w = 0; w < 48; w++) nowReachable.add(getWeeklyChallengeIdForWeek(w));
    expect(nowReachable.size).toBeGreaterThan(oldReachable.size);
  });

  it('handles non-finite / negative weeksLived defensively', () => {
    expect(getWeeklyChallengeDefinition(getWeeklyChallengeIdForWeek(NaN as never))).toBeDefined();
    expect(getWeeklyChallengeDefinition(getWeeklyChallengeIdForWeek(-5))).toBeDefined();
  });
});

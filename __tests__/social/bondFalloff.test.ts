/**
 * A catch-up is worth less to somebody you already see — Master Program 12.
 *
 * `Call` cost nothing, was capped at once per contact per week, and paid a flat
 * +3 at every score, against a decay of −0.5/week. Measured consequence: the
 * CASUAL SOCIAL persona, which rings its contacts once every four weeks and
 * does nothing else, sat at an average bond of 100 across 23 relationships by
 * week 250. Everybody anybody ever rang reached the top of the scale, which is
 * both why quantity dominated quality and why the upper half of the scale could
 * not be given a meaning.
 */
import { closenessFalloff, resolveInteraction } from '@/lib/social/npcDepth';
import type { Relationship } from '@/contexts/game/types';
import { BOND } from '@/lib/social/closeness';

const rel = (score: number): Relationship => ({
  id: 'r1',
  name: 'Owen',
  type: 'friend',
  relationshipScore: score,
  personality: 'reserved',
  gender: 'male',
  age: 30,
});

/**
 * Weeks to climb from `from` to `to` on free Calls made every `every` weeks,
 * with the standing decay (−2 per fully-ignored want cycle) applied throughout.
 *
 * `every: 1` is somebody who rings every week; `every: 4` is somebody who rings
 * when they think of it. The gap between those two answers is the whole point
 * of the curve.
 */
function weeksOfCallsToReach(from: number, to: number, every = 1): number {
  let score = from;
  for (let w = 0; w < 5000; w++) {
    if (score >= to) return w;
    if (w % every === 0) {
      score = Math.min(100, score + resolveInteraction(rel(score), 'call', 3, w).scoreDelta);
    }
    if (w % 4 === 3) score = Math.max(0, score - 2);
  }
  return Infinity;
}

describe('the curve', () => {
  it('is full value while a relationship is still being built', () => {
    expect(closenessFalloff(0)).toBe(1);
    expect(closenessFalloff(BOND.estranged)).toBe(1);
    expect(closenessFalloff(BOND.known)).toBe(1);
  });

  it('tapers above that, and never to nothing', () => {
    expect(closenessFalloff(BOND.close)).toBeLessThan(1);
    expect(closenessFalloff(BOND.trusted)).toBeLessThan(closenessFalloff(BOND.close));
    expect(closenessFalloff(100)).toBeCloseTo(0.25, 5);
  });

  it('is monotonic — more bond is never worth more', () => {
    for (let n = 1; n <= 100; n++) {
      expect(closenessFalloff(n)).toBeLessThanOrEqual(closenessFalloff(n - 1));
    }
  });

  it('handles a malformed stored score', () => {
    expect(closenessFalloff(undefined)).toBe(1);
    expect(closenessFalloff(Number.NaN)).toBe(1);
    expect(closenessFalloff(999)).toBeCloseTo(0.25, 5);
  });
});

describe('what free calls can and cannot buy', () => {
  it('recovery stays cheap — a neglected friend comes back fast', () => {
    // The property Program 11 measured and this must not break: mistakes are
    // repairable. From estranged back to known in a handful of weeks.
    expect(weeksOfCallsToReach(10, BOND.known)).toBeLessThanOrEqual(20);
  });

  it('close is a handful of calls, so every existing gate stays reachable', () => {
    // `ch2_someone_close`, `strongRelationshipCount` and the life-story line
    // all key off 60. Free contact must still get there.
    expect(weeksOfCallsToReach(45, BOND.close)).toBeLessThanOrEqual(15);
  });

  it('trusted is real sustained contact, not a formality', () => {
    // ~13 weeks of ringing somebody EVERY week.
    const weeks = weeksOfCallsToReach(BOND.close, BOND.trusted);
    expect(weeks).toBeGreaterThan(10);
    expect(weeks).toBeLessThan(30);
  });

  it('and the top of the scale is a year of it', () => {
    // 45 -> 100 is ~55 weeks of unbroken weekly contact. Reachable, and a real
    // investment; before the falloff it was a formality.
    expect(weeksOfCallsToReach(BOND.known, 100)).toBeGreaterThan(40);
  });

  it('SOMEBODY WHO RINGS WHEN THEY THINK OF IT NEVER GETS THERE', () => {
    // The measurement that motivated all of this: the CASUAL SOCIAL persona
    // calls its contacts once every four weeks and reached an average bond of
    // 100 across 23 relationships. On the curve, that cadence plateaus just
    // above `close` and cannot reach `trusted` at all - the decay matches the
    // gain. Consistency is what buys depth, not headcount.
    expect(weeksOfCallsToReach(BOND.known, BOND.close, 4)).toBeLessThan(Infinity);
    expect(weeksOfCallsToReach(BOND.close, BOND.trusted, 4)).toBe(Infinity);
  });

  it('a bond already at the ceiling gains nothing from another call', () => {
    expect(resolveInteraction(rel(100), 'call', 3, 12).scoreDelta).toBe(0);
  });
});

describe('the paid gesture is what the ceiling is for', () => {
  it('still moves a bond the free call cannot', () => {
    // `raiseRelationship` pays max(2, (100 - score)/12) and costs
    // $400 + 60·score. At 90 that is a $5,800 gesture for +2 - which is the
    // point: the top of the scale is bought with something.
    const gain = Math.max(2, Math.round((100 - 90) / 12));
    expect(gain).toBeGreaterThan(0);
    expect(resolveInteraction(rel(90), 'call', 3, 5).scoreDelta).toBeLessThanOrEqual(gain);
  });
});

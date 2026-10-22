/**
 * LATE-1 (owner decision 2026-10-22): Legacy Point accrual is a FLAT grant
 * keyed on weeks PLAYED in this life - +2 LP per 10 played weeks, plus +1 per
 * prestige level.
 *
 * The old rule (`floor(weeksLived/10) + prestigeLevel*2` every 10 ABSOLUTE
 * weeks) was quadratic: an 18 -> 65 life earned 29,890 LP against a 9,160 LP
 * Dynasty Tree, so one ordinary life bought the whole tree.
 */
import {
  describeLegacyAccrual,
  legacyPointsEarnedThisWeek,
  legacyPointsForPlayedWeeks,
  legacyPointsPerGrant,
} from '@/lib/legacy/legacyAccrual';
import { totalLegacyTreeCost } from '@/lib/legacy/legacyShop';

const WEEKS_18_TO_65 = (65 - 18) * 52; // 2,444
const WEEKS_18_TO_80 = (80 - 18) * 52; // 3,224

/** The old quadratic rule, kept here only to state the before number. */
function oldRule(startWeeksLived: number, endWeeksLived: number, prestigeLevel = 0): number {
  let total = 0;
  for (let w = startWeeksLived + 1; w <= endWeeksLived; w++) {
    if (w % 10 === 0) total += Math.floor(w / 10) + prestigeLevel * 2;
  }
  return total;
}

describe('LATE-1 - the per-week grant', () => {
  it('pays only on every 10th played week', () => {
    expect(legacyPointsEarnedThisWeek(0, 0)).toBe(0);
    expect(legacyPointsEarnedThisWeek(9, 0)).toBe(0);
    expect(legacyPointsEarnedThisWeek(10, 0)).toBe(2);
    expect(legacyPointsEarnedThisWeek(11, 0)).toBe(0);
    expect(legacyPointsEarnedThisWeek(2_440, 0)).toBe(2);
  });

  it('is FLAT: week 2,440 pays the same as week 10', () => {
    expect(legacyPointsEarnedThisWeek(2_440, 0)).toBe(legacyPointsEarnedThisWeek(10, 0));
  });

  it('adds +1 per prestige level', () => {
    expect(legacyPointsPerGrant(0)).toBe(2);
    expect(legacyPointsPerGrant(1)).toBe(3);
    expect(legacyPointsPerGrant(5)).toBe(7);
    expect(legacyPointsEarnedThisWeek(20, 3)).toBe(5);
  });

  it('degrades corrupt input to nothing rather than NaN', () => {
    for (const bad of [undefined, null, NaN, -10, '10', Infinity]) {
      expect(legacyPointsEarnedThisWeek(bad as unknown, 0)).toBe(0);
    }
    expect(legacyPointsPerGrant(undefined)).toBe(2);
    expect(legacyPointsPerGrant(NaN)).toBe(2);
  });
});

describe('LATE-1 - what a life earns', () => {
  it('an 18 -> 65 life earns ~490 LP (was 29,890)', () => {
    expect(oldRule(0, WEEKS_18_TO_65)).toBe(29_890);
    expect(legacyPointsForPlayedWeeks(WEEKS_18_TO_65, 0)).toBe(488);
  });

  it('an 18 -> 80 life stays under 10% of the Dynasty Tree (was 5.7x it)', () => {
    const tree = totalLegacyTreeCost();
    expect(oldRule(0, WEEKS_18_TO_80)).toBeGreaterThan(tree);
    expect(legacyPointsForPlayedWeeks(WEEKS_18_TO_80, 0)).toBeLessThan(tree * 0.1);
  });

  it('an heir taking over at 40 earns on PLAYED weeks, not the absolute counter', () => {
    const start = (40 - 18) * 52;
    const end = WEEKS_18_TO_65;
    expect(oldRule(start, end)).toBe(23_335);
    expect(legacyPointsForPlayedWeeks(end - start, 0)).toBe(260);
  });

  it('the copy names the rate the tick applies', () => {
    expect(describeLegacyAccrual(0)).toBe('+2 legacy points every 10 weeks you live');
    expect(describeLegacyAccrual(2)).toBe('+4 legacy points every 10 weeks you live');
  });
});

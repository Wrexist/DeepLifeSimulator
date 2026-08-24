/**
 * Political-perk tier gating.
 *
 * Regression guard for the off-by-one where `getActivePerks` compared the
 * 0-based `requiredLevel` against the 1-based `careerLevel` directly, granting
 * every office one perk tier too many (a first-term Council member collecting
 * Mayor-tier perks).
 */
import { getActivePerks, getCombinedPerkEffects } from '../perks';

describe('getActivePerks - office tier gating (1-based careerLevel)', () => {
  it('a Citizen (careerLevel 0) has no political perks', () => {
    expect(getActivePerks(0)).toHaveLength(0);
  });

  it('a Council Member (rank 1) gets only the base tier - never Mayor perks', () => {
    const perks = getActivePerks(1);
    expect(perks.length).toBeGreaterThan(0);
    // requiredLevel is 0-based; Council is requiredLevel 0 only.
    expect(perks.every(p => p.requiredLevel === 0)).toBe(true);
  });

  it('a Mayor (rank 2) unlocks the Mayor tier but not State Representative', () => {
    const perks = getActivePerks(2);
    expect(perks.some(p => p.requiredLevel === 1)).toBe(true);
    expect(perks.every(p => p.requiredLevel <= 1)).toBe(true);
  });

  it('the President (rank 6) unlocks the top perk tier', () => {
    expect(getActivePerks(6).some(p => p.requiredLevel === 5)).toBe(true);
  });

  it('active-perk count never shrinks moving up the ladder', () => {
    const counts = [0, 1, 2, 3, 4, 5, 6].map(rank => getActivePerks(rank).length);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });
});

describe('getCombinedPerkEffects', () => {
  it('business-income bonus is monotonic non-decreasing up the ladder', () => {
    const biz = [1, 2, 3, 4, 5, 6].map(rank => getCombinedPerkEffects(rank).businessIncomeBonus);
    for (let i = 1; i < biz.length; i++) {
      expect(biz[i]).toBeGreaterThanOrEqual(biz[i - 1]);
    }
  });

  it('a Council Member does not receive the full President-tier effect stack', () => {
    const council = getCombinedPerkEffects(1);
    const president = getCombinedPerkEffects(6);
    expect(president.businessIncomeBonus).toBeGreaterThan(council.businessIncomeBonus);
  });
});

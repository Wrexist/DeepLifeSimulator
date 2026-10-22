/**
 * MON-11 (2026-10 audit): the Premium Pass promo and the Legacy Pass hero
 * counted every REACHED premium tier as "waiting", including ones a lapsed
 * member had already claimed, so subscribing could hand over nothing new.
 */
import {
  XP_PER_TIER,
  getDefaultLegacyPass,
  getLegacyPassReward,
  getUnclaimedPremiumRewardStats,
} from '../legacyPass';

function gemsFor(tiers: number[]): number {
  return tiers.reduce((sum, t) => {
    const r = getLegacyPassReward('premium', t);
    return sum + (r && r.kind === 'gems' ? r.amount ?? 0 : 0);
  }, 0);
}

describe('getUnclaimedPremiumRewardStats', () => {
  it('counts reached premium tiers when none are claimed', () => {
    const pass = { ...getDefaultLegacyPass('s'), xp: 5 * XP_PER_TIER };
    const stats = getUnclaimedPremiumRewardStats(pass);
    const rewarded = [1, 2, 3, 4, 5].filter((t) => getLegacyPassReward('premium', t));
    expect(stats.count).toBe(rewarded.length);
    expect(stats.gems).toBe(gemsFor(rewarded));
  });

  it('excludes tiers that were already claimed', () => {
    const pass = {
      ...getDefaultLegacyPass('s'),
      xp: 5 * XP_PER_TIER,
      claimedPremiumTiers: [1, 2, 3, 4, 5],
    };
    expect(getUnclaimedPremiumRewardStats(pass)).toEqual({ count: 0, gems: 0, headline: null });
  });

  it('counts only the unclaimed remainder', () => {
    const pass = {
      ...getDefaultLegacyPass('s'),
      xp: 5 * XP_PER_TIER,
      claimedPremiumTiers: [1, 2],
    };
    const rest = [3, 4, 5].filter((t) => getLegacyPassReward('premium', t));
    const stats = getUnclaimedPremiumRewardStats(pass);
    expect(stats.count).toBe(rest.length);
    expect(stats.gems).toBe(gemsFor(rest));
  });
});

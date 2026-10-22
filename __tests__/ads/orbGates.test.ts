/**
 * The pure gates behind MON-5 and MON-7 (owner decisions 2026-10-22).
 * lib/ads/orbGates.ts.
 */
jest.mock('@/lib/config/featureFlags', () => {
  const actual = jest.requireActual('@/lib/config/featureFlags');
  return { ...actual, isFeatureEnabled: (flag: string) => mockAdMob && flag === 'adMob' };
});
let mockAdMob = false;
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios } }));

import {
  BANNER_GRACE_WEEKS,
  REWARD_ORB_MIN_PLAYED_WEEKS,
  dailyBonusOfferMode,
  removeAdsOrbUnlocked,
  rewardOrbUnlocked,
} from '@/lib/ads/orbGates';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const life = (played: number, lifeStartWeek = 0) => ({ lifeStartWeek, weeksLived: lifeStartWeek + played });

describe('MON-7 - the reward orb waits 8 played weeks', () => {
  it('is locked before week 8 of this life and open from it', () => {
    expect(REWARD_ORB_MIN_PLAYED_WEEKS).toBe(8);
    expect(rewardOrbUnlocked(life(0))).toBe(false);
    expect(rewardOrbUnlocked(life(7))).toBe(false);
    expect(rewardOrbUnlocked(life(8))).toBe(true);
  });

  it('counts weeks of THIS life, not the age-seeded counter', () => {
    // An age-25 start begins at weeksLived 364: still brand new.
    expect(rewardOrbUnlocked(life(0, 364))).toBe(false);
    expect(rewardOrbUnlocked(life(8, 364))).toBe(true);
  });

  it('treats a corrupt counter as week zero (locked)', () => {
    for (const bad of [undefined, null, NaN, -5]) {
      expect(rewardOrbUnlocked({ weeksLived: bad as unknown as number, lifeStartWeek: 0 })).toBe(false);
    }
    expect(rewardOrbUnlocked(null)).toBe(false);
  });
});

describe('MON-7 - the Remove Ads orb waits past the banner grace', () => {
  it('the grace is a full in-life year', () => {
    expect(BANNER_GRACE_WEEKS).toBe(WEEKS_PER_YEAR);
  });

  it('is locked through the grace and open after it', () => {
    expect(removeAdsOrbUnlocked(life(0))).toBe(false);
    expect(removeAdsOrbUnlocked(life(BANNER_GRACE_WEEKS))).toBe(false);
    expect(removeAdsOrbUnlocked(life(BANNER_GRACE_WEEKS + 1))).toBe(true);
    expect(removeAdsOrbUnlocked(life(0, 364))).toBe(false);
  });
});

describe('MON-5 - the daily doubler for ad-free players', () => {
  it('an ad-free player gets the perk whether or not ads exist in this build', () => {
    mockAdMob = true;
    expect(dailyBonusOfferMode(true)).toBe('perk');
    mockAdMob = false;
    expect(dailyBonusOfferMode(true)).toBe('perk');
  });

  it('a free player is offered an ad only when one can be shown', () => {
    mockAdMob = true;
    expect(dailyBonusOfferMode(false)).toBe('ad');
    mockAdMob = false;
    expect(dailyBonusOfferMode(false)).toBeNull();
  });
});

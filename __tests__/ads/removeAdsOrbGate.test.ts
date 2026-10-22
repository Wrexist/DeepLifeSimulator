import { shouldOfferRemoveAds } from '@/components/RemoveAdsOrb';
import { BANNER_GRACE_WEEKS } from '@/lib/ads/orbGates';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * The Remove Ads orb must never present an offer that cannot be taken: not when
 * the entitlement is already owned, and not in a build with IAP disabled (where
 * the tap would open a shop that cannot sell). And (MON-7) never before the
 * banner grace has ended in this life - selling the removal of ads a player
 * has not met yet.
 */
const base = createTestGameState();
const life = (adsRemoved: boolean, playedWeeks: number, lifeStartWeek = 364) => ({
  settings: { ...base.settings, adsRemoved },
  lifeStartWeek,
  weeksLived: lifeStartWeek + playedWeeks,
});
const PAST_GRACE = BANNER_GRACE_WEEKS + 1;

describe('Remove Ads orb gate', () => {
  it('never offers once ads are removed', () => {
    expect(shouldOfferRemoveAds(life(true, PAST_GRACE), true)).toBe(false);
  });

  it('offers while ads are on and IAP is enabled, once the banner grace is over', () => {
    expect(shouldOfferRemoveAds(life(false, PAST_GRACE), true)).toBe(true);
  });

  it('never offers when IAP is disabled, so the tap is never a dead end', () => {
    expect(shouldOfferRemoveAds(life(false, PAST_GRACE), false)).toBe(false);
  });

  it('MON-7: never offers during the banner grace, measured in weeks of THIS life', () => {
    for (const w of [0, 1, 8, BANNER_GRACE_WEEKS - 1, BANNER_GRACE_WEEKS]) {
      expect(`${w}:${shouldOfferRemoveAds(life(false, w), true)}`).toBe(`${w}:false`);
    }
    // An age-25 start (weeksLived seeded to 364) is still brand new.
    expect(shouldOfferRemoveAds(life(false, 0, 364), true)).toBe(false);
  });
});

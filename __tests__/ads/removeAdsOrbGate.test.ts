import { shouldOfferRemoveAds } from '@/components/RemoveAdsOrb';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * The Remove Ads orb must never present an offer that cannot be taken: not when
 * the entitlement is already owned, and not in a build with IAP disabled (where
 * the tap would open a shop that cannot sell).
 */
const settings = createTestGameState().settings;
const withAdsRemoved = (adsRemoved: boolean) => ({ settings: { ...settings, adsRemoved } });

describe('Remove Ads orb gate', () => {
  it('never offers once ads are removed', () => {
    expect(shouldOfferRemoveAds(withAdsRemoved(true), true)).toBe(false);
  });

  it('offers while ads are on and IAP is enabled', () => {
    expect(shouldOfferRemoveAds(withAdsRemoved(false), true)).toBe(true);
  });

  it('never offers when IAP is disabled, so the tap is never a dead end', () => {
    expect(shouldOfferRemoveAds(withAdsRemoved(false), false)).toBe(false);
  });
});

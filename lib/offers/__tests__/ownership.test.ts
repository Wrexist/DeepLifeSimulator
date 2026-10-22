/**
 * MON-8 (2026-10 audit): the Offer Center sold already-owned non-consumables.
 * Every non-consumable in the weekly rotation must resolve to "owned" once its
 * flag is set, and consumables must never read as owned.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { isNonConsumableOwned } from '@/lib/offers/ownership';
import { OFFER_ROTATION } from '@/lib/offers';
import { IAP_PRODUCTS, isConsumableProduct } from '@/utils/iapConfig';

describe('isNonConsumableOwned', () => {
  it('is false for every rotation product on a fresh save', () => {
    const s = createTestGameState();
    for (const offer of OFFER_ROTATION) {
      expect(isNonConsumableOwned(s, offer.productId)).toBe(false);
    }
  });

  it('reads the same flags the purchase writes for each non-consumable in the rotation', () => {
    const s = createTestGameState();
    s.settings = { ...s.settings, adsRemoved: true, privateBanking: true };
    s.perks = { ...(s.perks ?? {}), workBoost: true, mindset: true, fastLearner: true };
    // Work Pay Boost is a Consumable in App Store Connect but grants a
    // permanent perk, so it is "owned" for this purpose too.
    const permanent = OFFER_ROTATION.filter(
      (o) => !isConsumableProduct(o.productId) || o.productId === IAP_PRODUCTS.WORK_BOOST,
    );
    expect(permanent.map((o) => o.productId).sort()).toEqual(
      [
        IAP_PRODUCTS.WORK_BOOST,
        IAP_PRODUCTS.FAST_LEARNER,
        IAP_PRODUCTS.MINDSET,
        IAP_PRODUCTS.PRIVATE_BANKING,
        IAP_PRODUCTS.REMOVE_ADS,
      ].sort(),
    );
    for (const offer of permanent) {
      expect(isNonConsumableOwned(s, offer.productId)).toBe(true);
    }
  });

  it('never treats a consumable as owned', () => {
    const s = createTestGameState();
    s.settings = { ...s.settings, adsRemoved: true, lifetimePremium: true };
    expect(isNonConsumableOwned(s, IAP_PRODUCTS.GEMS_500)).toBe(false);
    expect(isNonConsumableOwned(s, IAP_PRODUCTS.YOUTH_PILL_PACK)).toBe(false);
  });

  it('treats the perk bundle as owned only when all four perks are', () => {
    const s = createTestGameState();
    s.perks = { workBoost: true, mindset: true, fastLearner: true };
    expect(isNonConsumableOwned(s, IAP_PRODUCTS.UNLOCK_ALL_PERKS)).toBe(false);
    s.perks = { ...s.perks, goodCredit: true };
    expect(isNonConsumableOwned(s, IAP_PRODUCTS.UNLOCK_ALL_PERKS)).toBe(true);
  });
});

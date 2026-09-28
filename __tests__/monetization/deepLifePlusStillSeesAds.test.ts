/**
 * "I bought the monthly DeepLife+ but I am still having ads" (Discord #help,
 * 2026-09-27).
 *
 * The purchase applied `adsRemoved: true`, then `SubscriptionReconciler` - on
 * the next week, foreground or RevenueCat callback - read RevenueCat's
 * `entitlements.active`, found no `premium` entitlement (the product was not
 * attached to it in the dashboard), treated that authoritative "not premium" as
 * a lapse and wrote `adsRemoved: false` back over the paid benefit.
 *
 * Two layers now hold: the store-level facts RevenueCat reports regardless of
 * dashboard wiring count as premium, and every ad gate reads the entitlement
 * flags, not just `adsRemoved`.
 */
import { readEntitlements } from '@/services/RevenueCatService';
import { areAdsRemoved } from '@/lib/ads/rewardedAd';
import { reconcileSubscriptionBenefits, applyDeepLifePlusBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { createTestGameState } from '../helpers/createTestGameState';

describe('readEntitlements', () => {
  it('honours the named premium entitlement', () => {
    expect(readEntitlements({ entitlements: { active: { premium: {} } } })).toEqual({ adsRemoved: true, premium: true });
  });

  it('counts an active DeepLife+ subscription even with no entitlement attached', () => {
    const info = { entitlements: { active: {} }, activeSubscriptions: ['deeplife_premium_monthly'] };
    expect(readEntitlements(info)).toEqual({ adsRemoved: true, premium: true });
  });

  it('strips the Android base-plan suffix', () => {
    const info = { entitlements: { active: {} }, activeSubscriptions: ['deeplife_premium_yearly:yearly'] };
    expect(readEntitlements(info).premium).toBe(true);
  });

  it('does NOT treat a lapsed subscription in purchase history as premium', () => {
    const info = {
      entitlements: { active: {} },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: ['deeplife_premium_monthly'],
    };
    expect(readEntitlements(info)).toEqual({ adsRemoved: false, premium: false });
  });

  it('counts owned non-consumables (lifetime, remove ads)', () => {
    expect(readEntitlements({ allPurchasedProductIdentifiers: ['deeplife_lifetime_premium'] }).premium).toBe(true);
    expect(readEntitlements({ allPurchasedProductIdentifiers: ['deeplife_remove_ads'] })).toEqual({
      adsRemoved: true,
      premium: false,
    });
  });

  it('is all-false for garbage', () => {
    expect(readEntitlements(undefined)).toEqual({ adsRemoved: false, premium: false });
    expect(readEntitlements({ activeSubscriptions: 'nope' })).toEqual({ adsRemoved: false, premium: false });
  });
});

describe('the reported flow: purchase, then the next reconcile', () => {
  it('keeps a subscriber ad-free when RevenueCat reports the subscription but no entitlement', () => {
    const bought = applyDeepLifePlusBenefits(createTestGameState());
    const plusActive = readEntitlements({
      entitlements: { active: {} },
      activeSubscriptions: ['deeplife_premium_monthly'],
    }).premium;
    const after = reconcileSubscriptionBenefits(bought, plusActive, false, true);
    expect(after.settings.adsRemoved).toBe(true);
    expect(areAdsRemoved(after)).toBe(true);
  });

  it('still revokes on a real authoritative lapse', () => {
    const bought = applyDeepLifePlusBenefits(createTestGameState());
    const after = reconcileSubscriptionBenefits(bought, false, false, true);
    expect(areAdsRemoved(after)).toBe(false);
  });
});

describe('a Remove Ads buyer on a save that never saw the purchase', () => {
  it('gets ad-free back from the reconcile (new game / other slot / old backup)', () => {
    const fresh = createTestGameState();
    expect(areAdsRemoved(fresh)).toBe(false);
    const after = reconcileSubscriptionBenefits(fresh, false, true, true);
    expect(after.settings.adsRemoved).toBe(true);
  });

  it('a negative Remove Ads answer still changes nothing on a never-subscribed save', () => {
    const fresh = createTestGameState();
    expect(reconcileSubscriptionBenefits(fresh, false, false, true)).toBe(fresh);
  });
});

describe('areAdsRemoved', () => {
  it('reads every ad-free entitlement flag', () => {
    const base = createTestGameState();
    expect(areAdsRemoved(base)).toBe(false);
    for (const key of ['adsRemoved', 'deepLifePlusActivated', 'lifetimePremium', 'everythingUnlocked'] as const) {
      expect(areAdsRemoved({ settings: { ...base.settings, [key]: true } })).toBe(true);
    }
  });
});

describe('a lapse seen offline is held, then ended by the next real answer (v52)', () => {
  const lapsedOffline = () =>
    reconcileSubscriptionBenefits(applyDeepLifePlusBenefits(createTestGameState()), false, false, false);

  it('the offline pass holds ad-free and marks it as held', () => {
    const held = lapsedOffline();
    expect(held.settings.adsRemoved).toBe(true);
    expect(held.settings.adsRemovedHeldForPlus).toBe(true);
    expect(held.settings.deepLifePlusActivated).toBe(false);
  });

  it('the next authoritative "not entitled" ends the hold', () => {
    const after = reconcileSubscriptionBenefits(lapsedOffline(), false, false, true);
    expect(areAdsRemoved(after)).toBe(false);
    expect(after.settings.adsRemovedHeldForPlus).toBeUndefined();
  });

  it('another offline pass keeps holding', () => {
    const after = reconcileSubscriptionBenefits(lapsedOffline(), false, false, false);
    expect(after.settings.adsRemoved).toBe(true);
  });

  it('a Remove Ads buyer keeps ad-free when the hold ends', () => {
    const after = reconcileSubscriptionBenefits(lapsedOffline(), false, true, true);
    expect(after.settings.adsRemoved).toBe(true);
    expect(after.settings.adsRemovedHeldForPlus).toBeUndefined();
  });

  it('resubscribing clears the hold', () => {
    const after = reconcileSubscriptionBenefits(lapsedOffline(), true, false, true);
    expect(after.settings.adsRemovedHeldForPlus).toBeUndefined();
    expect(after.settings.adsRemoved).toBe(true);
  });
});

describe('welcome gems are one-time per device, not per save', () => {
  it('a new save does not pay them again once paid elsewhere', () => {
    const fresh = createTestGameState();
    const before = fresh.stats.gems ?? 0;
    const after = applyDeepLifePlusBenefits(fresh, { welcomeGrantedElsewhere: true });
    expect(after.stats.gems).toBe(before);
    expect(after.settings.adsRemoved).toBe(true);
  });

  it('the first activation still pays them', () => {
    const fresh = createTestGameState();
    const after = applyDeepLifePlusBenefits(fresh);
    expect((after.stats.gems ?? 0) - (fresh.stats.gems ?? 0)).toBe(500);
  });
});

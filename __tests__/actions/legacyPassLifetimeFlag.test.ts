/**
 * MON2-3: a permanent premium unlock recorded in the save keeps the Legacy
 * Pass premium track, even when the store ledger cannot see it.
 *
 * The $99.99 Mega Pack writes `lifetimePremium` through `everythingUnlocked`
 * under its own (consumable) product id. `subscriptionService.hasPremiumAccess()`
 * only checks the LIFETIME_PREMIUM product, so an authoritative reconcile
 * passed `false` and locked the premium track that Lifetime Premium promises.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { reconcileLegacyPassSeason } from '@/contexts/game/actions/LegacyPassActions';
import { getClaimableTiers, getCurrentSeasonId, XP_PER_TIER } from '@/lib/legacyPass/legacyPass';
import { applyProductBenefitsToState } from '@/services/IAPService';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';

const NOW = Date.now();

function stateWithPass(premiumOwned: boolean, settings: Record<string, unknown> = {}) {
  const base = createTestGameState();
  return {
    ...base,
    settings: { ...base.settings, ...settings },
    legacyPass: {
      seasonId: getCurrentSeasonId(NOW),
      xp: 3 * XP_PER_TIER,
      premiumOwned,
      claimedFreeTiers: [],
      claimedPremiumTiers: [],
      ownedCosmetics: [],
    },
  };
}

describe('Legacy Pass premium from save-level lifetime flags (MON2-3)', () => {
  it('the Mega Pack grant writes lifetimePremium into the save', () => {
    const s = createTestGameState();
    applyProductBenefitsToState(s, getProductConfig(IAP_PRODUCTS.GEMS_MEGA)!, IAP_PRODUCTS.GEMS_MEGA);
    expect(s.settings.lifetimePremium).toBe(true);
  });

  it('an authoritative "not subscribed" does not downgrade a lifetimePremium save', () => {
    const next = reconcileLegacyPassSeason(stateWithPass(true, { lifetimePremium: true }), false, NOW, true);
    expect(next.legacyPass?.premiumOwned).toBe(true);
    expect(getClaimableTiers(next.legacyPass!, 'premium')).toEqual([1, 2, 3]);
  });

  it('upgrades the pass for an everythingUnlocked save the ledger cannot see', () => {
    const next = reconcileLegacyPassSeason(stateWithPass(false, { everythingUnlocked: true }), false, NOW, true);
    expect(next.legacyPass?.premiumOwned).toBe(true);
  });

  it('still downgrades a lapsed subscriber with no permanent unlock', () => {
    const next = reconcileLegacyPassSeason(stateWithPass(true), false, NOW, true);
    expect(next.legacyPass?.premiumOwned).toBe(false);
  });
});

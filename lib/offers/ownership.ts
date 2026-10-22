/**
 * Whether the player already owns a one-time (non-consumable) store product.
 *
 * The Offer Center used to render "Buy" on its weekly featured card with no
 * ownership check, while the gem shop marked the same SKUs Owned. An owner
 * tapping it either paid twice for nothing or, under RevenueCat, hit the
 * store's "already purchased" refusal (2026-10 audit MON-8). The flags read
 * here are the same ones `applyProductBenefitsToState` writes and the gem
 * shop's cards read, so the two shops agree.
 *
 * Consumables (gems, packs, youth pills, boosts) are never "owned" - except
 * Work Pay Boost, a Consumable in App Store Connect whose grant is a permanent
 * perk, so buying it twice would charge for nothing.
 */
import type { GameState } from '@/contexts/game/types';
import { IAP_PRODUCTS } from '@/utils/iapConfig';

export type OwnershipState = Pick<GameState, 'settings' | 'perks'>;

export function isNonConsumableOwned(state: OwnershipState, productId: string): boolean {
  const settings = state.settings;
  const perks = state.perks;
  switch (productId) {
    case IAP_PRODUCTS.REMOVE_ADS:
      return settings?.adsRemoved === true;
    case IAP_PRODUCTS.LIFETIME_PREMIUM:
      return settings?.lifetimePremium === true;
    case IAP_PRODUCTS.WORK_BOOST:
      return perks?.workBoost === true;
    case IAP_PRODUCTS.MINDSET:
      return perks?.mindset === true;
    case IAP_PRODUCTS.FAST_LEARNER:
      return perks?.fastLearner === true;
    case IAP_PRODUCTS.GOOD_CREDIT:
      return perks?.goodCredit === true;
    case IAP_PRODUCTS.UNLOCK_ALL_PERKS:
      return Boolean(perks?.workBoost && perks?.mindset && perks?.fastLearner && perks?.goodCredit);
    case IAP_PRODUCTS.PREMIUM_CREDIT_CARD:
      return settings?.premiumCreditCard === true;
    case IAP_PRODUCTS.FINANCIAL_PLANNING:
      return settings?.financialPlanning === true;
    case IAP_PRODUCTS.BUSINESS_BANKING:
      return settings?.businessBanking === true;
    case IAP_PRODUCTS.PRIVATE_BANKING:
      return settings?.privateBanking === true;
    case IAP_PRODUCTS.REVIVAL_PACK:
      return settings?.hasRevivalPack === true;
    default:
      return false;
  }
}

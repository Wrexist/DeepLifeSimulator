/**
 * DeepLife+ — the auto-renewing premium subscription.
 *
 * Single source of truth for plans + the benefits we ACTUALLY deliver (kept
 * honest — only list perks the game really grants):
 *   - Removes all ads (sets settings.adsRemoved)
 *   - Legacy Pass premium track every season (gated via subscriptionService tier)
 *   - Exclusive seasonal cosmetics (the premium Legacy Pass rewards)
 *   - Gem welcome bonus on subscribe
 *
 * The transport (store products, receipt verification) is handled by
 * SubscriptionService + IAPService; this module is pure config + helpers.
 */
import { SUBSCRIPTION_PRODUCTS, SUBSCRIPTION_CONFIGS } from '@/utils/iapConfig';
import { subscriptionService } from '@/services/SubscriptionService';

export type BillingPeriod = 'monthly' | 'yearly';

export interface DeepLifePlusPlan {
  period: BillingPeriod;
  productId: string;
  /** Display price from SUBSCRIPTION_CONFIGS. */
  price: string;
  /** Short unit label, e.g. "per month". */
  unit: string;
  /** Optional marketing badge. */
  badge?: string;
}

export const DEEP_LIFE_PLUS_PLANS: DeepLifePlusPlan[] = [
  {
    period: 'monthly',
    productId: SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY,
    price: SUBSCRIPTION_CONFIGS[SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY]?.price ?? '$4.99',
    unit: 'per month',
  },
  {
    period: 'yearly',
    productId: SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY,
    price: SUBSCRIPTION_CONFIGS[SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY]?.price ?? '$49.99',
    unit: 'per year',
    badge: 'Best value',
  },
];

export interface DeepLifePlusBenefit {
  id: string;
  title: string;
  description: string;
}

/** Only perks the game genuinely delivers today. Keep this truthful. */
export const DEEP_LIFE_PLUS_BENEFITS: DeepLifePlusBenefit[] = [
  { id: 'no_ads', title: 'Ad-free', description: 'Removes all ads, forever while subscribed.' },
  { id: 'legacy_premium', title: 'Legacy Pass Premium', description: 'Unlocks the premium reward track every season.' },
  { id: 'cosmetics', title: 'Exclusive cosmetics', description: 'Seasonal themes, frames and skins from the premium track.' },
  { id: 'welcome_gems', title: 'Gem welcome bonus', description: 'A one-time gem grant the first time you subscribe.' },
];

/** One-time gem grant applied when DeepLife+ benefits are first activated. */
export const DEEP_LIFE_PLUS_WELCOME_GEMS = 500;

/** Look up a DeepLife+ plan by billing period; `undefined` if none matches. */
export function getDeepLifePlusPlan(period: BillingPeriod): DeepLifePlusPlan | undefined {
  return DEEP_LIFE_PLUS_PLANS.find((p) => p.period === period);
}

/** True if a product id belongs to the DeepLife+ subscription family. */
export function isDeepLifePlusProduct(productId: string): boolean {
  return productId === SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY
    || productId === SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY;
}

/** True if DeepLife+ is currently active (any premium-tier subscription). */
export function isDeepLifePlusActive(): boolean {
  return subscriptionService.getSubscriptionTier() !== 'free';
}

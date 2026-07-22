/**
 * Maps the app's INTERNAL product ids (utils/iapConfig.ts — `deeplife_*`, the
 * ids the reward-grant logic keys off) to the STORE product ids configured in
 * RevenueCat / App Store Connect (`com.deeplife.simulator.*`).
 *
 * The purchase/reward code keeps using the app id everywhere; we translate
 * app→store ONLY at the RevenueCat lookup/purchase boundary (RevenueCatService),
 * and store→app when a webhook/customer-info reports a store id. Anything not
 * listed falls back to its own id unchanged (so matching ids "just work").
 *
 * ⚠️ CONFIRM THESE AGAINST YOUR REVENUECAT DASHBOARD. A few are best-effort
 * guesses from the product names you provided:
 *   • starter_pack            → the "starter" gem pack (deeplife_gems_starter)
 *   • work_pay_boost          → deeplife_work_boost
 *   • business_banking_package→ deeplife_business_banking
 *   • unlock_all_perks_bundle → deeplife_unlock_all_perks
 * Also: only the 10 products you set up are mapped — create the rest in the
 * store (all the gem tiers, subscriptions, etc.) and add them here as you go.
 */
import { IAP_PRODUCTS } from '@/utils/iapConfig';

/** app product id → RevenueCat/store product id */
const APP_TO_STORE: Record<string, string> = {
  [IAP_PRODUCTS.GEMS_500]: 'com.deeplife.simulator.500_gems',
  [IAP_PRODUCTS.GEMS_5000]: 'com.deeplife.simulator.5_000_gems',
  [IAP_PRODUCTS.SKILL_BOOST]: 'com.deeplife.simulator.skill_boost',
  [IAP_PRODUCTS.PREMIUM_CREDIT_CARD]: 'com.deeplife.simulator.premium_credit_card',
  [IAP_PRODUCTS.REMOVE_ADS]: 'com.deeplife.simulator.remove_ads',
  [IAP_PRODUCTS.GEMS_STARTER]: 'com.deeplife.simulator.starter_pack',
  [IAP_PRODUCTS.WORK_BOOST]: 'com.deeplife.simulator.work_pay_boost',
  [IAP_PRODUCTS.MONEY_BOOST]: 'com.deeplife.simulator.money_boost',
  [IAP_PRODUCTS.BUSINESS_BANKING]: 'com.deeplife.simulator.business_banking_package',
  [IAP_PRODUCTS.UNLOCK_ALL_PERKS]: 'com.deeplife.simulator.unlock_all_perks_bundle',
};

const STORE_TO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(APP_TO_STORE).map(([app, store]) => [store, app]),
);

/** App product id → store product id (identity if unmapped). */
export function appToStoreProductId(appId: string): string {
  return APP_TO_STORE[appId] ?? appId;
}

/** Store product id → app product id (identity if unmapped). */
export function storeToAppProductId(storeId: string): string {
  return STORE_TO_APP[storeId] ?? storeId;
}

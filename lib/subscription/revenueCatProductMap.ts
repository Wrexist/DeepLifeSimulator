/**
 * Maps the app's INTERNAL product ids (utils/iapConfig.ts — `deeplife_*`, the
 * ids the reward-grant logic keys off) to the STORE product ids configured in
 * RevenueCat / App Store Connect / Google Play Console.
 *
 * ✅ ALL product IDs use the exact same string in both the app and the store
 * (see REVENUECAT-SETUP.md Appendix A). The identity fallback in
 * `appToStoreProductId` (return appId unchanged when not in the map) therefore
 * handles every current product automatically.
 *
 * The ONLY exception is MINDSET on iOS (deeplife_mindset_perk) vs Android
 * (deeplife_mindset), but that difference is already handled upstream in
 * iapConfig.ts via Platform.select — so the value arriving here is already the
 * correct platform store ID, and no mapping is needed here either.
 *
 * This file is kept as the single place to add overrides if a future product
 * ever needs a store ID that differs from the app ID. Until then it is
 * intentionally empty.
 *
 * RevenueCat purchase/restore boundary usage:
 *   - appToStoreProductId: app id → RC product lookup / purchase call
 *   - storeToAppProductId: RC customerInfo product id → benefit grant key
 */
/**
 * App product id → store product id overrides.
 *
 * Empty: all current products share the same id in the app and the store.
 * Add an entry here ONLY if a future product's store ID diverges from its
 * app-internal ID - re-import IAP_PRODUCTS from '@/utils/iapConfig' for the
 * key when you do.
 *
 * Example (do NOT enable — IDs already match):
 *   [IAP_PRODUCTS.GEMS_500]: 'deeplife_gems_500',  // identity, no-op
 */
const APP_TO_STORE: Record<string, string> = {
  // No overrides needed — all deeplife_* IDs are identical in app and store.
  // (An earlier revision kept an unused IAP_PRODUCTS import alive with a
  // `...(IAP_PRODUCTS ? {} : {})` no-op spread to silence the lint warning -
  // a confusing decoy that read as logic. Import when needed instead.)
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

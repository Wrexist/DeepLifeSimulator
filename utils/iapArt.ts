/**
 * IAP artwork, keyed by product id.
 *
 * One map instead of the same `require()` repeated at every call site. The
 * paths were previously inlined in `GemShopModal` — fine while it was the only
 * surface that showed a product, and a duplicated source of truth the moment a
 * second one existed (the Offer Center). A pack whose art moves should break in
 * one place, not in however many screens happen to render it.
 *
 * `require()` is correct here and is NOT the internal-module `require` the lint
 * rule warns about: Metro resolves asset requires statically at build time, and
 * preflight §11's shipped-image budget only counts assets reachable this way.
 * `utils/menuBackground.ts` is the existing precedent for an asset map living
 * under `utils/`.
 */
import type { ImageSourcePropType } from 'react-native';

import { IAP_PRODUCTS } from '@/utils/iapConfig';

export const IAP_ART: Record<string, ImageSourcePropType> = {
  // Gem ladder
  [IAP_PRODUCTS.GEMS_100]: require('@/assets/images/iap/gems/gems_100.webp'),
  [IAP_PRODUCTS.GEMS_500]: require('@/assets/images/iap/gems/gems_500.webp'),
  [IAP_PRODUCTS.GEMS_1000]: require('@/assets/images/iap/gems/gems_1000.webp'),
  [IAP_PRODUCTS.GEMS_5000]: require('@/assets/images/iap/gems/gems_5000.webp'),
  [IAP_PRODUCTS.GEMS_15000]: require('@/assets/images/iap/gems/gems_15000.webp'),
  [IAP_PRODUCTS.GEMS_50000]: require('@/assets/images/iap/gems/gems_50000.webp'),
  // Bundles
  [IAP_PRODUCTS.GEMS_STARTER]: require('@/assets/images/iap/packs/starter_pack.webp'),
  [IAP_PRODUCTS.GEMS_PREMIUM]: require('@/assets/images/iap/packs/premium_pack.webp'),
  [IAP_PRODUCTS.GEMS_ULTIMATE]: require('@/assets/images/iap/packs/ultimate_pack.webp'),
  [IAP_PRODUCTS.GEMS_MEGA]: require('@/assets/images/iap/packs/mega_pack.webp'),
  // Single items
  [IAP_PRODUCTS.YOUTH_PILL_SINGLE]: require('@/assets/images/iap/items/youth_pill_single.webp'),
  [IAP_PRODUCTS.YOUTH_PILL_PACK]: require('@/assets/images/iap/items/youth_pill_pack.webp'),
  [IAP_PRODUCTS.MONEY_BOOST]: require('@/assets/images/iap/items/money_boost.webp'),
  [IAP_PRODUCTS.SKILL_BOOST]: require('@/assets/images/iap/items/skill_boost.webp'),
  [IAP_PRODUCTS.LIFETIME_PREMIUM]: require('@/assets/images/iap/items/lifetime_premium.webp'),
  // Feature unlocks
  [IAP_PRODUCTS.REMOVE_ADS]: require('@/assets/images/iap/premium/remove_ads.webp'),
  [IAP_PRODUCTS.UNLOCK_ALL_PERKS]: require('@/assets/images/iap/premium/unlock_all_perks.webp'),
  // Perks
  [IAP_PRODUCTS.WORK_BOOST]: require('@/assets/images/iap/perks/work_pay_boost.webp'),
  [IAP_PRODUCTS.MINDSET]: require('@/assets/images/iap/perks/mindset.webp'),
  [IAP_PRODUCTS.FAST_LEARNER]: require('@/assets/images/iap/perks/fast_learner.webp'),
  [IAP_PRODUCTS.GOOD_CREDIT]: require('@/assets/images/iap/perks/good_credit_score.webp'),
  // PRIVATE_BANKING has no dedicated art; `iapArtFor` returns undefined and the
  // card renders without a picture rather than borrowing a misleading one.
};

/** The art for a product, or undefined when it has none (perks, banking). */
export function iapArtFor(productId: string): ImageSourcePropType | undefined {
  return IAP_ART[productId];
}

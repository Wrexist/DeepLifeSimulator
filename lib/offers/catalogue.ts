/**
 * The rotating offer catalogue and its schedule.
 *
 * Every entry sells a REAL SKU that already exists in `utils/iapConfig.ts`.
 * Nothing here invents a product, a bundle or a price — an offer is a decision
 * about which existing pack is FEATURED this week, not a new thing to buy.
 * `offerCatalogue.test.ts` asserts every `productId` resolves to a real config,
 * because a featured SKU that does not load is an unbuyable card.
 *
 * `regularPriceUSD` mirrors the `price` string in `PRODUCT_CONFIGS`, and the
 * same test asserts the two agree — a drift there would let the badge compare
 * against a price the store never charged.
 */
import { IAP_PRODUCTS } from '@/utils/iapConfig';

import type { OfferDefinition } from './types';

/**
 * The rotation, in order. Twelve weeks before it repeats.
 *
 * Deliberately varied in KIND, not just in size: the brief's own warning is
 * that an identical offer every cycle stops reading as an offer. Gems alternate
 * with utility, bundles and one-off items, and no adjacent pair is the same
 * product.
 */
export const OFFER_ROTATION: OfferDefinition[] = [
  {
    id: 'offer_starter_bundle',
    productId: IAP_PRODUCTS.GEMS_STARTER,
    name: 'Starter Bundle',
    blurb: '1,000 gems and a Youth Pill — the usual first purchase.',
    regularPriceUSD: 9.99,
    audience: 'new_player',
  },
  {
    id: 'offer_coin_boost',
    productId: IAP_PRODUCTS.GEMS_1000,
    name: 'Gem Boost',
    blurb: '1,000 gems, nothing bundled.',
    regularPriceUSD: 9.99,
    audience: 'everyone',
  },
  {
    id: 'offer_work_boost',
    productId: IAP_PRODUCTS.WORK_BOOST,
    name: 'Work Pay Boost',
    blurb: '+50% earnings on every job, permanently.',
    regularPriceUSD: 1.99,
    audience: 'established',
  },
  {
    id: 'offer_gem_stack',
    productId: IAP_PRODUCTS.GEMS_5000,
    name: 'Gem Stack',
    blurb: '5,000 gems for players spending faster than they earn.',
    regularPriceUSD: 19.99,
    audience: 'established',
  },
  {
    id: 'offer_fast_learner',
    productId: IAP_PRODUCTS.FAST_LEARNER,
    name: 'Fast Learner',
    blurb: 'Halves how long every course takes.',
    regularPriceUSD: 1.99,
    audience: 'new_player',
  },
  {
    id: 'offer_premium_pack',
    productId: IAP_PRODUCTS.GEMS_PREMIUM,
    name: 'Premium Pack',
    blurb: '3,500 gems, 3 Youth Pills and a money multiplier.',
    regularPriceUSD: 24.99,
    audience: 'established',
  },
  {
    id: 'offer_youth_pack',
    productId: IAP_PRODUCTS.YOUTH_PILL_PACK,
    name: 'Youth Pill Pack',
    blurb: 'Five more runs at the life you are building.',
    regularPriceUSD: 19.99,
    audience: 'wealthy',
  },
  {
    id: 'offer_mindset',
    productId: IAP_PRODUCTS.MINDSET,
    name: 'Mindset',
    blurb: 'Promotions arrive twice as fast.',
    regularPriceUSD: 1.99,
    audience: 'established',
  },
  {
    id: 'offer_gem_small',
    productId: IAP_PRODUCTS.GEMS_500,
    name: 'Gem Pouch',
    blurb: '500 gems — the small one.',
    regularPriceUSD: 4.99,
    audience: 'new_player',
  },
  {
    id: 'offer_private_banking',
    productId: IAP_PRODUCTS.PRIVATE_BANKING,
    name: 'Private Banking',
    blurb: 'Better rates and the accounts the high street will not give you.',
    regularPriceUSD: 9.99,
    audience: 'wealthy',
  },
  {
    id: 'offer_remove_ads',
    productId: IAP_PRODUCTS.REMOVE_ADS,
    name: 'No Ads',
    blurb: 'Removes every ad. The reward orb keeps working.',
    regularPriceUSD: 2.99,
    audience: 'everyone',
  },
  {
    id: 'offer_ultimate_pack',
    productId: IAP_PRODUCTS.GEMS_ULTIMATE,
    name: 'Ultimate Pack',
    blurb: '12,000 gems, 10 Youth Pills and every permanent upgrade.',
    regularPriceUSD: 49.99,
    audience: 'wealthy',
  },
];

/**
 * What a featured offer actually gives you, and how that compares.
 *
 * THE HONESTY RULE IS THE SAME AS `pricing.ts`. Everything here is derived from
 * data the app already ships and the store already charges. Nothing is invented
 * to make a pack look better:
 *
 *  - The bullets come from `PRODUCT_DISPLAY_META`, whose own comment records
 *    that its contents match the grants in `applyProductBenefitsToState`. So a
 *    bullet is a promise the purchase code keeps, not marketing copy written
 *    beside it that can drift.
 *  - The value line is a real ratio between two real prices. It is OMITTED
 *    whenever it cannot be computed truthfully, which is the common case
 *    outside the US.
 *
 * WHY A RATIO AND NOT A "WORTH $X" LINE. A fabricated reference value ("a $60
 * value!") is the exact practice Apple's guidelines treat as misleading, and it
 * is unfalsifiable — nothing in the app ever sold those gems for $60. Gems per
 * dollar against the smallest pack is a statement the player can check against
 * the shop's own ladder, on the same screen.
 */
import { getProductConfig, getProductDisplayMeta, IAP_PRODUCTS } from '@/utils/iapConfig';

/** The baseline every "more per dollar" claim is measured against: the cheapest
 *  rung of the gem ladder. Chosen because it is the pack a player buys when
 *  they are NOT optimising, so it is the honest comparison for "more". */
const BASELINE_PRODUCT = IAP_PRODUCTS.GEMS_100;

export interface OfferBenefits {
  /** Short lines describing what the purchase grants. May be empty. */
  bullets: string[];
  /** Gems included, or null when the SKU grants none. */
  gems: number | null;
  /**
   * e.g. "≈ 140 gems per $1 · 1.4× the 100-gem pack". Null when it cannot be
   * computed truthfully — a non-gem SKU, a missing price, or a storefront we
   * cannot compare in (see `pricing.ts` for the same currency reasoning).
   */
  valueLine: string | null;
}

/** "$24.99" → 24.99, or NaN. Config prices are USD by construction. */
function usd(price: string | undefined): number {
  const n = parseFloat(String(price ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Fallback bullets for SKUs with no `PRODUCT_DISPLAY_META` entry.
 *
 * Derived from the config's own fields rather than written by hand, so a pack
 * whose contents change cannot leave a stale sentence behind.
 */
function derivedBullets(productId: string): string[] {
  const config = getProductConfig(productId) as
    | { gems?: number; youthPills?: number; money?: number; features?: string[]; description?: string }
    | undefined;
  if (!config) return [];
  if (Array.isArray(config.features) && config.features.length > 0) {
    return config.features.slice(0, 3);
  }
  const out: string[] = [];
  if (typeof config.gems === 'number' && config.gems > 0) {
    out.push(`${config.gems.toLocaleString()} Gems`);
  }
  if (typeof config.youthPills === 'number' && config.youthPills > 0) {
    out.push(`${config.youthPills} Youth Pill${config.youthPills === 1 ? '' : 's'}`);
  }
  if (typeof config.money === 'number' && config.money > 0) {
    out.push(`$${config.money.toLocaleString()} in cash`);
  }
  if (out.length === 0 && config.description) out.push(config.description);
  return out;
}

/**
 * Everything the Offer Center needs to describe one offer.
 *
 * `liveUSD` is the store's numeric price when it loaded AND the storefront is
 * USD; pass null otherwise. When present it is preferred over the config price,
 * so a scheduled App Store Connect discount makes the value line BETTER - which
 * is the one case where the number should move, and it moves because the store
 * actually charges less, not because the app decided to say so.
 */
export function offerBenefits(productId: string, liveUSD: number | null = null): OfferBenefits {
  const meta = getProductDisplayMeta(productId);
  const bullets = Array.isArray(meta?.contents) && meta.contents.length > 0
    ? meta.contents.slice(0, 3)
    : derivedBullets(productId);

  const config = getProductConfig(productId) as { gems?: number; price?: string } | undefined;
  const gems = typeof config?.gems === 'number' && config.gems > 0 ? config.gems : null;

  const price = liveUSD !== null && Number.isFinite(liveUSD) && liveUSD > 0
    ? liveUSD
    : usd(config?.price);

  let valueLine: string | null = null;
  if (gems !== null && Number.isFinite(price) && price > 0) {
    const baseline = getProductConfig(BASELINE_PRODUCT) as { gems?: number; price?: string } | undefined;
    const basePrice = usd(baseline?.price);
    const baseGems = baseline?.gems ?? 0;
    const perDollar = gems / price;
    if (Number.isFinite(perDollar) && perDollar > 0) {
      const rounded = Math.round(perDollar).toLocaleString();
      if (baseGems > 0 && Number.isFinite(basePrice) && basePrice > 0) {
        const multiple = perDollar / (baseGems / basePrice);
        // Only claim "more" when it IS more. A pack at or below the baseline
        // rate states its rate and stops there rather than dressing up a 1.0×.
        valueLine = multiple >= 1.05
          ? `≈ ${rounded} gems per $1 · ${multiple.toFixed(1)}× the ${baseGems}-gem pack`
          : `≈ ${rounded} gems per $1`;
      } else {
        valueLine = `≈ ${rounded} gems per $1`;
      }
    }
  }

  return { bullets, gems, valueLine };
}

/**
 * Honest price resolution for a featured offer.
 *
 * THE RULE THIS FILE ENFORCES: the app never computes a sale price. It renders
 * what the store reports, and it claims a discount only when it can PROVE one.
 *
 * Why the app cannot compute it. Apple's Promotional Offers API discounts
 * auto-renewable subscriptions only — it cannot touch this game's consumable
 * gem packs (verified against Apple's StoreKit documentation, 2026-08). The
 * mechanism that CAN is an App Store Connect **scheduled temporary price
 * change**: a start date, an end date, up to a year, explicitly supported for
 * consumables and non-consumables. That price change happens on Apple's side,
 * and StoreKit then reports the reduced price as the product's ordinary price.
 * There is no API that says "this is on sale" — only the current price.
 *
 * So a discount badge is derived, not declared:
 *
 *   badge ⟺ the live store price is numerically BELOW `regularPriceUSD`
 *            AND both figures are in the same currency (USD)
 *
 * When the owner has not scheduled a price change, the live price equals the
 * regular price, the comparison fails, and the card renders as a plain FEATURED
 * offer at its real price. That is the intended default. The failure mode is
 * "no badge", never "a badge for a discount that is not happening".
 *
 * NON-USD STOREFRONTS. `regularPriceUSD` is USD by definition, so it cannot be
 * compared against a EUR or JPY price without an exchange rate the app does not
 * have. Rather than guess, a non-USD storefront gets NO badge — the player
 * still sees their real localized price and the offer still works. Under-
 * claiming a real sale is a cost worth paying to make a false claim
 * structurally impossible.
 *
 * See `docs/IAP-PRICE-ROTATION.md` for the App Store Connect procedure.
 */
import type { OfferDefinition, ResolvedOfferPrice } from './types';

/** The shape we need off a loaded store product. Kept structural rather than
 *  importing an SDK type: the adapter (`services/expoIapAdapter.ts`) normalises
 *  two different SDKs and does not guarantee a numeric price. */
export interface StoreProductLike {
  productId?: string;
  price?: string | number;
  displayPrice?: string;
  localizedPrice?: string;
  priceAmount?: number;
  currency?: string;
  currencyCode?: string;
  priceCurrencyCode?: string;
}

const NOT_LOADED: ResolvedOfferPrice = {
  displayPrice: '',
  purchasable: false,
  discountPercent: null,
  strikethroughPrice: null,
};

/** The player-facing price string, straight from the SDK. */
function displayPriceOf(product: StoreProductLike): string {
  const candidate = product.displayPrice ?? product.localizedPrice ?? product.price;
  return typeof candidate === 'string'
    ? candidate
    : typeof candidate === 'number' && Number.isFinite(candidate)
      ? String(candidate)
      : '';
}

/** A finite positive amount plus an ISO currency, or null if the SDK gave us
 *  only a formatted string (which we must not parse — "1.234,56 €" and
 *  "$1,234.56" do not parse the same way). */
function numericPrice(product: StoreProductLike): { amount: number; currency: string } | null {
  const amount =
    typeof product.priceAmount === 'number'
      ? product.priceAmount
      : typeof product.price === 'number'
        ? product.price
        : NaN;
  const currency =
    typeof product.currency === 'string'
      ? product.currency
      : typeof product.currencyCode === 'string'
        ? product.currencyCode
        : typeof product.priceCurrencyCode === 'string'
          ? product.priceCurrencyCode
          : '';
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;
  return { amount, currency: currency.toUpperCase() };
}

/**
 * Resolve what to render for one offer.
 *
 * `product` is the store's loaded product for `offer.productId`, or
 * null/undefined when it did not load. A SKU that did not load is NOT
 * purchasable and gets no price — the gem shop already refuses to present a buy
 * button in that case, and an offer card must not be the one surface that
 * shows a config price next to a working button.
 */
export function resolveOfferPrice(
  offer: OfferDefinition,
  product: StoreProductLike | null | undefined,
): ResolvedOfferPrice {
  if (!product) return NOT_LOADED;

  const displayPrice = displayPriceOf(product);
  if (!displayPrice) return NOT_LOADED;

  const base: ResolvedOfferPrice = {
    displayPrice,
    purchasable: true,
    discountPercent: null,
    strikethroughPrice: null,
  };

  const live = numericPrice(product);
  // No numeric price, or a storefront that is not USD → we cannot compare, so
  // we do not claim. This is the common path outside the US and it is correct.
  if (!live || live.currency !== 'USD') return base;

  const regular = offer.regularPriceUSD;
  if (!Number.isFinite(regular) || regular <= 0) return base;

  // A price ABOVE the recorded regular price means our record is stale (Apple
  // adjusts prices for tax and FX). Treat it as "no sale" rather than as a
  // negative discount — and never render a strikethrough LOWER than the price
  // being charged.
  if (live.amount >= regular) return base;

  const discountPercent = Math.round((1 - live.amount / regular) * 100);
  // A sub-1% reduction is FX noise, not a sale. Rounding it to "0% OFF" or
  // showing a badge for two cents would be worse than showing nothing.
  if (discountPercent < 1) return base;

  return {
    ...base,
    discountPercent,
    strikethroughPrice: `$${regular.toFixed(2)}`,
  };
}

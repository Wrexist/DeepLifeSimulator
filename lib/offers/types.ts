/**
 * Rotating weekly offer types.
 *
 * READ THIS BEFORE ADDING A PRICE FIELD.
 *
 * There is no "sale price" in this module and there must never be one. The only
 * price the app may DISPLAY is the one StoreKit reports for the product in the
 * player's own storefront and currency. A discount here is a claim about what
 * the App Store is charging, and the app is not the thing that decides that —
 * App Store Connect is. See `docs/IAP-PRICE-ROTATION.md`.
 *
 * `regularPriceUSD` below is therefore NOT a price to show. It is the
 * undiscounted list price we believe the SKU normally sells at, used for
 * exactly one purpose: deciding whether the live price is genuinely lower, so
 * a "SAVE 30%" badge is only ever rendered against a real reduction.
 */

/** Why a given offer is being shown to this player. Personalisation changes
 *  WHICH offer is featured, never its price — the weekly rotation is identical
 *  for everyone, and eligibility only reorders within a week. */
export type OfferAudience =
  | 'everyone'
  | 'new_player'
  | 'established'
  | 'business_owner'
  | 'wealthy';

export interface OfferDefinition {
  /** Stable id for analytics and the rotation schedule. Not the SKU. */
  id: string;
  /** The real IAP product id this offer sells. Must exist in `IAP_PRODUCTS`. */
  productId: string;
  /** Short, concrete headline — "Coin Boost", not "Amazing Value!". */
  name: string;
  /** What the player actually gets, in plain words. */
  blurb: string;
  /**
   * The SKU's normal list price in USD, mirroring `PRODUCT_CONFIGS`.
   * Used ONLY as the comparison basis for a discount badge (see the file
   * header). Never rendered on its own.
   */
  regularPriceUSD: number;
  /** Who this offer is most useful to. Affects ordering, never price. */
  audience: OfferAudience;
}

/** One week of the rotation. */
export interface ScheduledOffer {
  /** Absolute UTC week index this offer occupies. */
  weekIndex: number;
  offer: OfferDefinition;
  /** UTC instant the week starts (inclusive). */
  startsAt: Date;
  /** UTC instant the week ends (exclusive). */
  endsAt: Date;
}

/**
 * What the UI needs to render one offer honestly.
 *
 * `displayPrice` is verbatim from the store. `discountPercent` is null unless
 * a reduction was PROVEN against a same-currency comparison — never estimated,
 * never carried over from config.
 */
export interface ResolvedOfferPrice {
  /** The string to show the player. Empty when the store has not loaded. */
  displayPrice: string;
  /** True when this SKU actually loaded from the store and can be bought. */
  purchasable: boolean;
  /**
   * A whole-number percentage, or null. Null means "we could not prove a
   * discount", which is the correct and common case — it is what renders when
   * no temporary price change is currently scheduled in App Store Connect.
   */
  discountPercent: number | null;
  /**
   * The regular price to strike through, in the SAME currency as
   * `displayPrice`. Non-null only alongside a non-null `discountPercent`.
   */
  strikethroughPrice: string | null;
}

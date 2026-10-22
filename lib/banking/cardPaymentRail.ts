/**
 * Whether purchases can be paid BY CARD yet (ECO-5).
 *
 * A credit card can be applied for, paid down and redeemed, but nothing in the
 * game can be bought with one: the old free-standing "Charge" only grew the
 * interest-bearing balance, so its cashback was always a net loss, and the
 * $4.99 Premium Credit Card (a cashback floor on card spend) had no in-game
 * value.
 *
 * Owner decision 2026-10-22: until a card payment rail ships (buyItem,
 * buyFood, vehicles, travel taking a card as the payment source), the SKU is
 * hidden from every in-app shop surface. The store product config, restore
 * and entitlement handling are untouched, so anyone who already bought it
 * keeps it. Flip `CARD_PAYMENT_RAIL_LIVE` in the change that ships the rail.
 */
export const CARD_PAYMENT_RAIL_LIVE = false;

/**
 * Should a shop surface list the Premium Credit Card? Only once card spending
 * exists - or, before then, as an already-owned (non-purchasable) row for a
 * player who bought it, so their entitlement stays visible.
 */
export function isPremiumCreditCardListed(alreadyOwned: boolean): boolean {
  return CARD_PAYMENT_RAIL_LIVE || alreadyOwned;
}

/**
 * Purchase-side effects of the three re-purposed "unlock" bonuses
 * (2026-08-23, owner-approved rebalance).
 *
 * All three shipped as unlocks for gates that never existed, were caught by
 * the inert-bonus audit, and sat in `lib/prestige/inertBonuses.ts` with the
 * shop refusing to sell them while the product question stayed open. The
 * owner's call resolved to RE-PURPOSE: each keeps its id, its price and its
 * fantasy, and gains an effect the game can actually deliver — so the players
 * who already paid get value retroactively and nobody's points are stranded.
 *
 *   early_item_access      4,000 · rare  "Premium Access"    → items −15%
 *   early_real_estate      6,000 · epic  "Real Estate Mogul" → properties −10%
 *   auto_manage_properties 5,000 · rare  "Property Manager"  → rent +15%
 *
 * Why discounts and a rent bump, not new gates: a discount is felt on every
 * purchase for the rest of the account's life, scales with the economy rather
 * than breaking it, and needs no new UI. The magnitudes are deliberately
 * below the tax/soft-cap thresholds the economy audits watch.
 *
 * ANTI-ARBITRAGE — the part that must not regress:
 *   - Items sell at 50% of the UNDISCOUNTED inflated price, so buy-then-sell
 *     under the 15% discount still loses 35 points, same as everyone else
 *     loses 50.
 *   - A discounted property's `purchasePrice`/`currentValue` basis is the
 *     DISCOUNTED figure (you paid less; it appreciates from what you paid),
 *     so buy-then-sell cannot mint the 10% the discount saved.
 *   - The rent bonus applies BEFORE `REAL_ESTATE_WEEKLY_RENT_CAP`, so it can
 *     never push a portfolio past the anti-exploit ceiling.
 *
 * §4.4 discipline: every multiplier here must be read by BOTH the price shown
 * and the price charged, from the same call, or the shop advertises a number
 * the action does not charge — the most repeated bug class in this repo.
 */

export const ITEM_DISCOUNT_RATE = 0.15;
export const PROPERTY_DISCOUNT_RATE = 0.10;
export const RENTAL_INCOME_BONUS_RATE = 0.15;

const has = (unlockedBonuses: string[] | undefined | null, id: string): boolean =>
  Array.isArray(unlockedBonuses) && unlockedBonuses.includes(id);

/** Multiplier applied to item shop prices (1 = no discount). */
export function itemPriceMultiplier(unlockedBonuses: string[] | undefined | null): number {
  return has(unlockedBonuses, 'early_item_access') ? 1 - ITEM_DISCOUNT_RATE : 1;
}

/** Multiplier applied to property purchase prices (1 = no discount). */
export function propertyPriceMultiplier(unlockedBonuses: string[] | undefined | null): number {
  return has(unlockedBonuses, 'early_real_estate') ? 1 - PROPERTY_DISCOUNT_RATE : 1;
}

/** Multiplier applied to weekly tenant rent income (1 = no bonus). */
export function rentalIncomeMultiplier(unlockedBonuses: string[] | undefined | null): number {
  return has(unlockedBonuses, 'auto_manage_properties') ? 1 + RENTAL_INCOME_BONUS_RATE : 1;
}

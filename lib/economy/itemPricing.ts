/**
 * The one price an item is bought at.
 *
 * Inflation (priceIndex) times the prestige "Premium Access" discount
 * (lib/prestige/purchaseDiscounts.ts). Both `buyItem` (the charge) and the
 * market screen (the display) MUST read this same function — a discount
 * applied on one side only is the advertised-vs-actual bug class (§4.4).
 *
 * SELL prices deliberately do NOT use this: items sell at 50% of the
 * UNDISCOUNTED inflated price, so the discount can never be arbitraged into
 * a buy-sell money loop (0.85 out, 0.50 back still loses 0.35).
 */
import { getInflatedPrice } from './inflation';
import { itemPriceMultiplier } from '@/lib/prestige/purchaseDiscounts';

const safeMindsetMult = (mult: number): number =>
  Number.isFinite(mult) && mult > 0 ? Math.min(1.6, Math.max(0.5, mult)) : 1;

/**
 * `mindsetMult` is the life's Mindset market multiplier
 * (`mindsetEffects(state).marketPrice`: a Frugal 0.90, a Big Spender 1.10).
 * Neutral when omitted. Buy side only, like the prestige discount.
 */
export function getItemPurchasePrice(
  basePrice: number,
  priceIndex: number,
  unlockedBonuses: string[] | undefined | null,
  mindsetMult = 1,
): number {
  return getInflatedPrice(basePrice, priceIndex) * itemPriceMultiplier(unlockedBonuses) * safeMindsetMult(mindsetMult);
}

/**
 * The one price food is bought at: inflation times the Mindset market
 * multiplier. `resolveFoodPurchase` (the charge) and the market screen (the
 * label and the affordability gate) both read it.
 */
export function getFoodPurchasePrice(basePrice: number, priceIndex: number, mindsetMult = 1): number {
  return getInflatedPrice(basePrice, priceIndex) * safeMindsetMult(mindsetMult);
}

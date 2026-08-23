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

export function getItemPurchasePrice(
  basePrice: number,
  priceIndex: number,
  unlockedBonuses: string[] | undefined | null,
): number {
  return getInflatedPrice(basePrice, priceIndex) * itemPriceMultiplier(unlockedBonuses);
}

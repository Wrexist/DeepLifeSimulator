/**
 * What it costs to HOLD property, as opposed to to buy it.
 *
 * The 2026-08-25 economy audit's one structural gap in the sink model: no
 * recurring cost in the game scaled with wealth unless the player volunteered
 * it. Rent as a tenant tops out at $950/wk; luxury upkeep is opt-in; and an
 * OWNED home paid nothing at all - the 2.2%/yr carrying cost applied only
 * while a unit was rented AND earning, and catalog homes carry no `upkeep`
 * field, so a $8,000,000 penthouse was free to hold while the renter across
 * the street paid $950 a week. Wealth had no weight.
 *
 * Property tax fixes that in the one place where a cost is genuinely
 * proportional to what you own, understandable without a tooltip, and
 * predictable week to week. The rate split is unchanged in total - the old
 * 2.2%/yr for a rented unit was authored as "~1.2%/yr tax + ~1% maintenance",
 * so tax simply becomes universal (you own it, you are taxed on it) and
 * maintenance stays with commercial use. Nothing is charged twice.
 */
import type { RealEstate } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { isCommercialCatalogId } from './catalog';

/** Annual property tax, as a fraction of a property's current value. */
export const PROPERTY_TAX_ANNUAL_RATE = 0.012;

/**
 * Commercial buildings pay double the residential rate (2.4%/yr) - the
 * real-world shape, and the counterweight the 2026-08-25 audit found missing
 * WITHIN the asset class: the commercial rent mode out-earned long-term
 * residential on yield (0.20%/wk vs 0.15%) AND stability (0.5% vacancy hazard
 * vs 1%), so past the capital gate there was no reason to ever let a
 * commercial unit go. With the heavier tax it keeps a premium - it should,
 * it is the $620k+ tier with no comfort/energy utility - but the premium is
 * now paid for, not free.
 */
export const COMMERCIAL_PROPERTY_TAX_MULTIPLIER = 2;

/**
 * Annual maintenance reserve on a unit in commercial use, as a fraction of
 * value. Charged by the tenancy tick against gross rent, not here.
 */
export const RENTED_MAINTENANCE_ANNUAL_RATE = 0.010;

const safeValue = (p: RealEstate | null | undefined): number => {
  if (!p || !p.owned) return 0;
  const v = typeof p.currentValue === 'number' && isFinite(p.currentValue) && p.currentValue > 0
    ? p.currentValue
    : p.price;
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
};

/** Weekly property tax on one owned property. 0 for anything unowned. */
export function propertyTaxWeekly(property: RealEstate | null | undefined): number {
  const value = safeValue(property);
  if (value <= 0) return 0;
  const rate = property && isCommercialCatalogId(property.id)
    ? PROPERTY_TAX_ANNUAL_RATE * COMMERCIAL_PROPERTY_TAX_MULTIPLIER
    : PROPERTY_TAX_ANNUAL_RATE;
  const weekly = (value * rate) / WEEKS_PER_YEAR;
  return isFinite(weekly) && weekly > 0 ? Math.round(weekly) : 0;
}

/**
 * Weekly property tax across a portfolio - the mandatory, wealth-scaling half
 * of holding property. A studio owner pays ~$22/wk; a penthouse owner ~$1,846.
 */
export function portfolioPropertyTaxWeekly(
  properties: readonly RealEstate[] | null | undefined,
): number {
  let total = 0;
  for (const p of properties ?? []) total += propertyTaxWeekly(p);
  return total;
}

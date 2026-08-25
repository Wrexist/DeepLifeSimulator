/**
 * Weekly real-estate tick — wraps the legacy `processWeeklyHousing` (which
 * still owns condition decay + base appreciation + base rent) and layers on
 * the new tenancy + cycle + Airbnb-variance logic.
 *
 * The tick:
 *   1. Runs the legacy housing pass (unchanged) to get appreciation / decay /
 *      base rent / upkeep / happiness.
 *   2. For each owned property, calls `tickProperty` to:
 *        - evolve neighborhood cycle
 *        - update tenant satisfaction
 *        - resolve move-out / find-new-tenant rolls
 *        - compute realized rent for the week (Airbnb variance, etc.)
 *   3. Applies the cycle's appreciation multiplier on top of the legacy base.
 *
 * Returns a delta to fold into the game's weekly cash flow + happiness, plus
 * notifications + the updated property list.
 */

import { RealEstate } from '@/contexts/game/types';
import { RENTED_MAINTENANCE_ANNUAL_RATE } from './carryingCosts';
import { cycleEffects, NeighborhoodCycle } from './market';
import { tickProperty } from './operations';
import { getUpgradeTier } from './housing';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * Per-source weekly cap on realized rental income, matching the design's
 * `PER_SOURCE_CAPS.realEstate` ($150K/wk) in lib/economy/passiveIncome.ts.
 * The aggregate tenant rent computed here feeds the weekly cash path directly
 * (applyRentAndHousing overwrites the legacy figure with it), so without this
 * clamp a large, high-rent portfolio could blow past the anti-exploit ceiling
 * that the passive-income aggregator enforces on every OTHER source.
 */
export const REAL_ESTATE_WEEKLY_RENT_CAP = 150000;

export interface RealEstateWeeklyTickInput {
  /** Properties as returned by the legacy `processWeeklyHousing` (already appreciated/decayed). */
  legacyProcessedProperties: RealEstate[];
  /** Income from the legacy housing pass — we may revise this property-by-property. */
  legacyRentalIncome: number;
  currentWeek: number;
  rollFor: (key: string) => number;
  /**
   * Prestige "Property Manager" (+15% tenant rent) — see
   * lib/prestige/purchaseDiscounts.ts. Applied to the aggregate realized rent
   * BEFORE the $150K/wk per-source cap, so the bonus can never push a
   * portfolio past the anti-exploit ceiling. Optional; default 1 (no bonus).
   */
  rentalIncomeMultiplier?: number;
}

export interface RealEstateWeeklyTickResult {
  properties: RealEstate[];
  /** New rental income figure that replaces the legacy one. */
  rentalIncome: number;
  notifications: { id: string; title: string; message: string }[];
}

export function runRealEstateWeeklyTick(input: RealEstateWeeklyTickInput): RealEstateWeeklyTickResult {
  let properties = input.legacyProcessedProperties;
  const notifications: RealEstateWeeklyTickResult['notifications'] = [];
  let rentalIncome = 0;

  for (let i = 0; i < properties.length; i++) {
    const before = properties[i];
    if (!before.owned) continue;

    // Layer cycle-driven appreciation on top of the legacy base appreciation.
    const cycle = (before.marketCycle ?? 'stable') as NeighborhoodCycle;
    const params = cycleEffects(cycle);
    const baseValue = safe(before.currentValue, before.price);
    // Apply the additional appreciation kick on top of legacy 0.1%/wk.
    // params.appreciationMultiplier (relative to 1.0) defines the boost.
    const cycleBoost = (params.appreciationMultiplier - 1) * 0.001; // ~0.1%/wk × multiplier
    const adjustedValue = baseValue * (1 + cycleBoost);

    // Property tick (cycle evolution, tenant lifecycle, realized rent).
    const tick = tickProperty({
      property: { ...before, currentValue: adjustedValue },
      currentWeek: input.currentWeek,
      rollFor: input.rollFor,
    });
    properties = properties.map((p, idx) => (idx === i ? tick.property : p));
    // Net recurring carrying costs (property tax + maintenance reserve) against the
    // gross rent for rented units that are ACTUALLY earning rent. Previously
    // rentalIncome credited gross rent with no offset, so a tenanted property was
    // pure profit. ~1.2%/yr tax + ~1%/yr maintenance ≈ 2.2%/yr of value, charged
    // weekly (WEEKS_PER_YEAR ≈ 52). A vacant/owner-occupied unit (no rent received)
    // is left at 0 so owners aren't charged phantom rent on their own home.
    // MAINTENANCE only. The other ~1.2%/yr of the old 0.022 was property TAX,
    // which is now charged on every owned unit whether or not it earns rent
    // (`lib/realEstate/carryingCosts.ts`) - the mandatory, wealth-scaling cost
    // the economy was missing. Keeping it here as well would bill a landlord
    // twice for the same tax. Total on a rented unit is unchanged.
    const carryingCost =
      tick.property.status === 'rented' && tick.rentReceived > 0
        ? (safe(tick.property.currentValue, tick.property.price) * RENTED_MAINTENANCE_ANNUAL_RATE) / 52
        : 0;
    // Route the upgrade-tier rent bonus through the realized (tenant-model) rent
    // so the legacy `processWeeklyHousing` figure — which previously carried this
    // bonus only to be discarded by the overwrite in applyRentAndHousing — is no
    // longer dead. Modest + tier-capped (max +$500/wk at tier 3) and only paid on
    // a unit that is ACTUALLY earning rent this week (tenant present), mirroring
    // the carrying-cost gate so vacant/owner-occupied homes get nothing.
    const upgradeRentBonus =
      tick.property.status === 'rented' && tick.rentReceived > 0
        ? safe(getUpgradeTier(safe(tick.property.upgradeLevel, 0))?.rentBonus, 0)
        : 0;
    rentalIncome += tick.rentReceived + upgradeRentBonus - carryingCost;
    notifications.push(...tick.notifications);
  }

  // Prestige Property Manager: scale POSITIVE realized rent only — a
  // net-negative week (carrying costs exceeding rent) is a real expense and
  // must not be amplified by an income bonus.
  const rentMult = safe(input.rentalIncomeMultiplier, 1);
  if (rentMult > 1 && rentalIncome > 0) {
    rentalIncome = Math.round(rentalIncome * rentMult);
  }

  // Clamp the aggregate realized rent to the design's $150K/wk real-estate
  // per-source cap BEFORE it feeds cash (applyRentAndHousing routes this straight
  // into the weekly cash flow). Upper-bound only — a net-negative carrying-cost
  // week stays as-is (a real expense), matching the passive-income aggregator
  // which only caps the positive side.
  const cappedRentalIncome = Math.min(REAL_ESTATE_WEEKLY_RENT_CAP, rentalIncome);

  return { properties, rentalIncome: cappedRentalIncome, notifications };
}

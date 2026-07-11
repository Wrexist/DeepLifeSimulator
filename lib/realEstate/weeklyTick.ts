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
import { cycleEffects, NeighborhoodCycle } from './market';
import { tickProperty } from './operations';
import { getUpgradeTier } from './housing';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface RealEstateWeeklyTickInput {
  /** Properties as returned by the legacy `processWeeklyHousing` (already appreciated/decayed). */
  legacyProcessedProperties: RealEstate[];
  /** Income from the legacy housing pass — we may revise this property-by-property. */
  legacyRentalIncome: number;
  currentWeek: number;
  rollFor: (key: string) => number;
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
    const carryingCost =
      tick.property.status === 'rented' && tick.rentReceived > 0
        ? (safe(tick.property.currentValue, tick.property.price) * 0.022) / 52
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

  return { properties, rentalIncome, notifications };
}

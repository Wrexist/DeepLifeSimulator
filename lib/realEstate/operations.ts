/**
 * Pure state transformers for RealEstate.
 *
 * Each function takes a list of properties + extras and returns a new list
 * plus side-effect data (cash delta, loan-to-create, tenant churn). The
 * React-aware action wrappers in RealEstateActions.ts apply the side effects.
 */

import { RealEstate } from '@/contexts/game/types';
import {
  findTenantProbability,
  generateTenant,
  moveOutProbability,
  realizedWeeklyRent,
  RENT_MODE_PARAMS,
  RentMode,
  satisfactionStep,
  TenantSnapshot,
} from './tenancy';
import { CYCLE_PARAMS, NeighborhoodCycle, nextCycle, sampleCycleDuration } from './market';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function findOwnedById(properties: RealEstate[], id: string): RealEstate | undefined {
  return properties.find((p) => p.id === id && p.owned);
}

export function ownedProperties(properties: RealEstate[]): RealEstate[] {
  return properties.filter((p) => p.owned);
}

export function totalEquity(properties: RealEstate[], mortgageRemainingById: Map<string, number>): number {
  let sum = 0;
  for (const p of properties) {
    if (!p.owned) continue;
    const value = safe(p.currentValue ?? p.price);
    const mortgage = p.mortgageId ? safe(mortgageRemainingById.get(p.mortgageId)) : 0;
    sum += Math.max(0, value - mortgage);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Purchase + sale
// ---------------------------------------------------------------------------

export interface MarkOwnedInput {
  propertyId: string;
  currentWeek: number;
  purchasePrice: number;
  mortgageId?: string;
  /** Optional initial neighborhood — defaults to the property id. */
  neighborhood?: string;
  /** Set the property as the player's primary residence. */
  asResidence?: boolean;
}

/**
 * Flip a property from unowned → owned, attach mortgage id (if any), seed the
 * neighborhood + cycle bookkeeping, and optionally mark it as the residence
 * (clearing the previous residence flag).
 */
export function markOwned(properties: RealEstate[], input: MarkOwnedInput): RealEstate[] {
  return properties.map((p) => {
    if (p.id === input.propertyId) {
      return {
        ...p,
        owned: true,
        status: input.asResidence ? 'owner' : (p.status === 'vacant' ? 'vacant' : p.status ?? 'owner'),
        purchasePrice: input.purchasePrice,
        purchasedWeek: input.currentWeek,
        currentValue: input.purchasePrice,
        condition: safe(p.condition, 90),
        currentResidence: input.asResidence ?? p.currentResidence,
        mortgageId: input.mortgageId,
        neighborhood: input.neighborhood ?? p.neighborhood ?? p.id,
        marketCycle: 'stable',
        cycleWeeksRemaining: 26,
      };
    }
    if (input.asResidence && p.currentResidence) {
      // Demote the prior residence so only one property carries the flag.
      return { ...p, currentResidence: false };
    }
    return p;
  });
}

export interface SaleResult {
  properties: RealEstate[];
  saleProceeds: number;
  mortgagePayoff: number;
  capitalGain: number;
  /** True if any mortgage was attached and needs to be removed from gameState.loans. */
  releasedMortgageId?: string;
}

/**
 * Sell a property. Pays off any outstanding mortgage from the proceeds, returns
 * the rest as cash. Capital gain = (sale price − purchase price). Caller deletes
 * the loan and adds the proceeds to stats.money.
 */
export function sellProperty(
  properties: RealEstate[],
  propertyId: string,
  mortgageRemaining: number
): SaleResult {
  const idx = properties.findIndex((p) => p.id === propertyId);
  if (idx === -1) {
    return { properties, saleProceeds: 0, mortgagePayoff: 0, capitalGain: 0 };
  }
  const p = properties[idx];
  const value = safe(p.currentValue ?? p.price);
  const debt = safe(mortgageRemaining);
  const gain = value - safe(p.purchasePrice, p.price);
  // Selling isn't frictionless: a realtor/closing cost on the sale price plus a
  // capital-gains tax on any positive gain come out of the proceeds. Without these
  // a buy-then-immediate-sell round trip was nearly free.
  const closingCost = value * 0.06; // 6% realtor + closing
  const capitalGainsTax = gain > 0 ? gain * 0.15 : 0; // 15% on realized gain
  const proceeds = Math.max(0, value - debt - closingCost - capitalGainsTax);
  const next = [...properties];
  next[idx] = {
    ...p,
    owned: false,
    status: 'vacant',
    currentResidence: false,
    mortgageId: undefined,
    tenant: undefined,
    rentMode: undefined,
    launderingFront: false,
  };
  return {
    properties: next,
    saleProceeds: proceeds,
    mortgagePayoff: debt,
    capitalGain: gain,
    releasedMortgageId: p.mortgageId,
  };
}

// ---------------------------------------------------------------------------
// Tenant management
// ---------------------------------------------------------------------------

export function setRentMode(
  properties: RealEstate[],
  propertyId: string,
  mode: RentMode,
  weeklyRent: number
): RealEstate[] {
  return properties.map((p) =>
    p.id === propertyId
      ? {
          ...p,
          status: 'rented',
          rentMode: mode,
          rent: weeklyRent,
          currentResidence: false,
          tenant: undefined,
          weeksVacant: 0,
        }
      : p
  );
}

export function endRental(properties: RealEstate[], propertyId: string): RealEstate[] {
  return properties.map((p) =>
    p.id === propertyId
      ? { ...p, status: 'owner', rentMode: undefined, tenant: undefined, rent: undefined, weeksVacant: undefined }
      : p
  );
}

export function kickTenant(properties: RealEstate[], propertyId: string): RealEstate[] {
  return properties.map((p) =>
    p.id === propertyId ? { ...p, tenant: undefined, weeksVacant: 0 } : p
  );
}

// ---------------------------------------------------------------------------
// Per-week update for ONE rented property — used by weeklyTick.ts
// ---------------------------------------------------------------------------

export interface PropertyTickInput {
  property: RealEstate;
  currentWeek: number;
  /** Roll source. */
  rollFor: (key: string) => number;
}

export interface PropertyTickOutput {
  property: RealEstate;
  /** Realized rent received this week (after vacancy / variance). */
  rentReceived: number;
  /** Notifications for the UI (tenant moved in, moved out, etc.). */
  notifications: { id: string; title: string; message: string }[];
  /** True if the cycle flipped this week (UI can highlight). */
  cycleChanged: boolean;
}

/**
 * Advance one property by one week. Handles cycle evolution, tenant lifecycle,
 * realized rent, vacancy clock. Does NOT touch the mortgage — that's the loan
 * system's job and runs through the legacy weekly tick.
 */
export function tickProperty(input: PropertyTickInput): PropertyTickOutput {
  const p = input.property;
  if (!p.owned) {
    return { property: p, rentReceived: 0, notifications: [], cycleChanged: false };
  }
  const notifications: PropertyTickOutput['notifications'] = [];

  // --- 1) Evolve the neighborhood cycle.
  let cycle: NeighborhoodCycle = (p.marketCycle ?? 'stable') as NeighborhoodCycle;
  let weeksRemaining = safe(p.cycleWeeksRemaining, 26);
  let cycleChanged = false;
  if (weeksRemaining <= 1) {
    const newCycle = nextCycle(cycle, input.rollFor('re.cycle.next'));
    weeksRemaining = sampleCycleDuration(newCycle, input.rollFor('re.cycle.duration'));
    cycleChanged = newCycle !== cycle;
    cycle = newCycle;
    if (cycleChanged) {
      notifications.push({
        id: `re-cycle-${p.id}-${input.currentWeek}`,
        title: '🏘️ Neighborhood Shift',
        message: `${p.name}: market cycle is now "${cycle}".`,
      });
    }
  } else {
    weeksRemaining -= 1;
  }
  const cycleParams = CYCLE_PARAMS[cycle];

  // --- 2) Tenancy + realized rent.
  let updated: RealEstate = {
    ...p,
    marketCycle: cycle,
    cycleWeeksRemaining: weeksRemaining,
  };
  let rentReceived = 0;
  const baseValue = safe(updated.currentValue ?? updated.price);
  const marketRent = baseValue * RENT_MODE_PARAMS[updated.rentMode ?? 'longTerm'].weeklyYieldMean * cycleParams.rentMultiplier;

  if (updated.status === 'rented' && updated.rentMode) {
    const mode = updated.rentMode;
    // Has a tenant?
    if (updated.tenant) {
      // Update satisfaction.
      const newSat = satisfactionStep(
        updated.tenant.satisfaction,
        safe(updated.condition, 70),
        updated.tenant.weeklyRent,
        marketRent,
        mode
      );
      // Roll for move-out.
      const movesOut = input.rollFor(`re.move.${updated.tenant.id}`) < moveOutProbability(newSat, mode);
      if (movesOut) {
        notifications.push({
          id: `re-tenant-leave-${p.id}-${input.currentWeek}`,
          title: '📦 Tenant Moved Out',
          message: `${updated.tenant.name} left ${updated.name}. Property is vacant.`,
        });
        updated = { ...updated, tenant: undefined, weeksVacant: 0 };
      } else {
        rentReceived = realizedWeeklyRent(updated.tenant.weeklyRent, mode, {
          u1: input.rollFor(`re.rent.${updated.tenant.id}.u1`),
          u2: input.rollFor(`re.rent.${updated.tenant.id}.u2`),
        });
        updated = {
          ...updated,
          tenant: { ...updated.tenant, satisfaction: newSat },
        };
      }
    } else {
      // No tenant — try to find one.
      const weeksVacant = safe(updated.weeksVacant, 0) + 1;
      const findProb = findTenantProbability(safe(updated.condition, 70), cycleParams.demandFactor);
      const foundOne = input.rollFor(`re.find.${p.id}`) < findProb;
      if (foundOne) {
        const newTenant: TenantSnapshot = generateTenant(marketRent, input.currentWeek, input.rollFor(`re.name.${p.id}`));
        notifications.push({
          id: `re-tenant-arrive-${p.id}-${input.currentWeek}`,
          title: '🔑 New Tenant',
          message: `${newTenant.name} moved into ${updated.name} at $${Math.round(newTenant.weeklyRent)}/wk.`,
        });
        updated = { ...updated, tenant: newTenant, weeksVacant: 0 };
        // Tenant won't pay for the partial week — we count starting next week.
      } else {
        updated = { ...updated, weeksVacant };
      }
    }
  }

  return { property: updated, rentReceived, notifications, cycleChanged };
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Apply a maintenance pass that restores condition. Cost is computed by the
 * caller; this function just bumps the condition and timestamps it.
 */
export function performMaintenance(
  properties: RealEstate[],
  propertyId: string,
  currentWeek: number,
  newCondition: number = 100
): RealEstate[] {
  return properties.map((p) =>
    p.id === propertyId
      ? { ...p, condition: Math.max(0, Math.min(100, newCondition)), lastMaintenance: currentWeek }
      : p
  );
}

/**
 * Estimated cost to bring a property to 100 condition.
 * Scales with property value so luxury repairs cost more.
 */
export function maintenanceCost(property: RealEstate): number {
  const value = safe(property.currentValue ?? property.price);
  const condition = safe(property.condition, 70);
  const damage = Math.max(0, 100 - condition);
  // 0.1% of value per condition point lost. A $500k home from 50→100 = $250.
  return Math.round((damage / 100) * value * 0.001);
}

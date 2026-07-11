/**
 * Buyable property catalog (data — ground rule #7).
 *
 * Previously the 8-tier residential ladder was inlined in
 * `components/computer/RealEstateApp.tsx`; Browse permanently emptied to "you
 * already own every property" once all 8 were owned, and the `commercial` rent
 * mode + laundering fronts had no inventory to attach to. This module keeps the
 * residential ladder AND adds a commercial/multi-unit tier so late-game has
 * something to buy and commercial mode has real assets.
 *
 * Every entry is a plain `RealEstate` descriptor consumed unchanged by
 * `buyPropertyWithMortgage` (mortgage/DTI preflight still applies) — no new
 * fields, no migration.
 */

import type { RealEstate } from '@/contexts/game/types';

/** True for the commercial/multi-unit tier (photo mapping + copy only). */
export function isCommercialCatalogId(id: string): boolean {
  return COMMERCIAL_CATALOG.some((c) => c.id === id);
}

/** Residential ladder — the original 8 tiers. */
export const RESIDENTIAL_CATALOG: RealEstate[] = [
  { id: 'studio-apt', name: 'Studio Apartment', price: 95_000,    weeklyHappiness: 3, weeklyEnergy: 2, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'city-apt',   name: 'City Apartment',   price: 180_000,   weeklyHappiness: 5, weeklyEnergy: 2, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'duplex',     name: 'Duplex',           price: 320_000,   weeklyHappiness: 6, weeklyEnergy: 3, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'sub-house',  name: 'Suburban House',   price: 480_000,   weeklyHappiness: 8, weeklyEnergy: 4, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'lux-condo',  name: 'Luxury Condo',     price: 850_000,   weeklyHappiness: 10, weeklyEnergy: 5, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'townhouse',  name: 'Brownstone',       price: 1_200_000, weeklyHappiness: 11, weeklyEnergy: 5, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'mansion',    name: 'Mansion',          price: 3_500_000, weeklyHappiness: 15, weeklyEnergy: 7, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'penthouse',  name: 'Penthouse',        price: 8_000_000, weeklyHappiness: 20, weeklyEnergy: 10, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
];

/**
 * Commercial / multi-unit tier. Comfort/energy are 0 — you don't live in a
 * warehouse; the payoff is commercial rent (and optional laundering fronts). The
 * same mortgage/DTI guardrails and the setPropertyRentMode rent ceiling apply.
 */
export const COMMERCIAL_CATALOG: RealEstate[] = [
  { id: 'retail-strip', name: 'Retail Storefront',    price: 620_000,   weeklyHappiness: 0, weeklyEnergy: 0, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'warehouse',    name: 'Warehouse',            price: 980_000,   weeklyHappiness: 0, weeklyEnergy: 0, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'office-suite', name: 'Office Suite',         price: 1_650_000, weeklyHappiness: 0, weeklyEnergy: 0, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'multi-unit',   name: 'Multi-Unit Apartments', price: 2_400_000, weeklyHappiness: 0, weeklyEnergy: 0, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
];

/** Full buyable catalog (residential first, then commercial). */
export const PROPERTY_CATALOG: RealEstate[] = [...RESIDENTIAL_CATALOG, ...COMMERCIAL_CATALOG];

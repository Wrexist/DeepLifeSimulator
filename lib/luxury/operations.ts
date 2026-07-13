/**
 * Luxury & Collectibles — pure helpers (no React, no side effects).
 *
 * Everything here is a pure function of an owned-id list (`GameState.luxuryItems`,
 * a `string[]` of catalog ids). Consumers that hold a full GameState pass
 * `state.luxuryItems`; keeping the surface at the id-list level makes these
 * trivially unit-testable and null-safe for old saves (absent → treated as none).
 *
 * All monetary math is derived from the immutable catalog — nothing here mutates
 * state or touches money. Cash movement happens only in LuxuryActions (canonical
 * money helpers) and the weekly upkeep reducer.
 */

import {
  LUXURY_CATALOG,
  LUXURY_LIFE_MIN_ITEMS,
  LUXURY_LIFE_VALUE_THRESHOLD,
  LUXURY_RESALE_FRACTION,
  type LuxuryItem,
} from './catalog';

/** O(1) id → catalog entry lookup. */
const CATALOG_BY_ID: ReadonlyMap<string, LuxuryItem> = new Map(
  LUXURY_CATALOG.map((item) => [item.id, item]),
);

/** Look up a catalog entry by id (undefined if unknown). */
export function getLuxuryItem(id: string): LuxuryItem | undefined {
  return CATALOG_BY_ID.get(id);
}

/** True if `id` is a real catalog id. */
export function isLuxuryItemId(id: string): boolean {
  return CATALOG_BY_ID.has(id);
}

/**
 * Normalize an owned-id list into deduped, catalog-valid entries.
 * Ignores unknown ids (defensive against corrupt/forward saves) and duplicates.
 */
export function getOwnedLuxuryItems(ownedIds: readonly string[] | undefined | null): LuxuryItem[] {
  if (!ownedIds || ownedIds.length === 0) return [];
  const seen = new Set<string>();
  const out: LuxuryItem[] = [];
  for (const id of ownedIds) {
    if (seen.has(id)) continue;
    const item = CATALOG_BY_ID.get(id);
    if (item) {
      out.push(item);
      seen.add(id);
    }
  }
  return out;
}

/** Whether a specific luxury id is currently owned. */
export function ownsLuxuryItem(ownedIds: readonly string[] | undefined | null, id: string): boolean {
  return !!ownedIds && ownedIds.includes(id);
}

/** Count of distinct owned luxury items. */
export function getOwnedLuxuryCount(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).length;
}

/** Total sticker (purchase) value of owned luxury — the "collection value". */
export function getTotalLuxuryValue(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + item.price, 0);
}

/** Resale value of a single item (rounded). */
export function getLuxuryResaleValue(item: LuxuryItem): number {
  return Math.floor(item.price * LUXURY_RESALE_FRACTION);
}

/**
 * Total resale value of owned luxury — the amount that counts toward net worth
 * (a fraction of sticker, so buying luxury is a sink, never a net-worth exploit).
 */
export function getTotalLuxuryResaleValue(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + getLuxuryResaleValue(item), 0);
}

/** Total weekly upkeep for owned luxury (deducted from stats.money each tick). */
export function getTotalLuxuryUpkeep(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + item.weeklyUpkeep, 0);
}

/** Total weekly happiness benefit from owned luxury. */
export function getTotalLuxuryHappiness(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + item.happiness, 0);
}

/** Total prestige points from owned luxury (feeds the reputation soft target). */
export function getTotalLuxuryPrestige(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + item.prestige, 0);
}

/** Whether `money` can cover the item's price (strict, no negative balances). */
export function canAffordLuxuryItem(money: number | undefined, id: string): boolean {
  const item = CATALOG_BY_ID.get(id);
  if (!item) return false;
  const cash = typeof money === 'number' && isFinite(money) ? money : 0;
  return cash >= item.price;
}

/**
 * The `luxury_life` completion predicate (un-orphans the legacy goal).
 * Completes at LUXURY_LIFE_MIN_ITEMS owned OR LUXURY_LIFE_VALUE_THRESHOLD value.
 * Always returns a strict boolean and is null-safe for old saves.
 */
export function isLuxuryLifeComplete(ownedIds: readonly string[] | undefined | null): boolean {
  const owned = getOwnedLuxuryItems(ownedIds);
  if (owned.length >= LUXURY_LIFE_MIN_ITEMS) return true;
  const value = owned.reduce((sum, item) => sum + item.price, 0);
  return value >= LUXURY_LIFE_VALUE_THRESHOLD;
}

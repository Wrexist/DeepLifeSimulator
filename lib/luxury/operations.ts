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

import type { LuxuryHolding, RealEstate } from '@/contexts/game/types';
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

// ---------------------------------------------------------------------------
// Developable luxury — items that are LAND (STATE_VERSION 24)
// ---------------------------------------------------------------------------
//
// A private island is a place, not a line item. Rather than reimplementing
// building, upgrading, furnishing, maintaining and appreciating it, buying a
// developable item MINTS a real `RealEstate` entry and hands the player the
// whole existing property stack in lib/realEstate/housing.ts.
//
// The link is `LuxuryHolding.propertyId`. These helpers are pure — they build
// the objects; LuxuryActions commits them inside its atomic updater.

/** Stable, collision-proof property id for a developable luxury item. */
export function luxuryPropertyId(itemId: string): string {
  return `luxury_${itemId}`;
}

/**
 * Build the `RealEstate` a developable purchase mints.
 *
 * Deliberately starts UNDEVELOPED — `upgradeLevel: 0`, no rooms, no interior.
 * The island you buy is empty land and a dock; everything on it is something
 * the player then chooses to build, which is where the depth lives.
 *
 * `status: 'owner'` (not `'rented'`) and `currentResidence: false` — owning an
 * island must not silently relocate the player out of their actual home.
 */
export function createLuxuryProperty(
  item: LuxuryItem,
  weeksLived: number,
): RealEstate | null {
  if (!item.developable) return null;
  const week = typeof weeksLived === 'number' && Number.isFinite(weeksLived) && weeksLived >= 0 ? weeksLived : 0;
  return {
    id: luxuryPropertyId(item.id),
    name: item.developable.propertyName,
    // Market value starts at ZERO — see the note in catalog.ts. The land's worth
    // is already counted through the luxury item's resale contribution to net
    // worth; valuing the property too would count one island twice and turn a
    // purchase into a free net-worth gain. What the compound is worth is what
    // the player builds on it.
    price: 0,
    weeklyHappiness: item.developable.baseHappiness,
    weeklyEnergy: 0,
    owned: true,
    interior: [],
    upgradeLevel: 0,
    rooms: [],
    status: 'owner',
    currentResidence: false,
    currentValue: 0,
    purchasePrice: 0,
    purchasedWeek: week,
    condition: 100,
    lastMaintenance: week,
    // Upkeep stays on the LUXURY item (weeklyUpkeep) so the player is never
    // billed twice for the same asset. The property's own upkeep is 0 until
    // they build something that adds one.
    upkeep: 0,
  };
}

/** True when buying this item should mint a property. */
export function isDevelopable(item: LuxuryItem | undefined): boolean {
  return !!item?.developable;
}

/** The property minted by a luxury item, if it exists in `properties`. */
export function findLuxuryProperty(
  properties: readonly RealEstate[] | undefined | null,
  itemId: string,
): RealEstate | undefined {
  if (!Array.isArray(properties)) return undefined;
  const id = luxuryPropertyId(itemId);
  return properties.find((p) => p?.id === id);
}

// ---------------------------------------------------------------------------
// Yield + appreciation — the collection stops being dead capital
// ---------------------------------------------------------------------------
//
// Before this, every luxury item was pure negative yield: pay sticker, lose 40%
// on resale, bleed upkeep forever, receive 1-5 happiness. For a player with $1B
// that is not a decision, it is a formality.
//
// Two additions fix it without turning trophies into investments:
//   YIELD        — weekly cash from charter fees, vintages, dividends. Set below
//                  each item's own upkeep, so a fully owned collection still
//                  costs money to hold; it just stops being a pure drain.
//   APPRECIATION — value drift on the holding. Some things gain (art, watches),
//                  some lose (yachts, jets), which is both truthful and makes
//                  WHICH trophies you buy an actual decision.

/** Total weekly cash produced by an owned collection. */
export function getTotalLuxuryYield(ownedIds: readonly string[] | undefined | null): number {
  return getOwnedLuxuryItems(ownedIds).reduce((sum, item) => sum + (item.yield?.weekly ?? 0), 0);
}

/** Per-item yield lines, for the weekly finance breakdown. */
export function getLuxuryYieldBreakdown(
  ownedIds: readonly string[] | undefined | null,
): { id: string; label: string; weekly: number }[] {
  return getOwnedLuxuryItems(ownedIds)
    .filter((item) => (item.yield?.weekly ?? 0) > 0)
    .map((item) => ({ id: item.id, label: item.yield!.label, weekly: item.yield!.weekly }));
}

/**
 * The current market value of a single holding.
 *
 * Falls back to the catalog price whenever the holding has no tracked value —
 * an item bought before appreciation existed, or one that never appreciates —
 * so this is always safe to call and always returns something sane.
 */
export function getHoldingValue(item: LuxuryItem, holding: LuxuryHolding | undefined): number {
  const tracked = holding?.currentValue;
  return typeof tracked === 'number' && Number.isFinite(tracked) && tracked >= 0 ? tracked : item.price;
}

/**
 * Total resale value of an owned collection, respecting appreciation.
 *
 * This is what net worth should count. `getTotalLuxuryResaleValue` (ids only)
 * stays for callers that have no holdings to hand and remains exactly correct
 * for a collection that has not appreciated.
 */
export function getTotalLuxuryMarketValue(
  ownedIds: readonly string[] | undefined | null,
  holdings: Record<string, LuxuryHolding> | undefined | null,
): number {
  return getOwnedLuxuryItems(ownedIds).reduce(
    (sum, item) => sum + getLuxuryHoldingValue(item, holdings?.[item.id]),
    0,
  );
}

/**
 * What ONE holding is worth — appreciation and condition included.
 *
 * This is the single answer to "what is this item worth", and the sell path and
 * net worth must both use it. They used to disagree: `sellLuxuryItem` paid a
 * flat 60% of the CATALOG price while net worth counted the same item at
 * condition-adjusted `currentValue`, so selling a damaged or depreciated trophy
 * RAISED net worth — one tap, and prestige points with it (100 per $1M). The
 * total above is now a reduce over this function, so the two definitions
 * physically cannot drift apart again. 2026-07-28 audit econ-1.
 */
export function getLuxuryHoldingValue(
  item: LuxuryItem,
  holding: LuxuryHolding | undefined,
): number {
  // Condition discounts the value — a damaged painting is worth less than an
  // undamaged one. Imported lazily to keep the module graph acyclic (risk.ts
  // reads getHoldingValue from here).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { conditionValueMultiplier, getCondition } = require('./risk') as typeof import('./risk');
  const condition = conditionValueMultiplier(getCondition(holding));
  return Math.floor(getHoldingValue(item, holding) * LUXURY_RESALE_FRACTION * condition);
}

export interface AppreciationResult {
  /** Updated holdings. SAME reference when nothing moved (setState-identity safe). */
  holdings: Record<string, LuxuryHolding>;
  /** Net change in market value this week (may be negative). */
  valueDelta: number;
}

/**
 * Advance one week of value drift across an owned collection.
 *
 * Pure: takes holdings, returns holdings. Returns the SAME reference when no
 * owned item appreciates, so the weekly tick does not churn state for the
 * overwhelmingly common case of a player who owns nothing that drifts.
 *
 * Developable items are skipped — their minted property appreciates through the
 * real-estate system, and drifting both would count one island twice.
 */
export function appreciateLuxuryHoldings(
  ownedIds: readonly string[] | undefined | null,
  holdings: Record<string, LuxuryHolding> | undefined | null,
): AppreciationResult {
  const owned = getOwnedLuxuryItems(ownedIds);
  const current = holdings || {};
  let next: Record<string, LuxuryHolding> | null = null;
  let valueDelta = 0;

  for (const item of owned) {
    const ratePct = item.appreciation?.weeklyRatePct;
    if (!ratePct || item.developable) continue;

    const holding = current[item.id];
    const before = getHoldingValue(item, holding);
    // Drift is a percentage of the ORIGINAL price, not of the running value, so
    // gains stay linear instead of compounding into absurdity over a long life.
    const after = Math.max(0, Math.round(before + item.price * (ratePct / 100)));
    if (after === before) continue;

    if (!next) next = { ...current };
    next[item.id] = { ...(holding ?? { acquiredWeek: 0 }), currentValue: after };
    valueDelta += after - before;
  }

  return { holdings: next ?? current, valueDelta };
}

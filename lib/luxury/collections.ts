/**
 * Luxury Collections — completion sets over the existing catalog.
 *
 * ## Why this exists
 *
 * The luxury catalog is the best-designed late-game sink in the repo: $1.22B of
 * purchases, a ~$256k/wk net drain, and yields deliberately held below each
 * item's own upkeep so a trophy never quietly becomes an investment. What it
 * lacked was a *completion meta* — twelve independent purchases with nothing
 * that recognised finishing a set. A player who owned eleven pieces had exactly
 * the same standing as one who owned eleven different pieces.
 *
 * Collections add the long-horizon target the depth audit found missing:
 * something to grind toward that is legible from the moment you own your first
 * item, and that keeps mattering at $500M.
 *
 * ## Design constraints this respects
 *
 * - **No migration.** Membership is derived entirely from `GameState.luxuryItems`
 *   (the existing ownership id list). Nothing new is stored, so there is no
 *   STATE_VERSION bump, no `repairGameState` mirror, and no drift risk.
 * - **No income.** Set bonuses grant *reputation standing* and a *hosting*
 *   multiplier — never weekly cash. Paying out money would break the catalog's
 *   central rule that luxury is a sink, and would hand the late game another
 *   untaxed income stream (which the economy audit flags as already too large).
 * - **Reputation stays a soft target.** The bonus lifts the ceiling the weekly
 *   tick drifts toward; it never pins reputation or grants it outright.
 */

import { LUXURY_CATALOG, LUXURY_REPUTATION_CAP, type LuxuryItem } from './catalog';

export interface LuxuryCollection {
  /** Stable id — safe to persist later if these ever become claimable. */
  id: string;
  /** Display name, and the title the player earns. */
  name: string;
  /** The title shown against the player's profile once complete. */
  title: string;
  emoji: string;
  /** One line explaining the theme. */
  description: string;
  /** Catalog ids that make up the set. */
  itemIds: string[];
  /**
   * Reputation added to the luxury SOFT TARGET while the set is complete.
   * Never granted directly — the weekly tick still drifts toward it a step at a
   * time, exactly as it does for per-item prestige.
   */
  reputationBonus: number;
  /**
   * Multiplier applied to hosting outcomes while complete. 1.0 = no change.
   * Hosting already reads the whole collection, so this rides existing plumbing.
   */
  hostingMultiplier: number;
}

/**
 * Tier sets mirror the catalog's own `tier` field, so they stay correct if an
 * item is retiered — the ids below are derived, not hand-copied.
 */
function idsForTier(tier: LuxuryItem['tier']): string[] {
  return LUXURY_CATALOG.filter((i) => i.tier === tier).map((i) => i.id);
}

/**
 * Thematic sets cut ACROSS tiers on purpose. A player chasing "The Fleet" has to
 * buy a $2.5M supercar and a $500M mega-yacht, so the set pulls them up the
 * price ladder instead of letting them complete everything cheap first.
 */
export const LUXURY_COLLECTIONS: LuxuryCollection[] = [
  {
    id: 'set_entry',
    name: 'First Acquisitions',
    title: 'Collector',
    emoji: '🥉',
    description: 'Every entry-tier piece. The start of a serious collection.',
    itemIds: idsForTier('entry'),
    reputationBonus: 3,
    hostingMultiplier: 1.05,
  },
  {
    id: 'set_premium',
    name: 'The Connoisseur',
    title: 'Connoisseur',
    emoji: '🥈',
    description: 'Every premium-tier piece — taste, not just money.',
    itemIds: idsForTier('premium'),
    reputationBonus: 5,
    hostingMultiplier: 1.1,
  },
  {
    id: 'set_elite',
    name: 'The Elite Holdings',
    title: 'Magnate',
    emoji: '🥇',
    description: 'Every elite-tier asset. People notice.',
    itemIds: idsForTier('elite'),
    reputationBonus: 8,
    hostingMultiplier: 1.15,
  },
  {
    id: 'set_ultra',
    name: 'The Untouchables',
    title: 'Titan',
    emoji: '💠',
    description: 'Every ultra-tier trophy. Fewer than a hundred people alive.',
    itemIds: idsForTier('ultra'),
    reputationBonus: 12,
    hostingMultiplier: 1.25,
  },
  {
    id: 'set_fleet',
    name: 'The Fleet',
    title: 'Commodore',
    emoji: '🛥️',
    description: 'Supercar, yacht, jet and mega-yacht. Never travel commercially again.',
    itemIds: ['supercar', 'luxury_yacht', 'private_jet', 'mega_yacht'],
    reputationBonus: 6,
    hostingMultiplier: 1.1,
  },
  {
    id: 'set_old_money',
    name: 'Old Money',
    title: 'Patron',
    emoji: '🏛️',
    description: 'Art, vineyard, racehorse and penthouse — the quiet kind of rich.',
    itemIds: ['fine_art_collection', 'vineyard_estate', 'racehorse', 'trophy_penthouse'],
    reputationBonus: 6,
    hostingMultiplier: 1.1,
  },
  {
    id: 'set_complete',
    name: 'The Complete Collection',
    title: 'Curator of the Age',
    emoji: '👑',
    description: 'Every piece in the catalog. There is nothing left to buy.',
    itemIds: LUXURY_CATALOG.map((i) => i.id),
    reputationBonus: 20,
    hostingMultiplier: 1.5,
  },
];

export interface CollectionProgress {
  collection: LuxuryCollection;
  /** How many of the set's items are owned. */
  owned: number;
  /** Size of the set. */
  total: number;
  complete: boolean;
  /** Catalog ids in the set that are still missing, in catalog order. */
  missingIds: string[];
}

function ownedSet(ownedIds: readonly string[] | undefined | null): Set<string> {
  return new Set(ownedIds ?? []);
}

/** Progress for one collection. */
export function getCollectionProgress(
  collection: LuxuryCollection,
  ownedIds: readonly string[] | undefined | null
): CollectionProgress {
  const owned = ownedSet(ownedIds);
  const missingIds = collection.itemIds.filter((id) => !owned.has(id));
  return {
    collection,
    owned: collection.itemIds.length - missingIds.length,
    total: collection.itemIds.length,
    // An empty set must never read as "complete" — that would hand out a title
    // for owning nothing if a collection is ever mis-authored.
    complete: collection.itemIds.length > 0 && missingIds.length === 0,
    missingIds,
  };
}

/** Progress for every collection, in display order. */
export function getAllCollectionProgress(
  ownedIds: readonly string[] | undefined | null
): CollectionProgress[] {
  return LUXURY_COLLECTIONS.map((c) => getCollectionProgress(c, ownedIds));
}

/** Just the completed ones. */
export function getCompletedCollections(
  ownedIds: readonly string[] | undefined | null
): LuxuryCollection[] {
  return LUXURY_COLLECTIONS.filter((c) => getCollectionProgress(c, ownedIds).complete);
}

/**
 * The title the player displays — the highest-value completed set, measured by
 * reputation bonus. Undefined until at least one set is complete.
 */
export function getLuxuryTitle(
  ownedIds: readonly string[] | undefined | null
): string | undefined {
  const done = getCompletedCollections(ownedIds);
  if (done.length === 0) return undefined;
  return done.reduce((best, c) => (c.reputationBonus > best.reputationBonus ? c : best)).title;
}

/**
 * Total reputation the completed sets add to the luxury soft target.
 *
 * Bonuses ADD rather than taking the max: completing "The Fleet" as well as the
 * tier sets is meant to be worth something. The result is clamped to the same
 * `LUXURY_REPUTATION_CAP` the per-item path uses, so no combination of sets can
 * push the target past the existing ceiling.
 */
export function getCollectionReputationBonus(
  ownedIds: readonly string[] | undefined | null
): number {
  const total = getCompletedCollections(ownedIds).reduce(
    (sum, c) => sum + c.reputationBonus,
    0
  );
  return Math.min(total, LUXURY_REPUTATION_CAP);
}

/**
 * Combined hosting multiplier from completed sets.
 *
 * Multiplicative, then capped: four completed sets should compound, but a
 * runaway multiplier on an event system is exactly the kind of unbounded
 * late-game scaling the economy audit flags elsewhere. 2.0 is a hard ceiling.
 */
export const MAX_COLLECTION_HOSTING_MULTIPLIER = 2.0;

export function getCollectionHostingMultiplier(
  ownedIds: readonly string[] | undefined | null
): number {
  const product = getCompletedCollections(ownedIds).reduce(
    (mult, c) => mult * c.hostingMultiplier,
    1
  );
  return Math.min(product, MAX_COLLECTION_HOSTING_MULTIPLIER);
}

/**
 * The set closest to completion that is not yet done — the "next target" a UI
 * can point at. Ties break toward the smaller set, so the nudge is always the
 * cheapest real progress available.
 */
export function getNextCollectionTarget(
  ownedIds: readonly string[] | undefined | null
): CollectionProgress | undefined {
  const open = getAllCollectionProgress(ownedIds).filter((p) => !p.complete);
  if (open.length === 0) return undefined;
  return open.reduce((best, p) => {
    if (p.missingIds.length !== best.missingIds.length) {
      return p.missingIds.length < best.missingIds.length ? p : best;
    }
    return p.total < best.total ? p : best;
  });
}

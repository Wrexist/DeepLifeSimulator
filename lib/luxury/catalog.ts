/**
 * Luxury & Collectibles catalog (data — ground rule "data lives in lib/").
 *
 * An aspirational late-game money sink. Each entry is a trophy asset the player
 * buys with in-game cash (`stats.money`), pays a small weekly upkeep to keep,
 * and enjoys a modest happiness + prestige (reputation) benefit while owning.
 *
 * Mirrors the shape of the vehicle/realEstate catalogs (`lib/vehicles/vehicles.ts`,
 * `lib/realEstate/catalog.ts`): a plain descriptor array + a typed interface, no
 * React, no game-state coupling. Ownership is tracked separately as an id list on
 * `GameState.luxuryItems` — the catalog is immutable reference data.
 *
 * Balance intent (see also lib/luxury/operations.ts):
 *  - Prices escalate ~$250k → $500M so there is always a "next" trophy.
 *  - `weeklyUpkeep` is a small fraction of price (~0.03–0.06%/wk) — meaningful
 *    but not instantly bankrupting; the point is a prestige sink, not a trap.
 *  - `happiness` is deliberately small (a late-game comfort, not a stat exploit).
 *  - `prestige` feeds a reputation SOFT TARGET (never an unconditional weekly
 *    rail — see applyLuxuryItemsForWeek), so a full collection lets reputation
 *    drift up to ~84, never pinned to 100 for free.
 */

export interface LuxuryItem {
  /** Stable catalog id — the value stored in GameState.luxuryItems. */
  id: string;
  /** Display name. */
  name: string;
  /** Emoji icon (matches the app's emoji-forward card convention). */
  emoji: string;
  /** Flavor / description shown on the card. */
  description: string;
  /** Purchase price in dollars (deducted from stats.money via the canonical path). */
  price: number;
  /** Weekly upkeep in dollars, deducted from stats.money each weekly tick. */
  weeklyUpkeep: number;
  /** Modest happiness sustained per week while owned (0-100 stat, decays). */
  happiness: number;
  /** Prestige points — contribute to a reputation soft target while owned. */
  prestige: number;
  /** Coarse tier label for grouping / copy. */
  tier: 'entry' | 'premium' | 'elite' | 'ultra';
  /**
   * Set when the item is LAND — buying it mints a real `RealEstate` entry and
   * hands the player the whole existing property stack (upgrade tiers, room
   * additions, decor, condition/maintenance, appreciation) instead of the item
   * being an inert line on a balance sheet.
   *
   * `baseValue` is the property's starting market value, deliberately a
   * FRACTION of the luxury price: the island's price buys the land, and what it
   * is worth as developed property is something you then build.
   */
  developable?: {
    /** Name of the minted property, e.g. "Private Island Compound". */
    propertyName: string;
    /** Weekly happiness the undeveloped property contributes. */
    baseHappiness: number;
  };

  // NOTE ON VALUE: the minted property deliberately starts at a market value of
  // ZERO. The land's worth is already counted by this item's own resale
  // contribution to net worth (LUXURY_RESALE_FRACTION), so giving the property
  // a starting value too would count one island twice — buying it would inflate
  // net worth for free. Starting at zero also states the design honestly: the
  // island is empty land, and the compound is worth exactly what you build on
  // it. Every upgrade, room and furnishing the player pays for raises it from
  // there.
}

/**
 * The buyable catalog, ascending by price. Ids are permanent — do not rename.
 */
export const LUXURY_CATALOG: LuxuryItem[] = [
  {
    id: 'rare_watch_collection',
    name: 'Rare Watch Collection',
    emoji: '⌚',
    description: 'A vault of grail-tier horology — Pateks, an early Daytona, an independent tourbillon.',
    price: 250_000,
    weeklyUpkeep: 120,
    happiness: 1,
    prestige: 2,
    tier: 'entry',
  },
  {
    id: 'museum_diamond',
    name: 'Museum-Grade Diamond',
    emoji: '💎',
    description: 'A flawless certified stone with provenance — the kind that tours exhibitions.',
    price: 600_000,
    weeklyUpkeep: 200,
    happiness: 1,
    prestige: 3,
    tier: 'entry',
  },
  {
    id: 'fine_art_collection',
    name: 'Fine Art Collection',
    emoji: '🖼️',
    description: 'Blue-chip canvases and a sculpture or two. Climate-controlled, insured, admired.',
    price: 1_200_000,
    weeklyUpkeep: 600,
    happiness: 2,
    prestige: 3,
    tier: 'premium',
  },
  {
    id: 'supercar',
    name: 'Hypercar',
    emoji: '🏎️',
    description: 'A limited-run hypercar with your name on the build sheet. Track days optional.',
    price: 2_500_000,
    weeklyUpkeep: 1_400,
    happiness: 2,
    prestige: 4,
    tier: 'premium',
  },
  {
    id: 'racehorse',
    name: 'Thoroughbred Racehorse',
    emoji: '🐎',
    description: 'A stakes-winning bloodline in your silks. The winner\'s circle awaits.',
    price: 6_000_000,
    weeklyUpkeep: 4_500,
    happiness: 2,
    prestige: 5,
    tier: 'premium',
  },
  {
    id: 'vineyard_estate',
    name: 'Vineyard Estate',
    emoji: '🍇',
    description: 'A boutique winery with a chateau, cellars, and a label critics actually rate.',
    price: 15_000_000,
    weeklyUpkeep: 8_000,
    happiness: 3,
    prestige: 6,
    tier: 'elite',
  },
  {
    id: 'luxury_yacht',
    name: 'Luxury Yacht',
    emoji: '🛥️',
    description: 'A 50-metre superyacht with full crew. Monaco in season, Caribbean off it.',
    price: 32_000_000,
    weeklyUpkeep: 20_000,
    happiness: 3,
    prestige: 7,
    tier: 'elite',
  },
  {
    id: 'private_jet',
    name: 'Private Jet',
    emoji: '✈️',
    description: 'An ultra-long-range jet on standby. No lines, no layovers, your schedule only.',
    price: 65_000_000,
    weeklyUpkeep: 42_000,
    happiness: 4,
    prestige: 8,
    tier: 'elite',
  },
  {
    id: 'private_island',
    name: 'Private Island',
    emoji: '🏝️',
    description: 'Your own island — private beaches, a compound, and a dock for the yacht.',
    price: 120_000_000,
    weeklyUpkeep: 60_000,
    happiness: 4,
    prestige: 9,
    tier: 'ultra',
    developable: {
      propertyName: 'Private Island Compound',
      baseHappiness: 4,
    },
  },
  {
    id: 'trophy_penthouse',
    name: 'Trophy Penthouse',
    emoji: '🌇',
    description: 'A full-floor skyline penthouse kept purely as a trophy address.',
    price: 180_000_000,
    weeklyUpkeep: 70_000,
    happiness: 4,
    prestige: 10,
    tier: 'ultra',
  },
  {
    id: 'mega_yacht',
    name: 'Mega-Yacht',
    emoji: '🛳️',
    description: 'A 120-metre floating palace: helipad, submarine, cinema, and a permanent crew of forty.',
    price: 300_000_000,
    weeklyUpkeep: 150_000,
    happiness: 5,
    prestige: 12,
    tier: 'ultra',
  },
  {
    id: 'sports_team_stake',
    name: 'Pro Sports Team Stake',
    emoji: '🏟️',
    description: 'A controlling stake in a major-league franchise. Owner\'s box, forever.',
    price: 500_000_000,
    weeklyUpkeep: 200_000,
    happiness: 5,
    prestige: 15,
    tier: 'ultra',
  },
];

/** Fraction of purchase price recovered on resale + counted toward net worth. */
export const LUXURY_RESALE_FRACTION = 0.6;

/** `luxury_life` completes at N owned items OR the value threshold below. */
export const LUXURY_LIFE_MIN_ITEMS = 3;
/** …or once total (sticker) luxury value reaches this. */
export const LUXURY_LIFE_VALUE_THRESHOLD = 25_000_000;

/** Max reputation the whole collection can drift you toward (safety cap). */
export const LUXURY_REPUTATION_CAP = 100;
/** Reputation gained per week toward the prestige soft target while owned. */
export const LUXURY_REPUTATION_STEP = 1;

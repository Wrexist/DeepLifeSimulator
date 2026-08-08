/**
 * The Dynasty Seat — prestige tier 5, the capstone.
 *
 * ## What it is
 *
 * A permanent estate, bought a wing at a time with MONEY, that survives every
 * death and every prestige. $7B for the whole thing, spread across as many
 * lives as it takes.
 *
 * ## Why this is the capstone and not just another shop
 *
 * Each wing deepens one of the three tiers below it rather than granting a
 * number:
 *
 *   Long Gallery  → the Vault (tier 2) holds three heirlooms instead of one
 *   Counting House→ Endowments (tier 3) pay double, and a fourth tranche opens
 *   Chapter House → two Trials (tier 4) may run at once, and each pays double
 *   Archive       → a fourth tier of Legacy Contracts appears
 *
 * So the reward for the fifth prestige is that the second, third and fourth
 * prestige's systems all get bigger — which is what makes it worth five lives
 * rather than one more purchase. It also means the wings need no new plumbing:
 * every effect lands in a system that already exists and is already surfaced.
 *
 * ## Why money, and why this much
 *
 * Money is wiped at every prestige. Before this, the only thing a late-game
 * player could do with a billion dollars was watch it disappear — the economy
 * audit's finding that no existing cost scales with wealth. The Seat is the
 * one place where money outlives the character, which turns "how much am I
 * about to throw away?" into the decision it should always have been.
 *
 * NEW, not gated: nothing in the game did any of this before. An existing save
 * loses nothing by the Seat existing.
 */

import type { GameState } from '@/contexts/game/types';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import { seatWingIds, withDynasty } from './state';
import type { DynastyState } from '@/contexts/game/types';

/** The prestige capability id gating the whole Seat. */
export const SEAT_FEATURE = 'feature:dynasty_seat';

export interface SeatWing {
  id: string;
  name: string;
  /** What the wing IS, in the fiction. */
  blurb: string;
  /** What it DOES, mechanically. Written for a player. */
  effect: string;
  cost: number;
  /** Wing that must be built first. The Seat is a chain, not a tree. */
  requires?: string;
}

/**
 * Four wings, strictly ordered and escalating ~4x each.
 *
 * A chain rather than a tree on purpose: a tree would let a player buy the
 * cheapest leaf of each branch and never feel the escalation, which is the
 * only thing making this a capstone rather than a menu.
 */
export const SEAT_WINGS: SeatWing[] = [
  {
    id: 'seat_long_gallery',
    name: 'The Long Gallery',
    blurb: 'A hall long enough to hang a life in.',
    effect: 'The Vault holds three heirlooms instead of one.',
    cost: 100_000_000,
  },
  {
    id: 'seat_counting_house',
    name: 'The Counting House',
    blurb: 'Clerks who have outlived four of your ancestors.',
    effect: 'Endowments pay double, and the Sovereign Fund tranche opens.',
    cost: 400_000_000,
    requires: 'seat_long_gallery',
  },
  {
    id: 'seat_chapter_house',
    name: 'The Chapter House',
    blurb: 'Where the family writes down what it will suffer, and why.',
    effect: 'Run two Trials at once, and every Trial pays double.',
    cost: 1_500_000_000,
    requires: 'seat_counting_house',
  },
  {
    id: 'seat_archive',
    name: 'The Archive',
    blurb: 'Every ledger the family has ever kept, in one cold room.',
    effect: 'Opens the Archive Contracts — the longest goals in the game.',
    cost: 5_000_000_000,
    requires: 'seat_chapter_house',
  },
];

const BY_ID = new Map(SEAT_WINGS.map((w) => [w.id, w]));

export function getSeatWing(id: string): SeatWing | undefined {
  return BY_ID.get(id);
}

/** Is this wing built? The single question every other tier asks of the Seat. */
export function hasSeatWing(state: GameState | undefined | null, wingId: string): boolean {
  return seatWingIds(state).includes(wingId);
}

/** Total cost of the whole estate — used by the balance test, and worth stating. */
export function totalSeatCost(): number {
  return SEAT_WINGS.reduce((sum, w) => sum + w.cost, 0);
}

export interface SeatPurchaseResult {
  success: boolean;
  message: string;
  /** Dollars to charge. 0 when the purchase was refused. */
  cost: number;
  /** The new `dynasty` value, when the purchase landed. */
  dynasty?: DynastyState;
}

/**
 * Build a wing.
 *
 * A PURE reducer over state + id, in the same shape as `purchaseLegacyUpgrade`
 * and `claimContract`, so the caller can run it once for the report and again
 * inside the `setGameState` updater against `prev`. Owning the wing is what
 * blocks the second run, and affordability is re-checked from the state passed
 * in — so a double-tap inside one React batch cannot build a wing twice or pay
 * for it twice (§4.4).
 */
export function buySeatWing(
  state: GameState | undefined | null,
  wingId: string
): SeatPurchaseResult {
  const wing = getSeatWing(wingId);
  if (!wing) return { success: false, message: 'Unknown wing.', cost: 0 };

  if (!isPrestigeFeatureUnlocked(state, SEAT_FEATURE)) {
    return { success: false, message: prestigeUnlockRequirement(state, SEAT_FEATURE), cost: 0 };
  }

  const built = seatWingIds(state);
  if (built.includes(wingId)) {
    return { success: false, message: `${wing.name} is already built.`, cost: 0 };
  }

  if (wing.requires && !built.includes(wing.requires)) {
    const parent = getSeatWing(wing.requires);
    return {
      success: false,
      message: `${wing.name} needs ${parent?.name ?? 'an earlier wing'} first.`,
      cost: 0,
    };
  }

  const money = state?.stats?.money;
  const cash = typeof money === 'number' && Number.isFinite(money) ? money : 0;
  if (cash < wing.cost) {
    return {
      success: false,
      message: `${wing.name} costs $${wing.cost.toLocaleString()} — you have $${Math.floor(cash).toLocaleString()}.`,
      cost: 0,
    };
  }

  return {
    success: true,
    message: `${wing.name} is built. It outlives you.`,
    cost: wing.cost,
    dynasty: withDynasty(state, { seatWings: [...built, wingId] }),
  };
}

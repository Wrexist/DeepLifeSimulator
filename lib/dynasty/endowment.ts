/**
 * The Endowment — prestige tier 3.
 *
 * ## The gap
 *
 * Money does not survive a life. Everything a player builds is deleted at
 * prestige, and the only meta-currency the game pays out — Legacy Points — is
 * earned by TIME alone (`floor(weeksLived/10) + prestigeLevel*2`, every ten
 * weeks). So a 900-week pauper and a 900-week trillionaire fund the Dynasty
 * Tree at exactly the same rate, and the last decade of a rich life has no
 * decision in it at all: the money is going to evaporate either way.
 *
 * The Endowment is the first cross-life use for cash. It converts money into
 * Legacy Points, which the Dynasty Tree already spends — so it feeds a sink
 * that exists rather than inventing a second economy.
 *
 * ## Why one-time tranches and not a rate
 *
 * A per-dollar rate is either linear (in which case the late game prints
 * unbounded points and the Tree is bought out in one life) or concave (in which
 * case splitting a donation into a hundred small ones beats making it once,
 * which is a worse exploit AND worse play). Fixed, once-per-id-forever tranches
 * are bounded by construction: 4,210 points total, ever, across every life a
 * player will ever run — against a Dynasty Tree costing ~8,700. Enough to
 * matter, not enough to replace living.
 *
 * That also makes the reducer idempotent. Owning the tranche id is what costs
 * the money, exactly as owning a Legacy Tree node is what costs the points, so
 * running it twice in one React batch cannot pay twice.
 *
 * ## Why the Sovereign Fund is behind the Counting House
 *
 * The fourth tranche costs a billion dollars and is only reachable with the
 * Dynasty Seat's Counting House (tier 5) built. Not to gate an existing thing —
 * it is new here — but so that tier 5's wing has something concrete to open,
 * and so the doubling that wing grants is a genuine reason to hold a tranche
 * back rather than take it the moment it is affordable.
 */

import type { DynastyState, GameState } from '@/contexts/game/types';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import { hasSeatWing, getSeatWing } from './seat';
import { endowmentIds, withDynasty } from './state';

/** The prestige capability id gating the Endowment. */
export const ENDOWMENT_FEATURE = 'feature:endowment';

/** Seat wing that doubles every tranche and opens the fourth. */
export const ENDOWMENT_WING = 'seat_counting_house';

export interface EndowmentTranche {
  id: string;
  name: string;
  description: string;
  /** Dollars. Charged once, ever. */
  cost: number;
  /** Legacy Points paid, before the Counting House multiplier. */
  points: number;
  /** Seat wing required before this tranche is offered at all. */
  requiresWing?: string;
}

export const ENDOWMENT_TRANCHES: EndowmentTranche[] = [
  {
    id: 'endowment_bequest',
    name: 'The Bequest',
    description: 'A line in a will. Small, and the first thing your family ever kept.',
    cost: 1_000_000,
    points: 60,
  },
  {
    id: 'endowment_foundation',
    name: 'The Foundation',
    description: 'Chartered, staffed, and named after you whether you like it or not.',
    cost: 10_000_000,
    points: 250,
  },
  {
    id: 'endowment_institute',
    name: 'The Institute',
    description: 'A building, a board, and a hundred years of running costs paid up front.',
    cost: 100_000_000,
    points: 900,
  },
  {
    id: 'endowment_sovereign',
    name: 'The Sovereign Fund',
    description: 'Large enough that governments ask it for money. Needs the Counting House.',
    cost: 1_000_000_000,
    points: 3_000,
    requiresWing: ENDOWMENT_WING,
  },
];

const BY_ID = new Map(ENDOWMENT_TRANCHES.map((t) => [t.id, t]));

export function getTranche(id: string): EndowmentTranche | undefined {
  return BY_ID.get(id);
}

/** 2 with the Counting House built, 1 without. */
export function endowmentMultiplier(state: GameState | undefined | null): number {
  return hasSeatWing(state, ENDOWMENT_WING) ? 2 : 1;
}

/** Points a tranche would actually pay right now, multiplier included. */
export function tranchePayout(
  state: GameState | undefined | null,
  tranche: EndowmentTranche
): number {
  return tranche.points * endowmentMultiplier(state);
}

/** Every point the whole board can ever pay, at both multipliers. */
export function totalEndowmentPoints(multiplier = 1): number {
  return ENDOWMENT_TRANCHES.reduce((sum, t) => sum + t.points, 0) * multiplier;
}

export interface EndowmentStatus {
  tranche: EndowmentTranche;
  taken: boolean;
  /** The wing it needs is not built — shown as a locked row, not hidden. */
  wingLocked: boolean;
  affordable: boolean;
  /** Points it would pay if taken now. */
  payout: number;
}

export function getEndowmentBoard(state: GameState | undefined | null): EndowmentStatus[] {
  const taken = new Set(endowmentIds(state));
  const money = state?.stats?.money;
  const cash = typeof money === 'number' && Number.isFinite(money) ? money : 0;
  return ENDOWMENT_TRANCHES.map((tranche) => ({
    tranche,
    taken: taken.has(tranche.id),
    wingLocked: Boolean(tranche.requiresWing) && !hasSeatWing(state, tranche.requiresWing as string),
    affordable: cash >= tranche.cost,
    payout: tranchePayout(state, tranche),
  }));
}

export interface EndowmentResult {
  success: boolean;
  message: string;
  /** Dollars to charge. 0 when refused. */
  cost: number;
  /** Legacy Points to pay. 0 when refused. */
  points: number;
  dynasty?: DynastyState;
}

/**
 * Take a tranche.
 *
 * PURE reducer over state + id — run once for the report, again inside the
 * updater against `prev`. The money is debited in the SAME updater that records
 * the tranche and credits the points, so there is no gate-then-grant window
 * (§4.4).
 */
export function claimEndowment(
  state: GameState | undefined | null,
  trancheId: string
): EndowmentResult {
  const tranche = getTranche(trancheId);
  if (!tranche) return { success: false, message: 'Unknown endowment.', cost: 0, points: 0 };

  if (!isPrestigeFeatureUnlocked(state, ENDOWMENT_FEATURE)) {
    return {
      success: false,
      message: prestigeUnlockRequirement(state, ENDOWMENT_FEATURE),
      cost: 0,
      points: 0,
    };
  }

  const taken = endowmentIds(state);
  if (taken.includes(trancheId)) {
    return { success: false, message: `${tranche.name} is already endowed.`, cost: 0, points: 0 };
  }

  if (tranche.requiresWing && !hasSeatWing(state, tranche.requiresWing)) {
    const wing = getSeatWing(tranche.requiresWing);
    return {
      success: false,
      message: `${tranche.name} needs ${wing?.name ?? 'a Dynasty Seat wing'} first.`,
      cost: 0,
      points: 0,
    };
  }

  const money = state?.stats?.money;
  const cash = typeof money === 'number' && Number.isFinite(money) ? money : 0;
  if (cash < tranche.cost) {
    return {
      success: false,
      message: `${tranche.name} costs $${tranche.cost.toLocaleString()} - you have $${Math.floor(cash).toLocaleString()}.`,
      cost: 0,
      points: 0,
    };
  }

  const points = tranchePayout(state, tranche);
  return {
    success: true,
    message: `${tranche.name} endowed - ${points.toLocaleString()} legacy points.`,
    cost: tranche.cost,
    points,
    dynasty: withDynasty(state, { endowments: [...taken, trancheId] }),
  };
}

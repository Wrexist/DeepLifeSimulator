/**
 * Luxury verbs — things you DO with a trophy, not just things you own.
 *
 * Audit D of docs/LUXURY_DEPTH_ROADMAP.md: the verbs on a luxury item were
 * "buy" and "sell", and sell is mistake-undo. That made the most expensive
 * object in the game also the least interactive — a property has eight verbs, a
 * vehicle has seven, a $6M racehorse had none.
 *
 * Three verbs, each reusing something that already exists:
 *
 *   RACE THE HORSE  — an entry fee, a seeded roll against form, a purse and
 *                     reputation on a win, and a record that builds over a life.
 *   TRACK DAY       — take the hypercar out. Reputation and happiness, with a
 *                     real chance of an expensive off.
 *   MUSEUM LOAN     — put the diamond on display. A fee and reputation while it
 *                     is out, and you cannot sell it until it comes back.
 *
 * All outcomes come from `getDeterministicRoll`, so a save reloaded and replayed
 * produces the same result — no reroll-by-reload.
 *
 * Pure module: no React, no state mutation, no RNG state of its own.
 */

import type { GameState, LuxuryHolding } from '@/contexts/game/types';

export type LuxuryVerbId = 'race_horse' | 'track_day' | 'museum_loan';

export interface LuxuryVerb {
  id: LuxuryVerbId;
  /** Catalog item this verb belongs to. */
  itemId: string;
  label: string;
  /** One line of what happens, for the button subtitle. */
  description: string;
  /** Cash it costs to do. */
  cost: number;
  /** Game weeks before it can be done again. */
  cooldownWeeks: number;
  /** Energy spent. Keeps verbs competing with the rest of the week. */
  energyCost: number;
}

export const LUXURY_VERBS: readonly LuxuryVerb[] = [
  {
    id: 'race_horse',
    itemId: 'racehorse',
    label: 'Enter a race',
    description: 'Pay the entry, run your colours, see what happens.',
    cost: 25_000,
    cooldownWeeks: 3,
    energyCost: 10,
  },
  {
    id: 'track_day',
    itemId: 'supercar',
    label: 'Book a track day',
    description: 'A closed circuit and nobody to answer to. Mind the barriers.',
    cost: 8_000,
    cooldownWeeks: 4,
    energyCost: 20,
  },
  {
    id: 'museum_loan',
    itemId: 'museum_diamond',
    label: 'Loan to a museum',
    description: 'Twelve weeks on public display under your name.',
    cost: 0,
    cooldownWeeks: 12,
    energyCost: 0,
  },
] as const;

const VERB_BY_ID = new Map(LUXURY_VERBS.map((v) => [v.id, v]));

export function getLuxuryVerb(id: string): LuxuryVerb | undefined {
  return VERB_BY_ID.get(id as LuxuryVerbId);
}

/** Verbs available for a given catalog item (usually 0 or 1). */
export function verbsForItem(itemId: string): LuxuryVerb[] {
  return LUXURY_VERBS.filter((v) => v.itemId === itemId);
}

/** How long a museum loan runs, in weeks. */
export const MUSEUM_LOAN_WEEKS = 12;
/** Weekly fee paid to the owner while the diamond is on display. */
export const MUSEUM_LOAN_WEEKLY_FEE = 4_000;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface VerbAvailability {
  available: boolean;
  /** Why not, for the disabled button. Absent when available. */
  reason?: string;
  /** Weeks left on the cooldown, 0 when ready. */
  weeksRemaining: number;
}

/**
 * Can the player do this right now?
 *
 * Checks ownership, cooldown, cash and energy in that order, so the reason
 * shown is the most fundamental one rather than whichever check ran first.
 */
export function getVerbAvailability(
  verb: LuxuryVerb,
  state: GameState | null | undefined,
): VerbAvailability {
  const owned = (state?.luxuryItems ?? []).includes(verb.itemId);
  if (!owned) {
    return { available: false, reason: 'You do not own this.', weeksRemaining: 0 };
  }

  const holding = state?.luxuryHoldings?.[verb.itemId];
  const week = num(state?.weeksLived);
  const last = num(holding?.lastActionWeek);
  // `lastActionWeek` absent (0) means never done — only apply a cooldown once
  // the verb has actually been used.
  const elapsed = holding?.lastActionWeek === undefined ? Infinity : week - last;
  const weeksRemaining = Math.max(0, Math.ceil(verb.cooldownWeeks - elapsed));
  if (weeksRemaining > 0) {
    return {
      available: false,
      reason: `Ready in ${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'}.`,
      weeksRemaining,
    };
  }

  if (verb.cost > 0 && num(state?.stats?.money) < verb.cost) {
    return {
      available: false,
      reason: `Costs $${verb.cost.toLocaleString()}.`,
      weeksRemaining: 0,
    };
  }

  if (verb.energyCost > 0 && num(state?.stats?.energy) < verb.energyCost) {
    return { available: false, reason: 'Not enough energy.', weeksRemaining: 0 };
  }

  return { available: true, weeksRemaining: 0 };
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

export interface VerbOutcome {
  /** Did it go well? Drives the toast tone, not whether it "worked". */
  good: boolean;
  /** Net cash change from the outcome, EXCLUDING the entry fee. */
  money: number;
  reputation: number;
  happiness: number;
  /** Player-facing result line. */
  message: string;
  /** Holding fields to merge (record, loan expiry). */
  holdingPatch?: Partial<LuxuryHolding>;
}

/**
 * Race the horse.
 *
 * Win chance improves with the horse's record, so a campaigned horse becomes a
 * better horse — the reason to keep racing rather than doing it once. Capped so
 * it never becomes a money printer: the purse is a multiple of the entry, and
 * the entry is lost on every run that is not a win or a place.
 */
export function resolveRace(roll: number, holding: LuxuryHolding | undefined): VerbOutcome {
  const runs = num(holding?.runs);
  const wins = num(holding?.wins);
  // Form: a record earns up to +15 percentage points on top of a 25% base.
  const formBonus = runs > 0 ? Math.min(15, Math.round((wins / runs) * 30)) : 0;
  const winChance = 25 + formBonus;
  const placeChance = winChance + 25;

  const pct = Math.max(0, Math.min(99.999, roll * 100));
  const nextRecord = { runs: runs + 1, wins: wins + (pct < winChance ? 1 : 0) };

  if (pct < winChance) {
    return {
      good: true,
      money: 90_000,
      reputation: 3,
      happiness: 6,
      message: 'Your colours came home first. The winner\'s enclosure, the photograph, all of it.',
      holdingPatch: nextRecord,
    };
  }
  if (pct < placeChance) {
    return {
      good: true,
      money: 30_000,
      reputation: 1,
      happiness: 2,
      message: 'Placed. Not the photograph, but the prize money covers the entry.',
      holdingPatch: nextRecord,
    };
  }
  return {
    good: false,
    money: 0,
    reputation: 0,
    happiness: -1,
    message: 'Ran unplaced. That is racing.',
    holdingPatch: nextRecord,
  };
}

/**
 * Take the hypercar out.
 *
 * Mostly a good day: reputation and happiness. But there is a real chance of an
 * expensive off, which is what stops this from being a free weekly stat top-up.
 */
export function resolveTrackDay(roll: number): VerbOutcome {
  const pct = Math.max(0, Math.min(99.999, roll * 100));

  if (pct < 8) {
    return {
      good: false,
      money: -120_000,
      reputation: -1,
      happiness: -4,
      message: 'You found the barrier at the exit of turn four. The repair bill is eye-watering.',
    };
  }
  if (pct < 30) {
    return {
      good: true,
      money: 0,
      reputation: 1,
      happiness: 4,
      message: 'A clean, quick day. You never got near the limit and you did not need to.',
    };
  }
  return {
    good: true,
    money: 0,
    reputation: 3,
    happiness: 8,
    message: 'Personal best, and an audience for it. Worth every cent of the car.',
  };
}

/**
 * Put the diamond on display.
 *
 * No roll — a museum loan is an arrangement, not a gamble. The trade is that
 * the stone is unavailable to sell while it is out, which is the cost that
 * makes the fee and the reputation worth something.
 */
export function resolveMuseumLoan(weeksLived: number): VerbOutcome {
  const until = num(weeksLived) + MUSEUM_LOAN_WEEKS;
  return {
    good: true,
    money: 0,
    reputation: 4,
    happiness: 2,
    message: `On display for ${MUSEUM_LOAN_WEEKS} weeks, credited to your collection. It cannot be sold until it returns.`,
    holdingPatch: { loanedUntilWeek: until },
  };
}

/** Is this item currently out on loan (and therefore unsellable)? */
export function isOnLoan(
  holding: LuxuryHolding | undefined,
  weeksLived: number | undefined,
): boolean {
  const until = holding?.loanedUntilWeek;
  if (typeof until !== 'number' || !Number.isFinite(until)) return false;
  return num(weeksLived) < until;
}

/** Weekly fee owed to the player for every item currently on loan. */
export function getLoanIncome(
  ownedIds: readonly string[] | undefined | null,
  holdings: Record<string, LuxuryHolding> | undefined | null,
  weeksLived: number | undefined,
): number {
  if (!ownedIds || !holdings) return 0;
  let total = 0;
  for (const id of ownedIds) {
    if (isOnLoan(holdings[id], weeksLived)) total += MUSEUM_LOAN_WEEKLY_FEE;
  }
  return total;
}

/**
 * Pure travel operations — trip quoting, readiness checks, benefit totals.
 *
 * These functions take inputs and return shapes the caller can apply via
 * `setGameState`. No side effects.
 */

import { GameState, TravelState } from '@/contexts/game/types';
import { DESTINATIONS, TravelDestination } from './destinations';
import { transportationMods } from './transportation';
import { rollTripEvents, summarizeEvents, TravelEventDef } from './events';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface TripQuoteFailure {
  ok: false;
  reason:
    | 'unknown-destination'
    | 'already-traveling'
    | 'needs-passport'
    | 'needs-money'
    | 'needs-happiness';
  message: string;
  needed?: number;
  have?: number;
}

export interface TripQuoteSuccess {
  ok: true;
  destination: TravelDestination;
  baseCost: number;
  baseDuration: number;
  adjustedCost: number;
  adjustedDuration: number;
  returnWeek: number;
  mods: ReturnType<typeof transportationMods>;
}

export type TripQuote = TripQuoteSuccess | TripQuoteFailure;

/**
 * Run all pre-trip checks and produce an applied cost / duration. Caller
 * deducts money and writes `travel.currentTrip` from the result.
 */
export function quoteTrip(
  destinationId: string,
  state: GameState,
  currentWeek: number
): TripQuote {
  const destination = DESTINATIONS.find((d) => d.id === destinationId);
  if (!destination) {
    return { ok: false, reason: 'unknown-destination', message: 'Destination not found' };
  }

  if (state.travel?.currentTrip) {
    return { ok: false, reason: 'already-traveling', message: 'You are already on a trip!' };
  }

  // Passport requirement
  const reqItems = (destination.requirements as any)?.items as string[] | undefined;
  if (reqItems?.includes('passport')) {
    const passportItem = state.items?.find((i: any) => i.id === 'passport');
    const ownsPassport = state.travel?.passportOwned || (passportItem as any)?.owned;
    if (!ownsPassport) {
      return { ok: false, reason: 'needs-passport', message: 'You need a passport to visit this destination' };
    }
  }

  // Stat / money requirement
  const reqMoney = (destination.requirements as any)?.money as number | undefined;
  const reqHappiness = (destination.requirements as any)?.happiness as number | undefined;

  const mods = transportationMods(state);
  const baseCost = safe(destination.cost, 0);
  const adjustedCost = Math.max(0, Math.floor(baseCost * mods.costMultiplier));
  const baseDuration = Math.max(1, safe(destination.duration, 1));
  const adjustedDuration = Math.max(1, Math.ceil(baseDuration * mods.durationMultiplier));

  if (reqMoney && safe(state.stats?.money, 0) < reqMoney) {
    return {
      ok: false,
      reason: 'needs-money',
      message: `Need at least $${reqMoney.toLocaleString()} of cash on hand to visit.`,
      needed: reqMoney,
      have: safe(state.stats?.money, 0),
    };
  }

  if (reqHappiness && safe(state.stats?.happiness, 0) < reqHappiness) {
    return {
      ok: false,
      reason: 'needs-happiness',
      message: `Need ${reqHappiness} happiness to visit.`,
      needed: reqHappiness,
      have: safe(state.stats?.happiness, 0),
    };
  }

  if (safe(state.stats?.money, 0) < adjustedCost) {
    return {
      ok: false,
      reason: 'needs-money',
      message: `Trip costs $${adjustedCost.toLocaleString()} — you have $${safe(state.stats?.money, 0).toLocaleString()}.`,
      needed: adjustedCost,
      have: safe(state.stats?.money, 0),
    };
  }

  return {
    ok: true,
    destination,
    baseCost,
    baseDuration,
    adjustedCost,
    adjustedDuration,
    returnWeek: currentWeek + adjustedDuration,
    mods,
  };
}

/**
 * Is a current trip ready to be ended? Tolerates legacy returnWeek values that
 * were stored as week-of-month (1..4) rather than absolute weeksLived.
 */
export function isTripReady(
  currentTrip: NonNullable<TravelState['currentTrip']> | undefined,
  currentAbsoluteWeek: number
): { ready: boolean; weeksRemaining: number } {
  if (!currentTrip) return { ready: false, weeksRemaining: 0 };
  const returnWeek = safe(currentTrip.returnWeek, 0);
  const effective = returnWeek <= 8 && currentAbsoluteWeek > 8 ? currentAbsoluteWeek : returnWeek;
  if (currentAbsoluteWeek >= effective) return { ready: true, weeksRemaining: 0 };
  return { ready: false, weeksRemaining: effective - currentAbsoluteWeek };
}

export interface TripReturnSummary {
  destination: TravelDestination;
  events: TravelEventDef[];
  /** Sum of destination benefits + event deltas. */
  totals: {
    happinessDelta: number;
    healthDelta: number;
    energyDelta: number;
    stressDelta: number;
    intelligenceDelta: number;
    reputationDelta: number;
    moneyDelta: number;
  };
  firstVisit: boolean;
}

/**
 * Build the full return-from-trip summary: roll travel events, sum benefits,
 * flag first-visit unlock. Caller wires the totals into setGameState.
 */
export function buildTripReturnSummary(
  state: GameState,
  rollFor: (key: string) => number
): TripReturnSummary | null {
  const trip = state.travel?.currentTrip;
  if (!trip) return null;
  const destination = DESTINATIONS.find((d) => d.id === trip.destinationId);
  if (!destination) return null;

  const events = rollTripEvents(safe(destination.cost, 0), rollFor);
  const eventTotals = summarizeEvents(events);

  const benefits = destination.benefits || ({} as TravelDestination['benefits']);
  const firstVisit = !state.travel?.visitedDestinations?.includes(destination.id);

  return {
    destination,
    events,
    totals: {
      happinessDelta: safe(benefits.happiness, 0) + eventTotals.happinessDelta,
      healthDelta: safe(benefits.health, 0) + eventTotals.healthDelta,
      energyDelta: safe(benefits.energy, 0) + eventTotals.energyDelta,
      stressDelta: safe(benefits.stress, 0),
      intelligenceDelta: safe(benefits.intelligence, 0),
      reputationDelta: safe(benefits.reputation, 0),
      moneyDelta: eventTotals.moneyDelta,
    },
    firstVisit,
  };
}

/**
 * Travel events — random things that happen during a trip and resolve on return.
 *
 * Drawn from a fixed pool weighted by destination cost (cheap trips draw common
 * petty events, expensive trips draw more dramatic ones). Caller seeds with
 * `currentWeek + destinationId` so the same trip always rolls the same events.
 *
 * Pure functions.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type TravelEventCategory =
  | 'positive'         // bonus stat gain, found souvenir, met someone interesting
  | 'expense'          // lost wallet, tourist trap, ATM fees
  | 'health'           // food poisoning, twisted ankle, jet lag
  | 'opportunity';     // contact for a business deal, scholarship lead

export interface TravelEventDef {
  id: string;
  category: TravelEventCategory;
  headline: string;
  description: string;
  /** Stat deltas applied on resolution. */
  happinessDelta?: number;
  healthDelta?: number;
  energyDelta?: number;
  /** USD delta applied on resolution. */
  moneyDelta?: number;
  /** Minimum destination cost to be eligible. */
  minTripCost: number;
}

export const TRAVEL_EVENTS: TravelEventDef[] = [
  // Cheap-trip pool
  { id: 'souvenir',     category: 'positive', headline: 'Found a souvenir', description: 'A weekend market trinket made the trip memorable.',     happinessDelta: 3,  minTripCost: 0 },
  { id: 'jet-lag',      category: 'health',   headline: 'Jet lag',         description: 'The flight back wrecked your sleep for a week.',            energyDelta: -10, minTripCost: 1000 },
  { id: 'lost-wallet',  category: 'expense',  headline: 'Lost wallet',     description: 'You misplaced your wallet on the last day.',                 moneyDelta: -200, minTripCost: 500 },
  { id: 'food-poison',  category: 'health',   headline: 'Food poisoning',  description: 'A street-food gamble didn\'t pay off.',                       healthDelta: -8, energyDelta: -5, minTripCost: 0 },
  // Mid-tier
  { id: 'tourist-trap', category: 'expense',  headline: 'Tourist trap',    description: 'The "must-see" ended up costing far more than advertised.', moneyDelta: -800, minTripCost: 2000 },
  { id: 'made-friend',  category: 'positive', headline: 'Made a friend',   description: 'A stranger you met turned out to share your industry.',     happinessDelta: 6,  minTripCost: 1500 },
  { id: 'spa',          category: 'positive', headline: 'Spa day',         description: 'You found an excellent spa and treated yourself.',          happinessDelta: 5, energyDelta: 10, healthDelta: 3, moneyDelta: -300, minTripCost: 1500 },
  // High-end
  { id: 'biz-contact',  category: 'opportunity', headline: 'Business contact', description: 'A dinner conversation turned into a real introduction.', happinessDelta: 4, minTripCost: 3000 },
  { id: 'first-class',  category: 'positive', headline: 'First-class upgrade', description: 'The airline upgraded you on the way home.',             happinessDelta: 8, energyDelta: 5, minTripCost: 3500 },
  { id: 'mugged',       category: 'health',   headline: 'Mugged',          description: 'A bad part of town caught you off guard.',                   healthDelta: -15, moneyDelta: -1500, minTripCost: 3000 },
];

/**
 * Pick 0-2 events that fire on a given trip. Roll source is seeded — caller
 * passes a stable seed (destination id + currentWeek).
 */
export function rollTripEvents(
  tripCost: number,
  rollFor: (key: string) => number
): TravelEventDef[] {
  const eligible = TRAVEL_EVENTS.filter((e) => tripCost >= e.minTripCost);
  if (eligible.length === 0) return [];

  // 60% chance of at least one event, 25% chance of a second.
  const first = rollFor('travel.event.1');
  if (first >= 0.6) return [];
  const firstIdx = Math.floor(rollFor('travel.event.1.idx') * eligible.length);
  const result: TravelEventDef[] = [eligible[firstIdx]];

  const second = rollFor('travel.event.2');
  if (second < 0.25 && eligible.length > 1) {
    const secondIdx = Math.floor(rollFor('travel.event.2.idx') * eligible.length);
    if (eligible[secondIdx]?.id !== result[0]?.id) result.push(eligible[secondIdx]);
  }

  return result;
}

/**
 * Aggregate stat + money deltas across a set of events.
 */
export function summarizeEvents(events: TravelEventDef[]): {
  happinessDelta: number;
  healthDelta: number;
  energyDelta: number;
  moneyDelta: number;
} {
  return events.reduce(
    (acc, e) => ({
      happinessDelta: acc.happinessDelta + safe(e.happinessDelta),
      healthDelta: acc.healthDelta + safe(e.healthDelta),
      energyDelta: acc.energyDelta + safe(e.energyDelta),
      moneyDelta: acc.moneyDelta + safe(e.moneyDelta),
    }),
    { happinessDelta: 0, healthDelta: 0, energyDelta: 0, moneyDelta: 0 }
  );
}

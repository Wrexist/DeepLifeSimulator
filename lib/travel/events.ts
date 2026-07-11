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
  /**
   * When set, this is a CURATED, destination-specific event: it is eligible only
   * for the destination whose id matches (in addition to the cost gate). Events
   * with no `destinationId` are the generic cost-tier pool that any trip can draw.
   * The ids here are the ones already referenced by `TravelDestination.events`.
   */
  destinationId?: string;
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

  // === Destination-flavored pool ===============================================
  // Curated events referenced by DESTINATIONS[].events. Deltas stay inside the
  // generic band; each fires ONLY for its destination (see eligibleTripEvents).
  // London
  { id: 'london_theatre', category: 'positive', headline: 'West End show', description: 'You landed last-minute stalls seats to a dazzling West End production.', happinessDelta: 6, minTripCost: 0, destinationId: 'london' },
  { id: 'london_museum',  category: 'positive', headline: 'British Museum', description: 'A slow afternoon among the antiquities left you inspired.',            happinessDelta: 4, energyDelta: -3, minTripCost: 0, destinationId: 'london' },
  // Dubai
  { id: 'dubai_luxury',        category: 'expense',  headline: 'Gold-souk splurge', description: 'The shopping got gloriously out of hand in the Gold Souk.',        happinessDelta: 4, moneyDelta: -700, minTripCost: 0, destinationId: 'dubai' },
  { id: 'dubai_desert_safari', category: 'positive', headline: 'Desert safari',     description: 'Dune-bashing and a starlit dinner in the dunes — unforgettable.',   happinessDelta: 7, energyDelta: -4, minTripCost: 0, destinationId: 'dubai' },
  // Rome
  { id: 'rome_colosseum', category: 'positive', headline: 'Colosseum tour',  description: 'Standing where gladiators once fought gave you chills.',          happinessDelta: 5, minTripCost: 0, destinationId: 'rome' },
  { id: 'rome_romance',   category: 'positive', headline: 'La dolce vita',   description: 'An unforgettable evening of gelato and the Trevi Fountain.',      happinessDelta: 6, minTripCost: 0, destinationId: 'rome' },
  // Thailand
  { id: 'thailand_temple',    category: 'positive', headline: 'Temple blessing',  description: 'A monk\'s blessing at dawn left you calm and centered.',            happinessDelta: 5, healthDelta: 3, minTripCost: 0, destinationId: 'thailand' },
  { id: 'thailand_full_moon', category: 'expense',  headline: 'Full-moon party',  description: 'A wild beach party you only half remember the morning after.',      happinessDelta: 6, energyDelta: -8, moneyDelta: -200, minTripCost: 0, destinationId: 'thailand' },
  // Sydney
  { id: 'sydney_surf',     category: 'health',   headline: 'Bondi surf lesson', description: 'You wiped out a dozen times, then finally caught a wave.',        happinessDelta: 5, healthDelta: 4, energyDelta: -5, minTripCost: 0, destinationId: 'sydney' },
  { id: 'sydney_wildlife', category: 'positive', headline: 'Koala encounter',   description: 'A wildlife sanctuary let you hand-feed a kangaroo. Made your day.',happinessDelta: 5, minTripCost: 0, destinationId: 'sydney' },
  // Iceland
  { id: 'iceland_northern_lights', category: 'positive', headline: 'Northern lights', description: 'The aurora blazed green across the whole sky. Speechless.',  happinessDelta: 8, minTripCost: 0, destinationId: 'iceland' },
  // Safari
  { id: 'safari_lion',   category: 'positive', headline: 'Lion pride sighting', description: 'A whole pride crossed the track metres from the jeep.',          happinessDelta: 7, minTripCost: 0, destinationId: 'safari' },
  { id: 'safari_sunset', category: 'positive', headline: 'Savanna sunset',      description: 'Sundowners as the sun sank over the Serengeti — pure magic.',     happinessDelta: 5, minTripCost: 0, destinationId: 'safari' },
  // Maldives
  { id: 'maldives_diving', category: 'health',   headline: 'Reef dive',          description: 'A technicolor coral wall dive you\'ll never forget.',            happinessDelta: 6, healthDelta: 3, minTripCost: 0, destinationId: 'maldives' },
  { id: 'maldives_sunset', category: 'positive', headline: 'Overwater sunset',   description: 'Dinner served above a glassy, mirror-still lagoon.',              happinessDelta: 6, minTripCost: 0, destinationId: 'maldives' },
];

/**
 * Resolve the pool of events a given trip may draw from: the generic cost-tier
 * events PLUS the curated events authored for this specific destination.
 *
 * This is the single source of truth shared by `rollTripEvents` (the on-return
 * roll) and the detail-screen "What could happen" preview, so the preview can
 * never drift from what actually rolls.
 */
export function eligibleTripEvents(tripCost: number, destinationId?: string): TravelEventDef[] {
  return TRAVEL_EVENTS.filter((e) => {
    if (tripCost < e.minTripCost) return false;
    // Curated events are eligible only for their own destination.
    if (e.destinationId) return e.destinationId === destinationId;
    return true;
  });
}

/**
 * Pick 0-2 events that fire on a given trip. Roll source is seeded — caller
 * passes a stable seed (destination id + currentWeek). When `destinationId` is
 * supplied, the destination's curated events join the generic cost-tier pool.
 */
export function rollTripEvents(
  tripCost: number,
  rollFor: (key: string) => number,
  destinationId?: string
): TravelEventDef[] {
  const eligible = eligibleTripEvents(tripCost, destinationId);
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

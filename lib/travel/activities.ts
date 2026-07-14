/**
 * Travel activities — things the player can DO while on a trip.
 *
 * A destination trip used to be book → wait → return. This adds an optional
 * in-trip loop: a catalog of activities (sightseeing, local cuisine, adventure
 * excursions, cultural tours, nightlife, souvenir shopping, relaxation) that the
 * player can do WHILE at the destination for a money + energy cost in exchange
 * for a bounded happiness / health / reputation lift and a souvenir memory.
 *
 * Design guardrails (a fun spend, NOT a stat farm):
 *   - Gated to being on a trip (`travel.currentTrip`) and, for curated ones, to
 *     the matching destination — exactly like `events.ts`'s curated pool.
 *   - Each activity is doable ONCE per trip (the natural cooldown), tracked in
 *     `currentTrip.activitiesDone`. Because a trip is short and clears on return,
 *     the per-trip happiness lift is bounded and can't be ground in place.
 *   - Costs real cash (canonical MoneyActions path in the action layer) and real
 *     energy, so it competes with everything else for the same budget.
 *
 * Pure data + pure evaluators. No side effects, no wall-clock. The React-aware
 * `doTravelActivity` wrapper in TravelActions.ts applies the charge + effects.
 */

import { GameState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type TravelActivityCategory =
  | 'sightseeing'
  | 'cuisine'
  | 'adventure'
  | 'culture'
  | 'nightlife'
  | 'shopping'
  | 'relaxation';

export interface TravelActivityEffects {
  /** Happiness gained — the point of the activity (always > 0). */
  happiness?: number;
  /** Health delta (spa/hike heal a little; nightlife dings it). */
  health?: number;
  /** Energy RESTORED (relaxation only). The energy COST is `energyCost`. */
  energy?: number;
  /** Small reputation / experience gain (broadens the mind, tell friends). */
  reputation?: number;
}

export interface TravelActivity {
  id: string;
  name: string;
  description: string;
  category: TravelActivityCategory;
  /** USD spent, >= 0. Charged via the canonical money path in the action layer. */
  cost: number;
  /** Energy consumed to do it, >= 0. Gated: you can't do it below this energy. */
  energyCost: number;
  /** Stat rewards applied on completion. */
  effects: TravelActivityEffects;
  /** Flavor souvenir/memory shown on completion. */
  souvenir?: string;
  /**
   * When set, this activity is CURATED for one destination and is offered only
   * there (e.g. a safari game drive, an alpine ski day). Activities with no
   * `destinationId` are the generic pool offered on ANY trip.
   */
  destinationId?: string;
}

/**
 * Activity catalog. Generic entries (no `destinationId`) are offered on every
 * trip; curated entries only at their destination. Effects stay in the same
 * bounded band as a single travel event so a trip's total lift is modest.
 */
export const TRAVEL_ACTIVITIES: TravelActivity[] = [
  // ── Generic pool (any destination) ─────────────────────────────────────────
  {
    id: 'sightseeing',
    name: 'City Sightseeing',
    description: 'Wander the landmarks, snap photos, soak in the sights.',
    category: 'sightseeing',
    cost: 60,
    energyCost: 8,
    effects: { happiness: 6, reputation: 1 },
    souvenir: 'A roll of postcard-perfect photos.',
  },
  {
    id: 'local_cuisine',
    name: 'Local Cuisine Tasting',
    description: 'Eat your way through the local specialties and street food.',
    category: 'cuisine',
    cost: 90,
    energyCost: 5,
    effects: { happiness: 7, health: 2 },
    souvenir: 'A new favorite dish you keep talking about.',
  },
  {
    id: 'adventure_excursion',
    name: 'Adventure Excursion',
    description: 'A guided outdoor thrill — zip-lines, rapids, or a summit hike.',
    category: 'adventure',
    cost: 220,
    energyCost: 24,
    effects: { happiness: 11, health: 4, reputation: 2 },
    souvenir: 'A GoPro clip your friends refuse to believe.',
  },
  {
    id: 'cultural_tour',
    name: 'Cultural Tour',
    description: 'A museum-and-history walking tour with a sharp local guide.',
    category: 'culture',
    cost: 110,
    energyCost: 10,
    effects: { happiness: 6, reputation: 3 },
    souvenir: 'A head full of stories and a signed guidebook.',
  },
  {
    id: 'nightlife',
    name: 'Night Out',
    description: 'Hit the bars, clubs, and rooftop lounges until late.',
    category: 'nightlife',
    cost: 180,
    energyCost: 22,
    effects: { happiness: 10, health: -3 },
    souvenir: 'A blurry group photo and a slight headache.',
  },
  {
    id: 'souvenir_shopping',
    name: 'Souvenir Shopping',
    description: 'Trawl the markets for keepsakes, crafts, and gifts.',
    category: 'shopping',
    cost: 150,
    energyCost: 6,
    effects: { happiness: 8 },
    souvenir: 'A suitcase of trinkets for everyone back home.',
  },
  {
    id: 'spa_relaxation',
    name: 'Spa & Relaxation',
    description: 'A slow day of massages, saunas, and doing absolutely nothing.',
    category: 'relaxation',
    cost: 200,
    energyCost: 0,
    effects: { happiness: 7, health: 4, energy: 18 },
    souvenir: 'The most relaxed you have felt in years.',
  },

  // ── Curated pool (destination-flavored) ────────────────────────────────────
  {
    id: 'safari_game_drive',
    name: 'Big Five Game Drive',
    description: 'Dawn jeep drive tracking lions, elephants, and rhino.',
    category: 'adventure',
    cost: 400,
    energyCost: 18,
    effects: { happiness: 14, reputation: 4 },
    souvenir: 'A once-in-a-lifetime photo of a lion at ten metres.',
    destinationId: 'safari',
  },
  {
    id: 'alps_ski_day',
    name: 'Alpine Ski Day',
    description: 'A full day carving fresh powder on the high pistes.',
    category: 'adventure',
    cost: 320,
    energyCost: 26,
    effects: { happiness: 12, health: 6 },
    souvenir: 'Rosy cheeks and a lift pass you kept as a bookmark.',
    destinationId: 'swiss_alps',
  },
  {
    id: 'tokyo_omakase',
    name: 'Omakase Sushi Counter',
    description: "Sit at the chef's counter for a wordless masterclass in sushi.",
    category: 'cuisine',
    cost: 280,
    energyCost: 4,
    effects: { happiness: 11, health: 3, reputation: 2 },
    souvenir: 'A new benchmark for what sushi can be.',
    destinationId: 'tokyo',
  },
  {
    id: 'paris_wine_tasting',
    name: 'Vineyard Wine Tasting',
    description: 'A sommelier-led tasting flight through French classics.',
    category: 'cuisine',
    cost: 240,
    energyCost: 6,
    effects: { happiness: 10, reputation: 3 },
    souvenir: 'A signed bottle you are saving for something special.',
    destinationId: 'paris',
  },
  {
    id: 'dubai_skydive',
    name: 'Skydive over the Palm',
    description: 'Freefall above the Palm Jumeirah with the coast wheeling below.',
    category: 'adventure',
    cost: 600,
    energyCost: 20,
    effects: { happiness: 15, reputation: 5 },
    souvenir: 'A jump certificate and the best adrenaline of your life.',
    destinationId: 'dubai',
  },
  {
    id: 'maldives_scuba',
    name: 'Reef Scuba Dive',
    description: 'A guided dive along a technicolor coral wall and manta cleaning station.',
    category: 'adventure',
    cost: 350,
    energyCost: 16,
    effects: { happiness: 12, health: 5 },
    souvenir: 'A logbook stamp and the memory of a passing manta ray.',
    destinationId: 'maldives',
  },
  {
    id: 'rome_food_tour',
    name: 'Trastevere Food Tour',
    description: 'Cacio e pepe, supplì, and gelato across the old quarter.',
    category: 'cuisine',
    cost: 130,
    energyCost: 8,
    effects: { happiness: 9, health: 2, reputation: 2 },
    souvenir: 'A little notebook of trattorias only locals know.',
    destinationId: 'rome',
  },
  {
    id: 'iceland_hot_springs',
    name: 'Geothermal Hot Springs',
    description: 'Soak in a steaming lagoon while snow falls around you.',
    category: 'relaxation',
    cost: 160,
    energyCost: 0,
    effects: { happiness: 9, health: 5, energy: 20 },
    souvenir: 'Skin like silk and a photo wreathed in steam.',
    destinationId: 'iceland',
  },
];

/**
 * The activities a given trip may offer: the generic pool PLUS the curated
 * activities authored for this specific destination. Single source of truth
 * shared by the UI list and `quoteActivity`, so they can never drift.
 */
export function activitiesForDestination(destinationId: string | undefined): TravelActivity[] {
  return TRAVEL_ACTIVITIES.filter((a) =>
    a.destinationId ? a.destinationId === destinationId : true
  );
}

export function getActivity(activityId: string): TravelActivity | undefined {
  return TRAVEL_ACTIVITIES.find((a) => a.id === activityId);
}

/** Net energy delta an activity applies: restore (effects.energy) minus its cost. */
export function netActivityEnergy(activity: TravelActivity): number {
  return safe(activity.effects.energy, 0) - safe(activity.energyCost, 0);
}

export type ActivityQuoteFailure = {
  ok: false;
  reason:
    | 'unknown-activity'
    | 'not-traveling'
    | 'wrong-destination'
    | 'already-done'
    | 'needs-money'
    | 'needs-energy';
  message: string;
  activity?: TravelActivity;
};

export type ActivityQuoteSuccess = {
  ok: true;
  activity: TravelActivity;
  /** Signed energy delta to apply (negative = net drain, positive = net gain). */
  netEnergy: number;
};

export type ActivityQuote = ActivityQuoteSuccess | ActivityQuoteFailure;

/**
 * Run all pre-activity checks against the current state. Pure — the caller
 * (doTravelActivity) re-checks the money/energy/already-done gates inside its
 * guarded updater so a double-tap can't double-charge.
 */
export function quoteActivity(activityId: string, state: GameState): ActivityQuote {
  const activity = getActivity(activityId);
  if (!activity) {
    return { ok: false, reason: 'unknown-activity', message: 'Activity not found.' };
  }

  const trip = state.travel?.currentTrip;
  if (!trip) {
    return {
      ok: false,
      reason: 'not-traveling',
      message: 'You can only do this while on a trip.',
      activity,
    };
  }

  if (activity.destinationId && activity.destinationId !== trip.destinationId) {
    return {
      ok: false,
      reason: 'wrong-destination',
      message: 'This activity is only available at another destination.',
      activity,
    };
  }

  const done = trip.activitiesDone ?? [];
  if (done.includes(activity.id)) {
    return {
      ok: false,
      reason: 'already-done',
      message: 'You already did this on this trip.',
      activity,
    };
  }

  const money = safe(state.stats?.money, 0);
  if (money < activity.cost) {
    return {
      ok: false,
      reason: 'needs-money',
      message: `Costs $${activity.cost.toLocaleString()} — you have $${Math.floor(money).toLocaleString()}.`,
      activity,
    };
  }

  const energy = safe(state.stats?.energy, 0);
  if (energy < activity.energyCost) {
    return {
      ok: false,
      reason: 'needs-energy',
      message: `Needs ${activity.energyCost} energy — you have ${Math.floor(energy)}.`,
      activity,
    };
  }

  return { ok: true, activity, netEnergy: netActivityEnergy(activity) };
}

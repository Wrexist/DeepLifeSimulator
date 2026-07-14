import {
  TRAVEL_ACTIVITIES,
  TravelActivityCategory,
  activitiesForDestination,
  getActivity,
  netActivityEnergy,
  quoteActivity,
} from '../activities';
import { DESTINATIONS } from '../destinations';
import { GameState } from '@/contexts/game/types';

const CATEGORIES: TravelActivityCategory[] = [
  'sightseeing',
  'cuisine',
  'adventure',
  'culture',
  'nightlife',
  'shopping',
  'relaxation',
];

/** Minimal GameState-as-any on a safari trip with plenty of money + energy. */
function base(over: Partial<any> = {}): GameState {
  return {
    stats: { money: 100_000, energy: 100, happiness: 50, health: 80, reputation: 10 },
    travel: {
      currentTrip: { destinationId: 'safari', returnWeek: 12, startWeek: 10, activitiesDone: [] },
      visitedDestinations: [],
      passportOwned: true,
      businessOpportunities: {},
      travelHistory: [],
    },
    weeksLived: 10,
    ...over,
  } as any;
}

describe('TRAVEL_ACTIVITIES catalog integrity', () => {
  it('has unique ids', () => {
    const ids = TRAVEL_ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every activity has a valid category, non-negative costs, and a happiness payoff', () => {
    for (const a of TRAVEL_ACTIVITIES) {
      expect(CATEGORIES).toContain(a.category);
      expect(a.cost).toBeGreaterThanOrEqual(0);
      expect(a.energyCost).toBeGreaterThanOrEqual(0);
      // The point of an activity is a happiness lift.
      expect(a.effects.happiness ?? 0).toBeGreaterThan(0);
      // Bounded (a fun spend, not a farm): no single activity beats a big trip.
      expect(a.effects.happiness ?? 0).toBeLessThanOrEqual(20);
    }
  });

  it('has a healthy generic pool and several curated activities', () => {
    const generic = TRAVEL_ACTIVITIES.filter((a) => !a.destinationId);
    const curated = TRAVEL_ACTIVITIES.filter((a) => a.destinationId);
    expect(generic.length).toBeGreaterThanOrEqual(7);
    expect(curated.length).toBeGreaterThanOrEqual(5);
  });

  it('curated activities reference real destinations', () => {
    const destIds = new Set(DESTINATIONS.map((d) => d.id));
    for (const a of TRAVEL_ACTIVITIES) {
      if (a.destinationId) expect(destIds.has(a.destinationId)).toBe(true);
    }
  });
});

describe('activitiesForDestination', () => {
  it('offers the generic pool plus that destination’s curated activities only', () => {
    const forSafari = activitiesForDestination('safari');
    expect(forSafari.some((a) => a.id === 'safari_game_drive')).toBe(true);
    // A curated activity for another destination must NOT appear.
    expect(forSafari.some((a) => a.id === 'alps_ski_day')).toBe(false);
    // All generic activities appear.
    const generic = TRAVEL_ACTIVITIES.filter((a) => !a.destinationId);
    for (const g of generic) expect(forSafari.some((a) => a.id === g.id)).toBe(true);
  });

  it('offers only generic activities for an unknown/undefined destination', () => {
    const forNone = activitiesForDestination(undefined);
    expect(forNone.every((a) => !a.destinationId)).toBe(true);
    expect(forNone.length).toBe(TRAVEL_ACTIVITIES.filter((a) => !a.destinationId).length);
  });
});

describe('netActivityEnergy', () => {
  it('is negative for a draining excursion', () => {
    const a = getActivity('adventure_excursion')!;
    expect(netActivityEnergy(a)).toBe(-(a.energyCost)); // no restore
    expect(netActivityEnergy(a)).toBeLessThan(0);
  });

  it('is positive for a restorative relaxation activity', () => {
    const spa = getActivity('spa_relaxation')!;
    expect(netActivityEnergy(spa)).toBe((spa.effects.energy ?? 0) - spa.energyCost);
    expect(netActivityEnergy(spa)).toBeGreaterThan(0);
  });
});

describe('quoteActivity gating', () => {
  it('rejects an unknown activity', () => {
    const r = quoteActivity('does-not-exist', base());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown-activity');
  });

  it('rejects when not on a trip', () => {
    const s = base();
    (s.travel as any).currentTrip = undefined;
    const r = quoteActivity('sightseeing', s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-traveling');
  });

  it('rejects a curated activity at the wrong destination', () => {
    // On a safari trip, the alpine ski day is unavailable.
    const r = quoteActivity('alps_ski_day', base());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrong-destination');
  });

  it('rejects an activity already done this trip (cooldown)', () => {
    const s = base();
    (s.travel as any).currentTrip.activitiesDone = ['sightseeing'];
    const r = quoteActivity('sightseeing', s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already-done');
  });

  it('rejects when the player cannot afford the money cost', () => {
    const s = base({ stats: { money: 0, energy: 100 } });
    const r = quoteActivity('souvenir_shopping', s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs-money');
  });

  it('rejects when the player lacks the energy cost', () => {
    const s = base({ stats: { money: 100_000, energy: 0 } });
    const r = quoteActivity('adventure_excursion', s); // energyCost > 0
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs-energy');
  });

  it('accepts an affordable generic activity and reports net energy', () => {
    const r = quoteActivity('sightseeing', base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.activity.id).toBe('sightseeing');
      expect(r.netEnergy).toBe(netActivityEnergy(r.activity));
    }
  });

  it('accepts a curated activity at its matching destination', () => {
    const r = quoteActivity('safari_game_drive', base());
    expect(r.ok).toBe(true);
  });
});
